import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StudentProfileProvider } from "./components/StudentProfileContext";
import { AiChatProvider } from "./components/AiChatContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <StudentProfileProvider>
      <AiChatProvider>
        <App />
      </AiChatProvider>
    </StudentProfileProvider>
  </React.StrictMode>
);
