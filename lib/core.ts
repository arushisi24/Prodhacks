// Ported from core.py

const SENSITIVE_KEYWORDS = [
  "ssn",
  "social security",
  "routing number",
  "account number",
  "debit card",
  "credit card",
  "pin",
  "password",
];

export function containsSensitiveText(text: string): boolean {
  const t = (text || "").toLowerCase();
  return SENSITIVE_KEYWORDS.some((h) => t.includes(h));
}

export const SAFETY_TEXT =
  "Quick note: please don't share sensitive info like SSN, full bank account/routing numbers, " +
  "passwords, or PINs. I can help using ranges and checklists.";

export function openingMessage(): string {
  return (
    "Hi! I'm FAFSA Buddy 👋\n\n" +
    "What do you want help with today?\n" +
    "• Need help paying for college\n" +
    "• Not sure what I qualify for\n" +
    "• School told me to apply\n" +
    "• I don't know\n\n" +
    "Privacy note: don't enter SSNs, bank account/routing numbers, passwords, or PINs."
  );
}

export interface UserData {
  mode: string; // "initial" | "apply" | "estimate" | "documents"
  apply_step: number;
  under_24: boolean | null;
  independent: boolean | null;
  household_size: number | null;
  income_range: string | null;
  asset_range: string | null;
  has_tax_info: boolean | null;
  has_bank_info: boolean | null;
  award_year: string;
  enrollment: string;
}

export function createUserData(): UserData {
  return {
    mode: "initial",
    apply_step: 0,
    under_24: null,
    independent: null,
    household_size: null,
    income_range: null,
    asset_range: null,
    has_tax_info: null,
    has_bank_info: null,
    award_year: "2026-27",
    enrollment: "full_time",
  };
}

const INCOME_SCORE_MAP: Record<string, number> = {
  under_20k: 6,
  "20_40k": 5,
  "40_60k": 4,
  "60_80k": 3,
  "80_100k": 2,
  "100_150k": 1,
  "150_200k": 0,
  over_200k: 0,
};

const ASSET_PENALTY_MAP: Record<string, number> = {
  under_1k: 0,
  "1_5k": 0,
  "5_20k": 1,
  "20_50k": 1,
  "50_100k": 2,
  over_100k: 2,
};

const PELL_MAX = 7395;
const PELL_MIN = 740;

function estimateSaiBand(
  independent: boolean,
  householdSize: number,
  incomeBand: string,
  assetBand: string
): [[number, number], string] {
  const incomeScore = INCOME_SCORE_MAP[incomeBand] ?? 0;
  const assetPenalty = ASSET_PENALTY_MAP[assetBand] ?? 0;
  let hhScore = 0;
  if (householdSize >= 4) hhScore = 1;
  if (householdSize >= 6) hhScore = 2;
  const indepScore = independent ? 1 : 0;
  const needScore = incomeScore + hhScore + indepScore - assetPenalty;

  if (needScore >= 6) return [[-1500, 0], "very_high_need"];
  if (needScore >= 4) return [[1, 1500], "high_need"];
  if (needScore >= 2) return [[1501, 3000], "moderate_need"];
  if (needScore >= 1) return [[3001, 4500], "low_need"];
  return [[4501, 999999], "very_low_need"];
}

function saiBandToPellPercent(saiMin: number, saiMax: number): [number, number] {
  if (saiMin <= 0) return [0.8, 1.0];
  if (saiMax <= 1500) return [0.55, 0.8];
  if (saiMax <= 3000) return [0.35, 0.55];
  if (saiMax <= 4500) return [0.15, 0.35];
  if (saiMax <= 6000) return [0.1, 0.2];
  return [0.0, 0.1];
}

function enrollmentFactor(enrollment: string): number {
  const map: Record<string, number> = {
    full_time: 1.0,
    three_quarter: 0.75,
    half_time: 0.5,
    less_than_half: 0.25,
  };
  return map[enrollment] ?? 1.0;
}

function roundToNearest10(x: number): number {
  return Math.round(x / 10) * 10;
}

function bankStatementScript(): string {
  return (
    "Bank statement script (phone or chat)\n" +
    "Hi — I'm gathering documents for a financial aid application.\n" +
    "Can you tell me how to download my most recent checking and savings statements as PDFs?\n" +
    "If I can't access online banking, can you mail them or prepare printed copies for pickup?\n\n" +
    "Have ready: your name, address on file, and whatever verification the bank uses.\n" +
    "Do not share: full account numbers, PINs, or passwords."
  );
}

