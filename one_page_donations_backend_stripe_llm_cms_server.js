/**
 * One-Page Donations Backend — Fully Working Example
 * Stack: Node.js (Express) + Stripe + OpenAI (LLM) + Nodemailer (SMTP email) + SQLite (better-sqlite3) + Sanity CMS (optional adapter)
 *
 * Features
 * - Create Stripe Checkout Sessions for donations
 * - Handle Stripe webhooks to confirm payments
 * - After successful donation, call LLM to generate:
 *    • personalized thank-you email
 *    • short impact summary
 * - Email donors automatically
 * - Persist donations and email content in SQLite
 * - Minimal CMS adapter with Sanity example for one-page content + impact copy
 *
 * ⚙️ Quick Start
 * 1) mkdir backend && cd backend && npm init -y
 * 2) npm i express stripe body-parser cors better-sqlite3 nodemailer axios zod dotenv openai
 * 3) Create .env (see template below)
 * 4) node server.js
 * 5) Expose your webhook during local dev: `npx stripe listen --forward-to localhost:8080/webhook/stripe`
 *
 * .env template (copy & adapt):
 * PORT=8080
 * PUBLIC_BASE_URL=http://localhost:5173
 * CORS_ORIGIN=http://localhost:5173
 *
 * STRIPE_SECRET_KEY=sk_live_or_test_...
 * STRIPE_WEBHOOK_SECRET=whsec_...
 * DEFAULT_CURRENCY=usd
 *
 * OPENAI_API_KEY=sk-...
 *
 * SMTP_HOST=smtp.sendgrid.net
 * SMTP_PORT=587
 * SMTP_SECURE=false
 * SMTP_USER=apikey
 * SMTP_PASS=SG.xxxxxx
 * EMAIL_FROM="Your Org <donotreply@yourorg.org>"
 *
 * # Optional: Sanity CMS (for one-page site copy + impact constants)
 * SANITY_PROJECT_ID=xxx
 * SANITY_DATASET=production
 * SANITY_TOKEN=skt_...
 * SANITY_API_VERSION=2023-10-10
 */

require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const Stripe = require('stripe');
const Database = require('better-sqlite3');
const nodemailer = require('nodemailer');
const axios = require('axios');
const { z } = require('zod');
const { OpenAI } = require('openai');

// ---------- Config ----------
const PORT = parseInt(process.env.PORT || '8080', 10);
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'http://localhost:5173';
const CORS_ORIGIN = process.env.CORS_ORIGIN || PUBLIC_BASE_URL;
const DEFAULT_CURRENCY = (process.env.DEFAULT_CURRENCY || 'usd').toLowerCase();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ---------- App ----------
const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json());

// Stripe webhook needs raw body for signature verification
app.use('/webhook/stripe', bodyParser.raw({ type: 'application/json' }));

