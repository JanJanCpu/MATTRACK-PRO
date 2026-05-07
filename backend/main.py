from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
import models, schemas, math
from database import engine, get_db
import joblib
import numpy as np
import requests 

# Load the trained model
try:
    mlp_model = joblib.load("procurement_model.pkl")
    print("Neural Network Model Loaded Successfully")
except:
    mlp_model = None
    print("Warning: procurement_model.pkl not found. Using fallback scoring logic.")
    
app = FastAPI(title="MatTrack PRO API", version="1.2.0")

# 1. Optimized CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Initialization

# models.Base.metadata.drop_all(bind=engine) // Uncomment this line if you want to reset the database during development (CAUTION: This will delete all data!)

models.Base.metadata.create_all(bind=engine)

# --- UTILS ---
def compute_distance(lat1, lon1, lat2, lon2):
    R = 6371 
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi/2)**2 + math.cos(phi1)*math.cos(phi2)*math.sin(dlambda/2)**2
    return R * (2 * math.atan2(math.sqrt(a), math.sqrt(1-a)))

def get_real_travel_time(lat1, lon1, lat2, lon2):
    url = f"http://router.project-osrm.org/route/v1/driving/{lon1},{lat1};{lon2},{lat2}?overview=false"
    try:
        response = requests.get(url, timeout=2).json()
        return round(response['routes'][0]['duration'] / 60, 2)
    except:
        return None 

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
@app.get("/inventory/", response_model=List[schemas.InventoryResponse])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

@app.post("/inventory/", response_model=schemas.InventoryResponse)
def create_inventory(item: schemas.InventoryCreate, db: Session = Depends(get_db)):
    db_item = models.Inventory(**item.dict())
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item

@app.patch("/inventory/{item_id}/procure", tags=["Inventory"])
def initiate_procurement(item_id: int, db: Session = Depends(get_db)):
    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    item.status = "In Transit"
    db.commit()
    return {"status": "success", "message": f"{item.item_name} is now In Transit"}

@app.delete("/inventory/{item_id}")
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"status": "success", "message": f"Item {item_id} deleted"}

# --- SUPPLIERS & ADVISORY ---
@app.get("/suppliers/", response_model=List[schemas.SupplierResponse], tags=["Logistics"])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/suppliers/", response_model=schemas.SupplierResponse)
def create_supplier(s: schemas.SupplierCreate, db: Session = Depends(get_db)):
    # 1. Create the base store
    new_s = models.Supplier(
        name=s.name, 
        contact=s.contact, 
        latitude=s.lat, 
        longitude=s.lon, 
        quality_rating=s.rating,
        is_sister_company=False
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s)

    # 2. If the UI sent material data, save it to the new relational table automatically
    if s.material:
        # Basic cleanup in case user types '₱250' instead of '250'
        clean_price = 0.0
        if s.price:
            try:
                clean_price = float(str(s.price).replace("₱", "").replace(",", "").strip())
            except:
                pass 
                
        new_mat = models.SupplierMaterial(
            supplier_id=new_s.id,
            material_name=s.material,
            price=clean_price,
            stock_level=s.stockLevel
        )
        db.add(new_mat)
        db.commit()
        db.refresh(new_s) # Refresh to attach the new material to the response

    return new_s

# --- NEW: Add extra materials to an existing store ---
@app.post("/suppliers/{supplier_id}/materials", response_model=schemas.SupplierMaterialResponse, tags=["Logistics"])
def add_material_to_supplier(supplier_id: int, mat: schemas.SupplierMaterialCreate, db: Session = Depends(get_db)):
    store = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")
    
    new_material = models.SupplierMaterial(
        supplier_id=supplier_id,
        material_name=mat.material_name,
        price=mat.price,
        stock_level=mat.stock_level
    )
    db.add(new_material)
    db.commit()
    db.refresh(new_material)
    return new_material

@app.get("/advisory/procure/{site_id}/{item_name}")
def procure_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
        
    suppliers = db.query(models.Supplier).all()
    recommendations = []
    
    for s in suppliers:
        dist = compute_distance(site.latitude, site.longitude, s.latitude, s.longitude)
        travel_time = get_real_travel_time(site.latitude, site.longitude, s.latitude, s.longitude)
        price_placeholder = 250.0 
        
        if mlp_model:
            input_data = np.array([[dist, s.quality_rating, price_placeholder]])
            predicted_score = mlp_model.predict(input_data)[0]
        else:
            predicted_score = (s.quality_rating * 10) - (dist * 1.5)

        if getattr(s, 'is_sister_company', False):
            predicted_score += 15

        recommendations.append({
            "supplier": s.name,
            "distance_km": round(dist, 2),
            "travel_time_mins": travel_time,
            "score": round(max(5, min(99, predicted_score)), 2),
            "contact": s.contact,
            "is_sister": getattr(s, 'is_sister_company', False)
        })
            
    return sorted(recommendations, key=lambda x: x['score'], reverse=True)

# --- REQUESTS ---
@app.get("/requests/active", response_model=List[schemas.RequestResponse])
def list_active_requests(db: Session = Depends(get_db)):
    return db.query(models.MaterialRequest).filter(models.MaterialRequest.status == "Pending").all()

@app.post("/requests/", response_model=schemas.RequestResponse)
def post_request(req: schemas.RequestCreate, db: Session = Depends(get_db)):
    new_req = models.MaterialRequest(**req.dict(), status="Pending")
    db.add(new_req)
    db.commit()
    db.refresh(new_req)
    return new_req

@app.get("/")
def health_check():
    return {"status": "online", "system": "MatTrack PRO", "version": "1.2.0"}