import React, { useState } from "react";
import { PayPalScriptProvider, PayPalButtons } from "@paypal/react-paypal-js";

export default function DonationsApp() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState("");

  const BACKEND_URL = "http://localhost:8080"; // Change later when deploying

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <div className="bg-white shadow-2xl rounded-2xl p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-4 text-center text-blue-600">
          🌍 Support Our Cause
        </h1>
        <p className="text-gray-600 mb-6 text-center">
          Enter your email and donation amount, then pay securely with PayPal.
        </p>

        {/* Email input */}
        <input
          type="email"
          placeholder="Your Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-lg p-2 mb-3"
        />

        {/* Amount input */}
        <input
          type="number"
          placeholder="Donation Amount (USD)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full border rounded-lg p-2 mb-6"
        />

        {/* PayPal Button */}
        <PayPalScriptProvider
          options={{
            "client-id": "test", // Sandbox test client ID — backend creates real orders
            currency: "USD",
          }}
        >
          <PayPalButtons
            style={{ layout: "vertical" }}
            createOrder={async () => {
              try {
                const res = await fetch(`${BACKEND_URL}/donate/create-order`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({ amount, email }),
                });
                const data = await res.json();
                return data.id; // orderId from backend
              } catch (err) {
                console.error("Error creating order:", err);
                setStatus("❌ Failed to create order");
              }
            }}
            onApprove={async (data) => {
              try {
                const res = await fetch(
                  `${BACKEND_URL}/donate/capture-order`,
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      orderID: data.orderID,
                      email,
                      amount,
                    }),
                  }
                );
                const details = await res.json();
                if (details.status === "COMPLETED") {
                  setStatus("✅ Thank you for your donation!");
                } else {
                  setStatus("⚠️ Payment not completed.");
                }
              } catch (err) {
                console.error("Error capturing order:", err);
                setStatus("❌ Failed to capture order");
              }
            }}
          />
        </PayPalScriptProvider>

        {/* Status message */}
        {status && (
          <p className="mt-4 text-center font-semibold text-green-600">
            {status}
          </p>
        )}
      </div>
    </div>
  );
}
