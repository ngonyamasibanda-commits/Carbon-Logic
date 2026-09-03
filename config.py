"""App configuration: categories, tiers, limits, and navigation."""

import os

from dotenv import load_dotenv

load_dotenv()

APP_NAME = "Carbon Logic"
APP_TAGLINE = "Professional Emissions Calculator"
DEFAULT_USER = "Hlulani Logic"
DEFAULT_TIER = "mx"  # All features unlocked - mx tier

TIERS = {
    "lite": {"label": "Lite", "price": "Included"},
    "lite_xl": {"label": "Lite XL", "price": "£995 ex VAT"},
    "mx": {"label": "MX", "price": "On Request"},
}

PLAN_OPTIONS = [
    {"id": "lite_x", "name": "Lite X", "price": "£295", "suffix": "ex VAT", "badge": None},
    {"id": "lite_xl", "name": "Lite XL", "price": "£995", "suffix": "ex VAT", "badge": "Recommended", "highlight": True},
    {"id": "mx", "name": "MX", "price": "On Request", "suffix": "", "badge": None, "purple": True},
]

# Publishable values only. Never put a service_role key here — this file is imported
# by the old Streamlit app and would ship with the process.
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("SUPABASE_KEY", "")

# category_id -> config - All features unlocked
CATEGORIES = {
    "electricity": {
        "name": "Electricity", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 2", "order": 1,
    },
    "natural_gas": {
        "name": "Natural Gas", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 1", "order": 2,
    },
    "fuel": {
        "name": "Fuel", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 1", "order": 3,
    },
    "cars": {
        "name": "Cars", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 1", "order": 4,
    },
    "flights": {
        "name": "Flights", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 5,
    },
    "public_transport": {
        "name": "Public Transport", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 6,
    },
    "refrigerants": {
        "name": "Refrigerants", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 1", "order": 7,
    },
    "home_workers": {
        "name": "Home Workers", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 8,
    },
    "freighting": {
        "name": "Freighting", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 9,
    },
    "waste": {
        "name": "Waste", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 10,
    },
    "commuting": {
        "name": "Commuting", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 11,
    },
    "water": {
        "name": "Water", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 12,
    },
    "heat_steam": {
        "name": "Heat and steam", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 2", "order": 13,
    },
    "bulk_materials": {
        "name": "Bulk Materials", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 14,
    },
    "hotel_stays": {
        "name": "Hotel Stays", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 15,
    },
    "ingredients": {
        "name": "Ingredients", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 16,
    },
    "paper": {
        "name": "Paper", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 17,
    },
    "computing": {
        "name": "Computing", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 18,
    },
    "spend": {
        "name": "Spend", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 19,
    },
    "product": {
        "name": "Product", "icon": "", "tier": "mx", "limit": None,
        "scope": "Scope 3", "order": 20,
    },
    "custom": {
        "name": "Custom", "icon": "", "tier": "mx", "limit": None,
        "scope": "Custom", "order": 21,
    },
}

INPUT_CATEGORIES = [k for k, v in sorted(CATEGORIES.items(), key=lambda x: x[1]["order"]) if v["order"] <= 12]
SCOPE3_CATEGORIES = [k for k, v in sorted(CATEGORIES.items(), key=lambda x: x[1]["order"]) if v["order"] >= 13]

# Navigation sections for Carbon Logic
NAVIGATION_SECTIONS = {
    "main": ["dashboard"],
    "input": INPUT_CATEGORIES,
    "scope3": SCOPE3_CATEGORIES,
    "analysis": ["analysis", "combined", "faqs", "credits"]
}

TIER_RANK = {"lite": 0, "lite_xl": 1, "mx": 2}

AIRPORTS = {
    "LHR": ("London Heathrow", 51.4700, -0.4543),
    "JFK": ("New York JFK", 40.6413, -73.7781),
    "CDG": ("Paris Charles de Gaulle", 49.0097, 2.5479),
    "DXB": ("Dubai International", 25.2532, 55.3657),
    "SIN": ("Singapore Changi", 1.3644, 103.9915),
    "JNB": ("Johannesburg OR Tambo", -26.1367, 28.2411),
    "CPT": ("Cape Town", -33.9715, 18.6021),
    "NBO": ("Nairobi", -1.3192, 36.9278),
    "LAX": ("Los Angeles", 33.9416, -118.4085),
    "FRA": ("Frankfurt", 50.0379, 8.5622),
    "AMS": ("Amsterdam Schiphol", 52.3105, 4.7683),
    "HKG": ("Hong Kong", 22.3080, 113.9185),
}
