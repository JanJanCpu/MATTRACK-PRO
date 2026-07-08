from fastapi import FastAPI, Depends, HTTPException, status, Request, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel, Field
import math
import requests
import datetime
from datetime import datetime as dt_datetime, timezone as dt_timezone, timedelta
import uuid
from pytz import timezone 
import jose
from jose import jwt
from passlib.context import CryptContext

# --- AI INTEGRATION IMPORTS ---
import os
from dotenv import load_dotenv
import google.generativeai as genai

load_dotenv()

import models, schemas
from database import engine, get_db

app = FastAPI(title="MatTrack PRO API", version="2.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine) 

SECRET_KEY = os.environ.get("SECRET_KEY", "SUPER_SECRET_SECURITY_TOKEN_REPLACE_THIS_FOR_PRODUCTION")
ALGORITHM = "HS256"

PH_TZ = timezone('Asia/Manila')

def get_local_time_string(dt_object):
    if not dt_object: return "Unknown Time"
    if dt_object.tzinfo is None:
        dt_object = dt_object.replace(tzinfo=dt_timezone.utc)
    local_dt = dt_object.astimezone(PH_TZ)
    return local_dt.strftime("%b %d, %Y - %I:%M %p")

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = dt_datetime.now(dt_timezone.utc) + timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

# --- HELPER: LAYER 2 STRING NORMALIZATION ---
def normalize_item_name(name: str) -> str:
    """Guarantees strict case and whitespace standardization across all project ledgers."""
    return name.strip().lower() if name else ""

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
    
def calculate_transfer_cost(distance_km: float):
    FUEL_PRICE_PHP = 65.00
    TRUCK_KM_PER_LITER = 6.0
    DISPATCH_FEE = 300.00
    fuel_cost = (distance_km / TRUCK_KM_PER_LITER) * FUEL_PRICE_PHP
    return round(fuel_cost + DISPATCH_FEE, 2)

def calculate_procurement_cost(unit_price: float, quantity: float, distance_km: float):
    SUPPLIER_DELIVERY_RATE = 25.00
    material_cost = unit_price * quantity
    delivery_fee = distance_km * SUPPLIER_DELIVERY_RATE
    return round(material_cost + delivery_fee, 2)

# --- HELPER: DYNAMIC INVENTORY THRESHOLDS ---
def get_dynamic_status(quantity: float, baseline: float, current_status: str) -> str:
    """Calculates status contextually based on the dynamic 10% baseline rule."""
    
    # 1. Respect manual PM lifecycle overrides (Sufficient, Surplus, Depleted)
    # If the PM flagged it as Depleted, it stays Depleted regardless of quantity.
    if current_status in ["Sufficient", "Surplus", "Depleted"]:
        return current_status
        
    # 2. Hard zero organically -> CRITICAL (They ran out, sound the alarm!)
    if quantity <= 0:
        return "Critical"
        
    # 3. Low stock triggers at 10% (or less) of the current baseline
    if quantity <= (baseline * 0.10):
        return "Low Stock"
        
    return "In Stock"

# --- DYNAMIC SCHEMA OVERRIDES (Bypasses schemas.py constraints to prevent silent data stripping) ---
class CatalogItemOut(BaseModel):
    id: int
    supplier_id: int
    material_name: str
    brand: Optional[str] = "Generic/No Brand"
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "Pcs"
    price: float
    stock_level: str
    delivery_rating: float
    
    class Config:
        from_attributes = True

class SupplierOut(BaseModel):
    id: int
    name: str
    contact: str
    latitude: float
    longitude: float
    quality_rating: float
    is_sister_company: bool
    address: Optional[str] = None
    materials: List[CatalogItemOut] = []

    class Config:
        from_attributes = True

# --- AUTH & USER ROUTES ---
@app.post("/register", response_model=schemas.UserResponse, tags=["Auth"])
def register_user(user: schemas.UserCreate = Body(...), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = hash_password(user.password)
    new_user = models.User(
        username=user.username, email=user.email, hashed_password=hashed,
        role=user.role, company_name=user.company_name, supplier_id=getattr(user, 'supplier_id', None)
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/token", response_model=schemas.Token, tags=["Auth"])
def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.username == form_data.username).first()
    client_ip = request.client.host if request.client else "Unknown IP"
    user_agent = request.headers.get("user-agent", "Unknown Device")

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            log = models.ActivityLog(user_id=user.id, action=f"Failed login attempt from IP: {client_ip}", is_security_event=True)
            db.add(log)
            db.commit()
        raise HTTPException(status_code=400, detail="Incorrect username or password")
    
    session_token = str(uuid.uuid4())
    token = create_access_token({"sub": user.username, "role": user.role, "id": user.id, "session": session_token})
    
    new_session = models.ActiveSession(
        user_id=user.id, token=session_token, device_info=user_agent[:250], ip_address=client_ip
    )
    db.add(new_session)
    
    log = models.ActivityLog(user_id=user.id, action=f"Successful login. New session created for {client_ip}.", is_security_event=True)
    db.add(log)
    db.commit()
    return {"access_token": token, "token_type": "bearer"}

@app.get("/users/me", response_model=schemas.UserResponse, tags=["Auth"])
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user: raise HTTPException(status_code=404, detail="User not found")
    return user

@app.get("/users/managers", response_model=List[schemas.UserResponse], tags=["Users"])
def get_managers(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    return db.query(models.User).filter(models.User.role == "staff").all()

# --- SECURITY SETTINGS ---
@app.patch("/users/password", tags=["Security"])
def update_password(req: schemas.PasswordUpdate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not verify_password(req.current_password, user.hashed_password):
        log = models.ActivityLog(user_id=user.id, action="Failed password update attempt (Incorrect current password).", is_security_event=True)
        db.add(log)
        db.commit()
        raise HTTPException(status_code=400, detail="Incorrect current password.")
        
    user.hashed_password = hash_password(req.new_password)
    log = models.ActivityLog(user_id=user.id, action="Account password successfully updated.", is_security_event=True)
    db.add(log)
    db.commit()
    return {"status": "success", "message": "Password updated successfully."}

@app.get("/users/sessions", response_model=List[schemas.SessionResponse], tags=["Security"])
def get_active_sessions(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        current_token: str = payload.get("session")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    sessions = db.query(models.ActiveSession).filter(models.ActiveSession.user_id == user_id).all()
    formatted_sessions = []
    for s in sessions:
        formatted_sessions.append({
            "id": s.id,
            "device_info": s.device_info,
            "ip_address": s.ip_address,
            "created_at": get_local_time_string(s.created_at),
            "last_active": get_local_time_string(s.last_active),
            "is_current_session": s.token == current_token
        })
    return formatted_sessions

@app.delete("/users/sessions", tags=["Security"])
def revoke_other_sessions(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        current_token: str = payload.get("session")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    db.query(models.ActiveSession).filter(
        models.ActiveSession.user_id == user_id,
        models.ActiveSession.token != current_token
    ).delete()
    
    log = models.ActivityLog(user_id=user_id, action="Emergency Revocation: Terminated all other active sessions.", is_security_event=True)
    db.add(log)
    db.commit()
    return {"status": "success", "message": "All other sessions have been forcefully disconnected."}

@app.get("/users/security-logs", response_model=List[schemas.ActivityLogResponse], tags=["Security"])
def get_security_logs(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    logs = db.query(models.ActivityLog).filter(
        models.ActivityLog.user_id == user_id,
        models.ActivityLog.is_security_event == True
    ).order_by(models.ActivityLog.id.desc()).limit(15).all()
    
    formatted_logs = []
    for log in logs:
        formatted_logs.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "timestamp": get_local_time_string(log.timestamp),
            "is_security_event": log.is_security_event
        })
    return formatted_logs

# --- SITES ---
@app.get("/sites/", response_model=List[schemas.SiteResponse], tags=["Sites"])
def list_sites(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    return db.query(models.ProjectSite).filter(models.ProjectSite.is_active == True).order_by(models.ProjectSite.id.asc()).all()

@app.post("/sites/", response_model=schemas.SiteResponse, tags=["Sites"])
def create_site(site: schemas.SiteCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Admins can create sites.")

    new_site = models.ProjectSite(
        site_name=site.name, 
        address=site.address, 
        latitude=site.lat, 
        longitude=site.lon, 
        manager_id=site.manager_id
    )
    db.add(new_site)
    
    audit_msg = f"User [{username}]: Created a new Project Site '{site.name}'."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg, is_security_event=False))
    
    db.commit()
    db.refresh(new_site)
    return new_site

@app.patch("/sites/{site_id}", response_model=schemas.SiteResponse, tags=["Sites"])
def edit_site(site_id: int, name: str = Body(None), address: str = Body(None), manager_id: int = Body(None), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Admins can edit site details.")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
    
    old_name = site.site_name
    
    if name: site.site_name = name
    if address: site.address = address
    if manager_id is not None: site.manager_id = manager_id
    
    audit_msg = f"User [{username}]: Modified Project Site settings for '{old_name}' (Site #{site_id})."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg, is_security_event=False))
    
    db.commit()
    db.refresh(site)
    return site

@app.patch("/sites/{site_id}/status", tags=["Sites"])
def update_project_status(site_id: int, req: schemas.ProjectStatusUpdate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
    
    if user_role == "staff" and site.manager_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized: Only the assigned PM can update this project's status.")

    valid_statuses = ["Pre Construction", "Mid Construction", "Finishing", "Post Construction"]
    if req.stage_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid project stage.")

    site.stage_status = req.stage_status
    db.commit()
    return {"status": "Success", "message": f"Project status advanced to {site.stage_status}"}

@app.delete("/sites/{site_id}", tags=["Sites"])
def soft_delete_site(site_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Safely archives a project site without destroying historical database integrity."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Admins can archive sites.")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")

    site.is_active = False
    
    audit_msg = f"User [{username}]: SECURITY EVENT - Project Site '{site.site_name}' (Site #{site_id}) was securely archived."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg, is_security_event=True))

    db.commit()
    return {"status": "success", "message": "Project Site securely archived."}

@app.get("/sites/archived", response_model=List[schemas.SiteResponse], tags=["Sites"])
def list_archived_sites(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Fetches only the soft-deleted/archived project sites."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Admins can view archives.")

    return db.query(models.ProjectSite).filter(models.ProjectSite.is_active == False).order_by(models.ProjectSite.id.desc()).all()

@app.patch("/sites/{site_id}/restore", response_model=schemas.SiteResponse, tags=["Sites"])
def restore_site(site_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Restores an archived site back to the active ledger."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role not in ["admin", "owner"]:
        raise HTTPException(status_code=403, detail="Unauthorized: Only Admins can restore sites.")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")

    site.is_active = True
    
    audit_msg = f"User [{username}]: Restored Project Site '{site.site_name}' (Site #{site_id}) from archives."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg, is_security_event=False))

    db.commit()
    db.refresh(site)
    return site

# --- INVENTORY & AUDIT LOGGING ---
@app.get("/inventory/", response_model=List[schemas.InventoryResponse], tags=["Inventory"])
def list_inventory(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    return db.query(models.Inventory).all()

@app.post("/inventory/log", tags=["Inventory"])
def log_stock_transaction(transaction: schemas.InventoryBase = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
    
    my_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == transaction.site_id).first()
    if not my_site: raise HTTPException(status_code=404, detail="Site not found")
    if user_role == "staff" and my_site.manager_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized: You can only modify inventory for your assigned sites.")

    norm_item_name = normalize_item_name(transaction.item_name)
    norm_brand = normalize_item_name(transaction.brand)
    clean_status = "In Stock" if transaction.status.lower() == "healthy" else transaction.status

    item = db.query(models.Inventory).filter(
        models.Inventory.site_id == transaction.site_id,
        models.Inventory.item_name == norm_item_name,
        models.Inventory.brand == norm_brand
    ).first()

    action_text = ""
    if item:
        if transaction.quantity > 0:
            item.quantity += transaction.quantity
            item.baseline_quantity = item.quantity 
            item.status = "In Stock" 
            action_text = f"Restocked {norm_item_name} ({norm_brand}). New total baseline is {item.quantity} {transaction.unit}."
        else:
            item.quantity += transaction.quantity
            action_text = f"Logged usage of {abs(transaction.quantity)} {transaction.unit} for {norm_item_name}."
            
        item.status = get_dynamic_status(item.quantity, item.baseline_quantity, item.status)
    else:
        inv_data = transaction.dict(exclude={"supplier_id", "batch_rating"})
        inv_data['item_name'] = norm_item_name
        inv_data['brand'] = norm_brand
        inv_data['baseline_quantity'] = transaction.quantity
        inv_data['status'] = get_dynamic_status(transaction.quantity, transaction.quantity, clean_status)
        item = models.Inventory(**inv_data)
        db.add(item)
        action_text = f"Registered initial 100% baseline for {transaction.quantity} {transaction.unit} of item: {norm_item_name}."

    if hasattr(transaction, 'supplier_id') and transaction.supplier_id and hasattr(transaction, 'batch_rating') and transaction.batch_rating:
        sup_mat = db.query(models.SupplierMaterial).filter(
            models.SupplierMaterial.supplier_id == transaction.supplier_id,
            models.SupplierMaterial.material_name == norm_item_name
        ).first()

        if sup_mat:
            if sup_mat.delivery_rating == 0.0:
                sup_mat.delivery_rating = transaction.batch_rating
            else:
                sup_mat.delivery_rating = (sup_mat.delivery_rating + transaction.batch_rating) / 2
        else:
            new_sup_mat = models.SupplierMaterial(
                supplier_id=transaction.supplier_id,
                material_name=norm_item_name,
                brand=norm_brand,
                delivery_rating=transaction.batch_rating,
                stock_level="Available"
            )
            db.add(new_sup_mat)
        
        supplier_info = db.query(models.Supplier).filter(models.Supplier.id == transaction.supplier_id).first()
        sup_name = supplier_info.name if supplier_info else "Supplier"
        action_text += f" (Rated delivery from {sup_name} as {transaction.batch_rating}/5 stars)."

    full_msg = f"User [{username}]: {action_text}"
    audit_log = models.ActivityLog(user_id=user_id, action=full_msg)
    db.add(audit_log)
    
    notif = models.Notification(user_id=user_id, title="Stock Updated", message=full_msg, link="/inventory")
    db.add(notif)
    
    if item.status == "Critical" or item.quantity <= 0:
        site_name = my_site.site_name
        admins = db.query(models.User).filter(models.User.role.in_(["admin", "owner"])).all()
        recipients = set([a.id for a in admins])
        
        all_sites = db.query(models.ProjectSite).all()
        for s in all_sites:
            if s.id != my_site.id and s.manager_id:
                dist = compute_distance(my_site.latitude, my_site.longitude, s.latitude, s.longitude)
                if dist <= 15.0: 
                    recipients.add(s.manager_id)
        
        if user_id in recipients:
            recipients.remove(user_id)
            
        for r_id in recipients:
            broadcast_msg = f"NETWORK ALERT: {site_name} is facing a critical shortage of {norm_item_name}. If you have surplus, please initiate a transfer to assist them."
            n = models.Notification(user_id=r_id, title="Nearby Critical Shortage", message=broadcast_msg, link="/inventory")
            db.add(n)

    db.commit()
    return {"status": "Success", "message": full_msg}

@app.patch("/inventory/{item_id}/flag", tags=["Inventory"])
def override_inventory_status(item_id: int, req: schemas.InventoryStatusOverride = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not item: raise HTTPException(status_code=404, detail="Item not found")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
    if user_role == "staff" and (not site or site.manager_id != user_id):
        raise HTTPException(status_code=403, detail="Unauthorized: Only the assigned PM can manage this inventory.")

    valid_flags = ["Sufficient", "Surplus", "Depleted"]
    if req.status not in valid_flags:
        raise HTTPException(status_code=400, detail="Invalid status flag.")

    item.status = req.status
    if req.status == "Depleted":
        item.quantity = 0.0 

    db.add(models.ActivityLog(user_id=user_id, action=f"Manually flagged {item.item_name} as {req.status}."))
    db.commit()
    
    return {"status": "Success", "message": f"Item successfully flagged as {req.status}."}

@app.post("/inventory/bulk-upload", tags=["Inventory"])
def bulk_upload_inventory(items: List[schemas.InventoryBase] = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role == "staff":
        for item_data in items:
            site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item_data.site_id).first()
            if not site or site.manager_id != user_id:
                raise HTTPException(status_code=403, detail=f"SECURITY BLOCK: CSV contains data for Site ID {item_data.site_id} which you are not authorized to manage.")

    added_count = 0
    updated_materials = 0

    for item_data in items:
        norm_name = normalize_item_name(item_data.item_name)
        norm_brand = normalize_item_name(item_data.brand)
        clean_status = "In Stock" if item_data.status.lower() == "healthy" else item_data.status

        existing_item = db.query(models.Inventory).filter(
            models.Inventory.site_id == item_data.site_id,
            models.Inventory.item_name == norm_name,
            models.Inventory.brand == norm_brand
        ).first()

        if existing_item:
            existing_item.quantity += item_data.quantity
            existing_item.baseline_quantity = existing_item.quantity
            existing_item.status = get_dynamic_status(existing_item.quantity, existing_item.baseline_quantity, existing_item.status)
        else:
            inv_data = item_data.dict(exclude={"supplier_id", "batch_rating"})
            inv_data['item_name'] = norm_name
            inv_data['brand'] = norm_brand
            inv_data['status'] = clean_status
            inv_data['baseline_quantity'] = item_data.quantity
            new_item = models.Inventory(**inv_data)
            db.add(new_item)
        
        added_count += 1

        if item_data.supplier_id and item_data.batch_rating:
            supplier_exists = db.query(models.Supplier).filter(models.Supplier.id == item_data.supplier_id).first()
            if supplier_exists:
                sup_mat = db.query(models.SupplierMaterial).filter(
                    models.SupplierMaterial.supplier_id == item_data.supplier_id,
                    models.SupplierMaterial.material_name == norm_name
                ).first()

                if sup_mat:
                    if sup_mat.delivery_rating == 0.0:
                        sup_mat.delivery_rating = item_data.batch_rating
                    else:
                        sup_mat.delivery_rating = (sup_mat.delivery_rating + item_data.batch_rating) / 2
                else:
                    new_sup_mat = models.SupplierMaterial(
                        supplier_id=item_data.supplier_id,
                        material_name=norm_name,
                        brand=norm_brand,
                        delivery_rating=item_data.batch_rating,
                        stock_level="Available"
                    )
                    db.add(new_sup_mat)
                updated_materials += 1

    action_msg = f"User [{username}]: Bulk received {added_count} items. Updated AI rating data for {updated_materials} valid supplier entries."
    audit_log = models.ActivityLog(user_id=user_id, action=action_msg)
    db.add(audit_log)
    
    notif = models.Notification(user_id=user_id, title="Bulk Import Complete", message=action_msg, link="/inventory")
    db.add(notif)
    
    db.commit()
    return {"status": "Success", "message": action_msg}

@app.get("/inventory/audit-logs/", tags=["Inventory"])
def get_recent_audit_logs(db: Session = Depends(get_db)):
    audit_logs = db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(20).all()
    formatted_logs = []
    for log in audit_logs:
        formatted_logs.append({
            "id": log.id,
            "user_id": log.user_id,
            "action": log.action,
            "timestamp": get_local_time_string(log.timestamp) 
        })
    return formatted_logs

@app.delete("/inventory/{item_id}", tags=["Inventory"])
def delete_inventory_item(item_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    db_item = db.query(models.Inventory).filter(models.Inventory.id == item_id).first()
    if not db_item: raise HTTPException(status_code=404, detail="Item not found")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == db_item.site_id).first()
    if user_role == "staff" and (not site or site.manager_id != user_id):
        raise HTTPException(status_code=403, detail="Unauthorized: Cannot delete inventory belonging to other sites.")

    db.delete(db_item)
    db.commit()
    return {"status": "success", "message": f"Item {item_id} deleted"}

# --- NOTIFICATIONS ---
@app.get("/notifications", tags=["Notifications"])
def get_user_notifications(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    notifs = db.query(models.Notification).filter(
        models.Notification.user_id == user_id
    ).order_by(models.Notification.id.desc()).limit(10).all()
    
    formatted_notifs = []
    for n in notifs:
        formatted_notifs.append({
            "id": n.id,
            "title": n.title,
            "message": n.message,
            "link": n.link, 
            "is_read": n.is_read,
            "created_at": get_local_time_string(n.created_at)
        })
    return formatted_notifs

@app.patch("/notifications/{notif_id}/read", tags=["Notifications"])
def mark_notification_read(notif_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    notif = db.query(models.Notification).filter(models.Notification.id == notif_id, models.Notification.user_id == user_id).first()
    if notif:
        notif.is_read = True
        db.commit()
    return {"status": "success"}

@app.patch("/notifications/read-all", tags=["Notifications"])
def mark_all_notifications_read(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    db.query(models.Notification).filter(
        models.Notification.user_id == user_id,
        models.Notification.is_read == False
    ).update({"is_read": True})
    
    db.commit()
    return {"status": "success", "message": "All notifications marked as read."}

# --- MATERIAL TRANSFERS & ROUTING ---
@app.post("/transfers/initiate", tags=["Transfers"])
def initiate_transfer(req: schemas.TransferCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    norm_name = normalize_item_name(req.item_name)
    norm_brand = normalize_item_name(req.brand)

    source_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == req.source_site_id,
        models.Inventory.item_name == norm_name,
        models.Inventory.brand == norm_brand
    ).first()

    if not source_item or source_item.quantity < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source site to transfer.")

    if source_item.status in ["Critical", "Low Stock"]:
        raise HTTPException(
            status_code=403,
            detail=f"SECURITY BLOCK: Cannot dispatch outbound transfer. '{source_item.item_name}' is currently flagged as '{source_item.status}' at Site #{req.source_site_id}. You can only transfer items tagged as 'Surplus' or 'In Stock'."
        )

    source_item.quantity -= req.quantity
    is_asset = source_item.unit in ["Unit", "Set"]
    
    if source_item.quantity == 0:
        source_item.status = "In Use" if is_asset else "Depleted"

    new_transfer = models.MaterialTransfer(
        item_name=norm_name, brand=norm_brand, quantity=req.quantity,
        unit=req.unit, source_site_id=req.source_site_id,
        destination_site_id=req.destination_site_id,
        status=models.TransferStatus.IN_TRANSIT.value
    )
    db.add(new_transfer)

    audit_msg = f"User [{username}]: Dispatched {req.quantity} {req.unit} of {norm_name} from Site ID {req.source_site_id} to Site ID {req.destination_site_id}."
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)

    notif = models.Notification(user_id=user_id, title="Transfer Dispatched", message=audit_msg, link="/logistics")
    db.add(notif)
    
    dest_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == req.destination_site_id).first()
    if dest_site and dest_site.manager_id:
        rcv_notif = models.Notification(user_id=dest_site.manager_id, title="Incoming Delivery", message=f"User [{username}]: A truck is en route with {req.quantity} {req.unit} of {norm_name}.", link="/projects")
        db.add(rcv_notif)

    db.commit()
    return {"status": "Success", "message": "Transfer initiated successfully."}

@app.get("/transfers/incoming/{site_id}", tags=["Transfers"])
def get_incoming_transfers(site_id: int, db: Session = Depends(get_db)):
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

    transfer = db.query(models.MaterialTransfer).filter(models.MaterialTransfer.id == transfer_id).first()
    if not transfer or transfer.status != models.TransferStatus.IN_TRANSIT.value:
        raise HTTPException(status_code=404, detail="Active transfer not found.")

    transfer.status = models.TransferStatus.RECEIVED.value
    transfer.received_at = dt_datetime.utcnow()

    norm_name = normalize_item_name(transfer.item_name)
    
    dest_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == transfer.destination_site_id,
        models.Inventory.item_name == norm_name
    ).first()

    is_asset = transfer.unit in ["Unit", "Set"]

    if dest_item:
        dest_item.quantity += transfer.quantity
        dest_item.baseline_quantity = dest_item.quantity
        if is_asset:
            dest_item.status = "Available" if dest_item.quantity > 0 else "In Use"
        else:
            dest_item.status = get_dynamic_status(dest_item.quantity, dest_item.baseline_quantity, dest_item.status)
    else:
        new_item = models.Inventory(
            item_name=norm_name, brand=transfer.brand, quantity=transfer.quantity,
            baseline_quantity=transfer.quantity,
            unit=transfer.unit, 
            status="Available" if is_asset else get_dynamic_status(transfer.quantity, transfer.quantity, "In Stock"),
            fsn_status="FAST", site_id=transfer.destination_site_id
        )
        db.add(new_item)

    audit_msg = f"User [{username}]: Received {transfer.quantity} {transfer.unit} of {norm_name} (Transfer ID: {transfer.id})."
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)
    
    notif = models.Notification(user_id=user_id, title="Delivery Received", message=audit_msg, link="/inventory")
    db.add(notif)

    db.commit()
    return {"status": "Success", "message": "Transfer received successfully."}

@app.post("/transfers/{transfer_id}/cancel", tags=["Transfers"])
def cancel_transfer(transfer_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    transfer = db.query(models.MaterialTransfer).filter(models.MaterialTransfer.id == transfer_id).first()
    if not transfer or transfer.status != models.TransferStatus.IN_TRANSIT.value:
        raise HTTPException(status_code=404, detail="Active transfer not found.")

    transfer.status = "CANCELLED"
    
    source_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == transfer.source_site_id,
        models.Inventory.item_name == transfer.item_name
    ).first()

    if source_item:
        source_item.quantity += transfer.quantity
        source_item.baseline_quantity = source_item.quantity 
        if source_item.unit in ["Unit", "Set"]:
            source_item.status = "Available"
        else:
            if source_item.status in ["Critical", "Low Stock"]:
                source_item.status = "In Stock"

    audit_msg = f"User [{username}]: Rejected/Cancelled Transfer TRK-{transfer.id:04d}. {transfer.quantity} {transfer.unit} of {transfer.item_name} reverted to Site {transfer.source_site_id}."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg))
    db.commit()
    
    return {"status": "Success", "message": "Transfer cancelled and stock reverted to origin."}

# --- SUPPLIERS & PURCHASE ORDERS ---
class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    site_id: int
    material_name: str
    quantity: float
    total_price: float

@app.get("/inventory/purchase-orders", tags=["Logistics"])
def list_purchase_orders(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
    
    if user_role in ["admin", "owner"]:
        return db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.id.desc()).all()
    
    managed_sites = db.query(models.ProjectSite).filter(models.ProjectSite.manager_id == user_id).all()
    managed_site_ids = [s.id for s in managed_sites]
    return db.query(models.PurchaseOrder).filter(models.PurchaseOrder.site_id.in_(managed_site_ids)).order_by(models.PurchaseOrder.id.desc()).all()

@app.post("/inventory/purchase-orders", tags=["Logistics"])
def create_purchase_order(req: PurchaseOrderCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    norm_name = normalize_item_name(req.material_name)
    new_order = models.PurchaseOrder(
        supplier_id=req.supplier_id, site_id=req.site_id, material_name=norm_name,
        quantity=req.quantity, total_price=req.total_price, status="Pending"
    )
    db.add(new_order)
    
    audit_msg = f"User [{username}]: Initiated external Purchase Order for {req.quantity} units of {norm_name} (Total: ₱{req.total_price})."
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)
    
    db.commit()
    return {"status": "Success", "message": "Purchase order sent to supplier."}

@app.post("/inventory/purchase-orders/{po_id}/receive", tags=["Logistics"])
def receive_po(po_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po or po.status == "Received":
        raise HTTPException(status_code=404, detail="Valid pending PO not found.")
        
    po.status = "Received"
    
    dest_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == po.site_id,
        models.Inventory.item_name == po.material_name
    ).first()
    
    if dest_item:
        dest_item.quantity += po.quantity
        dest_item.baseline_quantity = dest_item.quantity
        if dest_item.status in ["Critical", "Low Stock"]:
            dest_item.status = "In Stock"
    else:
        new_item = models.Inventory(
            site_id=po.site_id, item_name=po.material_name, brand="Generic/No Brand", 
            quantity=po.quantity, baseline_quantity=po.quantity, unit="Pcs", status="In Stock", fsn_status="FAST"
        )
        db.add(new_item)
        
    audit_msg = f"User [{username}]: Received external Procurement (PO #{po.id}) for {po.quantity} units of {po.material_name}."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg))
    
    db.commit()
    return {"status": "Success", "message": "PO Received and Inventory Updated."}

