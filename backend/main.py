"""FastAPI backend for Carbon Logic Engine emission calculations."""

from collections import defaultdict, deque
from time import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from typing import Optional
import math

# Import calculation functions from emission_engine
from emission_engine import (
    calc_electricity,
    calc_natural_gas,
    calc_fuel,
    calc_cars,
    calc_flights,
    calc_public_transport,
    calc_refrigerants,
    calc_home_workers,
    calc_freighting,
    calc_waste,
    calc_commuting,
    calc_water,
    calc_heat_steam,
    calc_bulk_materials,
    calc_hotel,
    calc_ingredients,
    calc_paper,
    calc_computing,
    calc_spend,
    calc_product,
    calc_custom,
)

class IPRateLimitMiddleware(BaseHTTPMiddleware):
    """Stops a single IP flooding the calculate endpoints. Frontend limits do not count."""

    def __init__(self, app, per_minute: int = 60, per_hour: int = 600):
        super().__init__(app)
        self.per_minute = per_minute
        self.per_hour = per_hour
        self._minute: dict[str, deque[float]] = defaultdict(deque)
        self._hour: dict[str, deque[float]] = defaultdict(deque)

    def _ip(self, request: Request) -> str:
        cf = request.headers.get('cf-connecting-ip')
        if cf:
            return cf.strip()
        forwarded = request.headers.get('x-forwarded-for')
        if forwarded:
            return forwarded.split(',', 1)[0].strip()
        if request.client:
            return request.client.host
        return 'unknown'

    async def dispatch(self, request: Request, call_next):
        if request.method == 'OPTIONS' or request.url.path in {'/', '/health'}:
            return await call_next(request)
        ip = self._ip(request)
        now = time()
        minute_hits = self._minute[ip]
        hour_hits = self._hour[ip]
        while minute_hits and minute_hits[0] <= now - 60:
            minute_hits.popleft()
        while hour_hits and hour_hits[0] <= now - 3600:
            hour_hits.popleft()
        if len(minute_hits) >= self.per_minute or len(hour_hits) >= self.per_hour:
            return JSONResponse(
                {'detail': 'Rate limit exceeded. Try again later.'},
                status_code=429,
                headers={'Retry-After': '60'},
            )
        minute_hits.append(now)
        hour_hits.append(now)
        return await call_next(request)


app = FastAPI(title="Carbon Logic API", version="1.0.0")

app.add_middleware(IPRateLimitMiddleware, per_minute=60, per_hour=600)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Pydantic models for request validation
class ElectricityRequest(BaseModel):
    usage_kwh: float
    renewable: bool = False


class NaturalGasRequest(BaseModel):
    amount: float
    unit: str = "kWh"  # kWh or Therms


class FuelRequest(BaseModel):
    amount: float
    fuel_type: str
    unit: str = "Litres"


class CarsRequest(BaseModel):
    amount: float
    fuel_type: str
    unit: str
    vehicle_type: str
    knows_fuel: bool


class FlightsRequest(BaseModel):
    distance: float
    flight_class: str
    passengers: int
    is_return: bool


class PublicTransportRequest(BaseModel):
    transport: str
    distance: float
    passengers: int


class RefrigerantsRequest(BaseModel):
    gas: str
    amount: float


class HomeWorkersRequest(BaseModel):
    workers: int
    hours: float
    days: float
    weeks: float
    occupancy: str


class FreightingRequest(BaseModel):
    weight: float
    distance: float
    mode: str


class WasteRequest(BaseModel):
    amount: float
    disposal: str


class CommutingRequest(BaseModel):
    mode: str
    distance: float
    days: int


class WaterRequest(BaseModel):
    volume: float


class HeatSteamRequest(BaseModel):
    amount: float
    heat_type: str


class BulkMaterialsRequest(BaseModel):
    weight: float
    material: str


class HotelRequest(BaseModel):
    nights: int
    rooms: int


class IngredientsRequest(BaseModel):
    weight: float
    ingredient: str


class PaperRequest(BaseModel):
    weight: float


class ComputingRequest(BaseModel):
    hours: float
    computing_type: str


class SpendRequest(BaseModel):
    amount: float
    category: str


class ProductRequest(BaseModel):
    quantity: float
    weight_per_unit: float
    product_name: str


class CustomRequest(BaseModel):
    amount: float
    factor: float
    unit: str
    label: str


# API Endpoints
@app.get("/")
async def root():
    return {"message": "Carbon Logic API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


@app.post("/api/v1/calculate/electricity")
async def calculate_electricity(request: ElectricityRequest):
    result = calc_electricity(request.usage_kwh, request.renewable)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/natural-gas")
async def calculate_natural_gas(request: NaturalGasRequest):
    result = calc_natural_gas(request.amount, request.unit)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/fuel")
async def calculate_fuel(request: FuelRequest):
    result = calc_fuel(request.amount, request.fuel_type, request.unit)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/cars")
async def calculate_cars(request: CarsRequest):
    result = calc_cars(request.amount, request.fuel_type, request.unit, request.vehicle_type, request.knows_fuel)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/flights")
async def calculate_flights(request: FlightsRequest):
    result = calc_flights(request.distance, request.flight_class, request.passengers, request.is_return)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/public-transport")
async def calculate_public_transport(request: PublicTransportRequest):
    result = calc_public_transport(request.transport, request.distance, request.passengers)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/refrigerants")
async def calculate_refrigerants(request: RefrigerantsRequest):
    result = calc_refrigerants(request.gas, request.amount)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/home-workers")
async def calculate_home_workers(request: HomeWorkersRequest):
    result = calc_home_workers(request.workers, request.hours, request.days, request.weeks, request.occupancy)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/freighting")
async def calculate_freighting(request: FreightingRequest):
    result = calc_freighting(request.weight, request.distance)
    result["details"] += f", {request.mode}"
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/waste")
async def calculate_waste(request: WasteRequest):
    result = calc_waste(request.amount, request.disposal)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/commuting")
async def calculate_commuting(request: CommutingRequest):
    result = calc_commuting(request.mode, request.distance, request.days)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/water")
async def calculate_water(request: WaterRequest):
    result = calc_water(request.volume)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/heat-steam")
async def calculate_heat_steam(request: HeatSteamRequest):
    result = calc_heat_steam(request.amount, request.heat_type)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/bulk-materials")
async def calculate_bulk_materials(request: BulkMaterialsRequest):
    result = calc_bulk_materials(request.weight, request.material)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/hotel")
async def calculate_hotel(request: HotelRequest):
    result = calc_hotel(request.nights, request.rooms)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/ingredients")
async def calculate_ingredients(request: IngredientsRequest):
    result = calc_ingredients(request.weight, request.ingredient)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/paper")
async def calculate_paper(request: PaperRequest):
    result = calc_paper(request.weight)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/computing")
async def calculate_computing(request: ComputingRequest):
    result = calc_computing(request.hours, request.computing_type)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/spend")
async def calculate_spend(request: SpendRequest):
    result = calc_spend(request.amount)
    result["details"] = f"£{request.amount:,.2f} — {request.category or 'General spend'}"
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/product")
async def calculate_product(request: ProductRequest):
    result = calc_product(request.quantity, request.weight_per_unit, request.product_name)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


@app.post("/api/v1/calculate/custom")
async def calculate_custom(request: CustomRequest):
    result = calc_custom(request.amount, request.factor, request.unit, request.label)
    return {
        "emissions_kg": result["emissions_kg"],
        "emissions_tco2e": result["emissions_tco2e"],
        "details": result["details"]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
