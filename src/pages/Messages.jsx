import { useState, useEffect, useRef } from "react";
import { supabase } from "../supabaseClient";

export default function Messages({ isAdmin, session }) {
  const [channels, setChannels] = useState([]); // List of users to chat with + Broadcast
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [selectedChannel, setSelectedChannel] = useState(null); // 'broadcast' or an st_id
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef(null);

  // Debounce search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  const fetchChannels = async (pageNum, isLoadMore = false) => {
    if (!session.stId) return;
    setLoadingChannels(true);
    
    let loadedChannels = [];
    
    // Everyone sees the Broadcast channel on the first page
    if (pageNum === 0 && (!debouncedSearch || "📢 announcements (all)".includes(debouncedSearch.toLowerCase()))) {
      loadedChannels.push({
        id: "broadcast",
        name: "📢 Announcements (All)",
        isBroadcast: true
      });
    }

    let moreAvailable = false;
    const PAGE_SIZE = 5;
    const start = pageNum * PAGE_SIZE;
    const end = start + PAGE_SIZE - 1;

    if (isAdmin) {
      // Staff see all members
      let query = supabase
        .from("members")
        .select("st_id, name", { count: "exact" })
        .order("name")
        .range(start, end);
        
      if (debouncedSearch) {
        query = query.ilike("name", `%${debouncedSearch}%`);
      }

      const { data: members, count, error } = await query;
      if (!error && members) {
        loadedChannels = [
          ...loadedChannels,
          ...members.map(m => ({
            id: m.st_id,
            name: `${m.name} (${m.st_id})`,
            isBroadcast: false
          }))
        ];
        moreAvailable = start + PAGE_SIZE < count;
      }
    } else {
      // Members see staff members to chat with
      let query = supabase
        .from("profiles")
        .select("st_id, full_name, role", { count: "exact" })
        .in("role", ["admin", "editor"])
        .not("st_id", "is", null)
        .range(start, end);

      if (debouncedSearch) {
        query = query.ilike("full_name", `%${debouncedSearch}%`);
      }

      const { data: staffProfiles, count, error } = await query;
      if (!error && staffProfiles) {
        const uniqueStaff = [];
        const seenIds = new Set();
        for (const staff of staffProfiles) {
          if (!seenIds.has(staff.st_id)) {
            seenIds.add(staff.st_id);
            uniqueStaff.push(staff);
          }
        }
        loadedChannels = [
          ...loadedChannels,
          ...uniqueStaff.map(s => ({
            id: s.st_id,
            name: `🛡️ ${s.full_name} (${s.role})`,
            isBroadcast: false
          }))
        ];
        moreAvailable = start + PAGE_SIZE < count;
      }
    }

    if (isLoadMore) {
      setChannels(prev => {
        // Deduplicate in case of race conditions
        const prevIds = new Set(prev.map(c => c.id));
        return [...prev, ...loadedChannels.filter(c => !prevIds.has(c.id))];
      });
    } else {
      setChannels(loadedChannels);
      if (pageNum === 0 && !selectedChannel) {
        setSelectedChannel("broadcast");
      }
    }
    
    setHasMore(moreAvailable);
    setLoadingChannels(false);
  };

  useEffect(() => {
    if (session.stId) {
      setPage(0);
      fetchChannels(0, false);
    }
  }, [isAdmin, session.stId, debouncedSearch]);

  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchChannels(nextPage, true);
  };

  useEffect(() => {
    if (!selectedChannel || !session.stId) return;

    let isMounted = true;
    
    // Fetch initial messages for the selected channel
    const loadMessages = async () => {
      let query = supabase
        .from("messages")
        .select(`
          id, content, created_at, sender_st_id, receiver_st_id,
          sender:sender_st_id (name)
        `)
        .order("created_at", { ascending: true });

      if (selectedChannel === "broadcast") {
        query = query.is("receiver_st_id", null);
      } else {
        // Direct messages between current user and selected user
        query = query.or(
          `and(sender_st_id.eq.${session.stId},receiver_st_id.eq.${selectedChannel}),` +
          `and(sender_st_id.eq.${selectedChannel},receiver_st_id.eq.${session.stId})`
        );
      }

      const { data, error } = await query;
      if (error) {
        console.error("Error loading messages:", error);
      } else if (isMounted) {
        setMessages(data || []);
        scrollToBottom();
      }
    };

    loadMessages();

    // Setup Realtime subscription for new messages
    const channelName = `messages-${selectedChannel}`;
    const subscription = supabase
      .channel(channelName)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'messages' 
      }, payload => {
        const newMsg = payload.new;
        
        // Check if the new message belongs to the currently selected view
        let belongsToCurrentView = false;
        
        if (selectedChannel === "broadcast" && newMsg.receiver_st_id === null) {
          belongsToCurrentView = true;
        } else if (
          selectedChannel !== "broadcast" &&
          ((newMsg.sender_st_id === session.stId && newMsg.receiver_st_id === selectedChannel) ||
           (newMsg.sender_st_id === selectedChannel && newMsg.receiver_st_id === session.stId))
        ) {
          belongsToCurrentView = true;
        }

        if (belongsToCurrentView) {
          // We need to fetch the sender name since payload.new doesn't join foreign keys
          supabase
            .from("members")
            .select("name")
            .eq("st_id", newMsg.sender_st_id)
            .maybeSingle()
            .then(({ data }) => {
              if (isMounted) {
                const enrichedMsg = {
                  ...newMsg,
                  sender: data || { name: newMsg.sender_st_id }
                };
                setMessages(prev => [...prev, enrichedMsg]);
                scrollToBottom();
              }
            });
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(subscription);
    };
  }, [selectedChannel, session.stId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
      }
    }, 100);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !session.stId) return;

    // Members cannot broadcast
    if (!isAdmin && selectedChannel === "broadcast") {
      alert("Only staff can send broadcast messages.");
      return;
    }

    const payload = {
      sender_st_id: session.stId,
      receiver_st_id: selectedChannel === "broadcast" ? null : selectedChannel,
      content: newMessage.trim()
    };

    setNewMessage(""); // Optimistic UI clear

    const { error } = await supabase
      .from("messages")
      .insert([payload]);

    if (error) {
      alert("Failed to send message: " + error.message);
    }
  };

  if (!session.stId) {
    return (
      <div className="empty-state">
        <p>You must be linked to a Student ID to use messaging.</p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", gap: "20px" }}>
      {/* Sidebar Channels List */}
      <div style={{ 
        width: "300px", 
        borderRight: "1px solid var(--border)", 
        display: "flex", 
        flexDirection: "column",
        background: "var(--surface)",
        borderRadius: "var(--r)",
        overflow: "hidden"
      }}>
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", fontWeight: "bold" }}>
          Conversations
        </div>
        <div style={{ padding: "12px", borderBottom: "1px solid var(--border)", background: "var(--bg)" }}>
          <div className="search-input-wrap">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                borderRadius: "20px",
                border: "1px solid var(--border)",
                background: "var(--bg3)",
                color: "var(--text)"
              }}
            />
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
          {channels.map(ch => (
            <div 
              key={ch.id}
              onClick={() => setSelectedChannel(ch.id)}
              style={{
                padding: "12px 16px",
                cursor: "pointer",
                borderBottom: "1px solid var(--border)",
                background: selectedChannel === ch.id ? "var(--bg)" : "transparent",
                borderLeft: selectedChannel === ch.id ? "3px solid var(--primary)" : "3px solid transparent",
                transition: "all 0.2s"
              }}
            >
              <div style={{ fontWeight: selectedChannel === ch.id ? "600" : "400", color: selectedChannel === ch.id ? "var(--text)" : "var(--text2)" }}>
                {ch.name}
              </div>
            </div>
          ))}

          {loadingChannels ? (
            <div style={{ padding: "20px", textAlign: "center" }}>
              <div className="spinner" style={{margin: "0 auto"}}></div>
            </div>
          ) : (
            hasMore && (
              <div style={{ padding: "12px", textAlign: "center" }}>
                <button 
                  onClick={handleLoadMore} 
                  className="btn btn-primary" 
                  style={{ width: "100%", justifyContent: "center", borderRadius: "16px", fontSize: "12px" }}
                >
                  Load More
                </button>
              </div>
            )
          )}
          
          {!loadingChannels && channels.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
              No conversations found.
            </div>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div style={{ 
        flex: 1, 
        display: "flex", 
        flexDirection: "column",
        background: "var(--surface)",
        borderRadius: "var(--r)",
        border: "1px solid var(--border)",
        overflow: "hidden"
      }}>
        {/* Chat Header */}
        <div style={{ padding: "16px", borderBottom: "1px solid var(--border)", fontWeight: "bold", background: "var(--bg)" }}>
          {channels.find(c => c.id === selectedChannel)?.name || "Select a conversation"}
        </div>
        
        {/* Messages List */}
        <div style={{ flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {messages.length === 0 ? (
            <div className="empty-state" style={{ margin: "auto" }}>
              <p className="text-muted">No messages yet. Say hello!</p>
            </div>
          ) : (
            messages.map(msg => {
              const isMine = msg.sender_st_id === session.stId;
              return (
                <div key={msg.id} style={{
                  alignSelf: isMine ? "flex-end" : "flex-start",
                  maxWidth: "70%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: isMine ? "flex-end" : "flex-start"
                }}>
                  <div style={{ fontSize: "11px", color: "var(--text3)", marginBottom: "4px" }}>
                    {isMine ? "You" : msg.sender?.name || msg.sender_st_id} • {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                  <div style={{
                    padding: "10px 14px",
                    borderRadius: "16px",
                    borderBottomRightRadius: isMine ? "4px" : "16px",
                    borderBottomLeftRadius: !isMine ? "4px" : "16px",
                    background: isMine ? "var(--primary)" : "var(--bg)",
                    color: isMine ? "white" : "var(--text)",
                    border: isMine ? "none" : "1px solid var(--border)",
                    lineHeight: "1.4",
                    wordBreak: "break-word"
                  }}>
                    {msg.content}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        {(!isAdmin && selectedChannel === "broadcast") ? (
          <div style={{ padding: "16px", borderTop: "1px solid var(--border)", background: "var(--bg)", textAlign: "center", color: "var(--text3)", fontSize: "13px" }}>
            Only staff can post announcements.
          </div>
        ) : (
          <form onSubmit={handleSendMessage} style={{ padding: "16px", borderTop: "1px solid var(--border)", display: "flex", gap: "10px", background: "var(--bg)" }}>
            <input 
              type="text" 
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type your message..." 
              style={{ flex: 1, padding: "10px 14px", borderRadius: "20px", border: "1px solid var(--border)", background: "var(--surface)", color: "var(--text)" }}
            />
            <button type="submit" className="btn btn-primary" style={{ borderRadius: "20px", padding: "0 24px" }} disabled={!newMessage.trim()}>
              Send
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
