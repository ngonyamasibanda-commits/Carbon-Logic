"""Reusable UI helpers and styling."""

import datetime

import streamlit as st

from config import APP_NAME, APP_TAGLINE, CATEGORIES, DEFAULT_USER, PLAN_OPTIONS, TIER_RANK, TIERS


# Professional SVG Icons (Lucide-style)
def svg_icon(name: str, size: int = 20) -> str:
    """Return SVG icon markup for given icon name."""
    icons = {
        "dashboard": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>',
        "electricity": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>',
        "natural_gas": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a5 5 0 0 0-5 5v2a5 5 0 0 0 10 0V7a5 5 0 0 0-5-5z"></path><path d="M12 22a5 5 0 0 0 5-5v-2a5 5 0 0 0-10 0v2a5 5 0 0 0 5 5z"></path></svg>',
        "fuel": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 5c-1.5 0-2.8 1.4-3 2-3.5-1.5-11-.3-11 6 0 1.8 0 3 2 4.5V20h4v-2h3v2h4v-4c1-.5 1.7-1 2-2.5V5z"></path><path d="M5 9v-2h2"></path></svg>',
        "cars": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><circle cx="17" cy="17" r="2"></circle></svg>',
        "flights": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"></path><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-6"></path><path d="M12 2v20"></path><path d="M12 2l4 4"></path><path d="M12 2l-4 4"></path></svg>',
        "public_transport": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2v4"></path><path d="M16 2v4"></path><rect x="4" y="6" width="16" height="12" rx="2"></rect><path d="M4 12h16"></path><path d="M12 18v4"></path></svg>',
        "refrigerants": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M16 2v20"></path><path d="M8 2v20"></path><path d="M2 8h20"></path><path d="M2 16h20"></path></svg>',
        "home_workers": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>',
        "freighting": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
        "waste": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
        "commuting": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16v-2.38C4 11.5 2.97 10.5 3 8c.03-2.72 1.49-6 4.5-6C9.37 2 11 3.8 11 6c0 2.97-1.03 3.97-1 5.62V16"></path><path d="M16 16v-2.38C16 11.5 14.97 10.5 15 8c.03-2.72 1.49-6 4.5-6C21.37 2 23 3.8 23 6c0 2.97-1.03 3.97-1 5.62V16"></path><path d="M12 16v6"></path><path d="M8 22h8"></path></svg>',
        "water": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"></path></svg>',
        "heat_steam": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M8 6v14"></path><path d="M16 6v14"></path><path d="M4 10h16"></path><path d="M4 14h16"></path></svg>',
        "bulk_materials": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        "hotel_stays": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"></path><path d="M5 21V7l8-4 8 4v14"></path><path d="M17 21v-8.5a2.5 2.5 0 0 0-5 0V21"></path></svg>',
        "ingredients": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9z"></path><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.16-3.16 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-.63 3.47 2.4 2.4 0 0 1-3.16 3.16 2.4 2.4 0 0 1-4.77.4z"></path></svg>',
        "paper": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
        "computing": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>',
        "spend": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        "product": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>',
        "custom": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>',
        "analysis": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>',
        "results": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>',
        "faqs": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>',
        "credits": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"></path><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>',
        "bell": '<svg xmlns="http://www.w3.org/2000/svg" width="{}" height="{}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>',
    }
    return icons.get(name, "").format(size, size)


