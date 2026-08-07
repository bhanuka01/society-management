import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import { resizeImage } from "../utils/imageOptimizer";
import PhoneContact from "../components/PhoneContact";
import { 
  User, 
  UserCheck, 
  Edit3, 
  FileText, 
  Mail, 
  Phone, 
  Link, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  Award, 
  Briefcase, 
  Clock, 
  ExternalLink, 
  ChevronLeft, 
  ChevronRight, 
  X, 
  AlertCircle, 
  Upload,
  Sparkles,
  Layers,
  Video,
  Check
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Progress } from "../components/ui/progress";

export default function MyInfo({ session }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    profile_image_url: "",
    mobile_number: "",
    linkedin_url: "",
    st_position: "",
    member_function: ""
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  const [profileImageFile, setProfileImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const [requests, setRequests] = useState([]);
  const [requestModal, setRequestModal] = useState(false);
  const [requestForm, setRequestForm] = useState({ name_on_letter: "", selected_events: [], additional_details: "" });
  const [settings, setSettings] = useState({
    letter_show_name: true,
    letter_show_events: true,
    letter_show_details: true,
    member_edit_name: false,
    member_edit_photo: true,
    member_edit_whatsapp: false,
    member_edit_linkedin: true,
    member_edit_position: false,
    member_edit_function: false
  });
  const [thisYearEvents, setThisYearEvents] = useState([]);
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const [staffMap, setStaffMap] = useState({});
  const [attPage, setAttPage] = useState(0);
  const [ocPage, setOcPage] = useState(0);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setMsg({ type: "error", text: "Please select a valid image file." });
        return;
      }
      setProfileImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const openEditModal = () => {
    setEditForm({
      name: profile?.name || "",
      profile_image_url: profile?.profile_image_url || "",
      mobile_number: profile?.mobile_number || "",
      linkedin_url: profile?.linkedin_url || "",
      st_position: profile?.st_position || "",
      member_function: profile?.member_function || ""
    });
    setProfileImageFile(null);
    setPreviewUrl(null);
    setMsg(null);
    setEditModal(true);
  };

  const closeEditModal = () => {
    setEditModal(false);
    setProfileImageFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setMsg(null);
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const updates = {};
      const profileUpdates = {};

      if (settings.member_edit_name) {
        if (!editForm.name.trim()) {
          throw new Error("Full Name cannot be empty.");
        }
        updates.name = editForm.name.trim();
        profileUpdates.full_name = editForm.name.trim();
      }

      if (settings.member_edit_photo) {
        let finalImageUrl = editForm.profile_image_url.trim() || null;

        if (profileImageFile) {
          const optimizedFile = await resizeImage(profileImageFile, 500, 600, 0.85);
          const cleanStId = session.stId.replace(/\//g, "-");
          const fileName = `${cleanStId}_${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from("profile_images")
            .upload(fileName, optimizedFile, {
              cacheControl: "3600",
              upsert: true
            });

          if (uploadError) {
            throw new Error("Failed to upload profile image: " + uploadError.message);
          }

          const { data: urlData } = supabase.storage
            .from("profile_images")
            .getPublicUrl(fileName);

          finalImageUrl = urlData?.publicUrl || finalImageUrl;
        }

        updates.profile_image_url = finalImageUrl;
      }

      if (settings.member_edit_whatsapp) {
        updates.mobile_number = editForm.mobile_number.trim() || null;
      }

      if (settings.member_edit_linkedin) {
        updates.linkedin_url = editForm.linkedin_url.trim() || null;
      }

      if (settings.member_edit_position) {
        updates.st_position = editForm.st_position.trim() || null;
      }

      if (settings.member_edit_function) {
        updates.member_function = editForm.member_function.trim() || null;
      }

      if (Object.keys(updates).length === 0) {
        throw new Error("No editable fields are enabled by the administrator.");
      }

      const { error } = await supabase
        .from("members")
        .update(updates)
        .eq("st_id", session.stId);

      if (error) throw error;

      if (profileUpdates.full_name) {
        await supabase
          .from("profiles")
          .update(profileUpdates)
          .eq("st_id", session.stId);
      }

      setProfile(prev => ({
        ...prev,
        ...updates
      }));

      setMsg({ type: "success", text: "Profile updated successfully!" });
      setTimeout(closeEditModal, 800);
    } catch (err) {
      setMsg({ type: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const loadRequests = async () => {
    try {
      const { data, error } = await supabase
        .from("letter_requests")
        .select("*")
        .eq("st_id", session.stId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRequests(data || []);
    } catch (err) {
      console.error("Error loading letter requests:", err);
    }
  };

  const loadSettingsAndEvents = async () => {
    try {
      const [settingsRes, eventsRes] = await Promise.all([
        supabase
          .from("system_settings")
          .select("key, value")
          .in("key", [
            "letter_show_name", "letter_show_events", "letter_show_details",
            "member_edit_name", "member_edit_photo", "member_edit_whatsapp",
            "member_edit_linkedin", "member_edit_position", "member_edit_function"
          ]),
        supabase
          .from("events")
          .select("event_id, name, date")
          .gte("date", `${new Date().getFullYear()}-01-01`)
          .lte("date", `${new Date().getFullYear()}-12-31`)
          .order("date", { ascending: false })
      ]);

      if (settingsRes.data) {
        const config = {};
        settingsRes.data.forEach(item => {
          config[item.key] = item.value === "true";
        });
        setSettings(prev => ({ ...prev, ...config }));
      }

      if (eventsRes.data) {
        setThisYearEvents(eventsRes.data);
      }
    } catch (err) {
      console.error("Error loading settings/events:", err);
    }
  };

  const getInterviewerName = (email) => {
    if (!email) return null;
    const key = email.toLowerCase();
    return staffMap[key] || email.split("@")[0];
  };

  const renderOcStatusBadge = (status) => {
    if (status === "Accept") return <Badge variant="success" className="text-[11px]">Accepted</Badge>;
    if (status === "Reject") return <Badge variant="destructive" className="text-[11px]">Rejected</Badge>;
    if (status === "Invited") return <Badge variant="default" className="text-[11px] bg-blue-600/20 text-blue-300 border-blue-500/30">Invited</Badge>;
    if (status === "Interview Scheduled") return <Badge variant="default" className="text-[11px] bg-purple-600/20 text-purple-300 border-purple-500/30">Interview Scheduled</Badge>;
    return <Badge variant="warning" className="text-[11px]">Pending</Badge>;
  };

  useEffect(() => {
    if (!session.stId) return;

    const loadInfo = async () => {
      setLoading(true);
      try {
        const { data: member } = await supabase
          .from("members")
          .select("*")
          .eq("st_id", session.stId)
          .maybeSingle();

        if (member) {
          const [ocRecords, attRecords, profileRes, memberRes] = await Promise.all([
            supabase
              .from("oc")
              .select("oc_position, apply_status, interviewer_email, interview_date, interview_link, events(name, date), functions(function_name)")
              .eq("st_id", session.stId),
            supabase
              .from("attendance")
              .select("attend, events(name, date)")
              .eq("st_id", session.stId),
            supabase
              .from("profiles")
              .select("email, full_name"),
            supabase
              .from("members")
              .select("email, name")
          ]);

          const map = {};
          if (profileRes.data) {
            profileRes.data.forEach(p => {
              if (p.email) map[p.email.toLowerCase()] = p.full_name || p.email;
            });
          }
          if (memberRes.data) {
            memberRes.data.forEach(m => {
              if (m.email && !map[m.email.toLowerCase()]) map[m.email.toLowerCase()] = m.name || m.email;
            });
          }
          setStaffMap(map);

          setProfile({
            ...member,
            oc: ocRecords.data || [],
            attendance: attRecords.data || []
          });
        }
      } catch (err) {
        console.error("Error loading info:", err);
      } finally {
        setLoading(false);
      }
    };

    Promise.all([loadInfo(), loadRequests(), loadSettingsAndEvents()]);
  }, [session.stId]);

  const openRequestModal = () => {
    setRequestForm({
      name_on_letter: profile?.name || "",
      selected_events: [],
      additional_details: ""
    });
    setMsg(null);
    setRequestModal(true);
  };

  const closeRequestModal = () => {
    setRequestModal(false);
    setMsg(null);
  };

  const handleSubmitRequest = async () => {
    setSubmittingRequest(true);
    setMsg(null);
    try {
      const payload = {
        st_id: session.stId,
        name_on_letter: settings.letter_show_name ? requestForm.name_on_letter.trim() : null,
        selected_events: settings.letter_show_events ? requestForm.selected_events : [],
        additional_details: settings.letter_show_details ? requestForm.additional_details.trim() : null,
        status: "not start"
      };

      const { error } = await supabase.from("letter_requests").insert(payload);
      if (error) throw error;
      
      setMsg({ type: "success", text: "Appreciation letter request submitted successfully!" });
      await loadRequests();
      setTimeout(closeRequestModal, 800);
    } catch (err) {
      console.error("Error submitting letter request:", err);
      setMsg({ type: "error", text: err.message });
    } finally {
      setSubmittingRequest(false);
    }
  };

  if (!session.stId) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-[#17171a]/90 border-zinc-800">
          <User className="w-10 h-10 text-zinc-600 stroke-[1.5]" />
          <p className="text-base font-semibold text-zinc-300">Account Not Linked</p>
          <p className="text-xs text-zinc-500 max-w-sm">
            This account is not linked to any student member record in the database.
          </p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4 text-zinc-400">
        <div className="w-9 h-9 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <span className="text-sm font-medium text-zinc-400">Loading profile details...</span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <Card className="p-12 text-center flex flex-col items-center justify-center gap-3 bg-[#17171a]/90 border-zinc-800">
          <AlertCircle className="w-10 h-10 text-rose-500 stroke-[1.5]" />
          <p className="text-base font-semibold text-zinc-300">Member Not Found</p>
          <p className="text-xs text-zinc-500 max-w-sm">
            Student record ({session.stId}) could not be found in the database.
          </p>
        </Card>
      </div>
    );
  }

  const attendanceList = profile?.attendance || [];
  const ocList = profile?.oc || [];

  const totalEvents = attendanceList.length;
  const attendedEvents = attendanceList.filter(a => a.attend === "YES").length;
  const absentEvents = totalEvents - attendedEvents;
  const attendanceRate = totalEvents ? Math.round((attendedEvents / totalEvents) * 100) : 0;

  const pageSize = 5;
  const totalAttPages = Math.ceil(attendanceList.length / pageSize) || 1;
  const paginatedAttendance = attendanceList.slice(attPage * pageSize, (attPage + 1) * pageSize);

  const totalOcPages = Math.ceil(ocList.length / pageSize) || 1;
  const paginatedOc = ocList.slice(ocPage * pageSize, (ocPage + 1) * pageSize);

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 text-zinc-200">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <UserCheck className="w-5 h-5" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              My Information
            </h1>
          </div>
          <p className="text-sm text-zinc-400">
            View your profile details, attendance records, and committee assignments
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={openEditModal}
            className="flex items-center gap-2 text-xs border-zinc-700/80 text-zinc-300 hover:text-white"
          >
            <Edit3 className="w-3.5 h-3.5" /> Edit Profile
          </Button>

          <Button
            size="sm"
            onClick={openRequestModal}
            className="flex items-center gap-2 text-xs bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/40"
          >
            <FileText className="w-3.5 h-3.5" /> Request Letter
          </Button>
        </div>
      </div>

      {/* Main Profile Card */}
      <Card className="p-6 md:p-8 bg-[#17171a]/90 border border-zinc-800/90 shadow-xl mb-8">
        <div className="flex flex-row items-center gap-6 pb-6 border-b border-zinc-800/80">
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-2xl overflow-hidden border-2 border-indigo-500/30 bg-zinc-900 flex-shrink-0 shadow-xl">
            {profile.profile_image_url ? (
              <img
                src={profile.profile_image_url}
                alt={profile.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.onerror = null;
                  e.target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + encodeURIComponent(profile.name);
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-500 text-3xl font-bold">
                {profile.name ? profile.name.slice(0, 2).toUpperCase() : "??"}
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center text-left">
            <h2 className="text-xl sm:text-3xl font-black text-white tracking-tight mb-2">
              {profile.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <Badge variant="default" className="bg-indigo-600/20 text-indigo-300 border-indigo-500/30 font-mono text-xs px-2.5 py-0.5">
                {profile.st_id}
              </Badge>
              {profile.level && (
                <Badge variant="secondary" className="text-xs px-2.5 py-0.5">
                  Year {profile.level}
                </Badge>
              )}
            </div>
            <p className="text-sm sm:text-base font-semibold text-zinc-400">
              {profile.st_position || "Regular Member"}
            </p>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-6">
          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Member Function
            </span>
            <span className="text-sm font-medium text-white">
              {profile.member_function || "Not assigned"}
            </span>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email Address
            </span>
            {profile.email ? (
              <a href={`mailto:${profile.email}`} className="text-sm font-medium text-indigo-400 hover:underline break-all">
                {profile.email}
              </a>
            ) : (
              <span className="text-sm text-zinc-500 italic">Not provided</span>
            )}
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-emerald-400" /> Mobile / WhatsApp
            </span>
            <div className="text-sm font-medium text-white">
              <PhoneContact phone={profile.mobile_number} />
            </div>
          </div>

          <div className="bg-zinc-900/50 p-4 rounded-xl border border-zinc-800/60">
            <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Link className="w-3.5 h-3.5 text-blue-400" /> LinkedIn Profile
            </span>
            {profile.linkedin_url ? (
              <a 
                href={profile.linkedin_url.trim().toLowerCase().startsWith("http") ? profile.linkedin_url.trim() : "https://" + profile.linkedin_url.trim()} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-sm font-medium text-blue-400 hover:underline inline-flex items-center gap-1"
              >
                View LinkedIn <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <span className="text-sm text-zinc-500 italic">Not provided</span>
            )}
          </div>
        </div>
      </Card>

      {/* Stats Grid: 3 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
        <Card className="p-5 bg-gradient-to-br from-[#17171a] to-[#1e1e24] border-emerald-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Present</span>
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{attendedEvents}</p>
          <p className="text-xs text-zinc-500">events attended successfully</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-[#17171a] to-[#1e1e24] border-rose-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Absent</span>
            <XCircle className="w-5 h-5 text-rose-400" />
          </div>
          <p className="text-3xl font-black text-white mb-1">{absentEvents}</p>
          <p className="text-xs text-zinc-500">events missed</p>
        </Card>

        <Card className="p-5 bg-gradient-to-br from-[#17171a] to-[#1e1e24] border-amber-500/30 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Attendance Rate</span>
            <Award className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-3xl font-black text-white mb-2">{attendanceRate}%</p>
          <Progress value={attendanceRate} max={100} />
        </Card>
      </div>

      {/* Split Lists: Attendance History & OC Assignments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Event Attendance History */}
        <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-zinc-800/60">
              <Calendar className="w-4 h-4 text-indigo-400" />
              <CardTitle className="text-base font-bold text-white">Event Attendance History</CardTitle>
            </div>

            {attendanceList.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                <Calendar className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                <p>No event attendance records on file</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse" style={{ fontSize: "13px" }}>
                  <thead>
                    <tr className="border-b border-zinc-800/80 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                      <th className="pb-3 px-2">Event</th>
                      <th className="pb-3 px-2 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {paginatedAttendance.map((att, idx) => (
                      <tr key={idx} className="hover:bg-zinc-800/30 transition-colors">
                        <td className="py-3 px-2">
                          <strong className="text-white block">{att.events?.name || "Unknown Event"}</strong>
                          <span className="text-[11px] text-zinc-500 font-mono mt-0.5 block">{att.events?.date}</span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <Badge variant={att.attend === "YES" ? "success" : "destructive"} className="text-[11px]">
                            {att.attend}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {totalAttPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800/60 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttPage(p => Math.max(0, p - 1))}
                disabled={attPage === 0}
                className="h-7 text-xs text-zinc-400"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <span className="text-zinc-500">
                Page {attPage + 1} of {totalAttPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setAttPage(p => Math.min(totalAttPages - 1, p + 1))}
                disabled={attPage >= totalAttPages - 1}
                className="h-7 text-xs text-zinc-400"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </Card>

        {/* Committee (OC) Assignments */}
        <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-4 mb-4 border-b border-zinc-800/60">
              <Briefcase className="w-4 h-4 text-emerald-400" />
              <CardTitle className="text-base font-bold text-white">Committee (OC) Assignments</CardTitle>
            </div>

            {ocList.length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
                <Briefcase className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
                <p>No committee assignments on file</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {paginatedOc.map((o, idx) => {
                  const interviewerName = getInterviewerName(o.interviewer_email);
                  return (
                    <div
                      key={idx}
                      className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/50 flex flex-col gap-3"
                    >
                      <div className="flex flex-col gap-1">
                        <strong className="text-sm font-bold text-white">{o.events?.name || "Unknown Event"}</strong>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-zinc-400 font-medium">
                          <span>{o.functions?.function_name || "General Sub-team"}</span>
                          <span className="text-zinc-600">•</span>
                          {o.oc_position ? (
                            o.oc_position.split(",").map((pos, pIdx) => (
                              <Badge key={pIdx} variant="secondary" className="text-[10px] px-2 py-0.5 bg-indigo-600/10 text-indigo-300 border-indigo-500/20">
                                {pos.trim()}
                              </Badge>
                            ))
                          ) : (
                            <Badge variant="secondary" className="text-[10px] px-2 py-0.5">Committee Member</Badge>
                          )}
                        </div>
                        <div className="mt-1">{renderOcStatusBadge(o.apply_status)}</div>
                      </div>

                      {o.apply_status !== "Accept" && o.apply_status !== "Reject" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-800/60 text-xs">
                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                              Assigned Interviewer
                            </span>
                            <span className={interviewerName ? "text-indigo-300 font-medium" : "text-zinc-500"}>
                              {interviewerName ? `👤 ${interviewerName}` : "Unassigned"}
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-0.5">
                              Interview Slot
                            </span>
                            {o.interview_date ? (
                              <div>
                                <span className="text-emerald-400 font-semibold block">
                                  📅 {new Date(o.interview_date).toLocaleString()}
                                </span>
                                {o.interview_link && (
                                  <a
                                    href={o.interview_link}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline mt-1"
                                  >
                                    <Video className="w-3 h-3" /> Join Meeting
                                  </a>
                                )}
                              </div>
                            ) : (
                              <span className="text-zinc-500">Not booked yet</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {totalOcPages > 1 && (
            <div className="flex items-center justify-between pt-4 mt-4 border-t border-zinc-800/60 text-xs">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOcPage(p => Math.max(0, p - 1))}
                disabled={ocPage === 0}
                className="h-7 text-xs text-zinc-400"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </Button>
              <span className="text-zinc-500">
                Page {ocPage + 1} of {totalOcPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setOcPage(p => Math.min(totalOcPages - 1, p + 1))}
                disabled={ocPage >= totalOcPages - 1}
                className="h-7 text-xs text-zinc-400"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </Card>
      </div>

      {/* Appreciation Letter Requests History */}
      <Card className="p-6 bg-[#17171a]/90 border border-zinc-800 shadow-xl">
        <div className="flex items-center gap-2 pb-4 mb-4 border-b border-zinc-800/60">
          <Award className="w-4 h-4 text-amber-400" />
          <CardTitle className="text-base font-bold text-white">Appreciation Letter Requests History</CardTitle>
        </div>

        {requests.length === 0 ? (
          <div className="py-12 text-center text-zinc-500 text-xs flex flex-col items-center gap-2">
            <FileText className="w-8 h-8 text-zinc-600 stroke-[1.5]" />
            <p>No letter requests submitted yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse" style={{ fontSize: "13px" }}>
              <thead>
                <tr className="border-b border-zinc-800/80 text-zinc-400 text-xs font-semibold uppercase tracking-wider">
                  <th className="pb-3 px-2">Name on Letter</th>
                  <th className="pb-3 px-2">Events Included</th>
                  <th className="pb-3 px-2">Additional Info</th>
                  <th className="pb-3 px-2">Request Date</th>
                  <th className="pb-3 px-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="py-3 px-2 font-medium text-white">
                      {r.name_on_letter || <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="py-3 px-2">
                      {r.selected_events && Array.isArray(r.selected_events) && r.selected_events.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {r.selected_events.map((e, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px] px-2 py-0.5">
                              {e}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-500">—</span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-zinc-400 max-w-xs truncate">
                      {r.additional_details || <span className="text-zinc-500">—</span>}
                    </td>
                    <td className="py-3 px-2 text-zinc-400 text-xs font-mono">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 text-right">
                      <Badge 
                        variant={
                          r.status === "done" || r.status === "completed" 
                            ? "success" 
                            : r.status === "inprogress" 
                            ? "warning" 
                            : "secondary"
                        } 
                        className="text-[10px] uppercase"
                      >
                        {r.status === "not start" ? "not started" : r.status === "inprogress" ? "in progress" : r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* EDIT PROFILE MODAL */}
      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeEditModal}>
          <Card 
            className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800">
              <CardTitle className="text-lg font-bold text-white">Edit Profile Details</CardTitle>
              <Button variant="ghost" size="icon" onClick={closeEditModal} className="h-8 w-8 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {msg && (
              <div className={`mx-6 mt-4 p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                msg.type === "error" ? "bg-rose-950/40 border-rose-900/60 text-rose-300" : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>{msg.text}</span>
              </div>
            )}

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
              {!settings.member_edit_name &&
               !settings.member_edit_photo &&
               !settings.member_edit_whatsapp &&
               !settings.member_edit_linkedin &&
               !settings.member_edit_position &&
               !settings.member_edit_function ? (
                <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-900/50 text-xs font-semibold text-rose-300 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Profile field editing is currently disabled by the society administrator.</span>
                </div>
              ) : (
                <>
                  {settings.member_edit_name && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Full Name</label>
                      <Input
                        placeholder="Enter full name"
                        value={editForm.name}
                        onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  {settings.member_edit_photo && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Profile Image</label>
                      <div className="flex items-center gap-4 p-3.5 rounded-xl border border-zinc-800 bg-zinc-900/50">
                        {previewUrl ? (
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 flex-shrink-0"
                          />
                        ) : editForm.profile_image_url ? (
                          <img
                            src={editForm.profile_image_url}
                            alt="Current Profile"
                            className="w-14 h-14 rounded-full object-cover border-2 border-indigo-500 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-500 font-bold text-lg flex-shrink-0">
                            👤
                          </div>
                        )}
                        <div className="flex flex-col gap-1.5">
                          <input
                            type="file"
                            accept="image/*"
                            id="profile-image-edit-upload"
                            onChange={handleFileChange}
                            className="hidden"
                          />
                          <label
                            htmlFor="profile-image-edit-upload"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 cursor-pointer w-fit"
                          >
                            <Upload className="w-3.5 h-3.5" /> Upload New Photo
                          </label>
                          <span className="text-[11px] text-zinc-500">
                            {profileImageFile ? profileImageFile.name : "Auto-resized to 500x600 px"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {settings.member_edit_whatsapp && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">WhatsApp / Mobile Number</label>
                      <Input
                        placeholder="e.g. +94771234567"
                        value={editForm.mobile_number}
                        onChange={e => setEditForm({ ...editForm, mobile_number: e.target.value })}
                      />
                    </div>
                  )}

                  {settings.member_edit_linkedin && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">LinkedIn Profile URL</label>
                      <Input
                        placeholder="e.g. https://linkedin.com/in/username"
                        value={editForm.linkedin_url}
                        onChange={e => setEditForm({ ...editForm, linkedin_url: e.target.value })}
                      />
                    </div>
                  )}

                  {settings.member_edit_position && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Position</label>
                      <Input
                        placeholder="e.g. Committee Member"
                        value={editForm.st_position}
                        onChange={e => setEditForm({ ...editForm, st_position: e.target.value })}
                      />
                    </div>
                  )}

                  {settings.member_edit_function && (
                    <div>
                      <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Function Name</label>
                      <select
                        value={editForm.member_function}
                        onChange={e => setEditForm({ ...editForm, member_function: e.target.value })}
                        className="w-full h-10 rounded-lg border border-zinc-800 bg-[#141417] px-3 py-2 text-sm text-zinc-100 focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="">Select Function</option>
                        <option value="Finance">Finance</option>
                        <option value="Marketing">Marketing</option>
                        <option value="Operation & Academic Management">Operation & Academic Management</option>
                        <option value="Personal Development">Personal Development</option>
                        <option value="Public Relations">Public Relations</option>
                        <option value="Research & Analyst">Research & Analyst</option>
                      </select>
                    </div>
                  )}
                </>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={closeEditModal} disabled={saving}>
                Cancel
              </Button>
              <Button 
                size="sm" 
                onClick={handleSaveProfile} 
                disabled={saving || (!settings.member_edit_name && !settings.member_edit_photo && !settings.member_edit_whatsapp && !settings.member_edit_linkedin && !settings.member_edit_position && !settings.member_edit_function)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}

      {/* REQUEST APPRECIATION LETTER MODAL */}
      {requestModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={closeRequestModal}>
          <Card 
            className="w-full max-w-lg max-h-[90vh] flex flex-col bg-[#17171a] border-zinc-700/80 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-zinc-800">
              <CardTitle className="text-lg font-bold text-white">Request Appreciation Letter</CardTitle>
              <Button variant="ghost" size="icon" onClick={closeRequestModal} className="h-8 w-8 text-zinc-400 hover:text-white">
                <X className="w-4 h-4" />
              </Button>
            </CardHeader>

            {msg && (
              <div className={`mx-6 mt-4 p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                msg.type === "error" ? "bg-rose-950/40 border-rose-900/60 text-rose-300" : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300"
              }`}>
                {msg.type === "error" ? <AlertCircle className="w-4 h-4" /> : <Check className="w-4 h-4" />}
                <span>{msg.text}</span>
              </div>
            )}

            <CardContent className="flex-1 overflow-y-auto p-6 space-y-4">
              <p className="text-xs text-zinc-400 leading-relaxed">
                Submit a request for an official appreciation letter documenting your contributions for this year.
              </p>

              {settings.letter_show_name && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Name on Letter</label>
                  <Input
                    placeholder="Enter the name as it should appear on the letter"
                    value={requestForm.name_on_letter}
                    onChange={e => setRequestForm({ ...requestForm, name_on_letter: e.target.value })}
                    required
                  />
                </div>
              )}

              {settings.letter_show_events && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">
                    Select This Year's Events (Participated / Organized)
                  </label>
                  {thisYearEvents.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic">No events found for this year.</p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-40 overflow-y-auto border border-zinc-800 p-3 rounded-xl bg-zinc-900/50">
                      {thisYearEvents.map(e => (
                        <label key={e.event_id} className="flex items-center gap-2 text-xs font-medium text-zinc-300 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={requestForm.selected_events.includes(e.name)}
                            onChange={(evt) => {
                              const name = e.name;
                              if (evt.target.checked) {
                                setRequestForm(prev => ({ ...prev, selected_events: [...prev.selected_events, name] }));
                              } else {
                                setRequestForm(prev => ({ ...prev, selected_events: prev.selected_events.filter(n => n !== name) }));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span>{e.name}</span>
                          <span className="text-zinc-500 font-mono text-[11px]">({e.date})</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {settings.letter_show_details && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-1.5">Additional Details</label>
                  <Textarea
                    placeholder="Describe your specific contributions, departments, roles, or special requests..."
                    rows={4}
                    value={requestForm.additional_details}
                    onChange={e => setRequestForm({ ...requestForm, additional_details: e.target.value })}
                    className="resize-none"
                  />
                </div>
              )}
            </CardContent>

            <CardFooter className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800 bg-zinc-900/40">
              <Button variant="ghost" size="sm" onClick={closeRequestModal} disabled={submittingRequest}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSubmitRequest} disabled={submittingRequest} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                {submittingRequest ? "Submitting..." : "Submit Request"}
              </Button>
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}
