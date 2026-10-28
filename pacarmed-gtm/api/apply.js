// Vercel Serverless Function — POST /api/apply
// Job-application form (join-our-team). Emails the application + resume via Resend.
// Reuses the same RESEND_API_KEY and verified domain as /api/contact.
//
// The browser sends JSON: all text fields + an optional { resume: {filename, type, content(base64)} }.
// Resume is attached to the email. Keep files small (Vercel Hobby request body limit ~4.5MB).

const ALLOWED_HOSTS = ["pacarmedsecurity.com", "www.pacarmedsecurity.com"];

function originAllowed(req) {
  const hay = ((req.headers["origin"] || "") + " " + (req.headers["referer"] || "")).toLowerCase();
  if (!hay.trim()) return false;
  if (ALLOWED_HOSTS.some(function (h) { return hay.indexOf("//" + h) !== -1 || hay.indexOf("." + h) !== -1; })) return true;
  if (hay.indexOf(".vercel.app") !== -1) return true;
  return false;
}

function clean(v, max) {
  if (Array.isArray(v)) v = v.join(", ");
  return String(v == null ? "" : v).replace(/[\u0000-\u001F\u007F]+/g, " ").trim().slice(0, max || 2000);
}
function escapeHtml(v) {
  return String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function safeParse(s) { try { return JSON.parse(s); } catch (e) { return {}; } }
function maskEmail(e) { var p = String(e).split("@"); return p[1] ? (p[0].slice(0, 2) + "***@" + p[1]) : "***"; }

module.exports = async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ ok: false, error: "method_not_allowed" }); }
  if (!originAllowed(req)) return res.status(403).json({ ok: false, error: "forbidden" });

  const raw = typeof req.body === "string" ? req.body : JSON.stringify(req.body || {});
  if (raw && raw.length > 4400000) return res.status(413).json({ ok: false, error: "payload_too_large" });

  const body = typeof req.body === "string" ? safeParse(req.body) : (req.body || {});
  if (body["bot-field"]) return res.status(200).json({ ok: true }); // honeypot

  const first = clean(body.first_name, 80), last = clean(body.last_name, 80);
  const email = clean(body.email, 200), phone = clean(body.phone, 40);
  if (!first || !last || !phone || !email) return res.status(400).json({ ok: false, error: "missing_fields" });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return res.status(400).json({ ok: false, error: "invalid_email" });

  const fields = [
    ["Name", first + " " + last],
    ["Phone", phone],
    ["Email", email],
    ["City", clean(body.city, 80)],
    ["Work location", clean(body.work_location, 120)],
    ["Position", clean(body.position, 120)],
    ["Availability", clean(body.availability, 120)],
    ["Shifts", clean(body.shifts, 200)],
    ["Guard card", clean(body.guard_card, 40)],
    ["Guard card #", clean(body.guard_card_number, 60)],
    ["Guard card expiration", clean(body.guard_card_expiration, 40)],
    ["Firearm permit", clean(body.firearm_permit, 40)],
    ["Driver's license", clean(body.drivers_license, 40)],
    ["Certifications", clean(body.certifications, 300)],
    ["18 or older", clean(body.age_18, 20)],
    ["Work authorized", clean(body.work_authorized, 20)],
    ["Background check consent", clean(body.background_consent, 20)],
  ].filter(function (r) { return r[1]; });

  const experience = clean(body.experience, 5000);
  const references = clean(body.references, 2000);

  const text = fields.map(function (r) { return r[0] + ": " + r[1]; }).join("\n") +
    "\n\nExperience:\n" + (experience || "(none provided)") +
    "\n\nReferences:\n" + (references || "(none provided)") +
    "\n\n— Submitted from the pacarmedsecurity.com careers form";

  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#161616">' +
    '<h2 style="margin:0 0 12px">New job application — ' + escapeHtml(first + " " + last) + '</h2>' +
    '<table cellpadding="6" style="border-collapse:collapse">' +
    fields.map(function (r) { return '<tr><td style="color:#636363;vertical-align:top"><strong>' + escapeHtml(r[0]) + '</strong></td><td>' + escapeHtml(r[1]) + "</td></tr>"; }).join("") +
    "</table>" +
    '<p style="margin:14px 0 4px;color:#636363"><strong>Experience</strong></p><p style="white-space:pre-wrap;margin:0">' + escapeHtml(experience || "(none provided)") + "</p>" +
    '<p style="margin:14px 0 4px;color:#636363"><strong>References</strong></p><p style="white-space:pre-wrap;margin:0">' + escapeHtml(references || "(none provided)") + "</p>" +
    '<hr style="border:none;border-top:1px solid #e4e4e4;margin:18px 0"><p style="color:#8a8a8a;font-size:12px;margin:0">Submitted from the pacarmedsecurity.com careers form</p></div>';

  console.log("Job application received:", JSON.stringify({ name: first + " " + last, email: maskEmail(email), at: new Date().toISOString(), hasResume: !!(body.resume && body.resume.content) }));

  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.APPLY_TO || process.env.CONTACT_TO || "info@pacarmedsecurity.com";
  const from = process.env.CONTACT_FROM || "Pac Armed Security <noreply@pacarmedsecurity.com>";
  if (!apiKey) { console.warn("RESEND_API_KEY not set — application not emailed."); return res.status(200).json({ ok: true }); }

  const payload = { from: from, to: [to], subject: "New job application — " + first + " " + last, text: text, html: html, reply_to: email };
  if (body.resume && body.resume.content && body.resume.filename) {
    payload.attachments = [{ filename: String(body.resume.filename).slice(0, 180), content: body.resume.content }];
  }

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!r.ok) { console.error("Resend error", r.status); return res.status(502).json({ ok: false, error: "email_failed" }); }
  } catch (err) {
    console.error("Application email failed:", err && err.message ? err.message : "unknown");
    return res.status(502).json({ ok: false, error: "email_failed" });
  }
  return res.status(200).json({ ok: true });
};
