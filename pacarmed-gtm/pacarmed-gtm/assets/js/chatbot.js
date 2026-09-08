/* Pac Armed Security — lead assistant (rule-based, no API key needed).
   Self-contained: injects its own styles + UI. Add with:
   <script src="assets/js/chatbot.js" defer></script>  */
(function () {
  var PHONE = "(808) 435-5022", TEL = "tel:+18084355022";

  var GREETING = "Aloha, I\u2019m the Pac Armed Security assistant. I can help you request armed guards, unarmed guards, mobile patrol, fire watch, event security, construction site security, or property patrol. What type of security coverage do you need?";
  var URGENT = "This sounds time-sensitive. Please call Pac Armed Security now at " + PHONE + ". I can also collect your details so the team can follow up.";
  var PRICE = "Security pricing depends on the location, service type, armed or unarmed coverage, risk level, number of officers, hours needed, and whether the coverage is temporary or ongoing. I can collect a few details and have the Pac Armed Security team provide a quote.";
  var CLOSE = "Thanks \u2014 I have your security request details. For the fastest response, call Pac Armed Security at " + PHONE + ". The team can review your request and follow up.";
  var OFFTOPIC = "I\u2019m here to help with Pac Armed Security \u2014 armed and unarmed guards, mobile patrol, fire watch, event, construction, commercial, and residential security across Hawaii and Nevada. What kind of coverage can I help you with?";

  var URGENT_RE = /\b(today|tonight|right now|asap|a\.s\.a\.p|emergency|break[\s-]?in|threat|threatening|active|incident|trespassing now|trespasser)\b/i;
  var PRICE_RE = /\b(price|pricing|prices|cost|costs|how much|quote|rate|rates|charge|\$)\b/i;
  var ASK_RE = /(do you|does pac|can you|are you|will you|\bserve\b|\boffer\b|\bprovide\b|\?)/i;

  var FAQ = [
    { re: /\barmed\b/i,                    a: "Yes. Pac Armed Security provides armed security guards for higher-risk properties, valuables, events, and sites that require a stronger visible security presence." },
    { re: /\bunarmed\b/i,                  a: "Yes. Unarmed guards are available for properties that need professional presence, access control, patrols, reporting, and customer-facing security support." },
    { re: /\boahu\b|\bhonolulu\b|\bhawaii\b/i, a: "Yes. Oahu is a primary service area for Pac Armed Security, and we serve locations across Hawaii." },
    { re: /\b(las vegas|vegas|nevada)\b/i, a: "Yes. Pac Armed Security also provides security services in Nevada." },
    { re: /\bmobile patrol\b|\bpatrol\b/i, a: "Yes. Mobile patrol is available for properties that need scheduled checks, gate checks, parking-lot patrol, trespass deterrence, and incident reports without a full-time guard post." },
    { re: /\bfire ?watch\b/i,              a: "Yes. Fire watch coverage may be available for properties dealing with fire system outages, compliance needs, or temporary fire-watch requirements. For urgent fire watch, call " + PHONE + "." },
    { re: /\bconstruction\b/i,             a: "Yes. Pac Armed Security provides construction site security for gate checks, after-hours patrol, trespass deterrence, equipment and material protection, and incident reporting." },
    { re: /\b(apartment|condo|hoa|community|residential)\b/i, a: "Yes. Pac Armed Security supports apartments, condos, HOAs, gated communities, parking areas, common areas, lobbies, and access-control points." },
    { re: /\b(event|venue|concert|wedding|party)\b/i, a: "Yes. Pac Armed Security provides event security \u2014 entry screening, crowd management, and coverage scaled to your venue and headcount." },
    { re: /\b(hotel|resort)\b/i,           a: "Yes. Pac Armed Security provides hotel and resort security with a guest-first approach \u2014 lobby, grounds, and after-hours coverage." },
    { re: /\b(executive|vip|close protection|bodyguard)\b/i, a: "Yes. Pac Armed Security offers discreet executive protection for principals, VIPs, and high-profile visitors." },
    { re: /\b(commercial|office|retail|warehouse|parking)\b/i, a: "Yes. Pac Armed Security covers commercial, retail, warehouse, and parking properties with uniformed officers, patrols, and access-control support." }
  ];

  var STEPS = [
    { key: "service",     q: "What type of security coverage do you need?", chips: ["Armed guards", "Unarmed guards", "Mobile patrol", "Fire watch", "Event security", "Construction site", "Property / HOA", "Executive protection", "Other"] },
    { key: "armed",       q: "Would you prefer armed or unarmed officers?", chips: ["Armed", "Unarmed", "Not sure"] },
    { key: "location",    q: "Where is the service located?", chips: ["Oahu / Hawaii", "Nevada", "Other"] },
    { key: "name",        q: "Great. What\u2019s your name?" },
    { key: "phone",       q: "What\u2019s the best phone number to reach you?" },
    { key: "email",       q: "And your email address?" },
    { key: "company",     q: "What\u2019s the company or property name? (Type \u201cskip\u201d if not applicable.)", optional: true },
    { key: "start",       q: "When do you need coverage to start?", chips: ["ASAP", "Within a week", "Just planning ahead"] },
    { key: "schedule",    q: "What hours or schedule do you need covered? (e.g. overnights, weekends, 24/7)" },
    { key: "urgency",     q: "How urgent is this?", chips: ["Emergency / now", "Within 24 hours", "This week", "Just planning"] },
    { key: "description", q: "Last one \u2014 briefly, what\u2019s the situation or what are you trying to protect?" }
  ];

  var lead = {}, step = 0, urgentShown = false, done = false;

  // ---------- styles ----------
  var css = ""
    + "#pac-chat,#pac-chat *{box-sizing:border-box;font-family:'Manrope','Segoe UI',system-ui,sans-serif}"
    + "#pac-launch{position:fixed;right:20px;bottom:20px;z-index:99998;display:flex;align-items:center;gap:10px;background:#141414;color:#fff;border:none;border-radius:40px;padding:12px 18px 12px 14px;box-shadow:0 8px 30px rgba(0,0,0,.35);cursor:pointer;font-size:15px;font-weight:700;transition:transform .15s ease,background .15s ease}"
    + "#pac-launch:hover{background:#000;transform:translateY(-2px)}"
    + "#pac-launch svg{width:22px;height:22px}"
    + "#pac-panel{position:fixed;right:20px;bottom:20px;z-index:99999;width:370px;max-width:calc(100vw - 32px);height:560px;max-height:calc(100vh - 32px);background:#fff;border-radius:16px;box-shadow:0 18px 60px rgba(0,0,0,.4);display:none;flex-direction:column;overflow:hidden;border:1px solid #E2E2E2}"
    + "#pac-panel.open{display:flex}"
    + "#pac-head{background:#141414;color:#fff;padding:16px 16px 14px;display:flex;align-items:flex-start;gap:12px}"
    + "#pac-head .t{font-family:'Figtree','Segoe UI',sans-serif;font-weight:800;font-size:16px;line-height:1.2}"
    + "#pac-head .s{font-size:12px;color:#B9BDC2;margin-top:2px}"
    + "#pac-head .grow{flex:1}"
    + "#pac-head a.call{color:#fff;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.28);border-radius:8px;padding:6px 10px;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap}"
    + "#pac-head button.x{background:none;border:none;color:#B9BDC2;font-size:22px;line-height:1;cursor:pointer;padding:0 2px}"
    + "#pac-body{flex:1;overflow-y:auto;padding:16px;background:#F7F7F8;display:flex;flex-direction:column;gap:10px}"
    + ".pac-msg{max-width:82%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}"
    + ".pac-bot{align-self:flex-start;background:#EDEEF0;color:#1A1A1D;border-bottom-left-radius:4px}"
    + ".pac-user{align-self:flex-end;background:#161616;color:#fff;border-bottom-right-radius:4px}"
    + "#pac-chips{display:flex;flex-wrap:wrap;gap:8px;padding:0 16px 10px;background:#F7F7F8}"
    + ".pac-chip{background:#fff;border:1px solid #CFCFD3;color:#1A1A1D;border-radius:18px;padding:8px 13px;font-size:13px;font-weight:600;cursor:pointer;transition:background .12s,border-color .12s}"
    + ".pac-chip:hover{background:#141414;color:#fff;border-color:#141414}"
    + "#pac-foot{display:flex;gap:8px;padding:12px;border-top:1px solid #E6E6E8;background:#fff}"
    + "#pac-in{flex:1;border:1px solid #D2D2D6;border-radius:10px;padding:11px 12px;font-size:16px;outline:none}"
    + "#pac-in:focus{border-color:#141414}"
    + "#pac-send{background:#141414;color:#fff;border:none;border-radius:10px;width:44px;flex:none;cursor:pointer;display:flex;align-items:center;justify-content:center}"
    + "#pac-send:hover{background:#000}#pac-send svg{width:18px;height:18px}"
    + "@media(max-width:480px){#pac-panel{right:8px;bottom:8px;width:calc(100vw - 16px);height:calc(100vh - 16px);max-height:none;border-radius:14px}#pac-launch{right:14px;bottom:14px}}";

  var st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  // ---------- DOM ----------
  var launch = document.createElement("button");
  launch.id = "pac-launch"; launch.setAttribute("aria-label", "Open chat");
  launch.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-11.9 7.8L3 21l1.7-6.1A8.5 8.5 0 1 1 21 11.5z"/></svg><span>Chat with us</span>';

  var panel = document.createElement("div");
  panel.id = "pac-panel"; panel.setAttribute("role", "dialog"); panel.setAttribute("aria-label", "Pac Armed Security assistant");
  panel.innerHTML =
    '<div id="pac-head">'
    + '<div class="grow"><div class="t">Pac Armed Security</div><div class="s">Guard requests \u2022 Hawaii &amp; Nevada</div></div>'
    + '<a class="call" href="' + TEL + '">Call</a>'
    + '<button class="x" aria-label="Close">\u00d7</button>'
    + '</div>'
    + '<div id="pac-body"></div>'
    + '<div id="pac-chips"></div>'
    + '<div id="pac-foot"><input id="pac-in" type="text" placeholder="Type your message\u2026" autocomplete="off"><button id="pac-send" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button></div>';

  document.body.appendChild(launch);
  document.body.appendChild(panel);

  var body = panel.querySelector("#pac-body");
  var chipsBox = panel.querySelector("#pac-chips");
  var input = panel.querySelector("#pac-in");
  var opened = false;

  function esc(s){var d=document.createElement("div");d.textContent=s;return d.innerHTML;}
  function scroll(){ body.scrollTop = body.scrollHeight; }
  function bot(text){ var d=document.createElement("div"); d.className="pac-msg pac-bot"; d.innerHTML=esc(text); body.appendChild(d); scroll(); }
  function user(text){ var d=document.createElement("div"); d.className="pac-msg pac-user"; d.innerHTML=esc(text); body.appendChild(d); scroll(); }
  function clearChips(){ chipsBox.innerHTML=""; }
  function showChips(arr){
    clearChips();
    (arr||[]).forEach(function(label){
      var c=document.createElement("button"); c.className="pac-chip"; c.textContent=label;
      c.onclick=function(){ handle(label); };
      chipsBox.appendChild(c);
    });
  }

  function askStep(){
    if (step >= STEPS.length){ finish(); return; }
    var s = STEPS[step];
    bot(s.q);
    showChips(s.chips);
  }

  function finish(){
    done = true; clearChips();
    var sum = "Here\u2019s what I have:\n"
      + "\u2022 Service: " + (lead.service||"\u2014") + (lead.armed?(" ("+lead.armed+")"):"") + "\n"
      + "\u2022 Location: " + (lead.location||"\u2014") + "\n"
      + "\u2022 Name: " + (lead.name||"\u2014") + "\n"
      + "\u2022 Phone: " + (lead.phone||"\u2014") + "\n"
      + "\u2022 Email: " + (lead.email||"\u2014") + "\n"
      + (lead.company?("\u2022 Property: "+lead.company+"\n"):"")
      + "\u2022 Start: " + (lead.start||"\u2014") + "\n"
      + "\u2022 Schedule: " + (lead.schedule||"\u2014") + "\n"
      + "\u2022 Urgency: " + (lead.urgency||"\u2014");
    bot(sum);
    bot(CLOSE);
    showChips(["Call " + PHONE]);
    var last = chipsBox.querySelector(".pac-chip");
    if (last) last.onclick = function(){ window.location.href = TEL; };
    submitLead();
  }

  function submitLead(){
    try {
      var data = {
        "form-name": "chatbot-lead",
        name: lead.name||"", phone: lead.phone||"", email: lead.email||"",
        company: lead.company||"", location: lead.location||"",
        service: (lead.service||"") + (lead.armed?(" / "+lead.armed):""),
        start: lead.start||"", schedule: lead.schedule||"",
        urgency: lead.urgency||"", message: lead.description||""
      };
      var enc = Object.keys(data).map(function(k){return encodeURIComponent(k)+"="+encodeURIComponent(data[k]);}).join("&");
      fetch("/", { method:"POST", headers:{"Content-Type":"application/x-www-form-urlencoded"}, body:enc })["catch"](function(){});
    } catch(e){}
  }

  function detectFAQ(m){
    if (!ASK_RE.test(m)) return null;
    for (var i=0;i<FAQ.length;i++){ if (FAQ[i].re.test(m)) return FAQ[i].a; }
    return null;
  }

  function handle(text){
    text = (text||"").trim();
    if (!text) return;
    user(text);
    input.value = "";
    var low = text.toLowerCase();

    if (done){
      // after completion, keep answering FAQs / urgency but don't loop the form
      if (URGENT_RE.test(low)){ bot(URGENT); return; }
      if (PRICE_RE.test(low)){ bot(PRICE); return; }
      var f0 = detectFAQ(low); if (f0){ bot(f0); return; }
      bot("You\u2019re all set \u2014 the team will follow up. For anything urgent, call " + PHONE + ".");
      return;
    }

    // price question -> answer, re-ask current step
    if (PRICE_RE.test(low)){ bot(PRICE); showChips(STEPS[step] && STEPS[step].chips); return; }
    // FAQ question -> answer, re-ask current step
    var f = detectFAQ(low);
    if (f){ bot(f); if (step < STEPS.length){ showChips(STEPS[step].chips); } return; }

    // otherwise treat as an answer to the current step
    var s = STEPS[step];
    // light validation
    if (s.key === "email" && low.indexOf("@") === -1){ bot("That doesn\u2019t look like an email \u2014 could you re-enter it? (Or type \u201cskip\u201d.)"); if(low!=="skip") return; }
    if (s.key === "company" && low === "skip"){ /* allow skip */ }
    else { lead[s.key] = text; }

    // urgency note (once), based on urgency-ish input anywhere
    if (!urgentShown && URGENT_RE.test(low)){ urgentShown = true; lead.urgency = lead.urgency || "Emergency / now"; bot(URGENT); }

    // skip armed question if the service already answers it
    if (s.key === "service"){
      if (/\bunarmed\b/i.test(low)){ lead.armed = "Unarmed"; step += 2; askStep(); return; }
      if (/\barmed\b/i.test(low)){ lead.armed = "Armed"; step += 2; askStep(); return; }
    }

    step += 1;
    askStep();
  }

  // ---------- events ----------
  function open(){
    panel.classList.add("open"); launch.style.display = "none";
    if (!opened){ opened = true; bot(GREETING); showChips(STEPS[0].chips); }
    setTimeout(function(){ input.focus(); }, 60);
  }
  function close(){ panel.classList.remove("open"); launch.style.display = "flex"; }
  launch.onclick = open;
  panel.querySelector(".x").onclick = close;
  panel.querySelector("#pac-send").onclick = function(){ handle(input.value); };
  input.addEventListener("keydown", function(e){ if (e.key === "Enter"){ e.preventDefault(); handle(input.value); } });
})();
