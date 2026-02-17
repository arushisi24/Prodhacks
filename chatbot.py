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
    "login",
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