function missingDocsChecklist(): string {
  return (
    "**Common FAFSA documents (college students):**\n" +
    "- Student info + contact details\n" +
    "- Tax info (you and/or parent, depending on dependency)\n" +
    "- Current bank balances (you and/or parent)\n" +
    "- Records of untaxed income (if applicable)\n" +
    "- List of schools to receive FAFSA\n\n" +
    "If you're missing something, tell me which one: **tax info** or **bank statements/balances**."
  );
}

function fafsaStepsOverview(): string {
  return (
    "**FAFSA application steps (high-level):**\n" +
    "1) Create your account/login\n" +
    "2) Start the FAFSA for the right academic year\n" +
    "3) Add your school list\n" +
    "4) Answer dependency + household questions\n" +
    "5) Enter income + asset info (use ranges if needed)\n" +
    "6) Sign and submit\n" +
    "7) Watch for follow-ups: verification, school portal requests\n\n" +
    "If you tell me whether you're **independent** or **dependent**, I'll tailor the checklist."
  );
}

function looksLikeAwardYear(s: string): boolean {
  const t = s.trim().replace(/[–—]/g, "-");
  return /^\d{4}-\d{2}$/.test(t);
}

function normalizeAwardYear(s: string): string {
  return s.trim().replace(/[–—]/g, "-");
}

export function routeMessage(state: UserData, userText: string): string {
  const text = (userText || "").trim();
  const low = text.toLowerCase();

  if (text === "") {
    return openingMessage();
  }

  if (containsSensitiveText(text)) {
    return SAFETY_TEXT;
  }

  const APPLY_BUTTON_TEXTS = new Set([
    "need help paying for college",
    "not sure what i qualify for",
    "school told me to apply",
    "i don't know",
  ]);

  if (APPLY_BUTTON_TEXTS.has(low)) {
    state.mode = "apply";
    state.apply_step = 1;
    return (
      "Got it — we'll do this together.\n\n" +
      "First question: what school year are you applying for?\n" +
      "Example: 2026-27"
    );
  }

  // Mode switching keywords
  if (["estimate", "how much", "pell", "project", "range"].some((k) => low.includes(k))) {
    state.mode = "estimate";
    state.independent = null;
    state.household_size = null;
    state.income_range = null;
    state.asset_range = null;
    return (
      "Awesome — let's estimate your Pell Grant range.\n" +
      "Quick note: please don't share SSNs, account numbers, passwords, or PINs.\n\n" +
      "Step 1 of 4: Are you independent for FAFSA purposes? (yes/no)\n" +
      "Not sure? Type: not sure"
    );
  }

  if (
    ["bank", "statement", "statements", "call", "documents", "docs"].some((k) =>
      low.includes(k)
    )
  ) {
    state.mode = "documents";
    return missingDocsChecklist() + "\n\n" + bankStatementScript();
  }

  if (
    ["apply", "start fafsa", "fill out", "submit", "walk me through"].some((k) =>
      low.includes(k)
    )
  ) {
    state.mode = "apply";
    return fafsaStepsOverview();
  }

  // Apply mode step-by-step flow
  if (state.mode === "apply") {
    // Step 1: collect award year
    if (state.apply_step === 1) {
      if (looksLikeAwardYear(text)) {
        state.award_year = normalizeAwardYear(text);
        state.apply_step = 2;
        return "Next: are you independent for FAFSA purposes? (yes/no)";
      }
      return "Please enter a school year like 2026-27.";
    }

    // Step 2: independent?
    if (state.apply_step === 2) {
      if (low.includes("yes")) {
        state.independent = true;
        state.apply_step = 3;
        return "Next: what's your household size? (number)";
      }
      if (low.includes("no")) {
        state.independent = false;
        state.apply_step = 3;
        return "Next: what's your household size? (number)";
      }
      return "Please reply yes or no: are you independent for FAFSA purposes?";
    }

    // Step 3: household size
    if (state.apply_step === 3) {
      const digits = text.replace(/\D/g, "");
      const hs = parseInt(digits, 10);
      if (!isNaN(hs) && hs > 0 && hs <= 20) {
        state.household_size = hs;
        state.apply_step = 4;
        return "Next: do you have your tax info available right now? (yes/no)";
      }
      if (digits) {
        return "That number looks off — what's your household size? (usually 1–10)";
      }
      return "Please enter a number for household size (like 3).";
    }

    // Step 4: tax info
    if (state.apply_step === 4) {
      if (low.includes("yes")) {
        state.has_tax_info = true;
        state.apply_step = 5;
        return "Thanks. Next: do you have your current bank balances available? (yes/no)";
      }
      if (low.includes("no")) {
        state.has_tax_info = false;
        state.apply_step = 5;
        return "No problem. Next: do you have your current bank balances available? (yes/no)";
      }
      return "Please reply yes or no: do you have your tax info available?";
    }

    // Step 5: bank info
    if (state.apply_step === 5) {
      if (low.includes("yes")) {
        state.has_bank_info = true;
        state.apply_step = 6;
        return "Great. Want a personalized checklist now? (yes/no)";
      }
      if (low.includes("no")) {
        state.has_bank_info = false;
        state.apply_step = 6;
        return "Got it. Want a checklist and a script to request bank statements? (yes/no)";
      }
      return "Please reply yes or no: do you have your bank balances available?";
    }

    // Step 6+: done
    return "If you want, type documents for a checklist + bank statement script, or estimate for a Pell range estimate.";
  }

  if (state.mode === "documents") {
    return missingDocsChecklist() + "\n\n" + bankStatementScript();
  }

  return openingMessage();
}

