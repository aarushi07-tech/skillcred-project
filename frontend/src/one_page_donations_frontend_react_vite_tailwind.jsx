import React, { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

function DonationsApp() {
  const [amount, setAmount] = useState("10");
  const [email, setEmail] = useState("");

  const API_URL =
    import.meta.env.VITE_API_URL || "http://localhost:8080"; // Works locally & on Render

  const createOrder = async () => {
    const res = await fetch(`${API_URL}/donate/create-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount }),
    });
    const data = await res.json();
    return data.orderID;
  };

  const onApprove = async (data) => {
    const res = await fetch(`${API_URL}/donate/capture-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderID: data.orderID,
        donorEmail: email,
      }),
    });
    const capture = await res.json();
    alert("🎉 " + capture.message);
  };

  return (
    <PayPalScriptProvider options={{ "client-id": "test" }}>
      <div className="min-h-screen flex flex-col justify-center items-center bg-gray-100 p-4">
        <h1 className="text-3xl font-bold mb-4">Donate</h1>

        <input
          type="email"
          placeholder="Your email"
          className="border p-2 mb-2"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="number"
          placeholder="Donation amount"
          className="border p-2 mb-4"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <PayPalButtons
          style={{ layout: "vertical" }}
          createOrder={createOrder}
          onApprove={onApprove}
        />
      </div>
    </PayPalScriptProvider>
  );
}

export default DonationsApp;