def inject_css():
    st.markdown(
        """
<style>
    /* Typography & Base Styles - Professional Dark Mode */
    html, body, [class*="css"] {
        font-family: -apple-system, BlinkMacSystemFont, "Inter", "Roboto", "Segoe UI", sans-serif;
        color: #FAFAFA;
    }
    
    /* Dark Mode Theme */
    .stApp {
        background-color: #0E1117;
    }
    
    /* Remove Streamlit Defaults */
    #MainMenu, footer, header { visibility: hidden; }
    .stApp > div:first-child { padding-top: 0 !important; }
    
    /* Sidebar Styling - Dark */
    [data-testid="stSidebar"] {
        background: #161A22;
        border-right: 1px solid #333;
    }
    [data-testid="stSidebar"] .stMarkdown h1 {
        font-size: 1.15rem !important;
        font-weight: 700 !important;
        color: #FAFAFA !important;
        margin-bottom: 0 !important;
    }
    
    .brand-tagline { color: #9CA3AF; font-size: 0.78rem; margin-top: -8px; }
    
    /* Welcome Card - Dark */
    .welcome-card {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 28px 32px;
        margin-bottom: 1.5rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .welcome-date { color: #9CA3AF; font-size: 0.9rem; }
    .welcome-name { font-size: 1.75rem; font-weight: 700; color: #FAFAFA; }
    .welcome-name span { color: #64748B; }
    
    /* Section Cards - Dark */
    .section-card {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px 24px;
        margin-bottom: 1rem;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .section-title {
        font-size: 1.1rem;
        font-weight: 600;
        border-bottom: 2px solid #64748B;
        padding-bottom: 8px;
        margin-bottom: 16px;
        display: inline-block;
        color: #FAFAFA;
    }
    
    /* Input Tiles - Dark */
    .input-tile {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 16px 12px;
        text-align: center;
        min-height: 110px;
        cursor: pointer;
        transition: all 0.15s ease;
    }
    .input-tile:hover { border-color: #64748B; box-shadow: 0 4px 12px rgba(100,116,139,0.2); }
    .tile-icon { font-size: 1.6rem; color: #64748B; }
    .tile-name { font-weight: 600; font-size: 0.88rem; margin-top: 6px; color: #FAFAFA; }
    .tile-count { font-size: 0.75rem; color: #9CA3AF; }
    
    /* Stepper - Dark */
    .stepper { display: flex; gap: 24px; align-items: center; margin: 12px 0 24px; }
    .step { display: flex; align-items: center; gap: 8px; font-size: 0.88rem; color: #6B7280; }
    .step.active { color: #64748B; font-weight: 600; }
    .step.done { color: #10B981; }
    .step-num {
        width: 28px; height: 28px; border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        border: 2px solid #4B5563; font-size: 0.8rem; font-weight: 600;
        color: #9CA3AF;
    }
    .step.active .step-num { border-color: #64748B; background: #64748B; color: #FAFAFA; }
    .step.done .step-num { border-color: #10B981; background: #10B981; color: #FAFAFA; }
    
    /* Form Styling - Dark */
    .form-header { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
    .form-header h2 { margin: 0; font-size: 1.4rem; color: #FAFAFA; }
    
    div[data-testid="stForm"] {
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px;
        background: #161A22;
    }
    
    /* Premium Boxes - Dark */
    .premium-box {
        border: 2px dashed #4B5563;
        border-radius: 12px;
        padding: 14px;
        margin-bottom: 10px;
        background: #1F2937;
    }
    
    /* Upgrade Modal - Dark */
    .upgrade-modal {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        max-width: 720px;
        margin: 0 auto;
    }
    .plan-card {
        border: 1px solid #333;
        border-radius: 12px;
        padding: 20px;
        text-align: center;
        background: #161A22;
    }
    .plan-card.highlight { border: 2px solid #64748B; background: #1F2937; }
    
    /* Button Styling - Slate Blue Primary */
    .stButton > button[kind="primary"], .stFormSubmitButton > button {
        background: #64748B !important;
        color: #FAFAFA !important;
        border: none !important;
        border-radius: 8px !important;
        font-weight: 600 !important;
    }
    .stButton > button[kind="primary"]:hover {
        background: #475569 !important;
    }
    .stButton > button {
        background: #1F2937 !important;
        color: #FAFAFA !important;
        border: 1px solid #333 !important;
        border-radius: 8px !important;
    }
    .stButton > button:hover {
        background: #374151 !important;
        border-color: #4B5563 !important;
    }
    
    /* Sidebar Entry Styling */
    .sidebar-entry { padding: 6px 0; font-size: 0.88rem; }
    .sidebar-entry.active { color: #64748B; font-weight: 600; }
    
    /* Metric Cards - Dark */
    .metric-strip {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
        margin-bottom: 20px;
    }
    .metric-box {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 16px 20px;
    }
    .metric-label { font-size: 0.8rem; color: #9CA3AF; }
    .metric-value { font-size: 1.5rem; font-weight: 700; color: #64748B; }
    
    /* Streamlit Metric Override */
    [data-testid="stMetricValue"] {
        color: #64748B !important;
        font-weight: 700 !important;
    }
    [data-testid="stMetricDelta"] {
        color: #10B981 !important;
    }
    
    /* Input Fields - Dark */
    .stTextInput > div > div > input,
    .stSelectbox > div > div > select,
    .stNumberInput > div > div > input {
        background: #1F2937 !important;
        color: #FAFAFA !important;
        border: 1px solid #333 !important;
    }
    .stTextInput > div > div > input:focus,
    .stSelectbox > div > div > select:focus,
    .stNumberInput > div > div > input:focus {
        border-color: #64748B !important;
    }
    
    /* DataFrames - Dark */
    .stDataFrame {
        background: #161A22;
        border: 1px solid #333;
        border-radius: 8px;
    }
    .stDataFrame [data-testid="stDataFrame"] {
        color: #FAFAFA;
    }
    
    /* Expander Styling - Dark */
    .streamlit-expanderHeader {
        background: #1F2937;
        border: 1px solid #333;
        border-radius: 8px;
        padding: 12px;
        color: #FAFAFA;
    }
    
    /* Info/Warning Boxes - Dark */
    .stAlert {
        background: #1F2937;
        border: 1px solid #333;
        border-radius: 8px;
        color: #FAFAFA;
    }
    
    /* Header Navigation - Dark */
    .header-nav {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 24px;
        background: #161A22;
        border-bottom: 1px solid #333;
    }
    
    .nav-link {
        color: #9CA3AF;
        text-decoration: none;
        font-size: 0.9rem;
        margin-right: 16px;
    }
    
    .nav-link:hover {
        color: #64748B;
    }
    
    .user-avatar {
        width: 32px;
        height: 32px;
        background: #64748B;
        color: #FAFAFA;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 600;
        font-size: 0.9rem;
    }
    
    /* SVG Icon Styling */
    .svg-icon {
        width: 20px;
        height: 20px;
        stroke: #FAFAFA;
        fill: none;
        stroke-width: 2;
        stroke-linecap: round;
        stroke-linejoin: round;
        display: inline-block;
        vertical-align: middle;
        margin-right: 8px;
    }
</style>
        """,
        unsafe_allow_html=True,
    )


