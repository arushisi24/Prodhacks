const STEPS = [
  {
    match: "fsa-id/create-account/verify",
    step: 3, total: 6,
    title: "Step 3: Verify Your Identity",
    instruction: "Almost there! Check your <strong>email or phone</strong> for a verification code and enter it here.<br><br>Once verified, your account will be created! \u2705",
    tip: "\uD83D\uDCA1 Your account won't be <em>fully</em> active until the SSA verifies your SSN \u2014 this takes 1\u20133 days. But you can start your FAFSA right away!",
    selector: 'input[type="text"], input[name*="code"], input[name*="otp"]',
    textFallbacks: ["verify", "enter code"],
    scrollTo: false,
  },
  {
    match: "fsa-id/create-account",
    step: 2, total: 6,
    title: "Step 2: Fill Out Your Info",
    instruction: "You'll need to fill out the following:<br><br><ul><li>\uD83D\uDCDB Full legal name</li><li>\uD83C\uDF82 Date of birth</li><li>\uD83D\uDD12 Social Security Number (SSN)</li><li>\uD83D\uDC64 Username &amp; password</li><li>\uD83D\uDCE7 Email address</li><li>\uD83D\uDCF1 Mobile phone number</li><li>\u2753 Challenge questions</li></ul>",
    tip: "\uD83D\uDCA1 Use an email and phone number only <em>you</em> have access to \u2014 they can only be linked to one FSA ID.",
    selector: 'input[name="firstName"], input[id*="first"], input[type="text"]',
    textFallbacks: ["first name", "continue"],
    scrollTo: false,
  },
  {
    match: "fsa-id/sign-in",
    step: 4, total: 6,
    title: "Step 4: Sign In",
    instruction: "Great \u2014 now <strong>sign in</strong> with the username and password you just created.<br><br>\uD83D\uDC49 Enter your username (or email/phone) and password below.",
    tip: "\uD83D\uDCA1 Saved your backup code? Keep it somewhere safe \u2014 you'll need it if you ever get locked out.",
    selector: 'input[name="username"], input[id*="username"], input[type="text"]',
    textFallbacks: ["username", "email", "sign in"],
    scrollTo: true,
  },
  {
    match: "apply-for-aid/fafsa",
    step: 6, total: 6,
    title: "Step 6: Fill Out Your FAFSA \uD83D\uDCDD",
    instruction: "You're on the FAFSA form! Work through each section:<br><br><ul><li>\uD83C\uDF93 Student info</li><li>\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 Parent/household info</li><li>\uD83D\uDCB0 Financial information</li><li>\uD83C\uDFEB Schools to send aid to</li><li>\u270D\uFE0F Sign &amp; submit</li></ul>",
    tip: "\uD83D\uDCA1 We'll guide you through each field as you go. Click 'Show me where' for help on any section!",
    selector: 'button, input[type="text"]',
    textFallbacks: ["continue", "next", "save"],
    scrollTo: false,
  },
  {
    match: "studentaid.gov/dashboard",
    step: 5, total: 6,
    title: "Step 5: You're Logged In! \uD83C\uDF89",
    instruction: "You're on your dashboard. Time to start your FAFSA!<br><br>\uD83D\uDC49 Click <strong>\"Start a New FAFSA\"</strong> or find your form under <strong>\"My Activity\"</strong> to begin.",
    tip: "\uD83D\uDCA1 Already started a FAFSA? It will appear under 'My Activity' so you can pick up where you left off.",
    selector: 'a[href*="fafsa"], a[href*="apply-for-aid"]',
    textFallbacks: ["fafsa form", "start fafsa", "my activity", "apply for aid", "start a new"],
    scrollTo: true,
  },
  {
    match: "studentaid.gov/",
    step: 1, total: 6,
    title: "Step 1: Create Your Account",
    instruction: "To fill out the FAFSA, you first need a <strong>StudentAid.gov account</strong> (also called an FSA ID).<br><br>\uD83D\uDC49 Click <strong>\"Create Account\"</strong> in the top right corner of the page to get started.",
    tip: "\uD83D\uDCA1 Both the student <em>and</em> a parent will each need their own separate account.",
    selector: 'a[href*="create-account"]',
    textFallbacks: ["create account", "sign up", "get started"],
    scrollTo: true,
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrentStep() {
  const url = window.location.href;
  for (const step of STEPS) {
    if (url.includes(step.match)) return step;
  }
  return null;
}

// Find element by CSS selector OR by matching visible text content
function findElement(selector, textFallbacks = []) {
  let el = document.querySelector(selector);
  if (el) return el;

  for (const text of textFallbacks) {
    const lower = text.toLowerCase();
    const all = document.querySelectorAll("a, button, [role='button']");
    for (const node of all) {
      if (node.textContent.trim().toLowerCase().includes(lower)) {
        return node;
      }
    }
  }
  return null;
}

function highlightElement(selector, textFallbacks = []) {
  document.querySelectorAll(".fafsa-highlight").forEach((el) => {
    el.classList.remove("fafsa-highlight");
  });

  const old = document.getElementById("fafsa-arrow");
  if (old) old.remove();

  const el = findElement(selector, textFallbacks);

  if (!el) {
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("fafsa-highlight");
  setTimeout(() => placeArrow(el), 600);
}

function placeArrow(el) {
  const old = document.getElementById("fafsa-arrow");
  if (old) old.remove();

  const rect = el.getBoundingClientRect();
  const arrow = document.createElement("div");
  arrow.id = "fafsa-arrow";
  arrow.innerHTML = "\uD83D\uDC49";
  arrow.style.cssText =
    "position:fixed;" +
    "top:" + (rect.top + rect.height / 2 - 16) + "px;" +
    "left:" + Math.max(rect.left - 44, 4) + "px;" +
    "font-size:28px;z-index:999999;pointer-events:none;";
  document.body.appendChild(arrow);
}

// ─── Sidebar Injection ────────────────────────────────────────────────────────

function injectSidebar(stepData) {
  const existing = document.getElementById("fafsa-sidebar");
  if (existing) existing.remove();

  const sidebar = document.createElement("div");
  sidebar.id = "fafsa-sidebar";

  const progressPct = Math.round((stepData.step / stepData.total) * 100);

  sidebar.innerHTML =
    '<div class="fafsa-header">' +
      '<img src="' + chrome.runtime.getURL("icons/icon48.png") + '" alt="FAFSA Buddy" />' +
      "<span>FAFSA Buddy</span>" +
      '<button id="fafsa-close">\u2715</button>' +
    "</div>" +
    '<div class="fafsa-progress">' +
      '<div class="fafsa-progress-label">Step ' + stepData.step + " of " + stepData.total + "</div>" +
      '<div class="fafsa-progress-bar">' +
        '<div class="fafsa-progress-fill" style="width:' + progressPct + '%"></div>' +
      "</div>" +
    "</div>" +
    '<div class="fafsa-body">' +
      "<h2>" + stepData.title + "</h2>" +
      "<p>" + stepData.instruction + "</p>" +
      (stepData.tip ? '<div class="fafsa-tip">' + stepData.tip + "</div>" : "") +
    "</div>" +
    '<div class="fafsa-footer">' +
      (stepData.selector ? '<button id="fafsa-highlight-btn">\uD83D\uDC46 Show me where</button>' : "") +
    "</div>";

  document.body.appendChild(sidebar);

  // ── Drag to move ──────────────────────────────────────────────────
  const header = sidebar.querySelector(".fafsa-header");
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;

  header.addEventListener("mousedown", (e) => {
    if (e.target.id === "fafsa-close") return;
    e.preventDefault();
    e.stopPropagation();

    const rect = sidebar.getBoundingClientRect();
    sidebar.style.right = "auto";
    sidebar.style.left = rect.left + "px";
    sidebar.style.top  = rect.top  + "px";

    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;

    isDragging = true;
    sidebar.style.transition = "none";
    document.body.style.userSelect = "none";
    document.body.style.pointerEvents = "none";
    sidebar.style.pointerEvents = "auto";
  }, true);

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    e.preventDefault();
    sidebar.style.left = (e.clientX - dragOffsetX) + "px";
    sidebar.style.top  = (e.clientY - dragOffsetY) + "px";
  }, true);

  window.addEventListener("mouseup", () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.style.userSelect = "";
    document.body.style.pointerEvents = "";
  }, true);
  // ─────────────────────────────────────────────────────────────────

  document.getElementById("fafsa-close").addEventListener("click", () => {
    sidebar.remove();
    const arrow = document.getElementById("fafsa-arrow");
    if (arrow) arrow.remove();
  });

  const highlightBtn = document.getElementById("fafsa-highlight-btn");
  if (highlightBtn) {
    highlightBtn.addEventListener("click", () => {
      highlightElement(stepData.selector, stepData.textFallbacks || []);
    });
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init() {
  const step = getCurrentStep();
  if (!step) return;

  setTimeout(() => {
    injectSidebar(step);
    if (step.scrollTo && step.selector) {
      setTimeout(() => highlightElement(step.selector, step.textFallbacks || []), 800);
    }
  }, 1000);
}

init();

// Re-run on URL changes (studentaid.gov is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    setTimeout(init, 1200);
  }
}).observe(document, { subtree: true, childList: true });

// Fetch profile from your website and autofill FAFSA fields
async function loadAndAutofill() {
  chrome.storage.local.get(['fafsaProfile'], ({ fafsaProfile }) => {
    if (!fafsaProfile) return;
    autofill(fafsaProfile);
  });
}

function autofill(fields) {
  const fieldMap = [
    { selector: 'input[name="firstName"], input[id*="first"]', value: fields.student_name?.split(' ')[0] },
    { selector: 'input[name="lastName"], input[id*="last"]', value: fields.student_name?.split(' ').slice(1).join(' ') },
    { selector: 'input[name="dateOfBirth"], input[id*="dob"], input[id*="birth"]', value: fields.student_dob },
    { selector: 'input[name="email"], input[id*="email"]', value: fields.student_email },
  ];

  for (const { selector, value } of fieldMap) {
    if (!value) continue;
    const el = document.querySelector(selector);
    if (!el) continue;

    // Trigger React synthetic events so FAFSA form registers the value
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

loadAndAutofill();

