import os
# from openai import OpenAI
from dataclasses import dataclass
from dataclasses import asdict
from typing import Optional, Dict, Any, Tuple, Literal
import requests

# client protection
sensitive_text = [
    "ssn",
    "social security",
    "routing number",
    "account number",
    "debit card",
    "credit card",
    "pin",
    "password",
]
def contains_sensitive_text(text):
    t = (text or "").lower()
    return any(h in t for h in sensitive_text)

safety_text = (
    "Quick note: please don’t share sensitive info like SSN, full bank account/routing numbers, "
    "passwords, or PINs. I can help using ranges and checklists."
)

def opening_message() -> str:
    return (
        "Hi! I’m FAFSA Buddy 👋\n\n"
        "What do you want help with today?\n"
        "• Need help paying for college\n"
        "• Not sure what I qualify for\n"
        "• School told me to apply\n"
        "• I don’t know\n\n"
        "Privacy note: don’t enter SSNs, bank account/routing numbers, passwords, or PINs."
    )

# store data
@dataclass
class user_data:
    mode: str = "initial" #initial->apply->estimate->documents
    apply_step: int = 0
    under_24: Optional[bool] = None
    independent: Optional[bool] = None
    household_size: Optional[int] = None
    income_range: Optional[str] = None
    asset_range: Optional[str] = None
    has_tax_info: Optional[bool] = None
    has_bank_info: Optional[bool] = None
    award_year: str = "2026-27"
    enrollment: str = "full_time"

# internal key, user label
income_ranges = [
    ("under_20k", "Under $20,000"),
    ("20_40k", "$20,000–$40,000"),
    ("40_60k", "$40,000–$60,000"),
    ("60_80k", "$60,000–$80,000"),
    ("80_100k", "$80,000–$100,000"),
    ("100_150k", "$100,000–$150,000"),
    ("150_200k", "$150,000–$200,000"),
    ("over_200k", "Over $200,000"),
]

asset_ranges = [
    ("under_1k", "Under $1,000"),
    ("1_5k", "$1,000–$5,000"),
    ("5_20k", "$5,000–$20,000"),
    ("20_50k", "$20,000–$50,000"),
    ("50_100k", "$50,000–$100,000"),
    ("over_100k", "Over $100,000"),
]

def format_band_menu(bands) -> str:
    # bands is like income_ranges = [("under_20k", "Under $20,000"), ...]
    return "\n".join([f"{k} — {label}" for k, label in bands])

def label_for_key(bands, key):
    for k, label in bands:
        if k == key:
            return label
    return key

def key_for_label(bands, label_text):
    for k, label in bands:
        if label == label_text:
            return k
    return label_text

# estimation
# https://collegescorecard.ed.gov/data/api/?utm_source=chatgpt.com
income_key = Literal[
    "under_20k", "20_40k", "40_60k", "60_80k", "80_100k", "100_150k", "150_200k", "over_200k"
]
asset_key = Literal["under_1k", "1_5k", "5_20k", "20_50k", "50_100k", "over_100k"]
enrollment = Literal["full_time", "three_quarter", "half_time", "less_than_half"]

class PellYearConfig:
    max_pell = 7395
    min_pell = 740

PELL_CONFIGS: Dict[str, PellYearConfig] = {
    "2026-27": PellYearConfig(),
    "2025-26": PellYearConfig(),
}

def estimate_sai_band(
    independent: bool,
    household_size: int,
    income_band: income_key,
    asset_band: asset_key,
):
    """
    returns ((sai_min, sai_max), label)
    lower SAI = higher need 
    """
    income_score_map = {
        "under_20k": 6,
        "20_40k": 5,
        "40_60k": 4,
        "60_80k": 3,
        "80_100k": 2,
        "100_150k": 1,
        "150_200k": 0,
        "over_200k": 0,
    }
    asset_penalty_map = {
        "under_1k": 0,
        "1_5k": 0,
        "5_20k": 1,
        "20_50k": 1,
        "50_100k": 2,
        "over_100k": 2,
    }
    income_score = income_score_map[income_band]
    asset_penalty = asset_penalty_map[asset_band]
    hh_score = 0
    if household_size >= 4:
        hh_score = 1
    if household_size >= 6:
        hh_score = 2
    indep_score = 1 if independent else 0
    need_score = income_score + hh_score + indep_score - asset_penalty
    if need_score >= 6:
        return (-1500, 0), "very_high_need"
    if need_score >= 4:
        return (1, 1500), "high_need"
    if need_score >= 2:
        return (1501, 3000), "moderate_need"
    if need_score >= 1:
        return (3001, 4500), "low_need"
    return (4501, 999999), "very_low_need"