def greeting():
    hour = datetime.datetime.now().hour
    if hour < 12:
        return "Good morning"
    if hour < 17:
        return "Good afternoon"
    return "Good evening"


def formatted_date():
    return datetime.datetime.now().strftime("%A, %B %d %Y")


def render_brand():
    # Professional Carbon Logic branding
    # Logo: Hexagon with "C" (dark blue) and "L" (outlined dark blue with light green inner line)
    # Light green leaf icon below letters
    # Text: "CARBON" (dark blue) "LOGIC" (light green) with thin light green lines
    st.markdown("### Carbon Logic")
    st.markdown(f'<p class="brand-tagline">{APP_TAGLINE}</p>', unsafe_allow_html=True)


def render_stepper(step: int = 2):
    steps = [("Select Form", 1), ("Input Data", 2), ("Review", 3)]
    html = '<div class="stepper">'
    for label, num in steps:
        cls = "done" if num < step else ("active" if num == step else "")
        icon = "✓" if num < step else str(num)
        html += f'<div class="step {cls}"><span class="step-num">{icon}</span>{label}</div>'
    html += "</div>"
    st.markdown(html, unsafe_allow_html=True)


def render_premium_boxes():
    st.markdown("**Additional Data**")
    st.text_input("Link", placeholder="e.g. SharePoint or Google Drive URL", key="form_link")
    st.text_area("Comments", placeholder="Add notes about this entry", key="form_comment", height=80)
    st.markdown(
        """
<div class="premium-box">
  <span class="badge-xl">Lite XL</span> <span class="badge-mx">MX</span><br>
  <strong>File Uploads & Storage</strong><br>
  <small style="color:#64748b">Keep evidence attached to every record — tap to upgrade.</small>
</div>
<div class="premium-box">
  <span class="badge-xl">Lite XL</span> <span class="badge-mx">MX</span><br>
  <strong>Custom Fields</strong><br>
  <small style="color:#64748b">Capture the extra detail you need — tap to upgrade.</small>
</div>
<div class="premium-box purple">
  <span class="badge-mx">MX</span><br>
  <strong>Data Tags</strong><br>
  <small style="color:#64748b">Tag, segment & slice your data — tap to upgrade.</small>
</div>
        """,
        unsafe_allow_html=True,
    )


