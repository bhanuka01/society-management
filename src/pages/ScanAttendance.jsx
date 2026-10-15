import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  CheckCircle2,
  AlertTriangle,
  Search,
  Check,
  RefreshCw,
  Info,
  Calendar,
  Sparkles,
  ArrowLeft,
  XCircle,
  Clock
} from "lucide-react";

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

    // Fallback: parse from hash string
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
      setTokenError("Missing event ID or access token. Please scan the dynamic QR code displayed on the coordinator's screen.");
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
        setTokenError("This dynamic QR code has expired. Please scan the current rotating code shown on the screen.");
        setVerifyingToken(false);
        setLoading(false);
        return;
      }
    } catch {
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
        .select("event_id, name, date, time")
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
          // Completely new walk-in
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

    if (isNewRegistration && !isSocietyMember && (!formName.trim() || !formLevel.trim())) {
      setSubmitError("Please fill in your Name and Level/Year.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");

    try {
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
      <div className="min-h-screen bg-[#08090a] text-white flex items-center justify-center flex-col gap-3 p-6 font-inter-variable">
        <RefreshCw className="w-8 h-8 text-[#e4f222] animate-spin" />
        <p className="text-[#8a8f98] font-berkeley-mono text-xs uppercase tracking-wider">
          Verifying Dynamic Signature...
        </p>
      </div>
    );
  }

  if (tokenError) {
    return (
      <div className="min-h-screen bg-[#08090a] text-white flex flex-col items-center justify-center p-6 text-center font-inter-variable">
        <div className="w-14 h-14 rounded-full bg-[#eb5757]/10 border border-[#eb5757]/20 flex items-center justify-center mb-4">
          <XCircle className="w-7 h-7 text-[#eb5757]" />
        </div>
        <h1 className="text-xl font-[590] mb-2 tracking-tight">Verification Expired or Invalid</h1>
        <p className="text-[#8a8f98] max-w-sm mb-6 text-[13px] leading-relaxed font-sans">{tokenError}</p>
        <div className="flex gap-3">
          <button
            onClick={verifyAndLoad}
            className="px-4 py-2 bg-[#161718] hover:bg-[#23252a] text-white font-[510] rounded-[6px] border border-[#23252a] transition-all text-xs font-berkeley-mono"
          >
            Retry Scan
          </button>
          <button
            onClick={onBackToLanding}
            className="px-4 py-2 bg-[#e4f222] hover:brightness-105 text-[#08090a] font-[510] rounded-[6px] transition-all text-xs"
          >
            Go to Homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08090a] text-[#d0d6e0] font-inter-variable flex flex-col items-center justify-center p-4 selection:bg-[#e4f222]/30 selection:text-white">
      <div className="w-full max-w-md bg-[#0f1011] border border-[#23252a] rounded-[12px] p-6 sm:p-7 flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/logo_trans_light.png" alt="ADSS Logo" className="h-10 w-auto mb-2.5" />
          <span className="text-[10px] font-berkeley-mono uppercase tracking-widest text-[#27a644]">
            Event Check-In Terminal
          </span>
          <h1 className="text-[18px] font-[590] text-white line-clamp-1 mt-0.5">{event?.name}</h1>
          <p className="text-[11px] font-berkeley-mono text-[#8a8f98] mt-0.5">
            Date: {event?.date} {event?.time ? `· ${event.time}` : ""}
          </p>
        </div>

        {success ? (
          /* SUCCESS SCREEN */
          <div className="flex flex-col items-center text-center py-4 space-y-4 animate-in fade-in duration-200">
            <div className="w-16 h-16 rounded-full bg-[#27a644]/15 border border-[#27a644]/30 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8 text-[#27a644]" />
            </div>
            <div>
              <h2 className="text-[20px] font-[590] text-white tracking-tight">Attendance Verified!</h2>
              <p className="text-[#8a8f98] text-[13px] max-w-xs mt-1 leading-relaxed">
                Thank you, <strong className="text-white">{registration?.name}</strong>. Your check-in is complete.
              </p>
            </div>

            <div className="w-full bg-[#161718] border border-[#23252a] rounded-[8px] p-3 text-left text-xs font-berkeley-mono space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[#8a8f98]">Student ID:</span>
                <span className="font-[510] text-white">{registration?.st_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#8a8f98]">Society Member:</span>
                <span className={`font-[510] ${isSocietyMember ? "text-[#27a644]" : "text-[#8a8f98]"}`}>
                  {isSocietyMember ? "✓ Member (Auto-recorded)" : "Guest Attendee"}
                </span>
              </div>
            </div>

            <button
              onClick={onBackToLanding}
              className="w-full py-2.5 bg-[#e4f222] hover:brightness-105 active:scale-[0.98] text-[#08090a] font-[510] rounded-[6px] transition-all text-xs"
            >
              Back to Home
            </button>
          </div>
        ) : !registration ? (
          /* SEARCH FORM */
          <div className="flex flex-col space-y-4">
            <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 text-xs text-[#8a8f98] leading-relaxed flex gap-2.5 items-start">
              <Info className="w-4 h-4 text-[#e4f222] mt-0.5 flex-shrink-0" />
              <div>
                Enter your university Student ID to verify your registration and complete check-in.
              </div>
            </div>

            {searchError && (
              <div className="bg-[#eb5757]/10 border border-[#eb5757]/20 text-[#eb5757] text-xs rounded-[6px] p-3 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>{searchError}</div>
              </div>
            )}

            <form onSubmit={handleSearch} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-berkeley-mono text-[#8a8f98] uppercase">
                  Student ID (ST ID)
                </label>
                <input
                  type="text"
                  placeholder="e.g. SC/2022/12984 or 2022/12984"
                  value={stIdInput}
                  onChange={(e) => setStIdInput(e.target.value)}
                  className="w-full mt-1.5 px-3 py-2 bg-[#161718] border border-[#23252a] focus:border-[#d0d6e0] text-white text-xs rounded-[6px] outline-none font-berkeley-mono placeholder:text-[#62666d]"
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={searching}
                className="w-full py-2.5 bg-[#e4f222] hover:brightness-105 disabled:opacity-50 text-[#08090a] font-[510] rounded-[6px] transition-all text-xs flex items-center justify-center gap-2"
              >
                {searching ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Searching registration...</span>
                  </>
                ) : (
                  <>
                    <Search className="w-3.5 h-3.5" />
                    <span>Find Registration</span>
                  </>
                )}
              </button>
            </form>
          </div>
        ) : (
          /* DETAILS & SUBMIT */
          <div className="flex flex-col space-y-4 animate-in fade-in duration-150">
            {submitError && (
              <div className="bg-[#eb5757]/10 border border-[#eb5757]/20 text-[#eb5757] text-xs rounded-[6px] p-3 flex gap-2 items-start">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>{submitError}</div>
              </div>
            )}

            {isNewRegistration ? (
              /* ON-THE-SPOT WALK-IN FORM */
              <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-4 space-y-3">
                <div className="border-b border-[#23252a] pb-2">
                  <div className="text-[10px] font-berkeley-mono text-amber-400 uppercase">
                    On-The-Spot Check-In
                  </div>
                  <div className="text-sm font-[590] text-white mt-0.5">
                    ID: <span className="font-berkeley-mono">{registration.st_id}</span>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div>
                    <label className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase">Full Name</label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      disabled={isSocietyMember}
                      placeholder="Enter your full name"
                      className="w-full mt-1 px-3 py-1.5 bg-[#08090a] border border-[#23252a] focus:border-[#d0d6e0] text-white text-xs rounded-[6px] outline-none disabled:opacity-50"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase">Degree Program</label>
                    <input
                      type="text"
                      value={formDegree}
                      onChange={(e) => setFormDegree(e.target.value)}
                      placeholder="e.g. B.Sc. Computer Science"
                      className="w-full mt-1 px-3 py-1.5 bg-[#08090a] border border-[#23252a] focus:border-[#d0d6e0] text-white text-xs rounded-[6px] outline-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase">Level / Year</label>
                      <input
                        type="text"
                        value={formLevel}
                        onChange={(e) => setFormLevel(e.target.value)}
                        disabled={isSocietyMember}
                        placeholder="e.g. 1, 2, 3, 4"
                        className="w-full mt-1 px-3 py-1.5 bg-[#08090a] border border-[#23252a] focus:border-[#d0d6e0] text-white text-xs rounded-[6px] outline-none disabled:opacity-50"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase">WhatsApp Number</label>
                      <input
                        type="text"
                        value={formPhone}
                        onChange={(e) => setFormPhone(e.target.value)}
                        placeholder="e.g. 0771234567"
                        className="w-full mt-1 px-3 py-1.5 bg-[#08090a] border border-[#23252a] focus:border-[#d0d6e0] text-white text-xs rounded-[6px] outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* PRE-REGISTERED CARD DISPLAY */
              <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-4 space-y-2">
                <div className="border-b border-[#23252a] pb-2">
                  <div className="text-[10px] font-berkeley-mono text-[#8a8f98] uppercase">Registration Match</div>
                  <div className="text-sm font-[590] text-white mt-0.5">{registration.name}</div>
                  <div className="text-xs font-berkeley-mono text-[#8a8f98]">ID: {registration.st_id}</div>
                </div>

                {registration.degree_program && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8a8f98]">Program:</span>
                    <span className="text-white truncate max-w-[200px]">{registration.degree_program}</span>
                  </div>
                )}

                {registration.level && (
                  <div className="flex justify-between text-xs">
                    <span className="text-[#8a8f98]">Level:</span>
                    <span className="text-white">{registration.level}</span>
                  </div>
                )}

                {registration.attend === "YES" && (
                  <div className="p-2 rounded-[4px] bg-[#27a644]/10 border border-[#27a644]/25 text-[#27a644] text-xs text-center font-berkeley-mono font-[510]">
                    ✓ Attendance already marked for this ID.
                  </div>
                )}
              </div>
            )}

            {/* Society Member Checkbox */}
            <div className="bg-[#161718] border border-[#23252a] rounded-[8px] p-3 flex items-center justify-between">
              <div>
                <span className="text-xs font-[510] text-white flex items-center gap-1.5">
                  Society Member
                  {isSocietyMember && (
                    <span className="px-1.5 py-0.2 rounded-[3px] bg-[#27a644]/15 border border-[#27a644]/30 text-[#27a644] font-berkeley-mono text-[9px] uppercase">
                      Detected
                    </span>
                  )}
                </span>
                <span className="text-[10px] text-[#8a8f98] block">Check if you are an active member of ADSS.</span>
              </div>
              <input
                type="checkbox"
                checked={isSocietyMember}
                disabled={isNewRegistration && isSocietyMember}
                onChange={(e) => setIsSocietyMember(e.target.checked)}
                className="w-4 h-4 rounded border-[#23252a] accent-[#e4f222] cursor-pointer disabled:opacity-50"
              />
            </div>

            {registration.attend === "YES" && !isNewRegistration ? (
              <button
                onClick={onBackToLanding}
                className="w-full py-2.5 bg-[#161718] hover:bg-[#23252a] border border-[#23252a] text-white font-[510] rounded-[6px] text-xs transition-colors"
              >
                Back to Home
              </button>
            ) : (
              <div className="flex gap-2.5">
                <button
                  onClick={() => {
                    setRegistration(null);
                    setIsNewRegistration(false);
                  }}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-transparent hover:bg-[#161718] border border-[#23252a] text-[#d0d6e0] font-[510] rounded-[6px] text-xs transition-colors"
                >
                  Change ID
                </button>
                <button
                  onClick={handleMarkPresent}
                  disabled={submitting}
                  className="flex-1 py-2.5 bg-[#e4f222] hover:brightness-105 disabled:opacity-50 text-[#08090a] font-[510] rounded-[6px] text-xs flex items-center justify-center gap-1.5 transition-all shadow-sm"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Confirm Check-In</span>
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
