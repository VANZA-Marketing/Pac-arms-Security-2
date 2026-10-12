// Vercel Serverless Function — POST /api/contact
// Receives the contact form, blocks bots/abuse, then emails the submission via Resend.
//
// Security measures:
//   - Same-origin guard (blocks direct/cross-site abuse of the endpoint)
//   - Honeypot (drops obvious bots)
//   - Strict input validation + length caps + control-char stripping
//   - Oversized-payload guard
//   - No full PII written to logs (email masked, message body not logged)
//   - HTML-escaped email output (no injection into the notification email)
//
// SETUP:
//   Set RESEND_API_KEY in Vercel env vars (Production). The CONTACT_FROM domain
//   must be verified in Resend. Optional: CONTACT_TO, CONTACT_FROM.

const ALLOWED_HOSTS = ["pacarmedsecurity.com", "www.pacarmedsecurity.com"];

// Only accept submissions that originate from our own site (real browser form
// posts always send Origin/Referer). Blocks naive scripted spam to the endpoint.
function originAllowed(req) {
  const hay = ((req.headers["origin"] || "") + " " + (req.headers["referer"] || "")).toLowerCase();
  if (!hay.trim()) return false; // no browser context -> likely a bot/script
  if (ALLOWED_HOSTS.some(function (h) { return hay.indexOf("//" + h) !== -1 || hay.indexOf("." + h) !== -1; })) return true;
  if (hay.indexOf(".vercel.app") !== -1) return true; // Vercel preview/prod URLs
  return false;
}

const LIMITS = { name: 120, email: 200, phone: 40, company: 160, location: 120, service: 120, training: 160, message: 4000 };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function clean(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]+/g, " ").trim().slice(0, max);
}
function maskEmail(e) {
  const parts = String(e).split("@");
  return parts[1] ? (parts[0].slice(0, 2) + "***@" + parts[1]) : "***";
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Same-origin guard.
  if (!originAllowed(req)) {
    return res.status(403).json({ ok: false, error: "forbidden" });
  }

  // Oversized-payload guard.
  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (raw && raw.length > 20000) {
    return res.status(413).json({ ok: false, error: "payload_too_large" });
  }

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

  // Honeypot: real users never fill this hidden field. Silently accept + drop.
  if (body["bot-field"]) {
    return res.status(200).json({ ok: true });
  }

  // Validate + sanitize.
  const name = clean(body.name, LIMITS.name);
  const email = clean(body.email, LIMITS.email);
  const phone = clean(body.phone, LIMITS.phone);
  if (!name || !email || !phone) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, error: "invalid_email" });
  }

  const submission = {
    name: name,
    email: email,
    phone: phone,
    company: clean(body.company, LIMITS.company),
    location: clean(body.location, LIMITS.location),
    service: clean(body.service, LIMITS.service),
    training: clean(body.training, LIMITS.training),
    message: clean(body.message, LIMITS.message),
    receivedAt: new Date().toISOString(),
  };

  // Backstop log WITHOUT full PII (no message body; email masked).
  console.log("Contact submission received:", JSON.stringify({
    name: submission.name,
    email: maskEmail(submission.email),
    service: submission.service,
    at: submission.receivedAt,
  }));

  await sendEmail(submission);
  return res.status(200).json({ ok: true });
};

// --- Email delivery via Resend (https://resend.com) -------------------------
async function sendEmail(s) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO || "info@pacarmedsecurity.com";
  const from = process.env.CONTACT_FROM || "Pac Armed Security <noreply@pacarmedsecurity.com>";

  if (!apiKey) {
    console.warn("RESEND_API_KEY is not set — email not sent.");
    return;
  }

  const rows = [
    ["Name", s.name],
    ["Phone", s.phone],
    ["Email", s.email],
    ["Company / Property", s.company],
    ["Service location", s.location],
    ["Security need", s.service],
    ["Training interest", s.training],
  ].filter(function (r) { return r[1]; });

  const text =
    rows.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") +
    "\n\nMessage:\n" + (s.message || "(no message)") +
    "\n\n— Sent from the pacarmedsecurity.com contact form";

  const html =
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#161616">' +
    "<h2 style=\"margin:0 0 12px\">New coverage request</h2><table cellpadding=\"6\" style=\"border-collapse:collapse\">" +
    rows.map(function (r) {
      return '<tr><td style="color:#636363;vertical-align:top"><strong>' + escapeHtml(r[0]) +
        '</strong></td><td>' + escapeHtml(r[1]) + "</td></tr>";
    }).join("") +
    "</table>" +
    '<p style="margin:14px 0 4px;color:#636363"><strong>Message</strong></p>' +
    '<p style="white-space:pre-wrap;margin:0">' + escapeHtml(s.message || "(no message)") + "</p>" +
    '<hr style="border:none;border-top:1px solid #e4e4e4;margin:18px 0">' +
    '<p style="color:#8a8a8a;font-size:12px;margin:0">Sent from the pacarmedsecurity.com contact form</p></div>';

  const payload = {
    from: from,
    to: [to],
    subject: "New coverage request — " + s.name,
    text: text,
    html: html,
  };
  if (s.email) payload.reply_to = s.email; // reply goes straight to the visitor

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    if (!r.ok) {
      console.error("Resend error", r.status);
    }
  } catch (err) {
    console.error("Email send failed:", err && err.message ? err.message : "unknown");
  }
}

function escapeHtml(v) {
  return String(v)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeParse(s) {
  try { return JSON.parse(s); } catch (e) { return {}; }
}
