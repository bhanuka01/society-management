import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { StudentProfileProvider } from "./components/StudentProfileContext";
import { AiChatProvider } from "./components/AiChatContext";
import { CycleProvider } from "./context/CycleContext";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <CycleProvider>
      <StudentProfileProvider>
        <AiChatProvider>
          <App />
        </AiChatProvider>
      </StudentProfileProvider>
    </CycleProvider>
  </React.StrictMode>
);