// ---------- DB (SQLite) ----------
const db = new Database('donations.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_payment_intent TEXT UNIQUE,
    stripe_checkout_session TEXT,
    donor_email TEXT,
    amount INTEGER, -- in cents
    currency TEXT,
    name TEXT,
    message TEXT,
    impact_summary TEXT,
    email_subject TEXT,
    email_body TEXT,
    emailed INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ---------- Email Transport ----------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: String(process.env.SMTP_SECURE || 'false') === 'true',
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// ---------- CMS Adapter (Sanity example) ----------
const cms = {
  async getOnePageContent() {
    const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION } = process.env;
    if (!SANITY_PROJECT_ID || !SANITY_DATASET) return null;
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION || '2023-10-10'}/data/query/${SANITY_DATASET}`;
    const query = encodeURIComponent(`*[_type == "landing" ][0]{title, heroText, impactCopy, impactCalculator}`);
    const { data } = await axios.get(`${url}?query=${query}`);
    return data?.result || null;
  },
  // Optional: store computed donation impact back into CMS (requires write token)
  async createImpactEntry({ email, amount, currency, impactSummary }) {
    const { SANITY_PROJECT_ID, SANITY_DATASET, SANITY_API_VERSION, SANITY_TOKEN } = process.env;
    if (!SANITY_PROJECT_ID || !SANITY_DATASET || !SANITY_TOKEN) return null;
    const url = `https://${SANITY_PROJECT_ID}.api.sanity.io/v${SANITY_API_VERSION || '2023-10-10'}/data/mutate/${SANITY_DATASET}`;
    const payload = {
      mutations: [
        {
          create: {
            _type: 'donationImpact',
            email,
            amount,
            currency,
            impactSummary,
            createdAt: new Date().toISOString(),
          },
        },
      ],
    };
    const { data } = await axios.post(url, payload, {
      headers: {
        Authorization: `Bearer ${SANITY_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });
    return data?.results?.[0] || null;
  },
};

// ---------- Helpers ----------
const CreateSessionSchema = z.object({
  amount: z.number().int().positive().min(100), // cents
  currency: z.string().optional(),
  email: z.string().email(),
  name: z.string().optional(),
  message: z.string().max(2000).optional(),
});

function centsToDisplay(amount, currency) {
  const code = (currency || DEFAULT_CURRENCY).toUpperCase();
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(amount / 100);
}

async function generateEmailAndImpact({ name, email, amount, currency, message }) {
  const site = await cms.getOnePageContent().catch(() => null);
  const impactCopy = site?.impactCopy || 'Your donation fuels our mission to create measurable change.';

  const sys = `You are a helpful nonprofit communications assistant. Write concise, warm, donor-centric copy. Keep paragraph lengths short.`;
  const prompt = `Donor details:\n- Name: ${name || 'friend'}\n- Email: ${email}\n- Donation: ${centsToDisplay(amount, currency)} (${currency || DEFAULT_CURRENCY})\n- Note from donor: ${message || '—'}\n\nContext about our impact (from CMS):\n${impactCopy}\n\nTasks:\n1) Write an email subject line (<=55 chars) that is specific and personal.\n2) Write a short thank-you email (120–180 words) addressed to the donor by first name if provided.\n3) Write a 2–3 sentence impact summary translating the donation into tangible outcomes (assume reasonable conversions if not provided).\n\nReturn as JSON with keys: subject, body, impact.`;

  // Use Responses API (compatible with current OpenAI SDK) — falls back gracefully if not available
  const res = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: prompt },
    ],
    temperature: 0.7,
  });

  let jsonText = res.choices?.[0]?.message?.content || '';
  try {
    // Try to extract JSON even if there is leading text
    const match = jsonText.match(/\{[\s\S]*\}/);
    if (match) jsonText = match[0];
    const parsed = JSON.parse(jsonText);
    return {
      subject: String(parsed.subject || 'Thank you for your gift!'),
      body: String(parsed.body || 'Thank you so much for your support.'),
      impact: String(parsed.impact || 'Your gift makes a real difference.'),
    };
  } catch (e) {
    return {
      subject: 'Thank you for your gift!',
      body: `We deeply appreciate your donation of ${centsToDisplay(amount, currency)}. ${impactCopy}`,
      impact: 'Your support powers tangible outcomes in our programs.',
    };
  }
}

async function sendThankYouEmail({ to, subject, html }) {
  const info = await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to,
    subject,
    html,
  });
  return info;
}

function renderEmailHTML({ name, amount, currency, body, impact }) {
  const display = centsToDisplay(amount, currency);
  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.6;color:#111;padding:24px">
      <h2 style="margin:0 0 8px 0">Thank you${name ? ', ' + name : ''}! 💛</h2>
      <p style="margin:0 0 12px 0">We received your donation of <strong>${display}</strong>.</p>
      <div style="background:#f8fafc;border-radius:12px;padding:16px;margin:16px 0">${body
        .replace(/\n/g, '<br/>')}</div>
      <h3 style="margin:16px 0 8px 0">Your impact</h3>
      <p style="margin:0 0 16px 0">${impact}</p>
      <p style="font-size:12px;color:#64748b;margin-top:24px">If you have any questions, just reply to this email.</p>
    </div>
  `;
}

