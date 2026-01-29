const express = require("express");
const cors = require("cors");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;
const allowedOrigin = process.env.ALLOWED_ORIGIN || "*";

app.use(
  cors({
    origin: allowedOrigin,
  })
);
app.use(express.json());

const resendKey = process.env.RESEND_API_KEY || "";
const resendFrom = process.env.RESEND_FROM || "";

const codeStore = new Map();
const CODE_TTL_MS = 5 * 60 * 1000;
const MIN_RESEND_MS = 30 * 1000;

const normalizeEmail = (value) => value.trim().toLowerCase();
const isValidEmail = (value) => /.+@.+\..+/.test(value);

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

const sendEmail = async (to, code) => {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFrom,
      to: [to],
      subject: "Your verification code",
      text: `Your verification code is ${code}. It expires in 5 minutes.`,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    const error = new Error("resend_failed");
    error.detail = text;
    throw error;
  }
};

app.post("/api/send-code", async (req, res) => {
  const email = req.body && typeof req.body.email === "string" ? req.body.email : "";
  const cleanEmail = normalizeEmail(email);

  if (!isValidEmail(cleanEmail)) {
    return res.status(400).json({ error: "invalid_email" });
  }

  if (!resendKey || !resendFrom) {
    return res.status(500).json({ error: "server_not_configured" });
  }

  const now = Date.now();
  const existing = codeStore.get(cleanEmail);
  if (existing && now - existing.lastSentAt < MIN_RESEND_MS) {
    const waitSeconds = Math.ceil((MIN_RESEND_MS - (now - existing.lastSentAt)) / 1000);
    return res.status(429).json({ error: "rate_limited", retryAfter: waitSeconds });
  }

  const code = Math.floor(100000 + Math.random() * 900000).toString();
  codeStore.set(cleanEmail, {
    code,
    expiresAt: now + CODE_TTL_MS,
    lastSentAt: now,
  });

  try {
    await sendEmail(cleanEmail, code);
    return res.json({ ok: true });
  } catch (error) {
    console.error("Resend failed:", error.detail || error.message || error);
    codeStore.delete(cleanEmail);
    return res.status(500).json({ error: "send_failed" });
  }
});

app.post("/api/verify-code", (req, res) => {
  const email = req.body && typeof req.body.email === "string" ? req.body.email : "";
  const code = req.body && typeof req.body.code === "string" ? req.body.code : "";
  const cleanEmail = normalizeEmail(email);

  if (!isValidEmail(cleanEmail) || !code) {
    return res.status(400).json({ error: "invalid_request" });
  }

  const entry = codeStore.get(cleanEmail);
  if (!entry) {
    return res.status(404).json({ error: "code_not_found" });
  }

  if (Date.now() > entry.expiresAt) {
    codeStore.delete(cleanEmail);
    return res.status(410).json({ error: "code_expired" });
  }

  if (code !== entry.code) {
    return res.status(400).json({ error: "invalid_code" });
  }

  codeStore.delete(cleanEmail);
  return res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Verification server running on port ${port}`);
});
