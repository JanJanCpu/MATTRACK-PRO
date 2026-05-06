
# MATTRACK PRO - Frontend

Real-time multi-project material tracking and AI procurement advisory system.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Backend API
Create a `.env` file in the project root:
```env
VITE_API_URL=http://localhost:8000
```

### 3. Start Development Server
```bash
npm run dev
```

The frontend will run at `http://localhost:5173`

### 4. Ensure Backend is Running
The frontend requires the FastAPI backend to be running on `http://localhost:8000`. 

To start the backend:
```bash
cd ../backend
python -m uvicorn main:app --reload
```

## Project Structure

```
src/
├── app/
│   ├── components/          # React components
│   │   ├── Dashboard.tsx   # KPIs and overview
│   │   ├── Inventory.tsx   # FSN analysis
│   │   ├── Advisory.tsx    # AI supplier ranking
│   │   └── LogisticsMap.tsx # Map visualization
│   ├── routes.tsx          # Navigation routes
│   └── App.tsx            # Root component
├── services/
│   └── apiService.ts      # API client
├── types.ts               # Type definitions
├── config.ts              # API configuration
└── styles/                # CSS and Tailwind
```

## Features

- **Dashboard**: Real-time KPIs for sites, shortages, deliveries, and surplus inventory
- **Inventory Management**: FSN (Fast/Slow/Non-moving) analysis with stock-out alerts
- **Smart Advisory**: AI-driven supplier ranking and surplus redistribution recommendations
- **Logistics Tracking**: Map-based visualization of sites and suppliers

## API Integration

All API calls are centralized in `src/services/apiService.ts`. The frontend automatically syncs with:

- **Sites API** - Project location management
- **Inventory API** - Real-time stock tracking
- **Suppliers API** - Vendor management
- **Advisory API** - AI recommendations

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API base URL | `http://localhost:8000` |

## Build for Production

```bash
npm run build
npm run preview
```

## Technologies

- React 18
- TypeScript
- Vite
- React Router 7
- Tailwind CSS 4
- Radix UI components
- Leaflet (maps)
- Lucide React (icons)
- Recharts (data visualization)

## Troubleshooting

### API Connection Errors
1. Verify backend is running: `http://localhost:8000`
2. Check `.env` file has correct `VITE_API_URL`
3. Clear browser cache and restart dev server

### Data Not Showing
1. Ensure backend has database seeded with data
2. Check browser console for API errors
3. Verify CORS is enabled in backend

### Styling Issues
1. Restart dev server with `npm run dev`
2. Check Tailwind CSS is loaded in browser DevTools
3. Verify `src/styles/index.css` is imported

## For More Information

See [FRONTEND_SETUP.md](./FRONTEND_SETUP.md) for detailed setup and development guide.

---

Original design: https://www.figma.com/design/a9TwCCaioD5WdjvdvQptdo/Centralized-Multi-Project-Dashboard
  