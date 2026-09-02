# Carbon Logic Engine - Full Stack Setup Guide

This guide explains how to run the complete Carbon Logic Engine with FastAPI backend and Next.js frontend.

## Architecture

```
carbon-logic-engine/
├── backend/                    # FastAPI Python Backend
│   ├── main.py               # API endpoints for emission calculations
│   ├── emission_engine.py    # Calculation logic
│   ├── requirements.txt       # Python dependencies
│   └── venv/                 # Python virtual environment
│
├── frontend/                   # Next.js TypeScript Frontend
│   ├── app/                   # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout with sidebar
│   │   ├── page.tsx           # Dashboard (home)
│   │   ├── emissions/page.tsx # Emissions tracking
│   │   └── executive/page.tsx # Executive dashboard
│   ├── components/            # React components
│   │   ├── Dashboard.tsx
│   │   ├── EmissionsPieChart.tsx
│   │   ├── ComplianceTrackerRow.tsx
│   │   └── LogShipmentModal.tsx
│   ├── lib/                   # Utilities
│   │   └── api.ts             # API integration functions
│   ├── package.json           # Node.js dependencies
│   └── tsconfig.json          # TypeScript config
│
└── app.py                     # Streamlit version (legacy)
```

## Prerequisites

- Python 3.9+
- Node.js 18+
- (Optional) For Streamlit version: Python with streamlit installed

## Step 1: Start the FastAPI Backend

```bash
cd /Users/hlulanisibanda/carbon-logic-engine/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

The backend will be available at:
- API: http://localhost:8000
- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

## Step 2: Start the Next.js Frontend

In a new terminal:

```bash
cd /Users/hlulanisibanda/carbon-logic-engine/frontend
npm install
npm run dev
```

The frontend will be available at:
- Application: http://localhost:3000
- With sidebar navigation between Dashboard, Emissions, and Executive views

## Features

### Backend (FastAPI)
- 21 RESTful API endpoints for emission calculations
- CORS enabled for Next.js frontend
- Pydantic models for request validation
- Covers all emission categories (Electricity, Natural Gas, Fuel, Cars, Flights, etc.)

### Frontend (Next.js)
- **Professional Dark Mode Theme**
  - Background: #0E1117
  - Cards: #161A22
  - Text: #FAFAFA
  - Primary: #64748B (slate blue)
  - Accent: #10B981 (green)

- **Dashboard Page**
  - Total Carbon Footprint with Scope 1/2/3 breakdown
  - Emissions pie chart by category
  - Compliance tracker with progress bars
  - Action items for carbon alerts
  - Real-time API integration

- **Emissions Page**
  - Category selection (Freighting, Flights, Vehicles, Facilities)
  - Quick emission logging modal
  - Category-specific tracking

- **Executive Dashboard**
  - KPI cards (Total Emissions, Reduction Progress, Compliance Score, Carbon Intensity)
  - Donut chart for emissions by scope
  - Bar chart for monthly emissions trend
  - Key insights section

- **Components**
  - Framer Motion animations
  - Recharts data visualization
  - Lucide React icons
  - Responsive design with Tailwind CSS

## API Integration

The frontend connects to the backend via `lib/api.ts`:

```typescript
import { calculateFreighting } from '@/lib/api'

const result = await calculateFreighting({
  weight: 10.5,
  distance: 500,
  mode: 'Road (Truck)'
})
// Returns: { emissions_kg, emissions_tco2e, details }
```

## Development Workflow

1. Make changes to backend code
2. Restart FastAPI server (Ctrl+C, then `uvicorn main:app --host 0.0.0.0 --port 8000`)
3. Frontend automatically updates with Next.js hot reload
4. Test changes at http://localhost:3000

## Current Status

✅ FastAPI backend running on port 8000
✅ Next.js frontend structure created
✅ Professional dark mode theme implemented
✅ All components built with exact reference architecture
✅ API integration layer created
✅ Loading states and error handling added
✅ Navigation with sidebar implemented
✅ Three pages: Dashboard, Emissions, Executive

## Next Steps for Production

1. Replace mock data with real API calls in components
2. Add authentication (JWT tokens)
3. Connect to real database (Supabase)
4. Add data persistence
5. Deploy to production (Vercel for frontend, Render/Fly.io for backend)
