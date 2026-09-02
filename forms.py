"""Category-specific input forms."""

import streamlit as st

from components import render_premium_boxes, render_results_table, render_stepper, svg_icon
from config import AIRPORTS, CATEGORIES
from database import count_entries, save_entry
from emission_engine import (
    calc_bulk_materials,
    calc_cars,
    calc_commuting,
    calc_computing,
    calc_custom,
    calc_electricity,
    calc_flights,
    calc_freighting,
    calc_fuel,
    calc_heat_steam,
    calc_home_workers,
    calc_hotel,
    calc_ingredients,
    calc_natural_gas,
    calc_paper,
    calc_product,
    calc_public_transport,
    calc_refrigerants,
    calc_spend,
    calc_waste,
    calc_water,
    haversine_km,
)


def _check_limit(category_id: str) -> bool:
    cfg = CATEGORIES[category_id]
    limit = cfg.get("limit")
    if limit and count_entries(category_id) >= limit:
        st.error(f"Entry limit reached ({limit}). Upgrade to save more records.")
        return False
    return True


def _submit(category_id: str, result: dict):
    if not _check_limit(category_id):
        return
    cfg = CATEGORIES[category_id]
    save_entry(
        category=category_id,
        scope=cfg["scope"],
        emissions_tco2e=result["emissions_tco2e"],
        details=result["details"],
        comment=st.session_state.get("form_comment", ""),
        link=st.session_state.get("form_link", ""),
    )
    st.success(f"Added {result['emissions_tco2e']:.4f} tCO2e to your footprint.")
    st.balloons()


def _form_header(category_id: str):
    cfg = CATEGORIES[category_id]
    icon_name = category_id.replace("_", "")
    st.markdown(f"## {svg_icon(icon_name, 24)} {cfg['name']}", unsafe_allow_html=True)
    render_stepper(2)
    st.caption(f"Enter your {cfg['name'].lower()} data for the reporting period.")


