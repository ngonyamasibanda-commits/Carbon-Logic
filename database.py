"""Supabase persistence with local session-state fallback."""

import datetime
import os
from typing import Any, Dict, List, Optional

import pandas as pd
import streamlit as st
from dotenv import load_dotenv

from config import SUPABASE_URL, SUPABASE_KEY

load_dotenv()

TABLE = "emission_entries"
SESSION_KEY = "emission_entries"
USER_ID = "default_user"


@st.cache_resource
def _client():
    try:
        from supabase import create_client

        url = SUPABASE_URL or os.environ.get("SUPABASE_URL")
        key = SUPABASE_KEY or os.environ.get("SUPABASE_KEY")
        if url and key:
            return create_client(url, key)
    except Exception:
        pass
    return None


def _ensure_session():
    if SESSION_KEY not in st.session_state:
        st.session_state[SESSION_KEY] = []


def _row_to_display(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row.get("id"),
        "Date Added": row.get("created_at", "")[:10] if row.get("created_at") else row.get("date_added", ""),
        "Category": row.get("category", ""),
        "Emissions (tCO2e)": round(float(row.get("emissions_tco2e", 0)), 4),
        "Details": row.get("details", ""),
        "Comment": row.get("comment", ""),
        "Scope": row.get("scope", ""),
        "Amount": row.get("amount"),
        "Unit": row.get("unit", ""),
    }


def entry_label(category_id: str) -> str:
    """Return entry count label for a category."""
    count = count_entries(category_id)
    cfg = __import__('config').CATEGORIES.get(category_id, {})
    limit = cfg.get("limit")
    if limit:
        return f"({count} of {limit} entries)"
    return f"({count} entries)"


@st.cache_data(ttl=300)
def fetch_entries(category: Optional[str] = None) -> List[Dict[str, Any]]:
    _ensure_session()
    sb = _client()
    if sb:
        try:
            q = sb.table(TABLE).select("*").eq("user_id", USER_ID).order("created_at", desc=True)
            if category:
                q = q.eq("category", category)
            return q.execute().data or []
        except Exception:
            pass
    rows = st.session_state[SESSION_KEY]
    if category:
        rows = [r for r in rows if r.get("category") == category]
    return rows


def count_entries(category: str) -> int:
    return len(fetch_entries(category))


def save_entry(
    category: str,
    scope: str,
    emissions_tco2e: float,
    details: str,
    amount: Optional[float] = None,
    unit: str = "",
    comment: str = "",
    link: str = "",
) -> bool:
    _ensure_session()
    now = datetime.datetime.utcnow().isoformat()
    payload = {
        "user_id": USER_ID,
        "category": category,
        "scope": scope,
        "emissions_tco2e": emissions_tco2e,
        "details": details,
        "amount": amount,
        "unit": unit,
        "comment": comment,
        "link": link,
        "created_at": now,
    }
    sb = _client()
    if sb:
        try:
            sb.table(TABLE).insert(payload).execute()
            return True
        except Exception:
            pass
    payload["id"] = len(st.session_state[SESSION_KEY]) + 1
    st.session_state[SESSION_KEY].append(payload)
    return True


def delete_entry(entry_id: int) -> bool:
    _ensure_session()
    sb = _client()
    if sb:
        try:
            sb.table(TABLE).delete().eq("id", entry_id).execute()
            return True
        except Exception:
            pass
    st.session_state[SESSION_KEY] = [r for r in st.session_state[SESSION_KEY] if r.get("id") != entry_id]
    return True


def entries_dataframe(category: Optional[str] = None) -> pd.DataFrame:
    rows = fetch_entries(category)
    if not rows:
        return pd.DataFrame(columns=["Date Added", "Emissions (tCO2e)", "Details", "Comment"])
    return pd.DataFrame([_row_to_display(r) for r in rows])


def total_emissions_tco2e() -> float:
    rows = fetch_entries()
    return sum(float(r.get("emissions_tco2e", 0)) for r in rows)
