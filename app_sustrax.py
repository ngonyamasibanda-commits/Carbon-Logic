"""Sustrax Lite Carbon Logic — professional emissions calculator."""

import streamlit as st

from components import (
    inject_css,
    is_locked,
    render_brand,
    render_upgrade_modal,
    render_welcome,
    svg_icon,
)
from database import entry_label
from visualizations import (
    emissions_by_category_donut,
    emissions_by_scope_bar,
    emissions_trend_line,
    monthly_emissions_ledger,
)
from config import (
    APP_NAME,
    CATEGORIES,
    DEFAULT_TIER,
    INPUT_CATEGORIES,
    SCOPE3_CATEGORIES,
    TIERS,
)
from database import entries_dataframe, total_emissions_tco2e
from forms import render_form

st.set_page_config(
    page_title=APP_NAME,
    page_icon="🌿",
    layout="wide",
    initial_sidebar_state="expanded",
)

inject_css()

# --- Session defaults ---
if "page" not in st.session_state:
    st.session_state.page = "dashboard"
if "user_tier" not in st.session_state:
    st.session_state.user_tier = DEFAULT_TIER
if "show_upgrade" not in st.session_state:
    st.session_state.show_upgrade = None
if "input_expanded" not in st.session_state:
    st.session_state.input_expanded = True
if "scope3_expanded" not in st.session_state:
    st.session_state.scope3_expanded = False


def navigate(page: str):
    st.session_state.page = page
    st.session_state.show_upgrade = None


def try_open_category(category_id: str):
    if is_locked(category_id, st.session_state.user_tier):
        st.session_state.show_upgrade = category_id
    else:
        navigate(f"form_{category_id}")


# --- Professional Header ---
def render_header():
    st.markdown(
        f"""
<div class="header-nav">
    <div style="font-weight: 700; color: #64748B; font-size: 1.1rem;">{APP_NAME}</div>
    <div style="flex: 1;"></div>
    <a href="#" class="nav-link">Learning Hub</a>
    <span style="color: #9CA3AF; margin: 0 12px;">{svg_icon('bell', 20)}</span>
    <div class="user-avatar">H</div>
</div>
        """,
        unsafe_allow_html=True,
    )


# --- Sidebar ---
with st.sidebar:
    render_brand()
    st.markdown("---")

    tier_label = TIERS.get(st.session_state.user_tier, {}).get("label", "Lite")
    st.caption(f"Plan: **{tier_label}**")

    if st.button("Dashboard", use_container_width=True, type="primary" if st.session_state.page == "dashboard" else "secondary"):
        navigate("dashboard")

    if st.button("Multi-site & Team Management", use_container_width=True):
        st.session_state.show_upgrade = "multi_site"

    st.markdown("**Input**")
    for cid in INPUT_CATEGORIES:
        cfg = CATEGORIES[cid]
        label = f"{cfg['name']}  {entry_label(cid)}"
        if st.button(label, key=f"nav_{cid}", use_container_width=True):
            try_open_category(cid)

    with st.expander("Additional Scope 3", expanded=st.session_state.scope3_expanded):
        for cid in SCOPE3_CATEGORIES:
            cfg = CATEGORIES[cid]
            label = f"{cfg['name']}  {entry_label(cid)}"
            if st.button(label, key=f"nav_{cid}", use_container_width=True):
                try_open_category(cid)

    st.markdown("---")
    for label, page in [
        ("Analysis", "analysis"),
        ("Combined Results", "combined"),
        ("FAQs", "faqs"),
        ("Carbon Credits", "credits"),
    ]:
        if st.button(label, key=f"nav_{page}", use_container_width=True):
            navigate(page)

    st.markdown("---")
    if st.button("Upgrade Plan", type="primary", use_container_width=True):
        st.session_state.show_upgrade = "upgrade_general"
        st.rerun()

    st.caption(f"© {APP_NAME}")


# --- Main Content ---
render_header()

if st.session_state.page != "dashboard":
    st.caption("Home / Form")

# --- Upgrade modal overlay ---
if st.session_state.show_upgrade:
    st.markdown("---")
    feature_id = st.session_state.show_upgrade
    if feature_id == "multi_site":
        st.markdown("### 🔒 Multi-site & Team Management")
        st.markdown(
            """
**Features:**
- Multiple sites & companies — scaled to your quote
- Add & manage your team — users to suit your needs
- Role-based access control
- Bulk data uploads
            """
        )
        render_upgrade_modal("Multi-site & Team Management", "freighting")
    elif feature_id == "upgrade_general":
        render_upgrade_modal("Premium Features", "freighting")
    elif feature_id in CATEGORIES:
        render_upgrade_modal(CATEGORIES[feature_id]["name"], feature_id)
    st.stop()


