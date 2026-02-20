console.log('FAFSA BUDDY CONTENT SCRIPT LOADED');
const STEPS = [
  {
    match: "fsa-id/create-account/verify",
    step: 3, total: 8,
    title: "Step 3: Verify Your Identity",
    instruction: "Almost there! Check your <strong>email or phone</strong> for a verification code and enter it here.<br><br>Once verified, your account will be created! \u2705",
    tip: "\uD83D\uDCA1 Your account won't be <em>fully</em> active until the SSA verifies your SSN \u2014 this takes 1\u20133 days. But you can start your FAFSA right away!",
    selector: 'input[type="text"], input[name*="code"], input[name*="otp"]',
    textFallbacks: ["verify", "enter code"],
    scrollTo: false,
  },
  {
    match: "fsa-id/create-account",
    step: 2, total: 8,
    title: "Step 2: Fill Out Your Info",
    instruction: "You'll need to fill out the following:<br><br><ul><li>\uD83D\uDCDB Full legal name</li><li>\uD83C\uDF82 Date of birth</li><li>\uD83D\uDD12 Social Security Number (SSN)</li><li>\uD83D\uDC64 Username &amp; password</li><li>\uD83D\uDCE7 Email address</li><li>\uD83D\uDCF1 Mobile phone number</li><li>\u2753 Challenge questions</li></ul>",
    tip: "\uD83D\uDCA1 Use an email and phone number only <em>you</em> have access to \u2014 they can only be linked to one FSA ID.",
    selector: 'input[name="firstName"], input[id*="first"], input[type="text"]',
    textFallbacks: ["first name", "continue"],
    scrollTo: false,
  },
  {
    match: "fsa-id/sign-in",
    step: 4, total: 8,
    title: "Step 4: Sign In",
    instruction: "Great \u2014 now <strong>sign in</strong> with the username and password you just created.<br><br>\uD83D\uDC49 Enter your username (or email/phone) and password below.",
    tip: "\uD83D\uDCA1 Saved your backup code? Keep it somewhere safe \u2014 you'll need it if you ever get locked out.",
    selector: 'input[name="username"], input[id*="username"], input[type="text"]',
    textFallbacks: ["username", "email", "sign in"],
    scrollTo: true,
  },
  {
    match: "fafsa-apply",
    step: 8, total: 8,
    title: "Step 8: Fill Out Your FAFSA 📝",
    instruction: "We're autofilling what we know from your profile. Fill in anything we missed, then click <strong>Continue</strong> at the bottom of each page.",
    tip: "💡 Not sure about a field? Head back to the FAFSA Buddy chat at prodhacks3.vercel.app and ask.",
    selector: 'button',
    textFallbacks: ["continue", "save and continue", "next"],
    scrollTo: true,
  },
  {
    match: "apply-for-aid/fafsa",
    step: 6, total: 8,
    title: "Step 6: Start or Continue Your FAFSA 📝",
    instruction: "You're in the right place! Now choose your option:<br><br><ul><li>📄 <strong>Start a new FAFSA</strong> — if you haven't filled one out for this school year yet</li><li>✏️ <strong>Edit a saved FAFSA</strong> — if you already started one and want to continue</li></ul>",
    tip: "💡 Make sure you're applying for the correct award year — most students apply for the upcoming school year.",
    selector: 'button, a',
    textFallbacks: ["start new form", "edit existing", "start a new", "continue", "edit"],
    scrollTo: true,
  },

  {
    match: "fafsa-apply/2026-27/roles",
    step: 7, total: 8,
    title: "Step 7: Select Your Role",
    instruction: "Choose who is filling out this FAFSA:<br><br><ul><li>🎓 <strong>Student</strong> — if you're the one applying for aid</li><li>👨‍👩‍👧 <strong>Parent</strong> — if you're helping your child apply</li></ul>",
    tip: "💡 Each person needs their own FSA ID to sign the form.",
    selector: 'button, a, [role="button"]',
    textFallbacks: ["student", "parent"],
    scrollTo: true,
  },
  {
    match: "studentaid.gov/dashboard",
    step: 5, total: 8,
    title: "Step 5: You're Logged In! \uD83C\uDF89",
    instruction: "You're on your dashboard. Time to start your FAFSA!<br><br>\uD83D\uDC49 Click <strong>\"Start a New FAFSA\"</strong> or find your form under <strong>\"My Activity\"</strong> to begin.",
    tip: "\uD83D\uDCA1 Already started a FAFSA? It will appear under 'My Activity' so you can pick up where you left off.",
    selector: 'a[href*="fafsa"], a[href*="apply-for-aid"]',
    textFallbacks: ["fafsa form", "start fafsa", "my activity", "apply for aid", "start a new"],
    scrollTo: true,
  },
  {
    match: "studentaid.gov/",
    step: 1, total: 8,
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

  const existingTab = document.getElementById("fafsa-expand-tab");
  if (existingTab) existingTab.remove();

  document.body.classList.remove("fafsa-open", "fafsa-collapsed");

  const sidebar = document.createElement("div");
  sidebar.id = "fafsa-sidebar";

  const progressPct = Math.round((stepData.step / stepData.total) * 100);

  sidebar.innerHTML =
    '<div class="fafsa-header">' +
      '<img src="' + chrome.runtime.getURL("icons/icon48.png") + '" alt="FAFSA Buddy" />' +
      "<span>FAFSA Buddy</span>" +
      '<button id="fafsa-toggle">&#8250;</button>' +
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
  document.body.classList.add("fafsa-open");

  // ── Expand tab ────────────────────────────────────────────────────
  const expandTab = document.createElement("button");
  expandTab.id = "fafsa-expand-tab";
  expandTab.innerHTML = "&#8249;";
  document.body.appendChild(expandTab);

  // ── Toggle collapse ───────────────────────────────────────────────
  document.getElementById("fafsa-toggle").addEventListener("click", (e) => {
    e.stopPropagation();
    sidebar.classList.add("collapsed");
    document.body.classList.remove("fafsa-open");
    document.body.classList.add("fafsa-collapsed");
    expandTab.classList.add("visible");
  });

  expandTab.addEventListener("click", () => {
    sidebar.classList.remove("collapsed");
    document.body.classList.remove("fafsa-collapsed");
    document.body.classList.add("fafsa-open");
    expandTab.classList.remove("visible");
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

// ─── Autofill ─────────────────────────────────────────────────────────────────

async function loadAndAutofill() {
  chrome.storage.local.get(['fafsaProfile'], ({ fafsaProfile }) => {
    if (!fafsaProfile) return;
    autofill(fafsaProfile);
  });
}

function autofill(fields) {
  const url = window.location.href;

  // ── Helper: fill a text input and trigger React events ────────────
  function fillInput(el, value) {
    if (!el || !value) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // ── Helper: click a radio/button by matching text ─────────────────
  function clickByText(text) {
    const els = document.querySelectorAll('fsa-fafsa-radio-button-card, div[class*="fsa-radio-button"], button, label');
    for (const el of els) {
      if (el.textContent.trim().toLowerCase().includes(text.toLowerCase())) {
        el.click();
        return true;
      }
    }
    return false;
  }

  // ── Helper: auto-click blue continue button ───────────────────────
  function clickContinue() {
    const btns = document.querySelectorAll('button');
    for (const btn of btns) {
      const text = btn.textContent.trim().toLowerCase();
      if (text.includes('continue') || text.includes('next') || text.includes('save and continue')) {
        btn.click();
        return;
      }
    }
  }

  // ── Personal circumstances — auto-click continue ──────────────────
  if (url.includes('personal-circumstances')) {
    setTimeout(() => {
      // Auto-select marital status
      if (fields.independent === false) {
        clickByText('single (never married)');
      }
      // Point to continue — don't auto-click, let user review
    }, 1500);
  }

  // ── Demographics — just point to continue ────────────────────────
  // No autofill needed, guide points to continue button

  // ── Finances ─────────────────────────────────────────────────────
  if (url.includes('student/finances') || url.includes('finances')) {
    setTimeout(() => {
      // Did student file taxes?
      if (fields.filed_taxes === true || fields.has_w2 === true) {
        clickByText('already completed');
        clickByText('will file');
      } else if (fields.filed_taxes === false) {
        clickByText('not going to file');
      }
    }, 1500);
  }

  // ── Colleges ─────────────────────────────────────────────────────
  if (url.includes('student/colleges') || url.includes('colleges')) {
    setTimeout(() => {
      if (fields.schools && fields.schools.length > 0) {
        const schoolInput = document.querySelector('input[id*="school"], input[placeholder*="school"], input[aria-label*="school"], input[type="search"]');
        if (schoolInput) {
          fillInput(schoolInput, fields.schools[0]);
          schoolInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    }, 1500);
  }

  // ── General: fill name/dob/email on any page ──────────────────────
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
    fillInput(el, value);
  }

  // ── Role selection ────────────────────────────────────────────────
  if (url.includes('roles')) {
    const role = fields.user_role;
    if (role) {
      setTimeout(() => {
        const allDivs = document.querySelectorAll('div[class*="fsa-radio-button"]');
        for (const el of allDivs) {
          if (el.textContent.trim().toLowerCase().includes(role)) {
            el.click();
            break;
          }
        }
      }, 2000);
    }
  }
}

loadAndAutofill();
// ─── Extracted Financial Data Autofill ────────────────────────────────────────

function loadAndAutofillExtracted() {
  console.log('LOAD AND AUTOFILL CALLED');
  chrome.storage.local.get(['fafsaExtracted'], ({ fafsaExtracted }) => {
    console.log('GOT FROM STORAGE:', !!fafsaExtracted);
    if (!fafsaExtracted) return;
    autofillExtracted(fafsaExtracted);
  });
}

function autofillExtracted(data) {
  console.log('AUTOFILL EXTRACTED CALLED', data);
  const url = window.location.href;
  if (!url.includes('fafsa-apply')) return;

  function fillInput(el, value) {
    if (!el || value == null) return;
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype, 'value'
    ).set;
    nativeSetter.call(el, String(value));
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function clickRadioByText(text) {
      const els = document.querySelectorAll('fsa-fafsa-radio-button-card');
      for (const el of els) {
        if (el.textContent.trim().toLowerCase() === text.toLowerCase()) {
          const inner = el.querySelector('.radio-button-card-container');
          if (inner) inner.click();
          else el.click();
          return true;
        }
      }
      return false;
    }

  // Direct ID mapping for Student tax return fields
  const ID_MAP = [
    { id: 'fsa_Input_StudentIncomeEarnedFromWork', key: 'income_earned_from_work' },
    { id: 'fsa_Input_StudentTaxExemptInterestIncome', key: 'tax_exempt_interest_income' },
    { id: 'fsa_Input_StudentUntaxedPortionsOfIraDistributions', key: 'untaxed_ira_distributions' },
    { id: 'fsa_Input_StudentUntaxedPortionsOfPensions', key: 'untaxed_pensions' },
    { id: 'fsa_Input_StudentAdjustedGrossIncome', key: 'adjusted_gross_income' },
    { id: 'fsa_Input_StudentIncomeTaxPaid', key: 'income_tax_paid' },
    { id: 'fsa_Input_StudentIraKeoghOtherDeductiblePayments', key: 'ira_deductions_sep_simple' },
    { id: 'fsa_Input_StudentEducationCredits', key: 'education_credits' },
    { id: 'fsa_Input_StudentCollegeGrantAndScholarshipAid', key: 'college_grants_reported_as_income' },
    { id: 'fsa_Input_StudentForeignIncomeExemptFromFederalTaxation', key: 'foreign_earned_income_exclusion' },
  ];

  // Also try matching by aria-labelledby text as fallback
  const LABEL_TO_KEY = [
    { labels: ['income earned from work'], key: 'income_earned_from_work' },
    { labels: ['tax exempt interest', 'tax-exempt interest'], key: 'tax_exempt_interest_income' },
    { labels: ['untaxed portions of ira', 'untaxed ira'], key: 'untaxed_ira_distributions' },
    { labels: ['ira rollover'], key: 'ira_rollover' },
    { labels: ['untaxed portions of pensions', 'untaxed pensions'], key: 'untaxed_pensions' },
    { labels: ['pension rollover'], key: 'pension_rollover' },
    { labels: ['adjusted gross income'], key: 'adjusted_gross_income' },
    { labels: ['income tax paid'], key: 'income_tax_paid' },
    { labels: ['ira deductions', 'sep, simple'], key: 'ira_deductions_sep_simple' },
    { labels: ['education credits', 'american opportunity', 'lifetime learning'], key: 'education_credits' },
    { labels: ['net profit or loss', 'schedule c'], key: 'schedule_c_net_profit' },
    { labels: ['college grants', 'scholarships', 'americorps'], key: 'college_grants_reported_as_income' },
    { labels: ['foreign earned income'], key: 'foreign_earned_income_exclusion' },
  ];

  function fillByIds() {
      console.log('FILL BY IDS RUNNING');
      for (const { id, key } of ID_MAP) {
        const value = data[key];
        const fillValue = (value == null) ? 0 : value;
        const el = document.getElementById(id);
        if (el) {
          fillInput(el, fillValue);
          el.style.outline = '2px solid #3a7bd5';
          el.style.backgroundColor = '#f0f7ff';
          setTimeout(() => { el.style.outline = ''; el.style.backgroundColor = ''; }, 3000);
        }
      }
    }

  function fillByLabels() {
    const allInputs = document.querySelectorAll('input[type="text"], input[type="number"], input:not([type])');
    for (const input of allInputs) {
      const labelId = input.getAttribute('aria-labelledby');
      const descId = input.getAttribute('aria-describedby');
      let labelText = '';
      if (labelId) {
        const lbl = document.getElementById(labelId);
        if (lbl) labelText = lbl.textContent.trim().toLowerCase();
      }
      if (!labelText && descId) {
        const desc = document.getElementById(descId);
        if (desc) labelText = desc.textContent.trim().toLowerCase();
      }
      if (!labelText) continue;

      for (const { labels, key } of LABEL_TO_KEY) {
        const value = data[key];
        if (value == null) continue;
        for (const label of labels) {
          if (labelText.includes(label)) {
            fillInput(input, value);
            input.style.outline = '2px solid #3a7bd5';
            input.style.backgroundColor = '#f0f7ff';
            setTimeout(() => { input.style.outline = ''; input.style.backgroundColor = ''; }, 3000);
            break;
          }
        }
      }
    }
  }


  // Try ID-based fill first, then label-based as fallback
// Wait for inputs to appear, retry up to 10 times
let attempts = 0;
  const tryFill = () => {
    attempts++;
    const found = document.getElementById('fsa_Input_StudentAdjustedGrossIncome');
    console.log('ATTEMPT', attempts, 'FOUND AGI INPUT:', !!found);
    if (found) {
      fillByIds();
      fillByLabels();

      // Filing status radio
      if (data.filing_status) {
        const statusMap = {
          'single': 'single',
          'head_of_household': 'head of household',
          'married_filing_jointly': 'married filing jointly',
          'married_filing_separately': 'married filing separately',
          'qualifying_surviving_spouse': 'qualifying surviving spouse',
        };
        const label = statusMap[data.filing_status];
        if (label) clickRadioByText(label);
      }

      // EIC radio
      if (data.received_eic === true || data.received_eic === false) {
        const cards = document.querySelectorAll('fsa-fafsa-radio-button-card, div[class*="fsa-radio-button"], label');
        for (const el of cards) {
          const text = el.textContent.trim().toLowerCase();
          const parent = el.closest('fsa-input, fieldset, div, section');
          const parentText = parent ? parent.textContent.toLowerCase() : '';
          if (parentText.includes('earned income credit') && text === (data.received_eic ? 'yes' : 'no')) {
            el.click();
            break;
          }
        }
      }

      // Schedule radio
      if (data.filed_schedule_a_b_d_e_f_h === true || data.filed_schedule_a_b_d_e_f_h === false) {
        const cards = document.querySelectorAll('fsa-fafsa-radio-button-card, div[class*="fsa-radio-button"], label');
        for (const el of cards) {
          const text = el.textContent.trim().toLowerCase();
          const parent = el.closest('fsa-input, fieldset, div, section');
          const parentText = parent ? parent.textContent.toLowerCase() : '';
          if (parentText.includes('schedule a') && text === (data.filed_schedule_a_b_d_e_f_h ? 'yes' : 'no')) {
            el.click();
            break;
          }
        }
      }

    } else if (attempts < 10) {
      setTimeout(tryFill, 1000);
    }
  };
  setTimeout(tryFill, 2000);
  showExtractedInSidebar(data);
}

function showExtractedInSidebar(data) {
  const sidebar = document.getElementById('fafsa-sidebar');
  if (!sidebar) return;
  const body = sidebar.querySelector('.fafsa-body');
  if (!body) return;
  if (document.getElementById('fafsa-extracted-info')) return;

  const section = document.createElement('div');
  section.id = 'fafsa-extracted-info';
  section.style.cssText = 'margin-top:14px; background:#f0f7ff; border:1px solid #b3d4f7; border-radius:8px; padding:12px; font-size:12px;';

  const items = [
    { label: 'AGI', key: 'adjusted_gross_income' },
    { label: 'Income Tax Paid', key: 'income_tax_paid' },
    { label: 'Income from Work', key: 'income_earned_from_work' },
    { label: 'Filing Status', key: 'filing_status' },
  ];

  let html = '<div style="font-weight:700;color:#1a4480;margin-bottom:8px;">📄 From Your Documents</div>';
  for (const { label, key } of items) {
    const val = data[key];
    if (val == null) continue;
    const display = typeof val === 'number' ? '$' + val.toLocaleString() : val.replace(/_/g, ' ');
    html += `<div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span style="color:#5a7a9a;">${label}</span><strong>${display}</strong></div>`;
  }

  section.innerHTML = html;
  body.appendChild(section);
}

loadAndAutofillExtracted();

chrome.storage.onChanged.addListener((changes) => {
  console.log('STORAGE CHANGED', Object.keys(changes));
  if (changes.fafsaExtracted && changes.fafsaExtracted.newValue) {
    autofillExtracted(changes.fafsaExtracted.newValue);
  }
  if (changes.fafsaProfile && changes.fafsaProfile.newValue) {
    autofill(changes.fafsaProfile.newValue);
  }
});