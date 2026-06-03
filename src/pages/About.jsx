import { useState } from "react";

const CONTACT_EMAIL = "bhanukadilshan2002@gmail.com";

export default function About() {
  const [message, setMessage] = useState("");

  const mailSubject = encodeURIComponent("Society Management System Issue");
  const mailBody = encodeURIComponent(message.trim() || "Hi, I need help with the Society Management System.");
  const mailHref = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title"><span className="icon">*</span> About</h1>
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
          <div><span>Database</span><strong>Supabase</strong></div>
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

      <section className="card about-contact">
        <div className="card-header">
          <span className="card-title">Contact For Issues</span>
          <span className="badge badge-gray">{CONTACT_EMAIL}</span>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Short Message</label>
            <textarea
              rows="4"
              placeholder="Write the issue shortly..."
              value={message}
              onChange={e => setMessage(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-actions">
          <a className="btn btn-primary" href={mailHref}>Send Email</a>
        </div>
      </section>
      <div style={{ height: "10px" }}></div>
      <div style={{ textAlign: "center", fontStyle: "italic", opacity: 0.8 }}> Developed by Bhanuka Dilshan</div>
    </div>


  );
}
