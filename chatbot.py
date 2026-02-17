import os
from openai import OpenAI
from dataclasses import dataclass
from typing import Optional
import requests

# WHO IS BUYING TOKENS
api_key = os.getenv("OPENAI_API_KEY")
client = OpenAi(api_key = api_key)

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
income_key = [
    "under_20k", "20_40k", "40_60k", "60_80k", "80_100k", "100_150k", "150_200k", "over_200k"
]
asset_key = ["under_1k", "1_5k", "5_20k", "20_50k", "50_100k", "over_100k"]
enrollment = ["full_time", "three_quarter", "half_time", "less_than_half"]

class PellYearConfig:
    max_pell = 7395
    min_pell = 740

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
    income_score = {
        "under_20k": 6,
        "20_40k": 5,
        "40_60k": 4,
        "60_80k": 3,
        "80_100k": 2,
        "100_150k": 1,
        "150_200k": 0,
        "over_200k": 0,
    }
    asset_score = {
        "under_1k": 0,
        "1_5k": 0,
        "5_20k": 1,
        "20_50k": 1,
        "50_100k": 2,
        "over_100k": 2,
    }
    hh_score = 0
    if household_size >= 4:
        hh_score = 1
    if household_size >= 6:
        hh_score = 2
    indep_score = 1 if independent else 0
    need_score = income_score + hh_score + indep_score - asset_score
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
    }

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




