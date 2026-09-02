"""Carbon emission calculations, factors, and unit conversions (DEFRA/UK-style factors)."""

import math
from typing import Any, Dict, Optional

# --- Unit conversions ---
GALLONS_TO_LITRES = 3.78541
MILES_TO_KM = 1.60934
KWH_TO_KWH = 1.0
THERMS_TO_KWH = 29.3071
KG_TO_TONNES = 0.001

# --- Emission factors (kg CO2e per unit) ---
FACTORS = {
    "electricity_grid_kwh": 0.20707,
    "electricity_renewable_kwh": 0.0,
    "natural_gas_kwh": 0.18296,
    "natural_gas_therm": 5.357,  # kg per therm
    "petrol_litre": 2.3126,
    "diesel_litre": 2.6835,
    "lpg_litre": 1.5571,
    "hybrid_km": 0.109,
    "ev_km": 0.053,
    "petrol_car_km": 0.171,
    "diesel_car_km": 0.163,
    "flight_economy_pkm": 0.109,
    "flight_premium_pkm": 0.174,
    "flight_business_pkm": 0.317,
    "flight_first_pkm": 0.434,
    "bus_pkm": 0.103,
    "rail_pkm": 0.036,
    "taxi_pkm": 0.148,
    "ferry_pkm": 0.113,
    "r404a_kg": 3922.0,
    "r410a_kg": 1924.0,
    "r134a_kg": 1300.0,
    "home_worker_hour_kwh": 0.185,  # kWh per home working hour
    "home_worker_factor": 0.20707,  # grid factor
    "freight_tkm": 0.098,
    "waste_landfill_kg": 0.467,
    "waste_recycling_kg": 0.021,
    "commuting_car_km": 0.171,
    "commuting_bus_km": 0.103,
    "commuting_rail_km": 0.036,
    "water_m3": 0.344,
    "heat_steam_kwh": 0.20707,
    "hotel_night": 10.4,
    "paper_kg": 0.919,
    "computing_kwh": 0.20707,
    "spend_gbp": 0.35,  # kg per £ spent (EEIO approx)
}


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def to_km(value: float, unit: str) -> float:
    return value * MILES_TO_KM if unit.lower().startswith("mile") else value


def to_litres(value: float, unit: str) -> float:
    u = unit.lower()
    if "gallon" in u:
        return value * GALLONS_TO_LITRES
    return value


def kg_to_tco2e(kg: float) -> float:
    return kg * KG_TO_TONNES


def calc_electricity(kwh: float, renewable: bool = False) -> Dict[str, Any]:
    factor = FACTORS["electricity_renewable_kwh"] if renewable else FACTORS["electricity_grid_kwh"]
    kg = kwh * factor
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{kwh:,.0f} kWh ({'Renewable' if renewable else 'Grid'})"}


def calc_natural_gas(amount: float, unit: str = "kWh") -> Dict[str, Any]:
    if unit.lower() == "therms":
        kg = amount * FACTORS["natural_gas_therm"]
        details = f"{amount:,.1f} therms"
    else:
        kg = amount * FACTORS["natural_gas_kwh"]
        details = f"{amount:,.0f} kWh"
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": details}


def calc_fuel(amount: float, fuel_type: str, unit: str) -> Dict[str, Any]:
    litres = to_litres(amount, unit)
    key = {
        "Petrol / Gasoline": "petrol_litre",
        "Diesel": "diesel_litre",
        "LPG": "lpg_litre",
    }.get(fuel_type, "diesel_litre")
    kg = litres * FACTORS[key]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{litres:,.1f} L {fuel_type}"}


def calc_cars(
    amount: float,
    fuel_type: str,
    unit: str,
    vehicle_type: str = "Company Owned",
    knows_fuel: bool = True,
    vehicle_size: str = "Medium",
) -> Dict[str, Any]:
    if knows_fuel and unit.lower() in ("litres", "liters", "gallons"):
        return calc_fuel(amount, fuel_type, unit)
    km = to_km(amount, unit)
    if "Electric" in fuel_type:
        kg = km * FACTORS["ev_km"]
    elif "Hybrid" in fuel_type:
        kg = km * FACTORS["hybrid_km"]
    elif "Diesel" in fuel_type:
        kg = km * FACTORS["diesel_car_km"]
    else:
        kg = km * FACTORS["petrol_car_km"]
    return {
        "emissions_kg": kg,
        "emissions_tco2e": kg_to_tco2e(kg),
        "details": f"{vehicle_type}, {fuel_type}, {amount:,.0f} {unit}",
    }


def calc_flights(
    distance_km: float,
    flight_class: str,
    passengers: int,
    return_ticket: bool,
) -> Dict[str, Any]:
    class_key = {
        "Economy": "flight_economy_pkm",
        "Premium Economy": "flight_premium_pkm",
        "Business": "flight_business_pkm",
        "First Class": "flight_first_pkm",
    }.get(flight_class, "flight_economy_pkm")
    pkm = distance_km * passengers * (2 if return_ticket else 1)
    kg = pkm * FACTORS[class_key]
    return {
        "emissions_kg": kg,
        "emissions_tco2e": kg_to_tco2e(kg),
        "details": f"{distance_km:,.0f} km, {passengers} pax, {flight_class}{', return' if return_ticket else ''}",
    }