def band_label(bands, key):
    return label_for_key(bands, key)

def format_pell_range(est: Dict[str, Any]):
    lo, hi = est["pell_range"]
    return f"${lo:,}–${hi:,}"

def sai_band_to_pell_percent(sai_min, sai_max):
    """
    returns (min_percent, max_percent) of max Pell
    """
    if sai_min <= 0:
        return (0.80, 1.00)
    if sai_max <= 1500:
        return (0.55, 0.80)
    if sai_max <= 3000:
        return (0.35, 0.55)
    if sai_max <= 4500:
        return (0.15, 0.35)
    if sai_max <= 6000:
        return (0.10, 0.20)
    return (0.00, 0.10)

def enrollment_factor(enrollment):
    return {
        "full_time": 1.0,
        "three_quarter": 0.75,
        "half_time": 0.5,
        "less_than_half": 0.25,
    }[enrollment]

def round_to_nearest_10(x):
    return int(round(x / 10.0) * 10)

def estimate_pell_range(
    award_year: str,
    independent: bool,
    household_size: int,
    income_band: income_key,
    asset_band: asset_key,
    enroll: enrollment = "full_time",
):
    """
    outputs a range-based Pell estimate using
      - estimated SAI band from ranges
      - mapping SAI band -> % of max Pell
      - enrollment intensity
    """
    (sai_min, sai_max), sai_label = estimate_sai_band(
        independent=independent,
        household_size=household_size,
        income_band=income_band,
        asset_band=asset_band,
    )
    pmin, pmax = sai_band_to_pell_percent(sai_min, sai_max)
    factor = enrollment_factor(enroll)
    cfg = PELL_CONFIGS[award_year]

    # compute dollars
    raw_min = cfg.max_pell * pmin * factor
    raw_max = cfg.max_pell * pmax * factor

    # apply minimum Pell floor (scaled) if eligible
    min_floor = cfg.min_pell * factor
    if raw_max > 0:
        raw_max = max(raw_max, min_floor)
    if raw_min > 0:
        raw_min = max(raw_min, min_floor)

    # [0, max_pell*factor]
    raw_min = max(0, min(raw_min, cfg.max_pell * factor))
    raw_max = max(0, min(raw_max, cfg.max_pell * factor))

    pell_min = round_to_nearest_10(raw_min)
    pell_max = round_to_nearest_10(raw_max)

    if sai_min <= 0:
        likelihood = "Very likely"
    elif sai_max <= 1500:
        likelihood = "Likely"
    elif sai_max <= 3000:
        likelihood = "Possible"
    else:
        likelihood = "Unlikely/Low"

    return {
        "award_year": award_year,
        "enrollment": enroll,
        "estimated_sai_band": (sai_min, sai_max),
        "sai_band_label": sai_label,
        "pell_likelihood": likelihood,
        "pell_range": (pell_min, pell_max),
        "disclaimer": "Range estimate only (not official). Final Pell depends on FAFSA SAI + school calculation and enrollment intensity.",
    }

def estimate_from_state(state: user_data):
    if state.independent is None or state.household_size is None or state.income_range is None or state.asset_range is None:
        raise ValueError("Need independent, household_size, income_range, asset_range to estimate.")
    return estimate_pell_range(
        award_year=state.award_year,
        independent=bool(state.independent),
        household_size=int(state.household_size),
        income_band=state.income_range,
        asset_band=state.asset_range,
        enroll=state.enrollment,
    )

def get_school_info(school_name, college_api_key, limit):
    url = "https://api.data.gov/ed/collegescorecard/v1/schools"
    params = {
        "api_key": college_api_key,
        "school.name": school_name,
        "fields": ",".join([
            "id",
            "school.name",
            "school.city",
            "school.state",
            "latest.cost.tuition.in_state",
            "latest.cost.tuition.out_of_state",
            "latest.cost.roomboard.oncampus",
            "latest.cost.avg_net_price.public",
            "latest.cost.avg_net_price.private",
        ]),
        "per_page": limit,
    }
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    return r.json().get("results", [])

