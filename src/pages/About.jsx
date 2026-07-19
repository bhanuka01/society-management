import { useState } from "react";

const CONTACT_EMAIL = "bhanukadilshan2002@gmail.com";

export default function About({ session }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null); // { type: "success" | "error", text: string }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!message.trim()) {
      setStatus({ type: "error", text: "Please enter a message before sending." });
      return;
    }

    setSending(true);
    setStatus(null);

    const formData = new FormData();
    formData.append("access_key", "a550f902-9114-4a93-be4f-44fd2145d58e");
    formData.append("subject", "Society Management System - Issue Report");
    formData.append("name", session?.name || "Guest User");
    formData.append("email", session?.email || "no-reply@society.com");

    const formattedMessage = `
Sender Details:
------------------------------------------
Name: ${session?.name || "Guest User"}
Email: ${session?.email || "Not Available"}
Student ID: ${session?.stId || "Not Available"}
Role: ${session?.role || "guest"}

System Context:
------------------------------------------
User Agent: ${navigator.userAgent}
URL: ${window.location.href}
Time: ${new Date().toLocaleString()}

Message/Issue Description:
------------------------------------------
${message.trim()}
`;
    formData.append("message", formattedMessage);

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        setStatus({ type: "success", text: "Your message has been sent successfully!" });
        setMessage("");
      } else {
        setStatus({ type: "error", text: data.message || "Failed to send the email. Please try again." });
      }
    } catch (error) {
      setStatus({ type: "error", text: "A network error occurred. Please check your connection." });
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon"><span className="material-symbols-outlined">info</span></span> About</h1>
        <p className="page-subtitle">society details, developer information, and issue contact</p>
      </div>

      {/* <div className="about-grid"> */}
      <section className="card about-card">
        <div className="card-header">
          <span className="card-title">Society Information</span>
        </div>
        <h2 className="about-heading">ADSS Society Manager</h2>
        <p className="about-text">
          This system helps manage society members, events, committee assignments, and attendance records in one place.
        </p>
        <div className="about-list">
          <div><span>Purpose</span><strong>Student society record management</strong></div>
          <div><span>Modules</span><strong>Members, Events, OC, Attendance</strong></div>
        </div>
      </section>

      {/* <section className="card about-card">
          <div className="card-header">
            <span className="card-title">Developer Information</span>
          </div>
          <h2 className="about-heading">Bhanuka</h2>
          <p className="about-text">
            Developed for simple, fast, and organized society administration with role-based access for members and admins.
          </p>
          <div className="about-list">
            <div><span>Role</span><strong>System Developer</strong></div>
            <div><span>App Type</span><strong>React + Supabase web app</strong></div>
          </div>
        </section> */}
      {/* </div> */}
      <div style={{ height: "20px" }}></div>

      <form onSubmit={handleSubmit}>
        <section className="card about-contact">
          <div className="card-header">
            <span className="card-title">Contact For Issues</span>
            <span className="badge badge-gray">{CONTACT_EMAIL}</span>
          </div>
          <p className="about-text" style={{ marginBottom: "16px" }}>
            Developed by <strong><a href="https://bhanukadilshan.me/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent2)", textDecoration: "none" }}>Bhanuka Dilshan</a></strong>. If you encounter any bugs, issues, or have feedback, please write a message below to send an email.
          </p>

          {status && (
            <div className={`alert alert-${status.type}`} style={{ marginBottom: "16px" }}>
              {status.text}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label>Short Message</label>
              <textarea
                rows="4"
                placeholder="Write the issue shortly..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                disabled={sending}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn btn-primary" type="submit" disabled={sending}>
              {sending ? "Sending..." : "Send Email"}
            </button>
          </div>
        </section>
      </form>
      {/* <div style={{ height: "10px" }}></div>
      <div style={{ textAlign: "center", fontStyle: "italic", opacity: 0.8 }}> Developed by <a href="https://bhanukadilshan.me/" target="_blank" rel="noopener noreferrer" style={{ color: "inherit", textDecoration: "underline" }}>Bhanuka Dilshan</a></div> */}
    </div>
  );
}
