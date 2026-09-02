"""Carbon Logic Engine — professional emissions calculator."""

import streamlit as st

from components import (
    entry_label,
    inject_css,
    is_locked,
    render_brand,
    render_upgrade_modal,
    render_welcome,
    svg_icon,
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
    page_icon="⚡",
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
        locked = is_locked(cid, st.session_state.user_tier)
        prefix = "🔒 " if locked else ""
        label = f"{prefix}{cfg['name']}  {entry_label(cid)}"
        if st.button(label, key=f"nav_{cid}", use_container_width=True):
            try_open_category(cid)

    with st.expander("Additional Scope 3", expanded=st.session_state.scope3_expanded):
        for cid in SCOPE3_CATEGORIES:
            cfg = CATEGORIES[cid]
            locked = is_locked(cid, st.session_state.user_tier)
            prefix = "🔒 " if locked else ""
            badge = " MX" if cfg["tier"] == "mx" else ""
            if st.button(f"{prefix}{cfg['name']}{badge}", key=f"nav_{cid}", use_container_width=True):
                try_open_category(cid)

    st.markdown("---")
    for label, page in [
        ("Analysis", "analysis"),
        ("Combined Results", "combined"),
        ("Reports", "reports"),
        ("FAQs", "faqs"),
        ("Carbon Credits", "credits"),
    ]:
        if st.button(label, key=f"nav_{page}", use_container_width=True):
            navigate(page)

    st.markdown("---")
    if st.button("Upgrade Plan", type="primary", use_container_width=True):
        st.session_state.show_upgrade = "upgrade_general"
        st.rerun()

    st.caption("© Carbon Logic Engine")


# --- Top bar ---
top_l, top_r = st.columns([6, 1])
with top_l:
    if st.session_state.page != "dashboard":
        st.caption("Home / Form")
with top_r:
    st.markdown(f'<div style="text-align:right;color:#9CA3AF;">🔔 &nbsp; <span style="background:#64748B;color:#FAFAFA;border-radius:50%;padding:4px 10px;font-weight:600;">H</span></div>', unsafe_allow_html=True)


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

    # Enhanced metrics with additional data
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

    # Add quick action buttons
    st.markdown('<div class="section-card"><span class="section-title">Quick Actions</span>', unsafe_allow_html=True)
    col1, col2, col3 = st.columns(3)
    with col1:
        if st.button("📊 View Analysis", key="quick_analysis", use_container_width=True):
            navigate("analysis")
    with col2:
        if st.button("📋 Export Data", key="quick_export", use_container_width=True):
            navigate("combined")
    with col3:
        if st.button("🌱 Carbon Credits", key="quick_credits", use_container_width=True):
            navigate("credits")
    st.markdown("</div>", unsafe_allow_html=True)

    st.markdown('<div class="section-card"><span class="section-title">Input Forms</span>', unsafe_allow_html=True)
    st.markdown("Select a category to begin data entry.")
    st.markdown("</div>", unsafe_allow_html=True)

    tiles = list(INPUT_CATEGORIES) + list(SCOPE3_CATEGORIES)
    cols = st.columns(4)
    for i, cid in enumerate(tiles):
        cfg = CATEGORIES[cid]
        locked = is_locked(cid, st.session_state.user_tier)
        with cols[i % 4]:
            badge = ""
            if locked:
                badge = "Lite XL" if cfg["tier"] == "lite_xl" else "MX"
            icon = "🔒" if locked else "📁"
            if st.button(
                f"{icon} {cfg['name']}\n{entry_label(cid)}",
                key=f"tile_{cid}",
                use_container_width=True,
                disabled=False,
            ):
                try_open_category(cid)
            if locked:
                st.caption(f"🔒 {badge}")

elif page == "analysis":
    st.title("Emissions Analysis")
    df = entries_dataframe()
    if df.empty:
        st.info("Add emission data to see analysis charts.")
    else:
        total = total_emissions_tco2e()
        st.metric("Total Footprint", f"{total:,.3f} tCO2e")

        # Enhanced visualizations
        col1, col2 = st.columns(2)
        with col1:
            st.subheader("Emissions by Category")
            by_cat = df.groupby("Category")["Emissions (tCO2e)"].sum().sort_values(ascending=False)
            st.bar_chart(by_cat)
        with col2:
            st.subheader("Emissions by Scope")
            if "Scope" in df.columns:
                by_scope = df.groupby("Scope")["Emissions (tCO2e)"].sum()
                st.bar_chart(by_scope)
            else:
                st.info("Scope data not available")

        # Additional insights
        st.markdown("---")
        st.subheader("Key Insights")
        c1, c2, c3 = st.columns(3)
        with c1:
            if not by_cat.empty:
                top_category = by_cat.idxmax()
                top_value = by_cat.max()
                st.metric("Highest Emitting Category", f"{top_category}", f"{top_value:.3f} tCO2e")
        with c2:
            avg_per_entry = total / len(df) if len(df) > 0 else 0
            st.metric("Average per Entry", f"{avg_per_entry:.4f} tCO2e")
        with c3:
            scope_1 = df[df["Scope"] == "Scope 1"]["Emissions (tCO2e)"].sum() if "Scope" in df.columns else 0
            scope_2 = df[df["Scope"] == "Scope 2"]["Emissions (tCO2e)"].sum() if "Scope" in df.columns else 0
            scope_3 = df[df["Scope"] == "Scope 3"]["Emissions (tCO2e)"].sum() if "Scope" in df.columns else 0
            st.metric("Scope 3 Share", f"{(scope_3/total*100):.1f}%" if total > 0 else "0%")

        # Trend analysis if we have date data
        if "Date Added" in df.columns:
            st.markdown("---")
            st.subheader("Recent Activity")
            recent_entries = df.sort_values("Date Added", ascending=False).head(5)
            st.dataframe(recent_entries[["Date Added", "Category", "Emissions (tCO2e)", "Details"]], use_container_width=True, hide_index=True)

elif page == "combined":
    st.title("Combined Results")
    st.markdown("Review and export your consolidated carbon footprint.")
    df = entries_dataframe()
    if df.empty:
        st.warning("No data recorded yet.")
    else:
        # Summary statistics
        st.markdown("### Summary Statistics")
        col1, col2, col3, col4 = st.columns(4)
        with col1:
            st.metric("Total Emissions", f"{total_emissions_tco2e():,.3f} tCO2e")
        with col2:
            st.metric("Total Entries", len(df))
        with col3:
            st.metric("Categories", df['Category'].nunique())
        with col4:
            if "Scope" in df.columns:
                st.metric("Scopes Covered", df['Scope'].nunique())

        # Filter options
        st.markdown("### Data Filters")
        col1, col2, col3 = st.columns(3)
        with col1:
            category_filter = st.selectbox("Filter by Category", ["All"] + list(df['Category'].unique()))
        with col2:
            if "Scope" in df.columns:
                scope_filter = st.selectbox("Filter by Scope", ["All"] + list(df['Scope'].unique()))
            else:
                scope_filter = "All"
        with col3:
            date_range = st.selectbox("Time Period", ["All Time", "Recent 30 Days", "Recent 90 Days"])

        # Apply filters
        filtered_df = df.copy()
        if category_filter != "All":
            filtered_df = filtered_df[filtered_df['Category'] == category_filter]
        if scope_filter != "All":
            filtered_df = filtered_df[filtered_df['Scope'] == scope_filter]

        # Display filtered data
        st.markdown("### Detailed Records")
        st.dataframe(filtered_df, use_container_width=True, hide_index=True)

        # Export options
        st.markdown("### Export Options")
        col1, col2, col3 = st.columns(3)
        with col1:
            csv = filtered_df.to_csv(index=False).encode("utf-8")
            st.download_button("Download CSV", csv, "carbon_footprint.csv", "text/csv", type="primary", use_container_width=True)
        with col2:
            # JSON export
            json_data = filtered_df.to_json(orient='records', indent=2)
            st.download_button("Download JSON", json_data, "carbon_footprint.json", "application/json", use_container_width=True)
        with col3:
            st.info("PDF export available in premium plans")

        # Print-friendly summary
        st.markdown("---")
        st.markdown("### Print-Friendly Summary")
        st.markdown(f"""
**Carbon Footprint Report**
- Total Emissions: {total_emissions_tco2e():,.3f} tCO2e
- Total Entries: {len(df)}
- Categories: {', '.join(df['Category'].unique())}
- Report Generated: {df['Date Added'].max() if not df.empty and 'Date Added' in df.columns else 'N/A'}
        """)

elif page == "faqs":
    st.title("Frequently Asked Questions")
    st.markdown("### General Questions")

    with st.expander("What reporting period should I use?"):
        st.write("Most organisations report on the previous 12 months of operational data. This aligns with standard carbon accounting practices and regulatory requirements.")

    with st.expander("What emission factors are used?"):
        st.write("Calculations use UK DEFRA-style emission factors for grid electricity, fuels, travel, and waste. These factors are updated annually to reflect the latest scientific data and grid composition.")

    with st.expander("How are units converted?"):
        st.write("Gallons are converted to litres, miles to kilometres, and results are shown in tonnes CO2e (tCO2e). All conversions follow international standards to ensure accuracy and comparability.")

    with st.expander("What is the difference between Scope 1, 2, and 3 emissions?"):
        st.write("""
        - **Scope 1:** Direct emissions from owned or controlled sources (e.g., company vehicles, on-site fuel combustion)
        - **Scope 2:** Indirect emissions from purchased electricity, steam, heating, and cooling
        - **Scope 3:** All other indirect emissions in the value chain (e.g., business travel, procurement, waste disposal)
        """)

    st.markdown("### Technical Questions")

    with st.expander("How accurate are the calculations?"):
        st.write("Our calculations use government-approved emission factors and standard conversion methodologies. Accuracy depends on the quality of input data provided. For regulatory compliance, we recommend professional verification.")

    with st.expander("Can I import data from other systems?"):
        st.write("CSV import is available in premium plans. We also offer API integration for enterprise customers to connect with existing ERP and accounting systems.")

    with st.expander("Is my data secure?"):
        st.write("Yes, all data is encrypted in transit and at rest. We comply with GDPR and other data protection regulations. Enterprise customers can choose data residency options.")

    st.markdown("### Account & Billing")

    with st.expander("Can I upgrade my plan?"):
        st.write("Yes — use the Upgrade button in the sidebar to unlock Lite XL and MX features. Upgrades take effect immediately and you'll be charged pro-rated amounts.")

    with st.expander("What happens if I exceed my entry limits?"):
        st.write("You'll receive notifications when approaching limits. You can upgrade your plan at any time to increase capacity or remove limits entirely with the MX plan.")

    with st.expander("Can I cancel my subscription?"):
        st.write("Yes, you can cancel at any time. Your data will be retained for 30 days to allow export, after which it will be permanently deleted in accordance with our data retention policy.")

    st.markdown("### Support")

    with st.expander("How do I get technical support?"):
        st.write("Lite plan users receive email support with 48-hour response time. Lite XL and MX plans include priority support with 24-hour response time and access to dedicated account managers.")

    with st.expander("Do you offer training and onboarding?"):
        st.write("Lite XL and MX plans include onboarding sessions and training materials. Enterprise customers receive customized training programs and ongoing support.")

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

elif page == "reports":
    st.title("Reports & Documentation")
    st.markdown("Generate comprehensive reports for compliance, stakeholders, and internal analysis.")

    df = entries_dataframe()
    if df.empty:
        st.warning("No data available for reporting. Add emission data first.")
    else:
        # Report generation options
        st.markdown("### Report Types")
        col1, col2, col3 = st.columns(3)

        with col1:
            st.markdown("#### Summary Report")
            st.markdown("Quick overview of your carbon footprint with key metrics and highlights.")
            if st.button("Generate Summary", key="summary_report", use_container_width=True):
                st.markdown("### Carbon Footprint Summary Report")
                st.markdown(f"**Total Emissions:** {total_emissions_tco2e():,.3f} tCO2e")
                st.markdown(f"**Report Period:** {df['Date Added'].min() if 'Date Added' in df.columns else 'N/A'} to {df['Date Added'].max() if 'Date Added' in df.columns else 'N/A'}")
                st.markdown(f"**Total Categories:** {df['Category'].nunique()}")
                st.markdown(f"**Data Points:** {len(df)}")

        with col2:
            st.markdown("#### Detailed Analysis")
            st.markdown("Comprehensive breakdown by category, scope, and time period.")
            if st.button("Generate Analysis", key="analysis_report", use_container_width=True):
                st.markdown("### Detailed Analysis Report")
                if "Scope" in df.columns:
                    for scope in df['Scope'].unique():
                        scope_data = df[df['Scope'] == scope]
                        st.markdown(f"**{scope}:** {scope_data['Emissions (tCO2e)'].sum():,.3f} tCO2e")

        with col3:
            st.markdown("#### Compliance Report")
            st.markdown("Format suitable for regulatory submissions and disclosures.")
            if st.button("Generate Compliance", key="compliance_report", use_container_width=True):
                st.markdown("### Compliance Report")
                st.markdown("**Reporting Standard:** UK DEFRA / GHG Protocol")
                st.markdown("**Verification Status:** Self-assessed")
                st.markdown(f"**Total Footprint:** {total_emissions_tco2e():,.3f} tCO2e")
                st.info("Professional verification available with MX plan")

        # Custom report builder
        st.markdown("---")
        st.markdown("### Custom Report Builder")
        with st.form("custom_report"):
            include_scope = st.checkbox("Include Scope Breakdown", value=True)
            include_categories = st.checkbox("Include Category Details", value=True)
            include_timeline = st.checkbox("Include Timeline Analysis", value=False)
            include_recommendations = st.checkbox("Include Recommendations", value=True)

            if st.form_submit_button("Generate Custom Report", type="primary"):
                st.markdown("### Custom Carbon Footprint Report")
                st.markdown(f"**Generated:** {st.session_state.get('report_date', 'N/A')}")
                st.markdown(f"**Total Emissions:** {total_emissions_tco2e():,.3f} tCO2e")

                if include_scope and "Scope" in df.columns:
                    st.markdown("#### Scope Breakdown")
                    for scope in df['Scope'].unique():
                        scope_data = df[df['Scope'] == scope]
                        st.markdown(f"- {scope}: {scope_data['Emissions (tCO2e)'].sum():,.3f} tCO2e")

                if include_categories:
                    st.markdown("#### Category Details")
                    for cat in df['Category'].unique():
                        cat_data = df[df['Category'] == cat]
                        st.markdown(f"- {cat}: {cat_data['Emissions (tCO2e)'].sum():,.3f} tCO2e ({len(cat_data)} entries)")

                if include_recommendations:
                    st.markdown("#### Recommendations")
                    st.markdown("- Focus on highest emitting categories for reduction efforts")
                    st.markdown("- Consider renewable energy sources for Scope 2 emissions")
                    st.markdown("- Implement employee commuting programs for Scope 3 reduction")

elif page.startswith("form_"):
    category_id = page.replace("form_", "")
    if category_id in CATEGORIES:
        render_form(category_id)
    else:
        st.error("Unknown category.")
else:
    navigate("dashboard")
    st.rerun()