@app.post("/inventory/purchase-orders/{po_id}/cancel", tags=["Logistics"])
def cancel_po(po_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    po = db.query(models.PurchaseOrder).filter(models.PurchaseOrder.id == po_id).first()
    if not po:
        raise HTTPException(status_code=404, detail="PO not found.")
    
    if po.status != "Pending":
        raise HTTPException(status_code=400, detail="Cannot cancel: The supplier has already shipped or processed this order.")
        
    po.status = "Cancelled"
    
    audit_msg = f"User [{username}]: Cancelled Pending Purchase Order (PO #{po.id}) for {po.quantity} units of {po.material_name}."
    db.add(models.ActivityLog(user_id=user_id, action=audit_msg))
    
    db.commit()
    return {"status": "Success", "message": "PO Cancelled Successfully."}

@app.get("/suppliers/", response_model=List[SupplierOut], tags=["Logistics"])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/suppliers/", response_model=SupplierOut, tags=["Logistics"])
def create_supplier(s: schemas.SupplierCreate = Body(...), db: Session = Depends(get_db)):
    new_s = models.Supplier(
        name=s.name, contact=s.contact, latitude=s.lat, longitude=s.lon, 
        quality_rating=s.rating, is_sister_company=False, address=s.address
    )
    db.add(new_s)
    db.commit()
    db.refresh(new_s)

    if s.material:
        clean_price = 0.0
        if s.price:
            try: clean_price = float(str(s.price).replace("₱", "").replace(",", "").strip())
            except: pass 
                
        new_mat = models.SupplierMaterial(supplier_id=new_s.id, material_name=normalize_item_name(s.material), price=clean_price, stock_level=s.stockLevel)
        db.add(new_mat)
        db.commit()
        db.refresh(new_s) 

    return new_s

class RatingUpdate(BaseModel):
    rating: int

@app.patch("/suppliers/{supplier_id}/rating", tags=["Logistics"])
def update_supplier_rating(supplier_id: int, req: RatingUpdate = Body(...), db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier: raise HTTPException(status_code=404, detail="Supplier not found")
    supplier.quality_rating = req.rating
    db.commit()
    return {"status": "success", "message": "Rating updated", "new_rating": supplier.quality_rating}

@app.delete("/suppliers/{supplier_id}", tags=["Logistics"])
def delete_supplier(supplier_id: int, db: Session = Depends(get_db)):
    db_supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not db_supplier: raise HTTPException(status_code=404, detail="Supplier not found")
    db.delete(db_supplier)
    db.commit()
    return {"status": "success", "message": f"Supplier {supplier_id} deleted"}

@app.get("/suppliers/{supplier_id}/catalog", response_model=List[CatalogItemOut], tags=["Suppliers"])
def get_supplier_catalog(supplier_id: int, db: Session = Depends(get_db)):
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier: raise HTTPException(status_code=404, detail="Supplier not found")
    return db.query(models.SupplierMaterial).filter(models.SupplierMaterial.supplier_id == supplier_id).all()

# --- SELLER PORTAL ---
class SellerMaterialCreate(BaseModel):
    material_name: str
    brand: str = "Generic/No Brand"
    quantity: float = 0.0
    unit: str = "Pcs"
    price: float
    stock_level: str

def ensure_supplier_profile(user, db: Session):
    if not user.supplier_id:
        company = getattr(user, "company_name", None)
        store_name = company if company else f"{user.username} Store"
        
        new_sup = models.Supplier(
            name=store_name, 
            contact="Update in Settings", 
            address="Update in Settings",
            latitude=14.5995, 
            longitude=120.9842,
            quality_rating=5,
            is_sister_company=False
        )
        db.add(new_sup)
        db.commit()
        db.refresh(new_sup)
        
        user.supplier_id = new_sup.id
        db.commit()
        
    return user.supplier_id

@app.get("/seller/materials", response_model=List[CatalogItemOut], tags=["Seller Portal"])
def get_seller_catalog(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role != "seller": raise HTTPException(status_code=403, detail="Unauthorized: Sellers only.")
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    sup_id = ensure_supplier_profile(user, db)

    return db.query(models.SupplierMaterial).filter(models.SupplierMaterial.supplier_id == sup_id).all()

@app.post("/seller/materials", tags=["Seller Portal"])
def add_seller_material(mat: SellerMaterialCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role != "seller": 
        raise HTTPException(status_code=403, detail="Unauthorized: Sellers only.")
    
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sup_id = ensure_supplier_profile(user, db)
    
    norm_name = normalize_item_name(mat.material_name)
    
    existing = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.supplier_id == sup_id,
        models.SupplierMaterial.material_name == norm_name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Material already exists in your catalog.")

    new_mat = models.SupplierMaterial(
        supplier_id=sup_id,
        material_name=norm_name,
        brand=mat.brand,               
        quantity=mat.quantity,         
        unit=mat.unit,                 
        price=mat.price,
        stock_level=mat.stock_level
    )
    db.add(new_mat)
    db.commit()
    return {"status": "success", "message": f"Added {norm_name} to catalog."}

@app.patch("/seller/materials/{material_id}", tags=["Seller Portal"])
def update_seller_material(
    material_id: int, 
    price: float = Body(None), 
    stock_level: str = Body(None), 
    brand: str = Body(None),
    quantity: float = Body(None),
    unit: str = Body(None),
    token: str = Depends(oauth2_scheme), 
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sup_id = ensure_supplier_profile(user, db)

    material = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.id == material_id, models.SupplierMaterial.supplier_id == sup_id
    ).first()
    if not material: raise HTTPException(status_code=404, detail="Material not found in your catalog.")
    
    if price is not None: material.price = price
    if stock_level is not None: material.stock_level = stock_level
    if brand is not None: material.brand = brand
    if quantity is not None: material.quantity = quantity
    if unit is not None: material.unit = unit
    
    db.commit()
    return {"status": "success", "message": "Catalog updated"}

@app.delete("/seller/materials/{material_id}", tags=["Seller Portal"])
def delete_seller_material(material_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sup_id = ensure_supplier_profile(user, db)
    
    material = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.id == material_id, models.SupplierMaterial.supplier_id == sup_id
    ).first()
    if not material: raise HTTPException(status_code=404, detail="Material not found.")
    
    db.delete(material)
    db.commit()
    return {"status": "success", "message": "Item removed from catalog"}

@app.get("/seller/orders", tags=["Seller Portal"])
def get_seller_orders(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sup_id = ensure_supplier_profile(user, db)
    
    return db.query(models.PurchaseOrder).filter(models.PurchaseOrder.supplier_id == sup_id).order_by(models.PurchaseOrder.id.desc()).all()

@app.patch("/seller/orders/{order_id}/status", tags=["Seller Portal"])
def update_order_status(order_id: int, status: str = Body(..., embed=True), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    sup_id = ensure_supplier_profile(user, db)
    
    order = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id, models.PurchaseOrder.supplier_id == sup_id
    ).first()
    if not order: raise HTTPException(status_code=404, detail="Order not found.")
    
    order.status = status
    db.commit()
    return {"status": "success", "new_status": order.status}

# --- ADVISORY ENGINE & RAG CHATBOT ---
@app.get("/advisory/auto-restock/{site_id}/{item_name}/{quantity_needed}", tags=["Advisory"])
def get_smart_restock_options(site_id: int, item_name: str, quantity_needed: float, db: Session = Depends(get_db)):
    target_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    norm_name = normalize_item_name(item_name)
    options = []

    surplus_items = db.query(models.Inventory).filter(
        models.Inventory.item_name == norm_name,
        models.Inventory.status == "Surplus",
        models.Inventory.site_id != site_id
    ).all()

    for item in surplus_items:
        source_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
        dist = compute_distance(target_site.latitude, target_site.longitude, source_site.latitude, source_site.longitude)
        est_cost = calculate_transfer_cost(dist) 
        
        options.append({
            "type": "INTERNAL_TRANSFER",
            "source_name": source_site.site_name,
            "source_id": source_site.id,
            "distance_km": round(dist, 2),
            "estimated_total_cost": est_cost,
            "recommendation_reason": f"Surplus available. Logistics cost: ₱{est_cost}"
        })

    external_materials = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.material_name == norm_name,
        models.SupplierMaterial.stock_level.in_(["Available", "High", "Medium"])
    ).all()

    for mat in external_materials:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == mat.supplier_id).first()
        dist = compute_distance(target_site.latitude, target_site.longitude, supplier.latitude, supplier.longitude)
        est_cost = calculate_procurement_cost(mat.price, quantity_needed, dist)
        
        options.append({
            "type": "EXTERNAL_PURCHASE",
            "source_name": supplier.name,
            "source_id": supplier.id,
            "distance_km": round(dist, 2),
            "estimated_total_cost": est_cost,
            "recommendation_reason": f"Unit price ₱{mat.price}. Total cost with delivery: ₱{est_cost}"
        })

    return sorted(options, key=lambda x: x["estimated_total_cost"])

@app.get("/advisory/procure/{site_id}/{item_name}", tags=["Advisory"])
def procure_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
        
    norm_name = normalize_item_name(item_name)
    suppliers = db.query(models.Supplier).all()
    recommendations = []
    
    for s in suppliers:
        dist = compute_distance(site.latitude, site.longitude, s.latitude, s.longitude)
        travel_time = get_real_travel_time(site.latitude, site.longitude, s.latitude, s.longitude)
        
        specific_material = db.query(models.SupplierMaterial).filter(
            models.SupplierMaterial.supplier_id == s.id,
            models.SupplierMaterial.material_name == norm_name
        ).first()

        actual_rating = specific_material.delivery_rating if (specific_material and hasattr(specific_material, 'delivery_rating') and specific_material.delivery_rating > 0) else s.quality_rating
        predicted_score = (actual_rating * 10) - (dist * 1.5)
        
        if getattr(s, 'is_sister_company', False): predicted_score += 15
        if specific_material: predicted_score += 5

        recommendations.append({
            "supplier": s.name, 
            "distance_km": round(dist, 2), 
            "travel_time_mins": travel_time,
            "score": round(max(5, min(99, predicted_score)), 2), 
            "contact": s.contact, 
            "is_sister": getattr(s, 'is_sister_company', False),
            "specific_match": bool(specific_material)
        })
            
    return sorted(recommendations, key=lambda x: x['score'], reverse=True)

class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@app.post("/advisory/chat", tags=["Advisory"])
def chat_with_ai(req: ChatRequest = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"reply": "⚠️ **System Error:** GEMINI_API_KEY is not set."}
    
    genai.configure(api_key=api_key)

    suppliers = db.query(models.Supplier).all()
    supplier_materials = db.query(models.SupplierMaterial).all()
    
    if current_user.role in ["admin", "owner"]:
        surplus_data = db.query(models.Inventory).filter(models.Inventory.status == "Surplus").all()
    else:
        managed_site = getattr(current_user, "managed_site_id", None)
        if managed_site:
            surplus_data = db.query(models.Inventory).filter(
                models.Inventory.status == "Surplus", models.Inventory.site_id == managed_site
            ).all()
        else:
            surplus_data = db.query(models.Inventory).filter(models.Inventory.status == "Surplus").all()

    supplier_context = "VERIFIED PENTABUILD SUPPLIERS:\n"
    for s in suppliers:
        supplier_context += f"- {s.name} | General Rating: {s.quality_rating}/5\n"

    mat_context = "\nKNOWN SUPPLIER CATALOGS:\n"
    for sm in supplier_materials:
        sup = next((s for s in suppliers if s.id == sm.supplier_id), None)
        sup_name = sup.name if sup else "Unknown"
        mat_context += f"- {sup_name} sells {sm.material_name} at ₱{sm.price}\n"

    internal_context = "\nINTERNAL PROJECT SURPLUS (Available for Transfer):\n"
    if not surplus_data:
        internal_context += "- No internal surplus reported.\n"
    else:
        for item in surplus_data:
            site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
            site_name = site.site_name if site else "Unknown Site"
            internal_context += f"- {item.item_name} ({item.brand}) | Qty: {item.quantity} {item.unit} | Location: {site_name} (Site ID: {item.site_id})\n"

    system_instruction = f"""You are MatTrack AI, an intelligent, bilingual enterprise logistics advisor for Pentabuild Construction.

    [LANGUAGE CAPABILITIES]:
    - You MUST fluidly understand and respond in Tagalog, English, or Taglish (Filipino construction terminology).
    - Map Filipino construction terms automatically (e.g., 'buhangin' -> Sand, 'pako' -> Nails, 'semento' -> Portland Cement, 'kabilya' -> Rebar/Steel Bars, 'bato' -> Gravel).

    [LIVE RAG DATABASE CONTEXT]:
    {internal_context}
    {supplier_context}
    {mat_context}

    [DECISION LOGIC & RULES]:
    1. ALWAYS prioritize INTERNAL PROJECT SURPLUS before external purchasing. If surplus exists, recommend an internal site-to-site transfer.
    2. CRITICAL ACTION TAG: If you recommend an internal transfer, you MUST append this exact command tag at the very end of your reply: [TRANSFER:site_id:item_name:brand:quantity:unit] (Example: [TRANSFER:2:portland cement:republic:100:Bags]).
    3. If internal surplus is insufficient, recommend the highest-rated or cheapest verified external external supplier from our catalog.
    4. If the user asks for prevailing hardware market prices not found in the local catalog, estimate standard Philippine construction retail prices based on current market grounding and inform them it is an estimated market baseline.
    5. Be helpful, professional, and structure your responses with clear formatting and bullet points.
    """

    try:
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        selected_model = next((m for m in available_models if 'flash' in m), available_models[0])
            
        model = genai.GenerativeModel(model_name=selected_model)
        full_prompt = f"{system_instruction}\n\n--- USER REQUEST ---\n{req.message}"
        
        response = model.generate_content(full_prompt)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"⚠️ **AI Error:** {str(e)}"}
    
@app.get("/")
def health_check():
    return {"status": "online", "system": "MatTrack PRO Core", "version": "2.3.0"}