import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";

export default function ScanAttendance({ onBackToLanding }) {
  const [loading, setLoading] = useState(true);
  const [verifyingToken, setVerifyingToken] = useState(true);
  const [tokenError, setTokenError] = useState("");
  const [event, setEvent] = useState(null);
  const [eventId, setEventId] = useState("");
  
  // Search state
  const [stIdInput, setStIdInput] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [registration, setRegistration] = useState(null);
  
  // Submit attendance state
  const [isSocietyMember, setIsSocietyMember] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // On-the-spot registration fields
  const [isNewRegistration, setIsNewRegistration] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDegree, setFormDegree] = useState("");
  const [formLevel, setFormLevel] = useState("");
  const [formPhone, setFormPhone] = useState("");

  // Parse parameters from URL
  const getParams = () => {
    const params = new URLSearchParams(window.location.search);
    let qEventId = params.get("event_id");
    let qToken = params.get("token");

    // Fallback: parse from hash string e.g. #/scan-attendance?event_id=123&token=abc
    const hash = window.location.hash;
    if (hash.includes("?")) {
      const hashParamsStr = hash.split("?")[1];
      const hashParams = new URLSearchParams(hashParamsStr);
      if (!qEventId) qEventId = hashParams.get("event_id");
      if (!qToken) qToken = hashParams.get("token");
    }

    return { eventId: qEventId, token: qToken };
  };

  const verifyAndLoad = async () => {
    setVerifyingToken(true);
    setTokenError("");
    const { eventId: qEventId, token: qToken } = getParams();

    if (!qEventId || !qToken) {
      setTokenError("Missing event ID or access token. Please scan the QR code displayed at the event.");
      setVerifyingToken(false);
      setLoading(false);
      return;
    }

    setEventId(qEventId);

    // 1. Decode token
    try {
      const decodedData = JSON.parse(atob(qToken));
      const { eventId: tokenEventId, exp, hash } = decodedData;

      // Verify signature/hash
      const expectedHash = (exp * 17 + 23).toString(16);
      if (hash !== expectedHash || tokenEventId !== qEventId) {
        setTokenError("Security verification failed. This QR code token is invalid.");
        setVerifyingToken(false);
        setLoading(false);
        return;
      }

      // Check expiry (allow 2 minutes of desync margin)
      const currentBlock = Math.floor(Date.now() / 60000);
      const diff = Math.abs(currentBlock - exp);
      if (diff > 2) {
        setTokenError("This QR code has expired. Please scan the newly generated QR code on the coordinator's screen.");
        setVerifyingToken(false);
        setLoading(false);
        return;
      }
    } catch (e) {
      setTokenError("Invalid token format. Please scan a valid event QR code.");
      setVerifyingToken(false);
      setLoading(false);
      return;
    }

    setVerifyingToken(false);

    // 2. Load Event details
    try {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("event_id", qEventId)
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        setTokenError("The requested event was not found in the database.");
      } else {
        setEvent(data);
      }
    } catch (err) {
      console.error("Error loading event:", err);
      setTokenError("Failed to connect to server to fetch event details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    verifyAndLoad();
  }, []);

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!stIdInput.trim()) {
      setSearchError("Please enter your Student ID.");
      return;
    }

    setSearching(true);
    setSearchError("");
    setRegistration(null);
    setSubmitError("");
    setIsNewRegistration(false);

    try {
      // Call Postgres search function via RPC which handles normalisation
      const { data, error } = await supabase.rpc("search_registration_by_id", {
        p_event_id: eventId,
        p_st_id: stIdInput.trim()
      });

      if (error) throw error;

      if (data && data.length > 0) {
        const regData = data[0];
        setRegistration(regData);
        setIsSocietyMember(regData.is_member);
      } else {
        // Not found in CSV registrations list! Check if they exist in the members database
        const { data: memberData, error: memberError } = await supabase.rpc("check_member_by_id", {
          p_st_id: stIdInput.trim()
        });

        setIsNewRegistration(true);
        if (!memberError && memberData && memberData.length > 0) {
          const mem = memberData[0];
          setRegistration({
            st_id: mem.st_id,
            name: mem.name,
            level: mem.level,
            degree_program: "",
            phone: "",
            attend: "NO",
            is_member: true
          });
          setFormName(mem.name);
          setFormLevel(mem.level || "");
          setFormDegree("");
          setFormPhone("");
          setIsSocietyMember(true);
        } else {
          // Completely new unregistered non-member walk-in
          setRegistration({
            st_id: stIdInput.trim(),
            name: "",
            level: "",
            degree_program: "",
            phone: "",
            attend: "NO",
            is_member: false
          });
          setFormName("");
          setFormLevel("");
          setFormDegree("");
          setFormPhone("");
          setIsSocietyMember(false);
        }
      }
    } catch (err) {
      console.error("Error searching registration:", err);
      setSearchError("Error searching registration list: " + err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleMarkPresent = async () => {
    if (!registration) return;
    
    // Simple verification for walk-ins
    if (isNewRegistration && !isSocietyMember && (!formName.trim() || !formLevel.trim())) {
      setSubmitError("Please fill in your Name and Level/Year.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
      // Call Postgres record function which handles writing to both tables with bypass
      const { data, error } = await supabase.rpc("record_csv_scan_attendance", {
        p_event_id: eventId,
        p_st_id: registration.st_id,
        p_is_member: isSocietyMember,
        p_name: isNewRegistration ? formName.trim() : null,
        p_phone: isNewRegistration ? formPhone.trim() : null,
        p_degree_program: isNewRegistration ? formDegree.trim() : null,
        p_level: isNewRegistration ? formLevel.trim() : null
      });

      if (error) throw error;

      if (data && data.success) {
        setRegistration(prev => ({
          ...prev,
          name: isNewRegistration ? formName.trim() : prev.name
        }));
        setSuccess(true);
      } else {
        setSubmitError("Failed to record attendance: " + (data?.message || "Unknown error"));
      }
    } catch (err) {
      console.error("Error marking present:", err);
      setSubmitError("Failed to submit attendance: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || verifyingToken) {
    return (
      <div className="min-h-screen bg-[#0B0A11] text-white flex items-center justify-center flex-col gap-4 p-6">
        <div className="w-12 h-12 border-4 border-[#0062ff] border-t-transparent rounded-full animate-spin"></div>
        <p className="text-text-secondary text-sm font-semibold uppercase tracking-wider">Verifying Scan Security...</p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#0B0A11] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
          <span className="material-symbols-outlined text-4xl text-[#ff4d4f]">error</span>
        </div>
        <h1 className="text-2xl font-bold mb-2">Verification Failed</h1>
        <p className="text-text-secondary max-w-sm mb-8 text-sm leading-relaxed">{tokenError}</p>
        <div className="flex gap-4">
          <button
            onClick={verifyAndLoad}
            className="px-5 py-2.5 bg-white/5 hover:bg-white/10 text-white font-semibold rounded-xl border border-white/10 transition-all text-sm"
          >
            Retry Scan
          </button>
          <button
            onClick={onBackToLanding}
            className="px-5 py-2.5 bg-[#0062ff] hover:bg-[#0052d4] text-white font-semibold rounded-xl transition-all text-sm"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0B0A11] text-white flex flex-col items-center justify-center p-4 selection:bg-[#0062ff] selection:text-white">
      <style>{`
        .glass-card {
          background: rgba(24, 23, 34, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
        }
        .pulse-accent {
          box-shadow: 0 0 20px rgba(0, 98, 255, 0.3);
          animation: pulse 2s infinite;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(0, 98, 255, 0.4); }
          70% { box-shadow: 0 0 0 10px rgba(0, 98, 255, 0); }
          100% { box-shadow: 0 0 0 0 rgba(0, 98, 255, 0); }
        }
      `}</style>

      <div className="w-full max-w-md glass-card rounded-3xl p-6 sm:p-8 flex flex-col">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo.png" alt="ADSS Logo" className="h-12 w-auto mb-3" />
          <h2 className="text-xs font-bold text-[#0062ff] tracking-widest uppercase mb-1">Event Attendance</h2>
          <h1 className="text-xl font-bold text-white line-clamp-1">{event?.name}</h1>
          <p className="text-[11px] text-text-secondary mt-1">Date: {event?.date}</p>
        </div>

        {success ? (
          /* SUCCESS SCREEN */
          <div className="flex flex-col items-center text-center py-6 animate-fadeIn">
            <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center mb-6 pulse-accent" style={{ animation: "none" }}>
              <span className="material-symbols-outlined text-4xl text-green-400">check_circle</span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Attendance Marked!</h2>
            <p className="text-text-secondary text-sm max-w-xs mb-6">
              Thank you, <strong>{registration?.name}</strong>. Your presence has been successfully registered.
            </p>

            <div className="w-full bg-white/5 border border-white/5 rounded-2xl p-4 text-left mb-6 text-xs flex flex-col gap-2">
              <div className="flex justify-between"><span className="text-text-secondary">Student ID:</span> <span className="font-bold">{registration?.st_id}</span></div>
              <div className="flex justify-between"><span className="text-text-secondary">Society Member:</span> <span className={`font-bold ${isSocietyMember ? "text-green-400" : "text-text-secondary"}`}>{isSocietyMember ? "✓ Yes (Auto-marked Present)" : "No (CSV only)"}</span></div>
            </div>

            <button
              onClick={onBackToLanding}
              className="w-full py-3 bg-[#0062ff] hover:bg-[#0052d4] text-white font-bold rounded-xl transition-all text-sm cursor-pointer"
            >
              Back to Home
            </button>
          </div>
        ) : !registration ? (
          /* SEARCH FORM */
          <div className="flex flex-col">
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-6 text-xs text-text-secondary leading-relaxed flex gap-2.5 items-start">
              <span className="material-symbols-outlined text-base text-[#0062ff] mt-0.5">info</span>
              <div>
                To mark your attendance, enter your Student ID. We will search for your name in the event's registration sheet.
              </div>
            </div>

            {searchError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl p-3.5 mb-4 flex gap-2 items-start">
                <span className="material-symbols-outlined text-base text-[#ff4d4f] mt-0.5">warning</span>
                <div>{searchError}</div>
              </div>
            )}

            <form onSubmit={handleSearch} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-text-secondary">Student ID (ST ID)</label>
                <input
                  type="text"
                  placeholder="e.g. 2022/12984 or sc/2022/12984"
                  value={stIdInput}
                  onChange={(e) => setStIdInput(e.target.value)}
                  className="px-4 py-3 bg-white/5 border border-white/10 focus:border-[#0062ff] text-white text-sm rounded-xl outline-none transition-all placeholder:text-white/20"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full py-3 bg-[#0062ff] hover:bg-[#0052d4] disabled:opacity-55 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                {searching ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Searching registrations...
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">search</span>
                    Find Registration
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* DETAILS & PRESENT SUBMIT */
          <div className="flex flex-col animate-fadeIn">
            {submitError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-200 text-xs rounded-xl p-3.5 mb-4 flex gap-2 items-start">
                <span className="material-symbols-outlined text-base text-[#ff4d4f] mt-0.5">error</span>
                <div>{submitError}</div>
              </div>
            )}

            {isNewRegistration ? (
              /* ON-THE-SPOT INPUT FORM */
              <div className="bg-[#0062ff]/5 border border-[#0062ff]/10 rounded-2xl p-5 mb-6 flex flex-col gap-4">
                <div className="border-b border-white/5 pb-3">
                  <div className="text-[10px] text-orange-400 uppercase font-bold tracking-wider">On-The-Spot Registration</div>
                  <div className="text-base font-extrabold text-white mt-1">ID: <span className="font-mono">{registration.st_id}</span></div>
                  <div className="text-[10px] text-text-secondary mt-1">Please enter your information below to register and record attendance.</div>
                </div>

                <div className="flex flex-col gap-3.5">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={isSocietyMember}
                      placeholder="Enter your full name"
                      className="px-3.5 py-2.5 bg-white/5 border border-white/10 focus:border-[#0062ff] text-white text-xs rounded-xl outline-none transition-all placeholder:text-white/20 disabled:opacity-60"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-semibold text-text-secondary">Degree Program</label>
                    <input
                      type="text"
                      value={formDegree}
                      onChange={(e) => setFormDegree(e.target.value)}
                      placeholder="e.g. B.Sc. Computer Science"
                      className="px-3.5 py-2.5 bg-white/5 border border-white/10 focus:border-[#0062ff] text-white text-xs rounded-xl outline-none transition-all placeholder:text-white/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3.5">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-text-secondary">Level / Year</label>
                      <input
                        type="text"
                        value={formLevel}
                        onChange={(e) => setFormLevel(e.target.value)}
                        disabled={isSocietyMember}
                        placeholder="e.g. 1, 2, 3, 4"
                        className="px-3.5 py-2.5 bg-white/5 border border-white/10 focus:border-[#0062ff] text-white text-xs rounded-xl outline-none transition-all placeholder:text-white/20 disabled:opacity-60"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-semibold text-text-secondary">WhatsApp Number</label>
                      <input
                        type="text"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="e.g. 0771234567"
                        className="px-3.5 py-2.5 bg-white/5 border border-white/10 focus:border-[#0062ff] text-white text-xs rounded-xl outline-none transition-all placeholder:text-white/20"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PRE-REGISTERED CARD DISPLAY */
              <div className="bg-[#0062ff]/5 border border-[#0062ff]/10 rounded-2xl p-5 mb-6 flex flex-col gap-4">
                <div className="border-b border-white/5 pb-3">
                  <div className="text-[10px] text-text-secondary uppercase font-bold tracking-wider">Registration Details</div>
                  <div className="text-base font-extrabold text-white mt-1">{registration.name}</div>
                  <div className="text-xs text-text-secondary font-mono mt-0.5">ID: {registration.st_id}</div>
                </div>

                {registration.degree_program && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Degree Program:</span>
                    <span className="text-white font-medium text-right max-w-[200px] truncate">{registration.degree_program}</span>
                  </div>
                )}

                {registration.level && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">Level:</span>
                    <span className="text-white font-medium">{registration.level}</span>
                  </div>
                )}

                {registration.phone && (
                  <div className="flex justify-between text-xs">
                    <span className="text-text-secondary">WhatsApp Number:</span>
                    <span className="text-white font-medium">{registration.phone}</span>
                  </div>
                )}

                {registration.attend === "YES" ? (
                  <div className="bg-green-500/10 border border-green-500/20 text-green-300 text-xs rounded-xl p-3 text-center font-semibold">
                    ✓ Attendance already marked for this ID.
                  </div>
                ) : null}
              </div>
            )}

            {/* Society Member Tik Button Checkbox */}
            <div className="bg-white/5 border border-white/5 rounded-2xl p-4 mb-6 flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  Society Member
                  {isSocietyMember && (
                    <span className="badge badge-green bg-green-500/10 text-green-400 border border-green-500/20 text-[9px] px-1.5 py-0.5 uppercase">
                      Detected
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-text-secondary">Check this if you are a member of ADSS.</span>
              </div>
              <input
                type="checkbox"
                checked={isSocietyMember}
                disabled={isNewRegistration && isSocietyMember} // Keep locked for auto-detected unregistered members
                onChange={(e) => setIsSocietyMember(e.target.checked)}
                className="w-5 h-5 rounded border-white/20 accent-[#0062ff] cursor-pointer disabled:opacity-65"
              />
            </div>

            {registration.attend === "YES" && !isNewRegistration ? (
              <button
                onClick={onBackToLanding}
                className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all text-sm cursor-pointer"
              >
                Cancel / Back
              </button>
            ) : (
              <div className="flex gap-4">
                <button
                  onClick={() => {
                    setRegistration(null);
                    setIsNewRegistration(false);
                  }}
                  className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl border border-white/10 transition-all text-sm cursor-pointer"
                  disabled={submitting}
                >
                  Change ID
                </button>
                <button
                  onClick={handleMarkPresent}
                  disabled={submitting}
                  className="flex-1 py-3 bg-[#0062ff] hover:bg-[#0052d4] disabled:opacity-55 text-white font-bold rounded-xl transition-all text-sm flex items-center justify-center gap-2 cursor-pointer pulse-accent"
                >
                  {submitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Marking...
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-base">check_box</span>
                      Mark Present
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
