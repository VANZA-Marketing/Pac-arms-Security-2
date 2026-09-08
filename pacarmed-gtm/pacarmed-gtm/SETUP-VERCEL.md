# PAC Armed — Vercel contact form + captcha setup

The contact form now posts to a Vercel serverless function that verifies a
**Cloudflare Turnstile** captcha before accepting a submission. Email delivery
is stubbed and ready for you to turn on later.

Files involved:
- `contact/index.html` — the form + the Turnstile widget + script
- `assets/js/main.js` — `submitContact()` sends the form to `/api/contact`
- `api/contact.js` — the serverless function (captcha check + honeypot + email stub)
- `vercel.json` — keeps trailing-slash URLs and sets the function timeout

## 1. Get Cloudflare Turnstile keys (free)
1. Go to the Cloudflare dashboard → **Turnstile** → **Add widget**.
2. Name it (e.g. "PAC Armed contact") and add your domain(s):
   your Vercel domain and `pacarmedsecurity.com`. Add `localhost` if you want to test locally.
3. Widget type: **Managed** is fine.
4. Copy the two keys it gives you: a **Site key** (public) and a **Secret key** (private).

## 2. Put the Site key in the page
In `contact/index.html`, find:
```html
<div class="cf-turnstile form-recaptcha" data-sitekey="1x00000000000000000000AA" ...>
```
Replace `1x00000000000000000000AA` (Cloudflare's always-pass **test** key) with your
real **Site key**. Until you do this, the captcha shows but does not actually block anything.

## 3. Add the Secret key in Vercel
Vercel → your project → **Settings → Environment Variables** → add:

| Name | Value |
|------|-------|
| `TURNSTILE_SECRET_KEY` | your Turnstile **Secret key** |

Redeploy after adding it (Vercel → Deployments → Redeploy, or push a commit).

## 4. Deploy
This is a static site plus one function. On Vercel, no build step is needed:
- static files are served as-is,
- anything in `/api` becomes a serverless function automatically (so `/api/contact.js` → `POST /api/contact`).

Import the repo (or drag-and-drop the folder) in Vercel and deploy. Framework preset: **Other / None**.

## 5. Email delivery — routed to info@pacarmed.com
Submissions are emailed to **info@pacarmed.com** using **Resend** (resend.com). The code is
already written in `api/contact.js` — you just need to add the API key (and verify a sending
domain). Until the key is set, submissions still succeed and are written to the **Vercel
function logs** (Project → Deployments → a deployment → **Functions** → `/api/contact` → Logs),
so nothing is lost in the meantime.

To turn email on:
1. Create a free account at **resend.com**.
2. **Verify a sending domain** you own (this is the domain in the "from" address, not the
   recipient). Add `pacarmed.com` in Resend → Domains and follow the DNS steps. Once verified,
   the default `from` address `noreply@pacarmed.com` will work.
   - Want to test *before* verifying a domain? Resend lets you send from `onboarding@resend.dev`
     to your own account email. Set `CONTACT_FROM` to `PAC Armed <onboarding@resend.dev>` and
     `CONTACT_TO` to the email you signed up with, just for testing.
3. In Vercel → Project → **Settings → Environment Variables**, add:

| Name | Value |
|------|-------|
| `RESEND_API_KEY` | your Resend API key |
| `CONTACT_TO` *(optional)* | `info@pacarmed.com` (already the default, so you can skip it) |
| `CONTACT_FROM` *(optional)* | e.g. `PAC Armed Website <noreply@pacarmed.com>` (default) |

4. Redeploy. Each submission now arrives at info@pacarmed.com, and hitting **Reply** replies
   straight to the person who filled out the form.

Prefer a different provider (SendGrid, Postmark, Mailgun, SMTP)? Tell me which and I'll swap the
send call — everything else stays the same.

## Testing locally (optional)
Install the Vercel CLI and run `vercel dev` from this folder — that serves the static
site *and* the function together. Use Cloudflare's test keys so you don't need real ones:
- Site key (in the HTML): `1x00000000000000000000AA`
- Secret key (env var): `1x0000000000000000000000000000000AA`

A plain static server (without `vercel dev`) will show the form and captcha, but the
submit will fail because `/api/contact` isn't running.

## Notes
- The old Netlify form attributes were removed from the contact form; it no longer depends on Netlify.
- The **careers application** form and the **chatbot** still use the old Netlify setup. When you
  move the whole site to Vercel, those need the same treatment (a function + captcha). Say the word
  and I'll convert them too.
