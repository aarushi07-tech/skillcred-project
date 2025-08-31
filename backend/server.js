import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import paypal from "@paypal/checkout-server-sdk";

dotenv.config();

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 8080;

// PayPal environment setup
const clientId = process.env.PAYPAL_CLIENT_ID;
const clientSecret = process.env.PAYPAL_CLIENT_SECRET;

const environment = new paypal.core.SandboxEnvironment(clientId, clientSecret);
const client = new paypal.core.PayPalHttpClient(environment);

// ✅ Create an order
app.post("/donate/create-order", async (req, res) => {
  const { amount, email } = req.body;

  if (!amount || !email) {
    return res.status(400).json({ error: "Amount and email are required" });
  }

  const request = new paypal.orders.OrdersCreateRequest();
  request.prefer("return=representation");
  request.requestBody({
    intent: "CAPTURE",
    purchase_units: [
      {
        amount: {
          currency_code: "USD",
          value: amount,
        },
      },
    ],
  });

  try {
    const order = await client.execute(request);
    res.json({ id: order.result.id });
  } catch (err) {
    console.error("PayPal create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
});

// ✅ Capture an order
app.post("/donate/capture-order", async (req, res) => {
  const { orderID, email, amount } = req.body;

  if (!orderID) {
    return res.status(400).json({ error: "Order ID is required" });
  }

  const request = new paypal.orders.OrdersCaptureRequest(orderID);
  request.requestBody({});

  try {
    const capture = await client.execute(request);
    const status = capture.result.status;

    if (status === "COMPLETED") {
      console.log(`✅ Payment completed for ${email}, Amount: $${amount}`);

      // Send thank you email (if SMTP is configured)
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        const transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Donations App" <${process.env.SMTP_USER}>`,
          to: email,
          subject: "🙏 Thank you for your donation!",
          text: `We truly appreciate your support. You donated $${amount}. This will make a big impact!`,
        });
      }

      return res.json({ status: "COMPLETED" });
    } else {
      return res.json({ status });
    }
  } catch (err) {
    console.error("PayPal capture error:", err);
    res.status(500).json({ error: "Failed to capture order" });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
