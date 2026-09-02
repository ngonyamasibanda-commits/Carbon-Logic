# Carbon Logic Frontend

Next.js frontend for Carbon Logic Engine with professional dark mode UI.

## Prerequisites

- Node.js 18+ installed
- FastAPI backend running on http://localhost:8000

## Installation

```bash
cd frontend
npm install
```

## Development

```bash
npm run dev
```

The application will be available at http://localhost:3000

## Features

### Pages
- **Dashboard** (`/`) - Main dashboard with carbon footprint metrics, compliance tracking, and action items
- **Emissions** (`/emissions`) - Detailed emissions tracking with category selection
- **Executive** (`/executive`) - High-level KPIs with donut and bar charts

### Components
- **Dashboard** - Main dashboard component with API integration
- **EmissionsPieChart** - Recharts pie chart for emissions by category
- **ComplianceTrackerRow** - Progress bars for emissions vs regulatory limits
- **LogShipmentModal** - Framer Motion animated modal for quick shipment entry

### API Integration
- `lib/api.ts` - Functions to connect to FastAPI backend
- Real-time emissions calculation via POST endpoints
- Health check and error handling

## Theme
- Background: #0E1117
- Card: #161A22
- Text: #FAFAFA
- Primary: #64748B (slate blue)
- Accent: #10B981 (green)

## Architecture
- Next.js 14 with App Router
- TypeScript for type safety
- Tailwind CSS for styling
- Framer Motion for animations
- Recharts for data visualization
- Lucide React for icons

## Navigation
- Fixed sidebar with Dashboard, Emissions, and Executive views
- Responsive layout with mobile-friendly design