# --- Page routing ---
page = st.session_state.page

if page == "dashboard":
    render_welcome()

    c1, c2 = st.columns(2)
    with c1:
        st.markdown('<div class="section-card"><span class="section-title">Profile</span>', unsafe_allow_html=True)
        st.markdown("Edit your details, intensity metrics, or country from your profile settings.")
        st.markdown("</div>", unsafe_allow_html=True)
    with c2:
        st.markdown('<div class="section-card"><span class="section-title">Carbon Credits</span>', unsafe_allow_html=True)
        st.markdown("After calculating your footprint, fund carbon credits through verified climate projects.")
        st.markdown("</div>", unsafe_allow_html=True)

    total = total_emissions_tco2e()
    df_all = entries_dataframe()
    st.markdown(
        f"""
<div class="metric-strip">
  <div class="metric-box"><div class="metric-label">Total Emissions</div><div class="metric-value">{total:,.3f} tCO2e</div></div>
  <div class="metric-box"><div class="metric-label">Data Entries</div><div class="metric-value">{len(df_all)}</div></div>
  <div class="metric-box"><div class="metric-label">Categories Used</div><div class="metric-value">{df_all['Category'].nunique() if not df_all.empty else 0}</div></div>
</div>
        """,
        unsafe_allow_html=True,
    )

    st.markdown('<div class="section-card"><span class="section-title">Input Forms</span>', unsafe_allow_html=True)
    st.markdown("Select a category to begin data entry.")
    st.markdown("</div>", unsafe_allow_html=True)

    tiles = list(INPUT_CATEGORIES) + list(SCOPE3_CATEGORIES)
    cols = st.columns(4)
    for i, cid in enumerate(tiles):
        cfg = CATEGORIES[cid]
        locked = is_locked(cid, st.session_state.user_tier)
        with cols[i % 4]:
            if st.button(
                f"{cfg['name']}\n{entry_label(cid)}",
                key=f"tile_{cid}",
                use_container_width=True,
                disabled=False,
            ):
                try_open_category(cid)

elif page == "analysis":
    st.title("Emissions Analysis")
    df = entries_dataframe()
    if df.empty:
        st.info("Add emission data to see analysis charts.")
    else:
        st.metric("Total Footprint", f"{total_emissions_tco2e():,.3f} tCO2e")
        
        # Professional Plotly visualizations
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Emissions by Category")
            fig = emissions_by_category_donut(df)
            st.plotly_chart(fig, use_container_width=True)
        with col2:
            st.subheader("Emissions by Scope")
            fig = emissions_by_scope_bar(df)
            st.plotly_chart(fig, use_container_width=True)
        
        # Additional visualizations
        st.markdown("---")
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Monthly Emissions Ledger")
            fig = monthly_emissions_ledger(df)
            st.plotly_chart(fig, use_container_width=True)
        with col2:
            st.subheader("Cumulative Emissions Trend")
            fig = emissions_trend_line(df)
            st.plotly_chart(fig, use_container_width=True)

elif page == "combined":
    st.title("Combined Results")
    st.markdown("Review and export your consolidated carbon footprint.")
    df = entries_dataframe()
    if df.empty:
        st.warning("No data recorded yet.")
    else:
        st.dataframe(df, use_container_width=True, hide_index=True)
        csv = df.to_csv(index=False).encode("utf-8")
        st.download_button("Download as CSV", csv, "carbon_footprint.csv", "text/csv", type="primary")

elif page == "faqs":
    st.title("Frequently Asked Questions")
    with st.expander("What reporting period should I use?"):
        st.write("Most organisations report on the previous 12 months of operational data.")
    with st.expander("What emission factors are used?"):
        st.write("Calculations use UK DEFRA-style emission factors for grid electricity, fuels, travel, and waste.")
    with st.expander("How are units converted?"):
        st.write("Gallons are converted to litres, miles to kilometres, and results are shown in tonnes CO2e (tCO2e).")
    with st.expander("Can I upgrade my plan?"):
        st.write("Yes — use the Upgrade button in the sidebar to unlock Lite XL and MX features.")

elif page == "credits":
    st.title("Carbon Credits")
    st.markdown(
        """
After completing your footprint calculation, you can offset residual emissions
through verified carbon credit projects including reforestation, renewable energy, and community initiatives.

**Your current footprint:** {:.3f} tCO2e
        """.format(total_emissions_tco2e())
    )
    st.info("Contact Carbon Logic to purchase verified offsets matched to your footprint.")

elif page.startswith("form_"):
    category_id = page.replace("form_", "")
    if category_id in CATEGORIES:
        render_form(category_id)
    else:
        st.error("Unknown category.")
else:
    navigate("dashboard")
    st.rerun()
