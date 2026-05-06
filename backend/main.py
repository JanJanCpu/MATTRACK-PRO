from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict
import models, schemas, math
from database import engine, get_db
import joblib
import numpy as np

# Load the trained model
mlp_model = joblib.load("procurement_model.pkl")
    
app = FastAPI(title="MatTrack PRO API", version="1.1.0")

# 1. Optimized CORS (Strictly allowed origins for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Initialization
models.Base.metadata.create_all(bind=engine)

# --- UTILS ---
def compute_distance(lat1, lon1, lat2, lon2):
    R = 6371 
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1-a)))

# --- CORE ROUTES ---

@app.get("/", tags=["Health"])
def health_check():
    return {"status": "online", "system": "MatTrack PRO", "version": "1.1.0"}

# --- SITES ---
@app.get("/sites/", response_model=List[schemas.SiteResponse], tags=["Sites"])
def list_sites(db: Session = Depends(get_db)):
    return db.query(models.ProjectSite).all()

@app.post("/sites/", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED)
def create_site(site: schemas.SiteCreate, db: Session = Depends(get_db)):
    db_site = models.ProjectSite(site_name=site.name, latitude=site.lat, longitude=site.lon)
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

# --- INVENTORY ---
@app.get("/inventory/grouped", tags=["Inventory"])
def get_grouped_inventory(db: Session = Depends(get_db)):
    items = db.query(models.Inventory).all()
    grouped = {}
    for i in items:
        key = f"Site {i.site_id}"
        if key not in grouped: grouped[key] = []
        grouped[key].append({"id": i.id, "item": i.item_name, "qty": i.quantity, "unit": i.unit, "status": i.status})
    return grouped

@app.get("/inventory/", response_model=List[schemas.InventoryResponse])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

# --- SUPPLIERS & ADVISORY ---
@app.get("/suppliers/", response_model=List[schemas.SupplierResponse], tags=["Logistics"])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(s: schemas.SupplierCreate, db: Session = Depends(get_db)):
    new_s = models.Supplier(name=s.name, contact=s.contact, latitude=s.lat, longitude=s.lon, quality_rating=s.rating)
    db.add(new_s)
    db.commit()
    db.refresh(new_s)
    return new_s

@app.get("/advisory/procure/{site_id}/{item_name}")
def procure_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    
    # Change this: Get ALL suppliers first, then filter in Python
    # This prevents the AI from getting stuck if categories aren't perfect
    suppliers = db.query(models.Supplier).all()
    
    recommendations = []
    for s in suppliers:
        # Check if supplier handles the item (e.g., "cement" in "Steel, Cement")
        category_list = s.categories.lower() if s.categories else ""
        if item_name.lower() in category_list or not s.categories:
            
            dist = compute_distance(site.latitude, site.longitude, s.latitude, s.longitude)
            price_placeholder = 250.0 
            
            if mlp_model:
                # Features: [Distance, Quality, Price]
                # Ensure the order matches what you trained in train_model.py!
                input_data = np.array([[dist, s.quality_rating, price_placeholder]])
                predicted_score = mlp_model.predict(input_data)[0]
            else:
                predicted_score = (s.quality_rating * 10) - (dist * 1.5)

            recommendations.append({
                "supplier": s.name,
                "distance_km": round(dist, 2),
                "score": round(max(5, min(99, predicted_score)), 2),
                "contact": s.contact
            })
            
    return sorted(recommendations, key=lambda x: x['score'], reverse=True)
# --- REQUESTS ---
@app.get("/requests/active", response_model=List[schemas.RequestResponse])
def list_active_requests(db: Session = Depends(get_db)):
    return db.query(models.MaterialRequest).filter(models.MaterialRequest.status == "Pending").all()

@app.post("/requests/", response_model=schemas.RequestResponse)
def post_request(req: schemas.RequestCreate, db: Session = Depends(get_db)):
    new_req = models.MaterialRequest(**req.model_dump(), status="Pending")
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req