export function currentChapter(state: UserData): number {
  if (state.mode === "apply") {
    if (state.apply_step <= 1) return 1;
    if (state.apply_step === 2 || state.apply_step === 3) return 2;
    if (state.apply_step === 4) return 3;
    if (state.apply_step === 5) return 4;
    if (state.apply_step >= 6) return 6;
  }
  if (state.mode === "estimate") return 4;
  if (state.mode === "documents") return 6;
  return 1;
}

export function computeProgress(state: UserData): number {
  const steps = [
    state.independent !== null,
    state.household_size !== null,
    state.income_range !== null,
    state.asset_range !== null,
  ];
  return steps.filter(Boolean).length / steps.length;
}

export function routeMessagePayload(
  state: UserData,
  userText: string
): {
  reply: string;
  mode: string;
  progress: number;
  chapter: number;
  state: UserData;
} {
  const reply = routeMessage(state, userText);
  return {
    reply,
    mode: state.mode,
    progress: computeProgress(state),
    chapter: currentChapter(state),
    state: { ...state },
  };
}

export function estimatePellRange(state: UserData): {
  pell_range: [number, number];
  pell_likelihood: string;
  sai_band_label: string;
  award_year: string;
  disclaimer: string;
} {
  const [[saiMin, saiMax], saiLabel] = estimateSaiBand(
    state.independent!,
    state.household_size!,
    state.income_range!,
    state.asset_range!
  );
  const [pMin, pMax] = saiBandToPellPercent(saiMin, saiMax);
  const factor = enrollmentFactor(state.enrollment);

  let rawMin = PELL_MAX * pMin * factor;
  let rawMax = PELL_MAX * pMax * factor;
  const minFloor = PELL_MIN * factor;

  if (rawMax > 0) rawMax = Math.max(rawMax, minFloor);
  if (rawMin > 0) rawMin = Math.max(rawMin, minFloor);

  rawMin = Math.max(0, Math.min(rawMin, PELL_MAX * factor));
  rawMax = Math.max(0, Math.min(rawMax, PELL_MAX * factor));

  const pellMin = roundToNearest10(rawMin);
  const pellMax = roundToNearest10(rawMax);

  let likelihood: string;
  if (saiMin <= 0) likelihood = "Very likely";
  else if (saiMax <= 1500) likelihood = "Likely";
  else if (saiMax <= 3000) likelihood = "Possible";
  else likelihood = "Unlikely/Low";

  return {
    award_year: state.award_year,
    pell_range: [pellMin, pellMax],
    pell_likelihood: likelihood,
    sai_band_label: saiLabel,
    disclaimer:
      "Range estimate only (not official). Final Pell depends on FAFSA SAI + school calculation and enrollment intensity.",
  };
}
