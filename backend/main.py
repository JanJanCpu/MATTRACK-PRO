from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import Dict, List
import models
import schemas
from database import engine, get_db
import math

# 1. Initialize the FastAPI App
app = FastAPI(title="MatTrack PRO API")

# 2. CORS Settings: Essential for React frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 3. Database Builder
models.Base.metadata.create_all(bind=engine)

# --- HELPER FUNCTIONS ---

def get_distance(lat1, lon1, lat2, lon2):
    """Calculates the Haversine distance between two sets of GPS coordinates."""
    R = 6371 # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2)**2)
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1 - a)))

# --- CORE ROUTES ---

@app.get("/")
def read_root():
    return {"status": "online", "system": "MatTrack PRO", "version": "1.0.0"}

@app.post("/sites/")
def create_site(name: str, lat: float, lon: float, db: Session = Depends(get_db)):
    db_site = models.ProjectSite(site_name=name, latitude=lat, longitude=lon)
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

@app.post("/inventory/", response_model=schemas.InventoryResponse)
def create_material(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    """Allows logging new receipts into the centralized ledger using site_id."""
    new_item = models.Inventory(**item.model_dump())
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.get("/inventory/grouped")
def get_grouped_inventory(db: Session = Depends(get_db)):
    """Groups flat records into a site-first structure for multi-project oversight."""
    items = db.query(models.Inventory).all()
    grouped_data = {}
    for item in items:
        # We use the site_id as the grouping key
        site_label = f"Site {item.site_id}"
        if site_label not in grouped_data:
            grouped_data[site_label] = []
        
        grouped_data[site_label].append({
            "id": item.id,
            "item": item.item_name,
            "qty": item.quantity,
            "unit": item.unit,
            "status": item.status
        })
    return grouped_data

@app.get("/inventory/", response_model=list[schemas.InventoryResponse])
def get_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

# --- SUPPLIER & ADVISORY ROUTES ---

@app.post("/suppliers/")
def create_supplier(name: str, contact: str, lat: float, lon: float, rating: float, db: Session = Depends(get_db)):
    new_supplier = models.Supplier(
        name=name, contact=contact, latitude=lat, longitude=lon, quality_rating=rating
    )
    db.add(new_supplier)
    db.commit()
    db.refresh(new_supplier)
    return new_supplier

@app.get("/suppliers/")
def get_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.get("/advisory/procure/{site_id}/{item_name}")
def get_procurement_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    """Ranks external suppliers based on Distance, Price, and Quality."""
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")

    suppliers = db.query(models.Supplier).all()
    recommendations = []
    for s in suppliers:
        dist = get_distance(site.latitude, site.longitude, s.latitude, s.longitude)
        price = 250.00 # Placeholder for Price API integration
        score = (s.quality_rating * 10) - (dist * 2) - (price / 50)
        
        recommendations.append({
            "supplier": s.name,
            "distance_km": round(dist, 2),
            "score": round(score, 2),
            "contact": s.contact
        })
    return sorted(recommendations, key=lambda x: x['score'], reverse=True)

@app.get("/advisory/transfer/{target_site_id}/{item_name}")
def get_transfer_suggestions(target_site_id: int, item_name: str, db: Session = Depends(get_db)):
    """The 'Brain' - finds internal surplus stock to avoid buying new materials."""
    target_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == target_site_id).first()
    if not target_site:
        raise HTTPException(status_code=404, detail="Target site not found")

    # Search for the item at other sites
    potential_sources = db.query(models.Inventory).filter(
        models.Inventory.item_name.ilike(f"%{item_name}%"),
        models.Inventory.site_id != target_site_id
    ).all()
    
    suggestions = []
    for item in potential_sources:
        # Manual fetch to prevent relationship lazy-loading crashes
        source_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
        if source_site:
            dist = get_distance(target_site.latitude, target_site.longitude, 
                                source_site.latitude, source_site.longitude)
            
            if dist < 50: # Only suggest if within a reasonable distance
                suggestions.append({
                    "from_site": source_site.site_name,
                    "available_qty": item.quantity,
                    "distance_km": round(dist, 2),
                    "action": "INTERNAL TRANSFER RECOMMENDED",
                    "savings": "MAXIMUM (Zero Procurement Cost)"
                })
            
    return sorted(suggestions, key=lambda x: x['distance_km'])

# --- MATERIAL REQUEST & AUTO-ADVISORY ---

@app.post("/requests/", response_model=schemas.RequestResponse)
def create_material_request(request: schemas.RequestCreate, db: Session = Depends(get_db)):
    """
    Submits a request for materials and logs it into the system.
    In a future update, this will trigger a notification to other sites.
    """
    new_request = models.MaterialRequest(**request.model_dump())
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return new_request

@app.get("/requests/active")
def get_active_requests(db: Session = Depends(get_db)):
    """
    Returns a list of all sites that currently need materials.
    This is what your groupmates will use for the 'Global Needs' feed.
    """
    return db.query(models.MaterialRequest).filter(models.MaterialRequest.status == "Pending").all()