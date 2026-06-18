# MATTRACK PRO - Frontend Setup Guide

## Overview
This is the main frontend for MATTRACK PRO, a real-time multi-project material tracking and AI procurement advisory system.

## Project Structure

```
src/
├── app/
│   ├── components/        # React components
│   │   ├── Dashboard.tsx  # Main dashboard with KPIs
│   │   ├── Inventory.tsx  # FSN analysis and inventory management
│   │   ├── Advisory.tsx   # AI supplier ranking and redistribution
│   │   ├── LogisticsMap.tsx # Map-based logistics tracking
│   │   └── Layout.tsx     # Main layout wrapper
│   ├── App.tsx           # Root app component
│   └── routes.tsx        # React Router configuration
├── services/
│   └── apiService.ts     # API client with all endpoints
├── types.ts              # TypeScript type definitions
├── config.ts             # Configuration and API endpoints
└── styles/               # CSS and Tailwind styles
```

## Setup Instructions

### 1. Environment Configuration

Create a `.env` file in the project root:

```env
VITE_API_URL=http://localhost:8000
```

For production:
```env
VITE_API_URL=https://your-api-domain.com
```

### 2. Backend API Requirements

Make sure your backend FastAPI server is running on `http://localhost:8000`. The frontend expects the following endpoints:

**Health Check:**
- `GET /` - API status

**Sites:**
- `POST /sites/` - Create new project site
- `GET /sites/` - List all sites

**Inventory:**
- `POST /inventory/` - Add inventory item
- `GET /inventory/` - Get all inventory
- `GET /inventory/grouped` - Get grouped by site

**Suppliers:**
- `POST /suppliers/` - Add supplier
- `GET /suppliers/` - List suppliers

**Advisory:**
- `GET /advisory/procure/{site_id}/{item_name}` - Get procurement advice

### 3. Install Dependencies

```bash
npm install
```

### 4. Start Development Server

```bash
npm run dev
```

The frontend will be available at `http://localhost:5173`

### 5. Build for Production

```bash
npm run build
```

## API Integration

The frontend uses a centralized API service located in `src/services/apiService.ts`. All API calls go through this service, which handles:

- Request/response formatting
- Error handling
- Type safety (TypeScript)
- Endpoint configuration

### Example API Usage

```typescript
import { inventoryAPI, sitesAPI } from '@/services/apiService';

// Fetch inventory
const inventory = await inventoryAPI.list();

// Create new inventory item
const newItem = await inventoryAPI.create({
  item_name: "Portland Cement",
  quantity: 500,
  unit: "bags",
  status: "Healthy",
  site_id: 1
});

// Get suppliers
const suppliers = await suppliersAPI.list();
```

## Components Overview

### Dashboard
- Real-time KPIs (sites, shortages, deliveries, surplus)
- Project health overview
- Recent deliveries tracking
- AI advisory panel

### Inventory
- FSN (Fast/Slow/Non-moving) analysis
- Critical stock-out alerts
- Real-time inventory table with filtering

### Advisory
- AI supplier value ranking
- Surplus redistribution recommendations
- Distance-based logistics optimization

### Logistics Map
- Map view of project sites
- Supplier locations
- Route optimization

## Data Synchronization

The frontend automatically syncs with the backend:

1. **Initial Load**: On component mount, data is fetched from API
2. **Real-time Updates**: Components use React hooks to manage state
3. **Error Handling**: User-friendly error messages if API fails
4. **Loading States**: Spinner indicators during data fetch

## Type Definitions

All API response types are defined in `src/types.ts`:

```typescript
export interface Inventory {
  id: number;
  item_name: string;
  quantity: number;
  unit: string;
  status: string;
  site_id: number;
}

export interface ProjectSite {
  id: number;
  site_name: string;
  latitude: number;
  longitude: number;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  latitude: number;
  longitude: number;
  quality_rating: number;
}
```

## Troubleshooting

### "API Error: 404" or "Failed to connect"
- Ensure backend is running at `http://localhost:8000`
- Check VITE_API_URL in `.env` file
- Verify backend endpoints match expected URLs

### Data not updating
- Check browser console for API errors
- Verify backend database has data
- Restart development server

### Styling issues
- Clear cache: `npm run dev -- --force`
- Rebuild Tailwind: Check `tailwind.config.ts`

## Technologies Used

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **React Router** - Navigation
- **Tailwind CSS** - Styling
- **Radix UI** - Component library
- **Lucide React** - Icons
- **Leaflet** - Map visualization

## Contributing

When adding new features:

1. Create API types in `src/types.ts`
2. Add API endpoints to `src/services/apiService.ts`
3. Create/update components with React hooks
4. Use proper TypeScript types
5. Add error handling and loading states

## License

Part of MATTRACK PRO system
