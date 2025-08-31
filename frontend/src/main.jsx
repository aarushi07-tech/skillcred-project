import React from "react";
import ReactDOM from "react-dom/client";
import DonationsApp from "./one_page_donations_frontend_react_vite_tailwind.jsx";
import "./index.css"; // only if you have styles (optional)

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <DonationsApp />
  </React.StrictMode>
);