def get_tuition(school):
    in_state = school.get("latest.cost.tuition.in_state")
    out_state = school.get("latest.cost.tuition.out_of_state")
    tuition = in_state if in_state is not None else out_state
    return {
        "name": school.get("school.name"),
        "city": school.get("school.city"),
        "state": school.get("school.state"),
        "tuition_in_state": in_state,
        "tuition_out_of_state": out_state,
        "tuition_best_guess": tuition,
    }

def bank_statement_script():
    return (
        "Bank statement script (phone or chat)\n"
        "Hi — I’m gathering documents for a financial aid application.\n"
        "Can you tell me how to download my most recent checking and savings statements as PDFs?\n"
        "If I can’t access online banking, can you mail them or prepare printed copies for pickup?\n\n"
        "Have ready: your name, address on file, and whatever verification the bank uses.\n"
        "Do not share: full account numbers, PINs, or passwords."
    )

def missing_docs_checklist():
    return (
        "Common FAFSA documents\n"
        "- Student contact info\n"
        "- Tax info (student and/or parent, depending on dependency)\n"
        "- Current bank balances (student and/or parent)\n"
        "- Records of untaxed income (if applicable)\n"
        "- List of schools to send FAFSA to\n\n"
        "Tell me what you’re missing: tax info or bank statements/balances."
    )

def fafsa_steps_overview():
    return (
        "FAFSA steps (high level)\n"
        "1) Log in (or create your FAFSA account)\n"
        "2) Start the FAFSA for the correct school year\n"
        "3) Add your school list\n"
        "4) Answer dependency and household questions\n"
        "5) Enter income and asset info\n"
        "6) Sign and submit\n"
        "7) Watch for follow-ups (verification or school portal requests)\n"
    )

def missing_docs_checklist():
    return (
        "**Common FAFSA documents (college students):**\n"
        "- Student info + contact details\n"
        "- Tax info (you and/or parent, depending on dependency)\n"
        "- Current bank balances (you and/or parent)\n"
        "- Records of untaxed income (if applicable)\n"
        "- List of schools to receive FAFSA\n\n"
        "If you’re missing something, tell me which one: **tax info** or **bank statements/balances**."
    )


def fafsa_steps_overview():
    return (
        "**FAFSA application steps (high-level):**\n"
        "1) Create your account/login\n"
        "2) Start the FAFSA for the right academic year\n"
        "3) Add your school list\n"
        "4) Answer dependency + household questions\n"
        "5) Enter income + asset info (use ranges if needed)\n"
        "6) Sign and submit\n"
        "7) Watch for follow-ups: verification, school portal requests\n\n"
        "If you tell me whether you’re **independent** or **dependent**, I’ll tailor the checklist."
    )

def looks_like_award_year(s: str) -> bool:
    # accepts: 2026-27, 2026–27, 2026—27
    t = s.strip().replace("–", "-").replace("—", "-")
    return len(t) == 7 and t[:4].isdigit() and t[4] == "-" and t[5:].isdigit()

def normalize_award_year(s: str) -> str:
    return s.strip().replace("–", "-").replace("—", "-")

