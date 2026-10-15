import { useState } from "react";
import { supabase } from "../supabaseClient";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  X,
  Sparkles,
  ShieldCheck
} from "lucide-react";

export default function Login({ onNavigate, onLoginSuccess, theme }) {
  const isDark = theme ? theme === "dark" : (typeof document !== "undefined" ? document.documentElement.classList.contains("dark") : true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Password Reset Drawer / Modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [resetError, setResetError] = useState("");

  const handleNavigateHome = () => {
    if (onNavigate) {
      onNavigate("home");
    } else {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleNavigateRegister = () => {
    if (onNavigate) {
      onNavigate("register");
    } else {
      window.history.pushState({}, "", "/register");
      window.dispatchEvent(new Event("popstate"));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage("");

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail || !password) {
      setErrorMessage("Please enter both email and password.");
      return;
    }

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password: password,
      });

      if (error) {
        setErrorMessage(error.message || "Invalid credentials. Please verify your email and password.");
        setLoading(false);
        return;
      }

      if (data?.user) {
        // Fetch profile to verify role and status
        const { data: profile } = await supabase
          .from("profiles")
          .select("id, email, full_name, preferred_name, role, st_id, status")
          .eq("id", data.user.id)
          .maybeSingle();

        const userRole = profile?.role || "member";
        const userStatus = profile?.status || "approved";

        const profileData = {
          role: userRole,
          stId: profile?.st_id || "",
          name: profile?.preferred_name || profile?.full_name || data.user.email || "",
          fullName: profile?.full_name || "",
          preferredName: profile?.preferred_name || "",
          email: profile?.email || data.user.email || "",
          userId: data.user.id,
          status: userStatus,
        };

        if (onLoginSuccess) {
          onLoginSuccess(profileData);
        } else {
          // Default redirection: update cache and push home
          try {
            localStorage.setItem("adss-profile-cache", JSON.stringify(profileData));
          } catch { }
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new Event("popstate"));
        }
      }
    } catch (err) {
      console.error("Login exception:", err);
      setErrorMessage(err.message || "An unexpected error occurred during sign in.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetPassword = async (e) => {
    e.preventDefault();
    setResetError("");
    setResetSuccess(false);

    const trimmed = (resetEmail || email).trim().toLowerCase();
    if (!trimmed) {
      setResetError("Please enter your registered email address.");
      return;
    }

    setResetLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: window.location.origin + "/#reset-password",
      });

      if (error) {
        setResetError(error.message);
      } else {
        setResetSuccess(true);
      }
    } catch (err) {
      setResetError(err.message || "Failed to send reset link.");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${isDark ? "bg-[#08090a] text-[#d0d6e0] selection:bg-[#e4f222] selection:text-[#08090a]" : "bg-[#f8f9fa] text-gray-800 selection:bg-gray-900 selection:text-white"} font-inter-variable relative flex flex-col justify-between overflow-x-hidden`}>
      {/* Background Subtle Radial Grid Dots (Linear style) */}
      <div
        className={`absolute inset-0 pointer-events-none ${isDark ? "opacity-[0.03]" : "opacity-[0.05]"}`}
        style={{
          backgroundImage: `radial-gradient(${isDark ? "#ffffff" : "#000000"} 1px, transparent 1px)`,
          backgroundSize: "24px 24px",
        }}
      />

      {/* Atmospheric Glow at the top */}
      <div className={`absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[260px] bg-gradient-to-b ${
        isDark ? "from-white/[0.04]" : "from-black/[0.02]"
      } to-transparent blur-3xl pointer-events-none`} />

      {/* ── Top Header Navigation ────────────────────────────────────────── */}
      <header className="relative z-10 w-full max-w-[1200px] mx-auto px-6 h-16 flex items-center justify-between">
        {/* Back to Home Button */}
        <button
          onClick={handleNavigateHome}
          className={`inline-flex items-center gap-2 text-[13px] transition-colors cursor-pointer group ${
            isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <ArrowLeft className={`w-4 h-4 group-hover:-translate-x-0.5 transition-transform ${isDark ? "text-[#8a8f98]" : "text-gray-500"}`} />
          <span>Back to ADSS Ruhuna</span>
        </button>

        {/* Brand Wordmark & Logo */}
        <div
          onClick={handleNavigateHome}
          className="flex items-center gap-2.5 cursor-pointer"
        >
          <div className={`w-6 h-6 rounded-[4px] border flex items-center justify-center p-1 ${
            isDark ? "bg-[#161718] border-[#23252a]" : "bg-white border-gray-200 shadow-sm"
          }`}>
            <img
              alt="ADSS Logo"
              className="w-full h-full object-contain"
              src={`${import.meta.env.BASE_URL}${isDark ? "logo_trans_light.png" : "logo_trans_dark.png"}`}
            />
          </div>
          <span className={`text-[14px] font-[510] tracking-[-0.015em] hidden sm:inline ${
            isDark ? "text-white" : "text-gray-900 font-semibold"
          }`}>
            ADSS Ruhuna
          </span>
        </div>

        {/* Register CTA Link */}
        <button
          onClick={handleNavigateRegister}
          className={`text-[13px] transition-colors cursor-pointer hidden sm:flex items-center gap-1.5 ${
            isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          <span>Need an account?</span>
          <span className={`font-[510] hover:underline ${isDark ? "text-[#d0d6e0]" : "text-gray-900 font-semibold"}`}>Register</span>
        </button>
      </header>

      {/* ── Main Content Container ────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-[420px]">
          {/* Linear Card (Carbon surface, 12px radius, hairline border) */}
          <div className={`rounded-[12px] border p-6 sm:p-8 relative ${
            isDark 
              ? "bg-[#0f1011] border-[#23252a] shadow-[rgb(35,37,42)_0px_0px_0px_1px_inset]" 
              : "bg-white border-gray-200 shadow-lg shadow-gray-200/50"
          }`}>

            {/* Top Indicator Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] border text-[11px] font-berkeley-mono tracking-wider ${
                isDark ? "bg-[#161718] border-[#23252a] text-[#8a8f98]" : "bg-gray-100 border-gray-200 text-gray-600"
              }`}>
                <span className="w-1.5 h-1.5 rounded-full bg-[#27a644] animate-pulse" />
                <span>AUTH // UNIFIED CONSOLE</span>
              </div>
              <span className={`text-[11px] font-berkeley-mono ${isDark ? "text-[#62666d]" : "text-gray-400"}`}>
                PORTAL v2.6
              </span>
            </div>

            {/* Title & Subtitle */}
            <h1 className={`text-[24px] sm:text-[26px] font-[510] tracking-[-0.022em] leading-tight mb-2 ${
              isDark ? "text-white" : "text-gray-900 font-semibold"
            }`}>
              Sign in to ADSS Ruhuna
            </h1>
            <p className={`text-[13.5px] font-[400] leading-relaxed mb-6 ${
              isDark ? "text-[#8a8f98]" : "text-gray-600"
            }`}>
              Enter your registered email and password to access the society dashboard, verify attendance, and view digital passes.
            </p>

            {/* Error Notification Banner */}
            {errorMessage && (
              <div className={`mb-5 p-3 rounded-[6px] border text-[13px] flex items-start gap-2.5 ${
                isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
              }`}>
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="leading-snug">{errorMessage}</div>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email Address */}
              <div>
                <label className={`block text-[13px] font-[510] mb-1.5 ${
                  isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                }`}>
                  Email address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    autoFocus
                    autoComplete="email"
                    placeholder="student@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full px-3.5 py-2.5 rounded-[6px] border text-[14px] transition-colors focus:outline-none ${
                      isDark 
                        ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]" 
                        : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                    }`}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className={`text-[13px] font-[510] ${
                    isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"
                  }`}>
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setResetEmail(email);
                      setResetError("");
                      setResetSuccess(false);
                      setShowResetModal(true);
                    }}
                    className={`text-[12px] transition-colors cursor-pointer ${
                      isDark ? "text-[#8a8f98] hover:text-[#d0d6e0]" : "text-gray-500 hover:text-gray-900"
                    }`}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full pl-3.5 pr-10 py-2.5 rounded-[6px] border text-[14px] transition-colors focus:outline-none ${
                      isDark 
                        ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] hover:border-[#383b3f] focus:border-[#d0d6e0] focus:bg-[#0f1011] text-[#d0d6e0] placeholder:text-[#62666d]" 
                        : "bg-gray-50/80 border-gray-200 hover:border-gray-300 focus:border-gray-900 focus:bg-white text-gray-900 placeholder:text-gray-400 shadow-sm"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors cursor-pointer p-0.5 ${
                      isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"
                    }`}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Primary Acid Lime CTA Button */}
              <button
                type="submit"
                disabled={loading}
                className="linear-btn-primary w-full mt-6 py-2.5 text-[14px] font-[510] tracking-[-0.011em] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <span className={`w-4 h-4 border-2 ${isDark ? "border-[#08090a]" : "border-white"} border-t-transparent rounded-full animate-spin`} />
                    <span>Verifying credentials...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Console</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Switch to Register */}
            <div className={`border-t mt-6 pt-5 text-center ${isDark ? "border-[#23252a]" : "border-gray-100"}`}>
              <p className={`text-[13px] ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                New member?{" "}
                <button
                  type="button"
                  onClick={handleNavigateRegister}
                  className={`hover:underline font-[510] cursor-pointer inline-flex items-center gap-1 ${
                    isDark ? "text-white" : "text-gray-900 font-semibold"
                  }`}
                >
                  Create member account
                  <ArrowRight className={`w-3 h-3 ${isDark ? "text-[#e4f222]" : "text-indigo-600"}`} />
                </button>
              </p>
            </div>

            {/* Scope Reassurance Badge */}
            <div className={`mt-4 pt-3 border-t flex items-center justify-center gap-2 text-[11px] font-berkeley-mono ${
              isDark ? "border-[#23252a]/50 text-[#62666d]" : "border-gray-100 text-gray-500"
            }`}>
              <ShieldCheck className="w-3.5 h-3.5 text-[#27a644]" />
              <span>Unified Member, Staff & Admin Authorization</span>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className={`relative z-10 w-full max-w-[1200px] mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] ${
        isDark ? "text-[#62666d]" : "text-gray-500"
      }`}>
        <div className="flex items-center gap-2">
          <span>Actuarial & Data Science Society</span>
          <span>•</span>
          <span>University of Ruhuna</span>
        </div>
        <div className={`flex items-center gap-4 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
          <button
            onClick={() => {
              window.history.pushState({}, "", "/privacy");
              window.dispatchEvent(new Event("popstate"));
            }}
            className={`transition-colors cursor-pointer ${isDark ? "hover:text-white" : "hover:text-gray-900"}`}
          >
            Privacy
          </button>
          <button
            onClick={() => {
              window.history.pushState({}, "", "/terms");
              window.dispatchEvent(new Event("popstate"));
            }}
            className={`transition-colors cursor-pointer ${isDark ? "hover:text-white" : "hover:text-gray-900"}`}
          >
            Terms
          </button>
        </div>
      </footer>

      {/* ── Forgot Password Modal ────────────────────────────────────────── */}
      {showResetModal && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm ${
            isDark ? "bg-[#08090a]/80" : "bg-black/40"
          }`}
          onClick={() => setShowResetModal(false)}
        >
          <div
            className={`border rounded-[12px] shadow-2xl w-full max-w-[420px] p-6 relative ${
              isDark ? "bg-[#0f1011] border-[#23252a]" : "bg-white border-gray-200"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowResetModal(false)}
              className={`absolute top-4 right-4 transition-colors cursor-pointer ${
                isDark ? "text-[#8a8f98] hover:text-white" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2.5 mb-2">
              <div className={`w-8 h-8 rounded-[6px] border flex items-center justify-center ${
                isDark ? "bg-[#161718] border-[#23252a] text-[#e4f222]" : "bg-indigo-50 border-indigo-200 text-indigo-600"
              }`}>
                <HelpCircle className="w-4 h-4" />
              </div>
              <h3 className={`text-[17px] font-[510] ${isDark ? "text-white" : "text-gray-900 font-semibold"}`}>
                Password Recovery
              </h3>
            </div>

            <p className={`text-[13px] leading-relaxed mb-4 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
              Enter your registered email address. We will send a secure password reset link to your inbox.
            </p>

            {resetSuccess ? (
              <div className={`p-3.5 rounded-[6px] border text-[13px] mb-4 flex items-start gap-2.5 ${
                isDark ? "bg-[#27a644]/10 border-[#27a644]/30 text-[#d0d6e0]" : "bg-emerald-50 border-emerald-200 text-emerald-800"
              }`}>
                <CheckCircle2 className="w-4 h-4 text-[#27a644] flex-shrink-0 mt-0.5" />
                <div>
                  <strong className={`font-[510] ${isDark ? "text-white" : "text-gray-900"}`}>Reset link dispatched!</strong>
                  <p className={`text-[12px] mt-1 ${isDark ? "text-[#8a8f98]" : "text-gray-600"}`}>
                    Please check your email inbox and spam folder for instructions to create a new password.
                  </p>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendResetPassword} className="space-y-4">
                {resetError && (
                  <div className={`p-2.5 rounded-[6px] border text-[12px] ${
                    isDark ? "bg-[#eb5757]/10 border-[#eb5757]/30 text-[#eb5757]" : "bg-rose-50 border-rose-200 text-rose-700"
                  }`}>
                    {resetError}
                  </div>
                )}

                <div>
                  <label className={`block text-[12px] font-[510] mb-1.5 ${isDark ? "text-[#d0d6e0]" : "text-gray-700 font-medium"}`}>
                    Registered Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="student@email.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className={`w-full px-3 py-2 rounded-[6px] border text-[13.5px] transition-colors focus:outline-none ${
                      isDark 
                        ? "bg-[rgba(255,255,255,0.02)] border-[#23252a] focus:border-[#d0d6e0] text-[#d0d6e0] placeholder:text-[#62666d]" 
                        : "bg-gray-50 border-gray-200 focus:border-gray-900 text-gray-900 placeholder:text-gray-400"
                    }`}
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className={`text-[13px] px-3 py-1.5 rounded-[6px] transition-colors ${
                      isDark ? "linear-btn-ghost" : "bg-white border border-gray-200 hover:bg-gray-100 text-gray-700 shadow-sm"
                    }`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="linear-btn-primary text-[13px] px-4 py-1.5"
                  >
                    {resetLoading ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            )}

            <div className={`mt-4 pt-3 border-t text-[11px] flex items-center justify-between ${
              isDark ? "border-[#23252a] text-[#62666d]" : "border-gray-100 text-gray-500"
            }`}>
              <span>Need executive assistance?</span>
              <span className={`font-berkeley-mono ${isDark ? "text-[#8a8f98]" : "text-gray-700 font-medium"}`}>adss@sci.ruh.ac.lk</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

