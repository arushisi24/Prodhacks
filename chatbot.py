import os
# from openai import OpenAI
from dataclasses import dataclass
from typing import Optional, Dict, Any, Tuple, Literal
import requests

# WHO IS BUYING TOKENS
# api_key = os.getenv("OPENAI_API_KEY")
# client = OpenAi(api_key = api_key)

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

# store data
@dataclass
class user_data:
    mode: str = "initial" #initial->apply->estimate->documents
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

if __name__ == "__main__":
    # quick test
    state = user_data(
        independent=True,
        household_size=2,
        income_range="20_40k",
        asset_range="1_5k",
        award_year="2026-27",
        enrollment="full_time",
    )
    print(estimate_from_state(state))