# conversation router
def route_message(state: user_data, user_text: str):
    text = (user_text or "").strip()
    low = text.lower()

    if text == "":
        return opening_message()

    if contains_sensitive_text(text):
        return safety_text
    
    APPLY_BUTTON_TEXTS = {
    "need help paying for college",
    "not sure what i qualify for",
    "school told me to apply",
    "i don't know",
    }

    if low in APPLY_BUTTON_TEXTS:
        state.mode = "apply"
        state.apply_step = 1
        return (
            "Got it — we’ll do this together.\n\n"
            "First question: what school year are you applying for?\n"
            "Example: 2026-27"
        )
    # mode switching keywords
    if any(k in low for k in ["estimate", "how much", "pell", "project", "range"]):
        state.mode = "estimate"
        state.independent = None
        state.household_size = None
        state.income_range = None
        state.asset_range = None

        return (
            "Awesome — let’s estimate your Pell Grant range.\n"
            "Quick note: please don’t share SSNs, account numbers, passwords, or PINs.\n\n"
            "Step 1 of 4: Are you independent for FAFSA purposes? (yes/no)\n"
            "Not sure? Type: not sure"
        )

    if any(k in low for k in ["bank", "statement", "statements", "call", "documents", "docs"]):
        state.mode = "documents"
        return missing_docs_checklist() + "\n\n" + bank_statement_script()

    if any(k in low for k in ["apply", "start fafsa", "fill out", "submit", "walk me through"]):
        state.mode = "apply"
        return fafsa_steps_overview()

    # handle estimate mode inputs
    if state.mode == "apply":
        # Step 1: collect award year
        if state.apply_step == 1:
            if looks_like_award_year(text):
                state.award_year = normalize_award_year(text)
                state.apply_step = 2
                # IMPORTANT: return ONLY the next question
                return "Next: are you independent for FAFSA purposes? (yes/no)"
            return "Please enter a school year like 2026-27."

        # Step 2: independent?
        if state.apply_step == 2:
            if "yes" in low:
                state.independent = True
                state.apply_step = 3
                return "Next: what’s your household size? (number)"
            if "no" in low:
                state.independent = False
                state.apply_step = 3
                return "Next: what’s your household size? (number)"
            return "Please reply yes or no: are you independent for FAFSA purposes?"

        # Step 3: household size
        if state.apply_step == 3:
            try:
                hs = int("".join(ch for ch in text if ch.isdigit()))
                if hs <= 0 or hs > 20:
                    return "That number looks off — what’s your household size? (usually 1–10)"
                state.household_size = hs
                state.apply_step = 4
                return "Next: do you have your tax info available right now? (yes/no)"
            except Exception:
                return "Please enter a number for household size (like 3)."

        # Step 4: tax info
        if state.apply_step == 4:
            if "yes" in low:
                state.has_tax_info = True
                state.apply_step = 5
                return "Thanks. Next: do you have your current bank balances available? (yes/no)"
            if "no" in low:
                state.has_tax_info = False
                state.apply_step = 5
                return "No problem. Next: do you have your current bank balances available? (yes/no)"
            return "Please reply yes or no: do you have your tax info available?"

        # Step 5: bank info
        if state.apply_step == 5:
            if "yes" in low:
                state.has_bank_info = True
                state.apply_step = 6
                return "Great. Want a personalized checklist now? (yes/no)"
            if "no" in low:
                state.has_bank_info = False
                state.apply_step = 6
                return "Got it. Want a checklist and a script to request bank statements? (yes/no)"
            return "Please reply yes or no: do you have your bank balances available?"

        # Step 6+: done / next actions
        return "If you want, type documents for a checklist + bank statement script, or estimate for a Pell range estimate."


    # apply mode
    if state.mode == "apply":
        return (
            fafsa_steps_overview()
            + "\n\nQuick questions so I can tailor this:\n"
            "1) Are you independent for FAFSA purposes? (yes/no)\n"
            "2) Do you have your tax info available? (yes/no)"
        )

    # documents mode
    if state.mode == "documents":
        return missing_docs_checklist() + "\n\n" + bank_statement_script()

    # default
    return opening_message()

# progress
def current_chapter(state: user_data) -> int:
    # 1=Goal & basics
    # 2=Household / dependency
    # 3=Taxes & income
    # 4=Assets & banking
    # 5=Schools & timing
    # 6=Checklist

    if state.mode == "apply":
        # apply_step meaning:
        # 1 = asking award year
        # 2 = asking independent?
        # 3 = asking household size
        # 4 = asking tax info
        # 5 = asking bank balances
        # 6 = wrap / checklist prompt

        if state.apply_step <= 1:
            return 1
        if state.apply_step in (2, 3):
            return 2
        if state.apply_step == 4:
            return 3
        if state.apply_step == 5:
            return 4
        if state.apply_step >= 6:
            return 6

    if state.mode == "estimate":
        # Optional: if you want estimate to move chapters too,
        # you should add estimate_step to state and map it.
        return 4

    if state.mode == "documents":
        return 6

    return 1

def compute_progress(state):
    steps = [
        state.independent is not None,
        state.household_size is not None,
        state.income_range is not None,
        state.asset_range is not None,
    ]
    return sum(1 for x in steps if x) / len(steps)

def route_message_payload(state, user_text: str):
    reply_text = route_message(state, user_text)
    return {
        "reply": reply_text,
        "mode": state.mode,
        "progress": compute_progress(state),
        "chapter": current_chapter(state),
        "state": asdict(state),
    }

if __name__ == "__main__":
    state = user_data()
    print("Type: estimate / apply / documents. Type quit to exit.\n")
    while True:
        msg = input("> ")
        if msg.strip().lower() in {"quit", "exit"}:
            break
        print(route_message(state, msg))
        print()




