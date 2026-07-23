// Vercel Serverless Function — POST /api/contact
// Receives the contact form, verifies the Cloudflare Turnstile captcha,
// drops obvious bots, then emails the submission to info@pacarmed.com.
//
// SETUP (see SETUP-VERCEL.md):
//   Captcha:  set  TURNSTILE_SECRET_KEY  (Cloudflare Turnstile secret key)
//   Email:    set  RESEND_API_KEY        (from resend.com)
//             optional  CONTACT_TO   (defaults to info@pacarmed.com)
//             optional  CONTACT_FROM (defaults to "PAC Armed Website <noreply@pacarmed.com>")
//
// Local testing without real keys: Cloudflare test keys —
//   site key   1x00000000000000000000AA   (in the HTML, always passes)
//   secret key 1x0000000000000000000000000000000AA

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "method_not_allowed" });
  }

  // Vercel parses JSON and urlencoded bodies into req.body automatically.
  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});

  // 1) Honeypot: real users never fill this hidden field. Silently accept + drop.
  if (body["bot-field"]) {
    return res.status(200).json({ ok: true });
  }

  // 2) Basic required-field validation.
  const name = (body.name || "").trim();
  const email = (body.email || "").trim();
  const phone = (body.phone || "").trim();
  if (!name || !email || !phone) {
    return res.status(400).json({ ok: false, error: "missing_fields" });
  }

  // 3) Verify the Cloudflare Turnstile captcha.
  const token = body["cf-turnstile-response"];
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("TURNSTILE_SECRET_KEY is not set in the environment.");
    return res.status(500).json({ ok: false, error: "server_not_configured" });
  }
  if (!token) {
    return res.status(400).json({ ok: false, error: "captcha_missing" });
  }
  try {
    const ip =
      req.headers["cf-connecting-ip"] ||
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    const verifyRes = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ secret: secret, response: token, remoteip: ip }),
      }
    );
    const outcome = await verifyRes.json();
    if (!outcome.success) {
      return res.status(400).json({ ok: false, error: "captcha_failed" });
    }
  } catch (err) {
    console.error("Turnstile verification error:", err);
    return res.status(502).json({ ok: false, error: "captcha_unavailable" });
  }

  // Passed the captcha — assemble a clean payload.
  const submission = {
    name: name,
    email: email,
    phone: phone,
    company: (body.company || "").trim(),
    location: (body.location || "").trim(),
    service: (body.service || "").trim(),
    training: (body.training || "").trim(),
    message: (body.message || "").trim(),
    receivedAt: new Date().toISOString(),
  };

  // Log to the Vercel function logs as a backstop so nothing is ever lost.
  console.log("New contact submission:", JSON.stringify(submission));

  // Email the submission (routed to info@pacarmed.com).
  await sendEmail(submission);

  return res.status(200).json({ ok: true });
};

// --- Email delivery via Resend (https://resend.com) -------------------------
async function sendEmail(s) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.CONTACT_TO || "info@pacarmed.com";
  const from = process.env.CONTACT_FROM || "PAC Armed Website <noreply@pacarmed.com>";

  if (!apiKey) {
    console.warn(
      "RESEND_API_KEY is not set — email not sent. The submission is in the logs above."
    );
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
      console.error("Resend error", r.status, await r.text());
    }
  } catch (err) {
    // Never block the visitor on an email failure — it's captured in the logs.
    console.error("Email send failed:", err);
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
