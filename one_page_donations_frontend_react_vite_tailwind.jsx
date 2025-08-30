// main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// App.jsx
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import DonateForm from "./DonateForm";
import ThankYou from "./ThankYou";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50 flex flex-col">
        <header className="bg-white shadow p-4">
          <h1 className="text-2xl font-bold text-center text-blue-700">
            Support Our Mission
          </h1>
        </header>
        <main className="flex-grow flex items-center justify-center p-6">
          <Routes>
            <Route path="/" element={<DonateForm />} />
            <Route path="/thank-you" element={<ThankYou />} />
          </Routes>
        </main>
        <footer className="p-4 text-center text-gray-500 text-sm">
          © {new Date().getFullYear()} Your Org
        </footer>
      </div>
    </BrowserRouter>
  );
}

// api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8080";

export async function createCheckoutSession(data) {
  const res = await fetch(`${API_BASE}/donate/create-checkout-session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create session");
  return res.json();
}

export async function fetchSession(id) {
  const res = await fetch(`${API_BASE}/donate/session/${id}`);
  if (!res.ok) throw new Error("Failed to fetch session");
  return res.json();
}

export async function fetchContent() {
  const res = await fetch(`${API_BASE}/content`);
  if (!res.ok) throw new Error("Failed to fetch content");
  return res.json();
}

// DonateForm.jsx
import { useState, useEffect } from "react";
import { createCheckoutSession, fetchContent } from "./api";

export default function DonateForm() {
  const [amount, setAmount] = useState(2000); // default $20
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState(null);

  useEffect(() => {
    fetchContent().then((res) => setContent(res.content));
  }, []);

  async function handleDonate(e) {
    e.preventDefault();
    setLoading(true);
    try {
      const { url } = await createCheckoutSession({
        amount,
        email,
        name,
        message,
      });
      window.location.href = url;
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow p-6">
      <h2 className="text-xl font-semibold mb-4 text-center">
        {content?.title || "Make a Donation"}
      </h2>
      <p className="text-gray-600 mb-6 text-center">
        {content?.heroText || "Your gift fuels our mission."}
      </p>
      <form onSubmit={handleDonate} className="space-y-4">
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          min="100"
          step="100"
          required
          className="w-full border rounded-lg p-2"
          placeholder="Amount in cents"
        />
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border rounded-lg p-2"
          placeholder="Your email"
        />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full border rounded-lg p-2"
          placeholder="Your name (optional)"
        />
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          className="w-full border rounded-lg p-2"
          placeholder="Message (optional)"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Processing..." : "Donate"}
        </button>
      </form>
    </div>
  );
}

// ThankYou.jsx
import { useEffect, useState } from "react";
import { fetchSession } from "./api";

export default function ThankYou() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("session_id");
    if (id) {
      fetchSession(id)
        .then(setSession)
        .finally(() => setLoading(false));
    }
  }, []);

  if (loading) return <p>Loading...</p>;
  if (!session) return <p>Donation session not found.</p>;

  return (
    <div className="max-w-md bg-white rounded-2xl shadow p-6 text-center">
      <h2 className="text-2xl font-bold mb-4">Thank You! 💛</h2>
      <p className="mb-2">
        We received your gift of <strong>{session.amount / 100} {session.currency.toUpperCase()}</strong>.
      </p>
      <p className="mb-4">A personalized thank-you email is on its way to {session.email}.</p>
      {session.message && (
        <p className="text-sm text-gray-600 border-t pt-4">Your note: "{session.message}"</p>
      )}
    </div>
  );
}

// index.css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-gray-50;
}
