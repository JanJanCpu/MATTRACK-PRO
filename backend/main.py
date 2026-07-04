from fastapi import FastAPI, Depends, HTTPException, status, Request, Body
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import math
import requests
import datetime
import uuid
from pytz import timezone 
import jose
from jose import jwt
from passlib.context import CryptContext
from datetime import timezone as dt_timezone

# --- AI INTEGRATION IMPORTS ---
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load environment variables from the .env file automatically!
load_dotenv()

import models, schemas
from database import engine, get_db

app = FastAPI(title="MatTrack PRO API", version="2.0.0")

# TEMPORARILY OPEN CORS FOR MOBILE TESTING
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

models.Base.metadata.create_all(bind=engine) 

SECRET_KEY = "SUPER_SECRET_SECURITY_TOKEN_REPLACE_THIS_FOR_PRODUCTION"
ALGORITHM = "HS256"

PH_TZ = timezone('Asia/Manila')

def get_local_time_string(dt_object):
    if not dt_object: return "Unknown Time"
    # Ensure it's offset-aware, then convert
    if dt_object.tzinfo is None:
        dt_object = dt_object.replace(tzinfo=dt_timezone.utc)
    local_dt = dt_object.astimezone(PH_TZ)
    return local_dt.strftime("%b %d, %Y - %I:%M %p")

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto"
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=8)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

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
    """Calculates the estimated cost of sending a Pentabuild truck to transfer surplus."""
    FUEL_PRICE_PHP = 65.00 # Current avg price per liter
    TRUCK_KM_PER_LITER = 6.0 # Heavy logistics truck efficiency
    DISPATCH_FEE = 300.00 # Base cost for driver time/labor
    
    fuel_cost = (distance_km / TRUCK_KM_PER_LITER) * FUEL_PRICE_PHP
    return round(fuel_cost + DISPATCH_FEE, 2)

def calculate_procurement_cost(unit_price: float, quantity: float, distance_km: float):
    """Calculates the cost of buying external hardware + supplier delivery fees."""
    SUPPLIER_DELIVERY_RATE = 25.00 # ₱25 per kilometer delivery fee
    
    material_cost = unit_price * quantity
    delivery_fee = distance_km * SUPPLIER_DELIVERY_RATE
    return round(material_cost + delivery_fee, 2)