def calc_public_transport(transport: str, distance_km: float, passengers: int) -> Dict[str, Any]:
    key = {
        "Bus": "bus_pkm",
        "Rail / Train": "rail_pkm",
        "Taxi": "taxi_pkm",
        "Ferry": "ferry_pkm",
    }.get(transport, "bus_pkm")
    pkm = distance_km * max(passengers, 1)
    kg = pkm * FACTORS[key]
    return {
        "emissions_kg": kg,
        "emissions_tco2e": kg_to_tco2e(kg),
        "details": f"{transport}, {distance_km:,.0f} km, {passengers} passengers",
    }


def calc_refrigerants(gas_type: str, amount_kg: float) -> Dict[str, Any]:
    key = {
        "R-404A": "r404a_kg",
        "R-410A": "r410a_kg",
        "R-134A": "r134a_kg",
    }.get(gas_type, "r134a_kg")
    kg = amount_kg * FACTORS[key]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{amount_kg:,.2f} kg {gas_type}"}


def calc_home_workers(
    workers: int,
    hours_day: float,
    days_week: float,
    weeks_year: float,
    occupancy: str = "Single",
) -> Dict[str, Any]:
    occupancy_factor = 1.0 if "Single" in occupancy else 0.5
    total_hours = workers * hours_day * days_week * weeks_year
    kwh = total_hours * FACTORS["home_worker_hour_kwh"] * occupancy_factor
    kg = kwh * FACTORS["home_worker_factor"]
    return {
        "emissions_kg": kg,
        "emissions_tco2e": kg_to_tco2e(kg),
        "details": f"{workers} workers, {total_hours:,.0f} hrs/yr, {occupancy}",
    }


def calc_freighting(weight_tonnes: float, distance_km: float) -> Dict[str, Any]:
    tkm = weight_tonnes * distance_km
    kg = tkm * FACTORS["freight_tkm"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{weight_tonnes:,.1f} t × {distance_km:,.0f} km"}


def calc_waste(amount_kg: float, disposal: str) -> Dict[str, Any]:
    key = "waste_recycling_kg" if "Recycl" in disposal else "waste_landfill_kg"
    kg = amount_kg * FACTORS[key]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{amount_kg:,.0f} kg, {disposal}"}


def calc_commuting(mode: str, distance_km: float, days: int) -> Dict[str, Any]:
    key = {"Car": "commuting_car_km", "Bus": "commuting_bus_km", "Rail": "commuting_rail_km"}.get(mode, "commuting_car_km")
    annual_km = distance_km * days * 2  # return trip
    kg = annual_km * FACTORS[key]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{mode}, {distance_km} km/day, {days} days/yr"}


def calc_water(volume_m3: float) -> Dict[str, Any]:
    kg = volume_m3 * FACTORS["water_m3"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{volume_m3:,.1f} m³"}


def calc_hotel(nights: int, rooms: int = 1) -> Dict[str, Any]:
    kg = nights * rooms * FACTORS["hotel_night"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{nights} nights, {rooms} room(s)"}


def calc_paper(weight_kg: float) -> Dict[str, Any]:
    kg = weight_kg * FACTORS["paper_kg"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{weight_kg:,.0f} kg paper"}


def calc_spend(amount_gbp: float) -> Dict[str, Any]:
    kg = amount_gbp * FACTORS["spend_gbp"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"£{amount_gbp:,.2f} spend"}


def calc_custom(amount: float, factor: float, unit: str, label: str) -> Dict[str, Any]:
    kg = amount * factor
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{amount:,.2f} {unit} — {label}"}


def calc_heat_steam(amount_kwh: float, heat_type: str) -> Dict[str, Any]:
    kg = amount_kwh * FACTORS["heat_steam_kwh"]
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{amount_kwh:,.0f} kWh {heat_type}"}


def calc_bulk_materials(weight_tonnes: float, material: str) -> Dict[str, Any]:
    factor = 0.1  # Simplified factor for bulk materials
    kg = weight_tonnes * factor * 1000  # Convert to kg
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{weight_tonnes:,.1f} tonnes {material}"}


def calc_ingredients(weight_kg: float, ingredient: str) -> Dict[str, Any]:
    factor = 0.5  # Simplified factor for ingredients
    kg = weight_kg * factor
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{weight_kg:,.0f} kg {ingredient}"}


def calc_computing(hours: float, computing_type: str) -> Dict[str, Any]:
    factor = 0.05  # Simplified factor for computing
    kg = hours * factor
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{hours:,.0f} hours {computing_type}"}


def calc_product(quantity: float, weight_per_unit: float, product_name: str) -> Dict[str, Any]:
    total_weight = quantity * weight_per_unit
    factor = 2.0  # Simplified factor for products
    kg = total_weight * factor
    return {"emissions_kg": kg, "emissions_tco2e": kg_to_tco2e(kg), "details": f"{quantity:,.0f} units × {weight_per_unit} kg {product_name}"}