def form_electricity():
    cid = "electricity"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_electricity"):
            pass
    with col2:
        if st.button("Bulk Upload", key="bulk_electricity"):
            pass
    
    st.markdown("Enter the amount of energy used at each site of operation. Copies of utility bills can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("electricity_form"):
            energy_source = st.selectbox("Energy Source", ["Select an option", "Purchased electricity", "Renewable electricity (generated on site)"])
            supplier_factor = st.number_input("Supplier Specific Emissions Factor (gCO2e/kWh)", min_value=0.0, step=0.001, format="%.4f")
            usage_kwh = st.number_input("Usage in kWh", min_value=0.0, step=100.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and usage_kwh > 0:
                renewable = energy_source == "Renewable electricity (generated on site)"
                _submit(cid, calc_electricity(usage_kwh, renewable))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Dashboard", key="back_electricity"):
            st.session_state.page = "dashboard"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Natural Gas →", key="next_electricity"):
            st.session_state.page = "form_natural_gas"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_natural_gas():
    cid = "natural_gas"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_natural_gas"):
            pass
    with col2:
        if st.button("Bulk Upload", key="bulk_natural_gas"):
            pass
    
    st.markdown("Enter the amount of energy used at each site of operation. Copies of utility bills can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("gas_form"):
            unit = st.selectbox("Unit of Measure", ["Select an option", "kWh", "Therms"])
            amount = st.number_input("Amount", min_value=0.0, step=10.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_natural_gas(amount, unit))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Electricity", key="back_natural_gas"):
            st.session_state.page = "form_electricity"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Fuel →", key="next_natural_gas"):
            st.session_state.page = "form_fuel"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_fuel():
    cid = "fuel"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_fuel"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_fuel", disabled=True):
            pass
    
    st.markdown("Enter the amount of fuel used at each site of operation. Copies of fuel receipts can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("fuel_form"):
            fuel_category = st.selectbox("Fuel Category", ["Select an option", "Petrol / Gasoline", "Diesel", "LPG", "Heavy Fuel Oil", "Kerosene"])
            amount = st.number_input("Amount", min_value=0.0, step=10.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                unit = "Litres"  # Default unit
                _submit(cid, calc_fuel(amount, fuel_category, unit))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Natural Gas", key="back_fuel"):
            st.session_state.page = "form_natural_gas"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Cars →", key="next_fuel"):
            st.session_state.page = "form_cars"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_cars():
    cid = "cars"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_cars"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_cars", disabled=True):
            pass
    
    st.caption("Enter details for each vehicle, or total fuel used if known.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("cars_form"):
            vehicle_type = st.selectbox("Type of Vehicle", ["Company Owned", "Employee Owned", "Hired"])
            knows_fuel = st.selectbox("Do you know the amount of fuel used?", ["Yes", "No"]) == "Yes"
            fuel_type = st.selectbox("Vehicle Fuel Type", ["Petrol / Gasoline", "Diesel", "Hybrid", "Electric (EV)"])
            if knows_fuel:
                unit = st.selectbox("Unit of Measure", ["Litres", "Gallons"])
            else:
                unit = st.selectbox("Unit of Measure", ["Kilometers Driven", "Miles Driven"])
                st.caption("Select vehicle size if fuel amount is unknown.")
                st.selectbox("Type of Fuel / Vehicle (By Size)", ["Small", "Medium", "Large"])
            amount = st.number_input("Amount", min_value=0.0, step=10.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_cars(amount, fuel_type, unit, vehicle_type, knows_fuel))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Fuel", key="back_cars"):
            st.session_state.page = "form_fuel"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Flights →", key="next_cars"):
            st.session_state.page = "form_flights"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_flights():
    cid = "flights"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_flights"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_flights", disabled=True):
            pass
    
    st.markdown("Enter flight details for business travel. Copies of flight bookings can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        mode = st.radio("Do you want to", ["Select Airports", "Enter Distances"], horizontal=True)
        with st.form("flights_form"):
            if mode == "Select Airports":
                codes = list(AIRPORTS.keys())
                dep = st.selectbox("Departure Airport", codes, format_func=lambda c: f"{c} — {AIRPORTS[c][0]}")
                dest = st.selectbox("Destination Airport", codes, format_func=lambda c: f"{c} — {AIRPORTS[c][0]}")
                _, lat1, lon1 = AIRPORTS[dep]
                _, lat2, lon2 = AIRPORTS[dest]
                distance = haversine_km(lat1, lon1, lat2, lon2)
                st.markdown(f"**Total {distance:,.0f} km**")
            else:
                distance = st.number_input("Distance (km)", min_value=0.0, step=100.0)
            flight_class = st.selectbox("Flight Class", ["Economy", "Premium Economy", "Business", "First Class"])
            passengers = st.number_input("Number of Passengers", min_value=1, step=1, value=1)
            is_return = st.radio("Return Ticket?", ["Yes", "No"], horizontal=True) == "Yes"
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and distance > 0:
                _submit(cid, calc_flights(distance, flight_class, int(passengers), is_return))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Cars", key="back_flights"):
            st.session_state.page = "form_cars"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Public Transport →", key="next_flights"):
            st.session_state.page = "form_public_transport"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_public_transport():
    cid = "public_transport"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_public_transport"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_public_transport", disabled=True):
            pass
    
    st.caption("Enter details for all taxi, bus, rail, and ferry travel.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("pt_form"):
            transport = st.selectbox("Transport Type", ["Bus", "Rail / Train", "Taxi", "Ferry"])
            distance = st.number_input("Distance (km)", min_value=0.0, step=10.0)
            passengers = st.number_input("Number of Passengers", min_value=1, step=1, value=1)
            st.caption("Enter 1 if you only have a total distance.")
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and distance > 0:
                _submit(cid, calc_public_transport(transport, distance, int(passengers)))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Flights", key="back_public_transport"):
            st.session_state.page = "form_flights"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Refrigerants →", key="next_public_transport"):
            st.session_state.page = "form_refrigerants"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_refrigerants():
    cid = "refrigerants"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_refrigerants"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_refrigerants", disabled=True):
            pass
    
    st.markdown("Enter refrigerant leakage data. Service records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("ref_form"):
            gas = st.selectbox("Type of Gas", ["Select an option", "R-404A", "R-410A", "R-134A", "R-22", "R-32"])
            amount = st.number_input("Amount in kg", min_value=0.0, step=0.1, format="%.2f")
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_refrigerants(gas, amount))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Public Transport", key="back_refrigerants"):
            st.session_state.page = "form_public_transport"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Home Workers →", key="next_refrigerants"):
            st.session_state.page = "form_home_workers"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_home_workers():
    cid = "home_workers"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_home_workers"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_home_workers", disabled=True):
            pass
    
    st.caption("Enter 1 in Number of Workers if entering totals for multiple employees.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("hw_form"):
            occupancy = st.selectbox(
                "Occupancy",
                [
                    "Single — during working hours, the house would be unoccupied",
                    "Multiple — others are home during working hours",
                ],
            )
            workers = st.number_input("Number of Workers", min_value=1, step=1, value=1)
            hours = st.number_input("Hours per Day Worked", min_value=0.0, step=0.5, value=8.0)
            days = st.number_input("Days per Week Worked", min_value=0.0, step=0.5, value=5.0)
            weeks = st.number_input("Weeks per Year Worked", min_value=0.0, step=1.0, value=48.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit:
                _submit(cid, calc_home_workers(int(workers), hours, days, weeks, occupancy))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Refrigerants", key="back_home_workers"):
            st.session_state.page = "form_refrigerants"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Go to Dashboard", key="next_home_workers"):
            st.session_state.page = "dashboard"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_freighting():
    cid = "freighting"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_freighting"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_freighting", disabled=True):
            pass
    
    st.markdown("Enter freight transport data. Shipping records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("freight_form"):
            weight = st.number_input("Weight (tonnes)", min_value=0.0, step=0.1)
            distance = st.number_input("Distance (km)", min_value=0.0, step=100.0)
            mode = st.selectbox("Transport Mode", ["Select an option", "Road (Truck)", "Rail", "Ocean", "Air"])
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and weight > 0 and distance > 0:
                result = calc_freighting(weight, distance)
                result["details"] += f", {mode}"
                _submit(cid, result)
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Home Workers", key="back_freighting"):
            st.session_state.page = "form_home_workers"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Waste →", key="next_freighting"):
            st.session_state.page = "form_waste"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_waste():
    cid = "waste"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_waste"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_waste", disabled=True):
            pass
    
    st.markdown("Enter waste disposal data. Copies of waste disposal records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("waste_form"):
            disposal = st.selectbox("Disposal Method", ["Select an option", "Landfill", "Recycling", "Composting", "Incineration"])
            amount = st.number_input("Weight (kg)", min_value=0.0, step=10.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_waste(amount, disposal))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Home Workers", key="back_waste"):
            st.session_state.page = "form_home_workers"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Commuting →", key="next_waste"):
            st.session_state.page = "form_commuting"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_commuting():
    cid = "commuting"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_commuting"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_commuting", disabled=True):
            pass
    
    st.markdown("Enter employee commuting data. Travel expense reports can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("commute_form"):
            mode = st.selectbox("Commute Mode", ["Select an option", "Car", "Bus", "Rail", "Walking", "Cycling"])
            distance = st.number_input("One-way distance (km)", min_value=0.0, step=1.0)
            days = st.number_input("Working days per year", min_value=0, step=1, value=220)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and distance > 0:
                _submit(cid, calc_commuting(mode, distance, days))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Waste", key="back_commuting"):
            st.session_state.page = "form_waste"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Water →", key="next_commuting"):
            st.session_state.page = "form_water"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_water():
    cid = "water"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_water"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_water", disabled=True):
            pass
    
    st.markdown("Enter water consumption data. Water bills can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("water_form"):
            volume = st.number_input("Volume (m³)", min_value=0.0, step=1.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and volume > 0:
                _submit(cid, calc_water(volume))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Commuting", key="back_water"):
            st.session_state.page = "form_commuting"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Go to Dashboard", key="next_water"):
            st.session_state.page = "dashboard"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_hotel():
    cid = "hotel_stays"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_hotel"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_hotel", disabled=True):
            pass
    
    st.markdown("Enter hotel accommodation data for business travel. Booking confirmations can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("hotel_form"):
            nights = st.number_input("Number of Nights", min_value=1, step=1)
            rooms = st.number_input("Number of Rooms", min_value=1, step=1, value=1)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit:
                _submit(cid, calc_hotel(int(nights), int(rooms)))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Bulk Materials", key="back_hotel"):
            st.session_state.page = "form_bulk_materials"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Ingredients →", key="next_hotel"):
            st.session_state.page = "form_ingredients"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_paper():
    cid = "paper"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_paper"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_paper", disabled=True):
            pass
    
    st.markdown("Enter paper consumption data. Purchase records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("paper_form"):
            weight = st.number_input("Paper weight (kg)", min_value=0.0, step=10.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and weight > 0:
                _submit(cid, calc_paper(weight))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Ingredients", key="back_paper"):
            st.session_state.page = "form_ingredients"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Computing →", key="next_paper"):
            st.session_state.page = "form_computing"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_spend():
    cid = "spend"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_spend"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_spend", disabled=True):
            pass
    
    st.markdown("Enter procurement spend data. Purchase records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("spend_form"):
            amount = st.number_input("Spend amount (£)", min_value=0.0, step=100.0)
            category = st.text_input("Spend category", placeholder="e.g. Office supplies")
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                result = calc_spend(amount)
                result["details"] = f"£{amount:,.2f} — {category or 'General spend'}"
                _submit(cid, result)
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Computing", key="back_spend"):
            st.session_state.page = "form_computing"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Product →", key="next_spend"):
            st.session_state.page = "form_product"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_custom():
    cid = "custom"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_custom"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_custom", disabled=True):
            pass
    
    st.markdown("Enter custom emission data for activities not covered by standard categories. Documentation can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("custom_form"):
            label = st.text_input("Activity name")
            amount = st.number_input("Amount", min_value=0.0, step=1.0)
            unit = st.text_input("Unit", placeholder="e.g. kWh, km, kg")
            factor = st.number_input("Emission factor (kg CO2e per unit)", min_value=0.0, step=0.001, format="%.6f")
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0 and factor > 0:
                _submit(cid, calc_custom(amount, factor, unit, label))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Product", key="back_custom"):
            st.session_state.page = "form_product"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Go to Dashboard", key="next_custom"):
            st.session_state.page = "dashboard"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_heat_steam():
    cid = "heat_steam"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_heat_steam"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_heat_steam", disabled=True):
            pass
    
    st.markdown("Enter district heating and steam consumption data. Utility bills can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("heat_steam_form"):
            heat_type = st.selectbox("Heat Source", ["Select an option", "District Heating", "District Steam", "Natural Gas Boiler"])
            amount = st.number_input("Energy amount (kWh)", min_value=0.0, step=100.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_heat_steam(amount, heat_type))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Dashboard", key="back_heat_steam"):
            st.session_state.page = "dashboard"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Bulk Materials →", key="next_heat_steam"):
            st.session_state.page = "form_bulk_materials"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_bulk_materials():
    cid = "bulk_materials"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_bulk_materials"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_bulk_materials", disabled=True):
            pass
    
    st.markdown("Enter bulk materials consumption data. Purchase records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("bulk_materials_form"):
            material = st.selectbox("Material Type", ["Select an option", "Concrete", "Steel", "Aluminum", "Wood", "Plastic"])
            weight = st.number_input("Weight (tonnes)", min_value=0.0, step=0.1)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and weight > 0:
                _submit(cid, calc_bulk_materials(weight, material))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Heat and Steam", key="back_bulk_materials"):
            st.session_state.page = "form_heat_steam"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Hotel Stays →", key="next_bulk_materials"):
            st.session_state.page = "form_hotel_stays"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_ingredients():
    cid = "ingredients"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_ingredients"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_ingredients", disabled=True):
            pass
    
    st.markdown("Enter ingredient data for food and beverage products. Purchase records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("ingredients_form"):
            ingredient = st.text_input("Ingredient name", placeholder="e.g. Flour, Sugar")
            weight = st.number_input("Weight (kg)", min_value=0.0, step=1.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and weight > 0:
                _submit(cid, calc_ingredients(weight, ingredient or "Ingredient"))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Hotel Stays", key="back_ingredients"):
            st.session_state.page = "form_hotel_stays"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Paper →", key="next_ingredients"):
            st.session_state.page = "form_paper"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_computing():
    cid = "computing"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_computing"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_computing", disabled=True):
            pass
    
    st.markdown("Enter computing and data center energy usage. Server logs can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("computing_form"):
            computing_type = st.selectbox("Computing Type", ["Select an option", "Cloud Computing", "Data Center", "Server Usage"])
            hours = st.number_input("Usage hours", min_value=0.0, step=1.0)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and hours > 0:
                _submit(cid, calc_computing(hours, computing_type))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Paper", key="back_computing"):
            st.session_state.page = "form_paper"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Spend →", key="next_computing"):
            st.session_state.page = "form_spend"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_product():
    cid = "product"
    _form_header(cid)
    
    # Form navigation buttons
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("Tutorial", key="tutorial_product"):
            pass
    with col2:
        if st.button("🔒 Bulk Upload", key="bulk_product", disabled=True):
            pass
    
    st.markdown("Enter product manufacturing data. Production records can be linked in the 'Additional Data' section to the right.")
    
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form("product_form"):
            product_name = st.text_input("Product name", placeholder="e.g. Widget A")
            quantity = st.number_input("Quantity (units)", min_value=0.0, step=1.0)
            weight = st.number_input("Weight per unit (kg)", min_value=0.0, step=0.1)
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and quantity > 0 and weight > 0:
                _submit(cid, calc_product(quantity, weight, product_name or "Product"))
    with col2:
        render_premium_boxes()
    
    # Navigation buttons
    st.markdown("---")
    col1, col2, col3, col4 = st.columns([1, 1, 1, 1])
    with col1:
        if st.button("← Back to Spend", key="back_product"):
            st.session_state.page = "form_spend"
            st.rerun()
    with col2:
        pass  # Space for the primary button
    with col3:
        if st.button("Next to Custom →", key="next_product"):
            st.session_state.page = "form_custom"
            st.rerun()
    with col4:
        st.markdown("[Go to results](javascript:void(0))", unsafe_allow_html=True)
    
    render_results_table(cid)


def form_generic(category_id: str):
    cid = category_id
    _form_header(cid)
    st.info(f"The {CATEGORIES[cid]['name']} module is available on your plan. Configure emission factors below.")
    col1, col2 = st.columns([2, 1])
    with col1:
        with st.form(f"{cid}_form"):
            amount = st.number_input("Activity amount", min_value=0.0, step=1.0)
            unit = st.text_input("Unit", value="kWh")
            factor = st.number_input("Emission factor (kg CO2e/unit)", min_value=0.0, value=0.207, format="%.4f")
            submit = st.form_submit_button("Calculate & add to footprint", type="primary", use_container_width=True)
            if submit and amount > 0:
                _submit(cid, calc_custom(amount, factor, unit, CATEGORIES[cid]["name"]))
    with col2:
        render_premium_boxes()
    render_results_table(cid)


FORM_MAP = {
    "electricity": form_electricity,
    "natural_gas": form_natural_gas,
    "fuel": form_fuel,
    "cars": form_cars,
    "flights": form_flights,
    "public_transport": form_public_transport,
    "refrigerants": form_refrigerants,
    "home_workers": form_home_workers,
    "freighting": form_freighting,
    "waste": form_waste,
    "commuting": form_commuting,
    "water": form_water,
    "heat_steam": form_heat_steam,
    "bulk_materials": form_bulk_materials,
    "hotel_stays": form_hotel,
    "ingredients": form_ingredients,
    "paper": form_paper,
    "computing": form_computing,
    "spend": form_spend,
    "product": form_product,
    "custom": form_custom,
}


def render_form(category_id: str):
    fn = FORM_MAP.get(category_id)
    if fn:
        fn()
    else:
        form_generic(category_id)