# --- AUTH & USER ROUTES ---
@app.post("/register", response_model=schemas.UserResponse, tags=["Auth"])
def register_user(user: schemas.UserCreate = Body(...), db: Session = Depends(get_db)):
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed = hash_password(user.password)
    new_user = models.User(
        username=user.username, email=user.email, hashed_password=hashed,
        role=user.role, company_name=user.company_name
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
    
    dummy_session = models.ActiveSession(
        user_id=user.id, token=str(uuid.uuid4()), device_info="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome", 
        ip_address="112.204.1.99", created_at=datetime.datetime.utcnow() - datetime.timedelta(days=2)
    )
    db.add(dummy_session)
    
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
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role in ["owner", "admin"]:
        return db.query(models.ProjectSite).all()
    return db.query(models.ProjectSite).filter(models.ProjectSite.manager_id == user_id).all()

@app.post("/sites/", response_model=schemas.SiteResponse, status_code=status.HTTP_201_CREATED, tags=["Sites"])
def create_site(site: schemas.SiteCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    assigned_manager = site.manager_id
    if user_role == "staff":
        assigned_manager = user_id

    db_site = models.ProjectSite(site_name=site.name, address=site.address, latitude=site.lat, longitude=site.lon, manager_id=assigned_manager)
    db.add(db_site)
    db.commit()
    db.refresh(db_site)
    return db_site

@app.patch("/sites/{site_id}/progress", response_model=schemas.SiteResponse, tags=["Sites"])
def update_site_progress(site_id: int, req: schemas.SiteProgressUpdate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_role: str = payload.get("role", "").lower()
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
    
    if user_role == "staff" and site.manager_id != user_id:
        raise HTTPException(status_code=403, detail="Unauthorized write operation")
        
    site.stage_status = req.stage_status
    site.progress_percentage = req.progress_percentage
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
        inv_data = transaction.dict(exclude={"supplier_id", "batch_rating"})
        item = models.Inventory(**inv_data)
        db.add(item)
        action_text = f"Initialized {transaction.quantity} {transaction.unit} of new item: {transaction.item_name}."

    if hasattr(transaction, 'supplier_id') and transaction.supplier_id and hasattr(transaction, 'batch_rating') and transaction.batch_rating:
        sup_mat = db.query(models.SupplierMaterial).filter(
            models.SupplierMaterial.supplier_id == transaction.supplier_id,
            models.SupplierMaterial.material_name == transaction.item_name
        ).first()

        if sup_mat:
            if sup_mat.delivery_rating == 0.0:
                sup_mat.delivery_rating = transaction.batch_rating
            else:
                sup_mat.delivery_rating = (sup_mat.delivery_rating + transaction.batch_rating) / 2
        else:
            new_sup_mat = models.SupplierMaterial(
                supplier_id=transaction.supplier_id,
                material_name=transaction.item_name,
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
    
    if transaction.status == "Critical" or transaction.quantity <= 0:
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
            broadcast_msg = f"NETWORK ALERT: {site_name} is facing a critical shortage of {transaction.item_name}. If you have surplus, please initiate a transfer to assist them."
            n = models.Notification(user_id=r_id, title="Nearby Critical Shortage", message=broadcast_msg, link="/inventory")
            db.add(n)

    db.commit()
    return {"status": "Success", "message": full_msg}

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
                raise HTTPException(status_code=403, detail=f"SECURITY BLOCK: CSV contains data for Site ID {item_data.site_id} which you are not authorized to manage. Please remove those rows.")

    added_count = 0
    updated_materials = 0

    for item_data in items:
        existing_item = db.query(models.Inventory).filter(
            models.Inventory.site_id == item_data.site_id,
            models.Inventory.item_name == item_data.item_name,
            models.Inventory.brand == item_data.brand
        ).first()

        if existing_item:
            existing_item.quantity += item_data.quantity
        else:
            inv_data = item_data.dict(exclude={"supplier_id", "batch_rating"})
            new_item = models.Inventory(**inv_data)
            db.add(new_item)
        
        added_count += 1

        if item_data.supplier_id and item_data.batch_rating:
            supplier_exists = db.query(models.Supplier).filter(models.Supplier.id == item_data.supplier_id).first()
            if supplier_exists:
                sup_mat = db.query(models.SupplierMaterial).filter(
                    models.SupplierMaterial.supplier_id == item_data.supplier_id,
                    models.SupplierMaterial.material_name == item_data.item_name
                ).first()

                if sup_mat:
                    if sup_mat.delivery_rating == 0.0:
                        sup_mat.delivery_rating = item_data.batch_rating
                    else:
                        sup_mat.delivery_rating = (sup_mat.delivery_rating + item_data.batch_rating) / 2
                else:
                    new_sup_mat = models.SupplierMaterial(
                        supplier_id=item_data.supplier_id,
                        material_name=item_data.item_name,
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
    # 1. Query the logs from the database
    audit_logs = db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(20).all()
    
    # 2. Use the same variable name 'audit_logs' in the loop
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

@app.post("/requests/{request_id}/receive", tags=["Procurement"])
def receive_material_request(request_id: int, db: Session = Depends(get_db)):
    # 1. Find the request
    req = db.query(models.MaterialRequest).filter(models.MaterialRequest.id == request_id).first()
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")

    # 2. Add to Inventory
    # Check if item exists at site to update quantity, else create new
    item = db.query(models.Inventory).filter(
        models.Inventory.site_id == req.site_id,
        models.Inventory.item_name == req.item_name
    ).first()

    if item:
        item.quantity += req.quantity_needed
    else:
        new_item = models.Inventory(
            site_id=req.site_id,
            item_name=req.item_name,
            quantity=req.quantity_needed,
            unit="Pcs", # You might want to make this dynamic later
            status="Healthy"
        )
        db.add(new_item)

    # 3. Remove/Update Request
    req.status = "Received"
    db.commit()
    return {"status": "success", "message": "Item added to inventory"}

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

# --- MATERIAL TRANSFERS ---
class TransferCreate(BaseModel):
    item_name: str
    brand: str
    quantity: float
    unit: str
    source_site_id: int
    destination_site_id: int

@app.post("/transfers/initiate", tags=["Transfers"])
def initiate_transfer(req: TransferCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    source_item = db.query(models.Inventory).filter(
        models.Inventory.site_id == req.source_site_id,
        models.Inventory.item_name == req.item_name,
        models.Inventory.brand == req.brand
    ).first()

    if not source_item or source_item.quantity < req.quantity:
        raise HTTPException(status_code=400, detail="Insufficient stock at source site to transfer.")

    source_item.quantity -= req.quantity
    is_asset = source_item.unit in ["Unit", "Set"]
    
    if source_item.quantity == 0:
        source_item.status = "In Use" if is_asset else "Critical"
    elif source_item.quantity <= 10 and not is_asset:
        source_item.status = "Low Stock"

    new_transfer = models.MaterialTransfer(
        item_name=req.item_name, brand=req.brand, quantity=req.quantity,
        unit=req.unit, source_site_id=req.source_site_id,
        destination_site_id=req.destination_site_id,
        status=models.TransferStatus.IN_TRANSIT.value
    )
    db.add(new_transfer)

    audit_msg = f"User [{username}]: Dispatched {req.quantity} {req.unit} of {req.item_name} from Site ID {req.source_site_id} to Site ID {req.destination_site_id}."
    
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)

    notif = models.Notification(user_id=user_id, title="Transfer Dispatched", message=audit_msg, link="/logistics")
    db.add(notif)
    
    dest_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == req.destination_site_id).first()
    if dest_site and dest_site.manager_id:
        rcv_notif = models.Notification(user_id=dest_site.manager_id, title="Incoming Delivery", message=f"User [{username}]: A truck is en route with {req.quantity} {req.unit} of {req.item_name}.", link="/projects")
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
    transfer.received_at = datetime.datetime.utcnow()

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
            item_name=transfer.item_name, brand=transfer.brand, quantity=transfer.quantity,
            unit=transfer.unit, status="Available" if is_asset else "Healthy",
            fsn_status="FAST", site_id=transfer.destination_site_id
        )
        db.add(new_item)

    audit_msg = f"User [{username}]: Received {transfer.quantity} {transfer.unit} of {transfer.item_name} (Transfer ID: {transfer.id})."
    
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)
    
    notif = models.Notification(user_id=user_id, title="Delivery Received", message=audit_msg, link="/inventory")
    db.add(notif)

    db.commit()
    return {"status": "Success", "message": "Transfer received successfully."}

class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    site_id: int
    material_name: str
    quantity: float
    total_price: float

@app.post("/inventory/purchase-orders", tags=["Logistics"])
def create_purchase_order(req: PurchaseOrderCreate = Body(...), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        username: str = payload.get("sub")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    # 1. Create the official PO in the database
    new_order = models.PurchaseOrder(
        supplier_id=req.supplier_id,
        site_id=req.site_id,
        material_name=req.material_name,
        quantity=req.quantity,
        total_price=req.total_price,
        status="Pending"
    )
    db.add(new_order)
    
    # 2. Log it for the SOC and Audit Trail
    audit_msg = f"User [{username}]: Initiated external Purchase Order for {req.quantity} units of {req.material_name} (Total: ₱{req.total_price})."
    audit_log = models.ActivityLog(user_id=user_id, action=audit_msg)
    db.add(audit_log)
    
    db.commit()
    return {"status": "Success", "message": "Purchase order sent to supplier."}

# --- SUPPLIERS ---
@app.get("/suppliers/", response_model=List[schemas.SupplierResponse], tags=["Logistics"])
def list_suppliers(db: Session = Depends(get_db)):
    return db.query(models.Supplier).all()

@app.post("/suppliers/", response_model=schemas.SupplierResponse, tags=["Logistics"])
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
                
        new_mat = models.SupplierMaterial(supplier_id=new_s.id, material_name=s.material, price=clean_price, stock_level=s.stockLevel)
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

@app.get("/suppliers/{supplier_id}/catalog", tags=["Suppliers"])
def get_supplier_catalog(supplier_id: int, db: Session = Depends(get_db)):
    # Verify the supplier exists first (Optional but good practice)
    supplier = db.query(models.Supplier).filter(models.Supplier.id == supplier_id).first()
    if not supplier:
        raise HTTPException(status_code=404, detail="Supplier not found")
        
    # Query the materials linked to this supplier
    catalog = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.supplier_id == supplier_id
    ).all()
    
    return catalog

@app.get("/seller/materials", response_model=List[schemas.SupplierMaterialResponse], tags=["Seller Portal"])
def get_seller_catalog(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. Decode token and verify "seller" role
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
        user_role: str = payload.get("role", "").lower()
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")

    if user_role != "seller":
        raise HTTPException(status_code=403, detail="Unauthorized: Sellers only.")

    # 2. Fetch the user to get their supplier_id
    user = db.query(models.User).filter(models.User.id == user_id).first()
    
    if not user or not user.supplier_id:
        raise HTTPException(status_code=400, detail="Seller account not linked.")

    # 3. Query ONLY the materials linked to this specific supplier
    catalog = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.supplier_id == user.supplier_id
    ).all()
    
    return catalog

@app.patch("/seller/materials/{material_id}", tags=["Seller Portal"])
def update_seller_material(material_id: int, price: float = Body(None), stock_level: str = Body(None), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. Authenticate user
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.supplier_id:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # 2. Find and update material
    material = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.id == material_id,
        models.SupplierMaterial.supplier_id == user.supplier_id # Security constraint!
    ).first()
    
    if not material: raise HTTPException(status_code=404, detail="Material not found in your catalog.")
    
    if price is not None: material.price = price
    if stock_level is not None: material.stock_level = stock_level
    
    db.commit()
    return {"status": "success", "message": "Catalog updated"}

@app.delete("/seller/materials/{material_id}", tags=["Seller Portal"])
def delete_seller_material(material_id: int, token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. Authenticate user
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.supplier_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # 2. Find and delete material
    material = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.id == material_id,
        models.SupplierMaterial.supplier_id == user.supplier_id
    ).first()
    
    if not material: raise HTTPException(status_code=404, detail="Material not found.")
    
    db.delete(material)
    db.commit()
    return {"status": "success", "message": "Item removed from catalog"}

@app.get("/seller/orders", tags=["Seller Portal"])
def get_seller_orders(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. Authenticate user
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.supplier_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # 2. Fetch orders
    orders = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.supplier_id == user.supplier_id
    ).order_by(models.PurchaseOrder.id.desc()).all()
    
    return orders

@app.patch("/seller/orders/{order_id}/status", tags=["Seller Portal"])
def update_order_status(order_id: int, status: str = Body(..., embed=True), token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    # 1. Authenticate user
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("id")
    except jose.JWTError:
        raise HTTPException(status_code=401, detail="Invalid Session")
        
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user or not user.supplier_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    # 2. Find and update order
    order = db.query(models.PurchaseOrder).filter(
        models.PurchaseOrder.id == order_id,
        models.PurchaseOrder.supplier_id == user.supplier_id
    ).first()
    
    if not order: raise HTTPException(status_code=404, detail="Order not found.")
    
    order.status = status
    db.commit()
    
    return {"status": "success", "new_status": order.status}

@app.get("/advisory/auto-restock/{site_id}/{item_name}/{quantity_needed}", tags=["Advisory"])
def get_smart_restock_options(site_id: int, item_name: str, quantity_needed: float, db: Session = Depends(get_db)):
    target_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    options = []

    # --- 1. CHECK INTERNAL SURPLUS ---
    surplus_items = db.query(models.Inventory).filter(
        models.Inventory.item_name == item_name,
        models.Inventory.status == "Surplus",
        models.Inventory.site_id != site_id
    ).all()

    for item in surplus_items:
        source_site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
        dist = compute_distance(target_site.latitude, target_site.longitude, source_site.latitude, source_site.longitude)
        
        # A transfer means the material is technically "free", we just pay for logistics
        est_cost = calculate_transfer_cost(dist) 
        
        options.append({
            "type": "INTERNAL_TRANSFER",
            "source_name": source_site.site_name,
            "source_id": source_site.id,
            "distance_km": round(dist, 2),
            "estimated_total_cost": est_cost,
            "recommendation_reason": f"Surplus available. Logistics cost: ₱{est_cost}"
        })

    # --- 2. CHECK EXTERNAL SUPPLIERS ---
    external_materials = db.query(models.SupplierMaterial).filter(
        models.SupplierMaterial.material_name == item_name,
        models.SupplierMaterial.stock_level.in_(["Available", "High", "Medium"])
    ).all()

    for mat in external_materials:
        supplier = db.query(models.Supplier).filter(models.Supplier.id == mat.supplier_id).first()
        dist = compute_distance(target_site.latitude, target_site.longitude, supplier.latitude, supplier.longitude)
        
        # Buying means we pay for the material PLUS delivery
        est_cost = calculate_procurement_cost(mat.price, quantity_needed, dist)
        
        options.append({
            "type": "EXTERNAL_PURCHASE",
            "source_name": supplier.name,
            "source_id": supplier.id,
            "distance_km": round(dist, 2),
            "estimated_total_cost": est_cost,
            "recommendation_reason": f"Unit price ₱{mat.price}. Total cost with delivery: ₱{est_cost}"
        })

    # --- 3. RETURN RANKED BY CHEAPEST OPTION ---
    ranked_options = sorted(options, key=lambda x: x["estimated_total_cost"])
    return ranked_options

# --- ADVISORY (DETERMINISTIC HEURISTIC) ---
@app.get("/advisory/procure/{site_id}/{item_name}", tags=["Advisory"])
def procure_advice(site_id: int, item_name: str, db: Session = Depends(get_db)):
    site = db.query(models.ProjectSite).filter(models.ProjectSite.id == site_id).first()
    if not site: raise HTTPException(status_code=404, detail="Site not found")
        
    suppliers = db.query(models.Supplier).all()
    recommendations = []
    
    for s in suppliers:
        dist = compute_distance(site.latitude, site.longitude, s.latitude, s.longitude)
        travel_time = get_real_travel_time(site.latitude, site.longitude, s.latitude, s.longitude)
        
        specific_material = db.query(models.SupplierMaterial).filter(
            models.SupplierMaterial.supplier_id == s.id,
            models.SupplierMaterial.material_name == item_name
        ).first()

        actual_rating = specific_material.delivery_rating if (specific_material and hasattr(specific_material, 'delivery_rating') and specific_material.delivery_rating > 0) else s.quality_rating
        
        predicted_score = (actual_rating * 10) - (dist * 1.5)
        
        if getattr(s, 'is_sister_company', False): predicted_score += 15

        if specific_material:
            predicted_score += 5

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

class MaterialRequestCreate(BaseModel):
    site_id: int
    item_name: str
    quantity: int
    status: str = "Pending"

    # Create the endpoint that matches the frontend API call
from datetime import datetime

@app.get("/requests/", tags=["Procurement"])
def get_material_requests(db: Session = Depends(get_db)):
    return db.query(models.MaterialRequest).all()

@app.post("/requests/", tags=["Procurement"])
def create_material_request(req: MaterialRequestCreate, db: Session = Depends(get_db)):
    # Note: Use 'quantity_needed' to match your models.py
    new_request = models.MaterialRequest(
        site_id=req.site_id,
        item_name=req.item_name,
        quantity_needed=req.quantity,
        status=req.status
    )
    db.add(new_request)
    db.commit()
    db.refresh(new_request)
    return new_request

# --- LIVE RAG-POWERED AI CHATBOT ROUTE ---
class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@app.post("/advisory/chat", tags=["Advisory"])
def chat_with_ai(req: ChatRequest = Body(...), db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # 1. Authenticate the AI Engine
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"reply": "⚠️ **System Error:** GEMINI_API_KEY is not set."}
    
    genai.configure(api_key=api_key)

    # 2. Build the Live RAG Context (Internal Surplus + External Suppliers)
    suppliers = db.query(models.Supplier).all()
    supplier_materials = db.query(models.SupplierMaterial).all()
    surplus_data = db.query(models.Inventory).filter(models.Inventory.status == "Surplus").all()
    
    # 🔒 SECURITY FILTER: If they are 'staff', they can only see surplus at their site or public pool sites
    if current_user.role == "admin":
        # Admins can see surplus everywhere
        surplus_data = db.query(models.Inventory).filter(models.Inventory.status == "Surplus").all()
    else:
        # Staff can only see surplus assigned to their specific managed site or open public sites
        surplus_data = db.query(models.Inventory).filter(
            models.Inventory.status == "Surplus",
            models.Inventory.site_id == current_user.managed_site_id
        ).all()

    # Context String: Suppliers
    supplier_context = "VERIFIED PENTABUILD SUPPLIERS:\n"
    for s in suppliers:
        supplier_context += f"- {s.name} | General Rating: {s.quality_rating}/5\n"

    # Context String: Materials
    mat_context = "\nKNOWN SUPPLIER CATALOGS:\n"
    for sm in supplier_materials:
        sup = next((s for s in suppliers if s.id == sm.supplier_id), None)
        sup_name = sup.name if sup else "Unknown"
        mat_context += f"- {sup_name} sells {sm.material_name}\n"

    # Context String: Internal Surplus
    internal_context = "\nINTERNAL PROJECT SURPLUS (Available for Transfer):\n"
    if not surplus_data:
        internal_context += "- No internal surplus reported.\n"
    else:
        for item in surplus_data:
            site = db.query(models.ProjectSite).filter(models.ProjectSite.id == item.site_id).first()
            site_name = site.site_name if site else "Unknown Site"
            internal_context += f"- {item.item_name} ({item.brand}) | Qty: {item.quantity} {item.unit} | Location: {site_name} (Site ID: {item.site_id})\n"

    # 3. System Instructions
    # 3. System Instructions
    system_instruction = f"""You are MatTrack AI, an enterprise procurement and logistics advisor.

    [LIVE DATABASE CONTEXT]:
    {internal_context}
    {supplier_context}
    {mat_context}

    [DECISION LOGIC]:
    - ALWAYS check the INTERNAL PROJECT SURPLUS list first. 
    - If a material is available in the surplus list, explicitly recommend an internal transfer and name the site.
    - CRITICAL: If you recommend a transfer, you MUST append this exact command tag at the very end of your response: [TRANSFER:site_id:item_name:brand:quantity:unit] (Example: [TRANSFER:2:Portland Cement:Republic:120:Bags])
    - Only recommend external procurement if the surplus is insufficient or non-existent.
    - Be concise, professional, and use bullet points.
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
    return {"status": "online", "system": "MatTrack PRO Core", "version": "2.0.0"}