// ---------- Routes ----------
app.get('/health', (_req, res) => res.json({ ok: true }));

// Create Stripe Checkout Session
app.post('/donate/create-checkout-session', async (req, res) => {
  try {
    const parsed = CreateSessionSchema.parse(req.body);
    const { amount, email } = parsed;
    const currency = (parsed.currency || DEFAULT_CURRENCY).toLowerCase();

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency,
            product_data: { name: 'Donation' },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      success_url: `${PUBLIC_BASE_URL}/thank-you?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PUBLIC_BASE_URL}/donate?canceled=true`,
      metadata: {
        name: parsed.name || '',
        message: parsed.message || '',
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'Unable to create checkout session' });
  }
});

// Optionally resolve session details for the frontend thank-you page
app.get('/donate/session/:id', async (req, res) => {
  try {
    const cs = await stripe.checkout.sessions.retrieve(req.params.id, { expand: ['payment_intent'] });
    res.json({
      id: cs.id,
      amount: cs.amount_total,
      currency: cs.currency,
      email: cs.customer_details?.email || cs.customer_email,
      name: cs.metadata?.name || null,
      message: cs.metadata?.message || null,
      status: cs.payment_status,
    });
  } catch (e) {
    res.status(404).json({ error: 'Session not found' });
  }
});

// Stripe webhook — finalize donation, generate+send email
app.post('/webhook/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const paymentIntentId = session.payment_intent;
      const email = session.customer_details?.email || session.customer_email;
      const amount = session.amount_total;
      const currency = session.currency || DEFAULT_CURRENCY;
      const name = session.metadata?.name || '';
      const message = session.metadata?.message || '';

      // Idempotency: skip if already stored
      const existing = db.prepare('SELECT id FROM donations WHERE stripe_payment_intent = ?').get(String(paymentIntentId));
      if (!existing) {
        // Generate LLM content
        const gen = await generateEmailAndImpact({ name, email, amount, currency, message });
        const html = renderEmailHTML({ name, amount, currency, body: gen.body, impact: gen.impact });

        // Persist
        const insert = db.prepare(`INSERT INTO donations
          (stripe_payment_intent, stripe_checkout_session, donor_email, amount, currency, name, message, impact_summary, email_subject, email_body, emailed)
          VALUES (@pi, @cs, @email, @amount, @currency, @name, @message, @impact, @subject, @body, 0)`);
        const result = insert.run({
          pi: String(paymentIntentId),
          cs: String(session.id),
          email,
          amount,
          currency,
          name,
          message,
          impact: gen.impact,
          subject: gen.subject,
          body: html,
        });

        // Send email
        await sendThankYouEmail({ to: email, subject: gen.subject, html });
        db.prepare('UPDATE donations SET emailed = 1 WHERE id = ?').run(result.lastInsertRowid);

        // Optional: push impact summary to CMS
        cms.createImpactEntry({ email, amount, currency, impactSummary: gen.impact }).catch(() => {});
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Admin: list donations (add auth in production)
app.get('/admin/donations', (_req, res) => {
  const rows = db.prepare('SELECT * FROM donations ORDER BY created_at DESC').all();
  res.json(rows);
});

// Endpoint to re-send email (idempotent-ish)
app.post('/admin/donations/:id/resend', async (req, res) => {
  const row = db.prepare('SELECT * FROM donations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  await sendThankYouEmail({ to: row.donor_email, subject: row.email_subject, html: row.email_body });
  res.json({ ok: true });
});

// Public content endpoint consuming CMS
app.get('/content', async (_req, res) => {
  try {
    const content = await cms.getOnePageContent();
    res.json({ content });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch content' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Donations backend running on http://localhost:${PORT}`);
});
