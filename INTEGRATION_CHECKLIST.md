# MATTRACK PRO - Integration Checklist & Quick Start

## ✅ Pre-Integration Checklist

- [ ] Backend API is running on `http://localhost:8000`
- [ ] Backend database has test data (sites, inventory, suppliers)
- [ ] Backend CORS is enabled for frontend origin
- [ ] Node.js (v16+) and npm are installed
- [ ] Git is configured for version control

## 🚀 Quick Start - 5 Minutes

### Step 1: Install Dependencies
```bash
cd "Centralized Multi-Project Frontend"
npm install
```

### Step 2: Create Environment File
Create `.env` file in project root:
```env
VITE_API_URL=http://localhost:8000
```

### Step 3: Start Development Server
```bash
npm run dev
```

### Step 4: Open in Browser
Navigate to: `http://localhost:5173`

### Step 5: Verify Data Loading
- Dashboard should show real data
- Check browser console for any errors
- If no data, ensure backend has data

## 🔍 Verification Steps

### 1. API Connectivity Test
Open browser console and run:
```javascript
fetch('http://localhost:8000/')
  .then(r => r.json())
  .then(d => console.log('Backend OK:', d))
  .catch(e => console.error('Backend Error:', e))
```

### 2. Data Fetch Test
```javascript
fetch('http://localhost:8000/inventory/')
  .then(r => r.json())
  .then(d => console.log('Inventory:', d))
```

### 3. Check Frontend Logs
Look for loading spinners and error messages on components.

## 🛠️ Common Issues & Fixes

### Issue: "Failed to fetch"
**Cause**: Backend not running
**Fix**:
1. Start backend: `python -m uvicorn main:app --reload`
2. Verify it runs on `http://localhost:8000`
3. Restart frontend dev server

### Issue: "CORS error"
**Cause**: Backend doesn't allow frontend requests
**Fix**: Add to backend `main.py`:
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # or ["http://localhost:5173"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

### Issue: "No data appearing"
**Cause**: Backend has no test data
**Fix**:
1. Check backend database: `python test_db.py`
2. Add test data via backend API:
```bash
curl -X POST "http://localhost:8000/sites/" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Site", "lat": 14.5, "lon": 121.0}'
```

### Issue: Blank page
**Cause**: Frontend build/import error
**Fix**:
```bash
rm -rf node_modules .vite
npm install
npm run dev
```

## 📊 Data Structure Expected

### Sites
```json
{
  "id": 1,
  "site_name": "BGC Commercial Tower 8",
  "latitude": 14.5547,
  "longitude": 121.0476
}
```

### Inventory
```json
{
  "id": 1,
  "item_name": "Portland Cement",
  "quantity": 500,
  "unit": "bags",
  "status": "Healthy",
  "site_id": 1
}
```

### Suppliers
```json
{
  "id": 1,
  "name": "SteelMakers Inc.",
  "contact": "contact@steelmakers.com",
  "latitude": 14.6214,
  "longitude": 121.0063,
  "quality_rating": 4.5
}
```

## 📝 Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run preview   # Preview production build
```

## 🌐 API Endpoints Reference

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/` | Health check |
| POST | `/sites/` | Create site |
| GET | `/sites/` | List all sites |
| POST | `/inventory/` | Create inventory |
| GET | `/inventory/` | List inventory |
| GET | `/inventory/grouped` | Grouped by site |
| POST | `/suppliers/` | Create supplier |
| GET | `/suppliers/` | List suppliers |
| GET | `/advisory/procure/{site_id}/{item_name}` | Get recommendations |

## 🔐 Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

## 📱 Responsive Design

- ✅ Desktop (1920px+)
- ✅ Tablet (768px - 1024px)
- ✅ Mobile (320px - 767px)

## 🎨 Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Dashboard | ✅ Live | Real data from API |
| Inventory | ✅ Live | FSN analysis enabled |
| Advisory | ✅ Live | Supplier ranking active |
| Logistics Map | ✅ Live | Sites & suppliers mapped |
| Layout | ✅ Live | Navigation ready |

## 📚 Documentation Files

- `README.md` - Quick overview
- `FRONTEND_SETUP.md` - Detailed setup guide
- `SYNCHRONIZATION_REPORT.md` - What was changed
- `INTEGRATION_CHECKLIST.md` - This file

## 🐛 Debug Mode

### Enable Verbose Logging
In `src/services/apiService.ts`, uncomment logging:
```typescript
console.log('API call:', url);
console.log('Response:', response);
```

### Browser DevTools
1. Open DevTools: `F12` or `Ctrl+Shift+I`
2. Go to Network tab
3. Check API requests and responses
4. Look for errors in Console tab

## 🚢 Deployment Checklist

Before deploying to production:

- [ ] Set correct `VITE_API_URL` in `.env.production`
- [ ] Run `npm run build`
- [ ] Test build locally: `npm run preview`
- [ ] Check console for errors
- [ ] Verify all API endpoints are accessible
- [ ] Test on different browsers
- [ ] Performance test (Lighthouse)
- [ ] Security audit

## 📞 Support

### If Something Breaks:

1. **Check Logs**
   - Browser console (F12)
   - Backend terminal
   - Network tab in DevTools

2. **Common Fixes**
   - Clear cache: `npm run dev -- --force`
   - Restart both frontend and backend
   - Check VITE_API_URL in .env

3. **Reset Everything**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   npm run dev
   ```

## ✨ Feature Readiness

- ✅ Dashboard with real KPIs
- ✅ Inventory management with FSN analysis
- ✅ AI-driven supplier recommendations
- ✅ Geospatial logistics mapping
- ✅ Error handling & loading states
- ✅ Type safety with TypeScript
- ✅ Responsive design
- ✅ Environment configuration

---

**Version**: 1.0.0
**Last Updated**: May 6, 2026
**Status**: Ready for Integration ✅
