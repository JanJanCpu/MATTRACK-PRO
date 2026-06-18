from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import math
import requests
import datetime
import jose
from jose import jwt
from passlib.context import CryptContext

import models, schemas
from database import engine, get_db

app = FastAPI(title="MatTrack PRO API", version="2.0.0")

# 1. Optimized CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Initialization
models.Base.metadata.create_all(bind=engine) 

# --- SECURITY & AUTHENTICATION CONFIG ---
SECRET_KEY = "SUPER_SECRET_SECURITY_TOKEN_REPLACE_THIS_FOR_PRODUCTION"
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.utcnow() + datetime.timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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

# --- AUTH & USER ROUTES ---
@app.post("/register", response_model=schemas.UserResponse, tags=["Auth"])
def register_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = hash_password(user.password)
    new_user = models.User(
        username=user.username,
        email=user.email,
        hashed_password=hashed,
        role=user.role,
        company_name=user.company_name
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token, tags=["Auth"])
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    token = create_access_token({"sub": user.username, "role": user.role, "id": user.id})
    return {"access_token": token, "token_type": "bearer"}

# --- SITES ---
@app.get("/sites/", response_model=List[schemas.SiteResponse], tags=["Sites"])
def list_sites(db: Session = Depends(get_db)):
    return db.query(models.ProjectSite).all()

@app.post("/sites/", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED, tags=["Sites"])
def create_site(site: schemas.SiteCreate, db: Session = Depends(get_db)):
    db_site = models.ProjectSite(
        site_name=site.name, 
        address=site.address, 
        latitude=site.lat, 
        longitude=site.lon
    )
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