def is_locked(category_id: str, user_tier: str) -> bool:
    required = CATEGORIES[category_id]["tier"]
    return TIER_RANK.get(user_tier, 0) < TIER_RANK.get(required, 0)


def render_upgrade_modal(feature_name: str, category_id: str):
    limit = CATEGORIES[category_id].get("limit")
    st.markdown(f'<div class="upgrade-modal">', unsafe_allow_html=True)
    st.markdown(f"### Unlock {feature_name} with Lite XL")
    st.caption(f"You're on Lite. Upgrade to Lite XL to unlock {feature_name} and save far more records.")
    cols = st.columns(3)
    records = {"lite_x": 0, "lite_xl": limit or 10, "mx": "Unlimited"}
    for i, plan in enumerate(PLAN_OPTIONS):
        with cols[i]:
            cls = "highlight" if plan.get("highlight") else ("purple" if plan.get("purple") else "")
            st.markdown(f'<div class="plan-card {cls}">', unsafe_allow_html=True)
            if plan.get("badge"):
                st.markdown(f"**{plan['badge']}**")
            st.markdown(f"#### {plan['name']}")
            st.markdown(f"**{plan['price']}** {plan['suffix']}")
            rec = records[plan["id"]]
            st.markdown(f"{rec} {feature_name.lower()} records")
            if plan["id"] == "lite_x":
                st.button("Not available", key=f"plan_{category_id}_{plan['id']}", disabled=True, use_container_width=True)
            elif plan["id"] == "lite_xl":
                if st.button(f"Get Lite XL →", key=f"plan_{category_id}_{plan['id']}", type="primary", use_container_width=True):
                    st.session_state.user_tier = "lite_xl"
                    st.session_state.show_upgrade = None
                    st.rerun()
            else:
                if st.button("Get MX →", key=f"plan_{category_id}_{plan['id']}", use_container_width=True):
                    st.session_state.user_tier = "mx"
                    st.session_state.show_upgrade = None
                    st.rerun()
            st.markdown("</div>", unsafe_allow_html=True)
    if st.button("Close", key=f"close_upgrade_{category_id}"):
        st.session_state.show_upgrade = None
        st.rerun()
    st.markdown("</div>", unsafe_allow_html=True)


def render_welcome():
    st.markdown(
        f"""
<div class="welcome-card">
  <div class="welcome-date">{formatted_date()}</div>
  <div class="welcome-name">{greeting()}, <span>{DEFAULT_USER}</span></div>
  <p style="color:#475569;margin-top:12px;">
    Your carbon calculations are typically based on the previous 12 months.
    Select an emission source below to begin building your footprint.
  </p>
</div>
        """,
        unsafe_allow_html=True,
    )





def render_results_table(category_id: str):
    from database import delete_entry, entries_dataframe

    st.markdown("---")
    st.subheader("Results")
    df = entries_dataframe(category_id)
    if df.empty:
        st.info("No entries yet. Complete the form above and click **Calculate & add to footprint**.")
        return
    display_cols = ["Date Added", "Emissions (tCO2e)", "Details", "Comment"]
    st.dataframe(df[display_cols], use_container_width=True, hide_index=True)
    with st.expander("Manage entries"):
        for _, row in df.iterrows():
            c1, c2 = st.columns([4, 1])
            with c1:
                st.text(f"{row['Date Added']} — {row['Details']} ({row['Emissions (tCO2e)']} tCO2e)")
            with c2:
                eid = row.get("id")
                if eid and st.button("Delete", key=f"del_{category_id}_{eid}"):
                    delete_entry(int(eid))
                    st.rerun()


def svg_icon(icon_name: str, size: str = "normal") -> str:
    """Return professional emoji for icon usage."""
    # Using professional emojis for button compatibility
    emoji_map = {
        "dashboard": "📊",
        "lock": "🔒", 
        "analysis": "📈",
        "combined": "📋",
        "reports": "📄",
        "faq": "❓",
        "credits": "🌱",
        "upgrade": "⬆️",
        "notification": "🔔",
        "electricity": "⚡",
        "home": "🏠",
        "settings": "⚙️",
        "category": "📁",
    }
    return emoji_map.get(icon_name, "•")