@app.patch("/sites/{site_id}/progress", response_model=schemas.SiteResponse, tags=["Sites"])
def update_site_progress(site_id: int, req: schemas.SiteProgressUpdate, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
    
    site.stage_status = req.stage_status
    site.progress_percentage = req.progress_percentage
    db.commit()
    db.refresh(site)
    return site

# --- INVENTORY & AUDIT LOGGING ---
@app.get("/inventory/", response_model=List[schemas.InventoryResponse], tags=["Inventory"])
def list_inventory(db: Session = Depends(get_db)):
    return db.query(models.Inventory).all()

@app.post("/inventory/log", tags=["Inventory"])
def log_stock_transaction(transaction: schemas.InventoryBase, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
    
    item = db.query(models.Inventory).filter(
        models.Inventory.site_id == transaction.site_id,
        models.Inventory.item_name == transaction.item_name,
        models.Inventory.brand == transaction.brand
    ).first()

    action_text = ""
    if item:
        item.quantity += transaction.quantity
        item.status = transaction.status 
        action_text = f"Updated {transaction.item_name} ({transaction.brand}) stock by {transaction.quantity} {transaction.unit}."
    else:
        item = models.Inventory(**transaction.dict())
        db.add(item)
        action_text = f"Initialized {transaction.quantity} {transaction.unit} of new item: {transaction.item_name}."

    audit_log = models.ActivityLog(user_id=user_id, action=f"User [{username}]: {action_text}")
    db.add(audit_log)
    db.commit()
    return {"status": "Success", "message": action_text}

# Bulk Upload Route
@app.post("/inventory/bulk-upload", tags=["Inventory"])
def bulk_upload_inventory(items: List[schemas.InventoryBase], token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    added_count = 0
    
    for item_data in items:
        existing_item = db.query(models.Inventory).filter(
            models.Inventory.site_id == item_data.site_id,
            models.Inventory.item_name == item_data.item_name,
            models.Inventory.brand == item_data.brand
        ).first()

        if existing_item:
            existing_item.quantity += item_data.quantity
        else:
            new_item = models.Inventory(**item_data.dict())
            db.add(new_item)
            
        added_count += 1

    audit_log = models.ActivityLog(
        user_id=user_id, 
        action=f"User [{username}]: Bulk imported {added_count} items."
    )
    db.add(audit_log)
    db.commit()
    
    return {"status": "Success", "message": f"Successfully imported {added_count} items!"}

@app.get("/inventory/audit-logs", tags=["Inventory"])
def get_recent_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(5).all()
    return [{"id": log.id, "action": log.action, "timestamp": "Just now" } for log in logs] 

@app.delete("/inventory/{item_id}", tags=["Inventory"])
def delete_inventory_item(item_id: int, db: Session = Depends(get_db)):
    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not db_item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(db_item)
    db.commit()
    return {"status": "success", "message": f"Item {item_id} deleted"}

# --- MATERIAL TRANSFERS (The 3-Step Handshake) ---
@app.post("/transfers/initiate", tags=["Transfers"])
def initiate_transfer(req: schemas.TransferCreate, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    # 1. Deduct from Source Site
    source_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == req.source_site_id,
        models.Inventory.item_name == req.item_name,
        models.Inventory.brand == req.brand
    ).first()

    if not source_item or source_item.quantity < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source site to transfer.")

    # Deduct quantity and auto-update status
    source_item.quantity -= req.quantity
    is_asset = source_item.unit in ["Unit", "Set"]
    
    if source_item.quantity == 0:
        source_item.status = "In Use" if is_asset else "Critical"
    elif source_item.quantity <= 10 and not is_asset:
        source_item.status = "Low Stock"

    # 2. Create the "In Transit" Ticket (The Void)
    new_transfer = models.MaterialTransfer(
        item_name=req.item_name,
        brand=req.brand,
        quantity=req.quantity,
        unit=req.unit,
        source_site_id=req.source_site_id,
        destination_site_id=req.destination_site_id,
        status=models.TransferStatus.IN_TRANSIT.value
    )
    db.add(new_transfer)

    # 3. Write to Audit Trail
    audit_log = models.ActivityLog(
        user_id=user_id,
        action=f"User [{username}]: Dispatched {req.quantity} {req.unit} of {req.item_name} from Site ID {req.source_site_id} to Site ID {req.destination_site_id}."
    )
    db.add(audit_log)

    db.commit()
    return {"status": "Success", "message": "Transfer initiated successfully."}

@app.get("/transfers/incoming/{site_id}", response_model=List[schemas.TransferResponse], tags=["Transfers"])
def get_incoming_transfers(site_id: int, db: Session = Depends(get_db)):
    # Lets Site B check the void for incoming trucks
    return db.query(models.MaterialTransfer).filter(
        models.MaterialTransfer.destination_site_id == site_id,
        models.MaterialTransfer.status == models.TransferStatus.IN_TRANSIT.value
    ).all()

@app.post("/transfers/{transfer_id}/receive", tags=["Transfers"])
def receive_transfer(transfer_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    # 1. Find the exact Transfer Ticket
    transfer = db.query(models.MaterialTransfer).filter(models.MaterialTransfer.id == transfer_id).first()
    if not transfer or transfer.status != models.TransferStatus.IN_TRANSIT.value:
        raise HTTPException(status_code=404, detail="Active transfer not found.")

    # 2. Mark as Received
    transfer.status = models.TransferStatus.RECEIVED.value
    transfer.received_at = datetime.datetime.utcnow()

    # 3. Inject into Destination Inventory
    dest_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == transfer.destination_site_id,
        models.Inventory.item_name == transfer.item_name,
        models.Inventory.brand == transfer.brand
    ).first()

    is_asset = transfer.unit in ["Unit", "Set"]

    if dest_item:
        dest_item.quantity += transfer.quantity
        dest_item.status = "Available" if is_asset else "Healthy"
    else:
        new_item = models.Inventory(
            item_name=transfer.item_name,
            brand=transfer.brand,
            quantity=transfer.quantity,
            unit=transfer.unit,
            status="Available" if is_asset else "Healthy",
            fsn_status="FAST",
            site_id=transfer.destination_site_id
        )
        db.add(new_item)

    # 4. Write to Audit Trail
    audit_log = models.ActivityLog(
        user_id=user_id,
        action=f"User [{username}]: Received {transfer.quantity} {transfer.unit} of {transfer.item_name} (Transfer ID: {transfer.id})."
    )
    db.add(audit_log)

    db.commit()
    return {"status": "Success", "message": "Transfer received successfully."}

# --- SUPPLIERS ---
@app.get("/suppliers/", response_model=List[schemas.SupplierResponse], tags=["Logistics"])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/suppliers/", response_model=schemas.SupplierResponse, tags=["Logistics"])
def create_supplier(s: schemas.SupplierCreate, db: Session = Depends(get_db)):
    new_s = models.Supplier(
        name=s.name, 
        contact=s.contact, 
        latitude=s.lat, 
        longitude=s.lon, 
        quality_rating=s.rating,
        is_sister_company=False,
        address=s.address
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s)

    if s.material:
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
        db.refresh(new_s) 

    return new_s

class RatingUpdate(BaseModel):
    rating: int

@app.patch("/suppliers/{supplier_id}/rating", tags=["Logistics"])
def update_supplier_rating(supplier_id: int, req: RatingUpdate, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
    
    supplier.quality_rating = req.rating
    db.commit()
    return {"status": "success", "message": "Rating updated", "new_rating": supplier.quality_rating}

@app.delete("/suppliers/{supplier_id}", tags=["Logistics"])
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    
    if not db_supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    db.delete(db_supplier)
    db.commit()
    
    return {"status": "success", "message": f"Supplier {supplier_id} deleted"}

# --- ADVISORY (DETERMINISTIC HEURISTIC INSTEAD OF AI) ---
@app.get("/advisory/procure/{site_id}/{item_name}", tags=["Advisory"])
def procure_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site:
        raise HTTPException(status_code=404, detail="Site not found")
        
    suppliers = db.query(models.Supplier).all()
    recommendations = []
    
    for s in suppliers:
        dist = compute_distance(site.latitude, site.longitude, s.latitude, s.longitude)
        travel_time = get_real_travel_time(site.latitude, site.longitude, s.latitude, s.longitude)
        
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

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@app.post("/advisory/chat", tags=["Advisory"])
def chat_with_ai(req: ChatRequest, db: Session = Depends(get_db)):
    supplier_count = db.query(models.Supplier).count()
    
    simulated_response = (
        f"**System Acknowledged:** I received your query regarding '{req.message}'. "
        f"I am currently tracking {supplier_count} unlisted suppliers in the database. "
        "Once my API key is active, I will cross-reference this with live prices and proximity."
    )
    
    return {"reply": simulated_response}

@app.get("/")
def health_check():
    return {"status": "online", "system": "MatTrack PRO Core", "version": "2.0.0"}