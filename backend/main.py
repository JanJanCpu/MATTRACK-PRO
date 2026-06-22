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
    local_dt = dt_object.replace(tzinfo=datetime.timezone.utc).astimezone(PH_TZ)
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

@app.get("/inventory/audit-logs", tags=["Inventory"])
def get_recent_audit_logs(db: Session = Depends(get_db)):
    logs = db.query(models.ActivityLog).order_by(models.ActivityLog.id.desc()).limit(20).all()
    
    formatted_logs = []
    for log in logs:
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

# --- LIVE RAG-POWERED AI CHATBOT ROUTE ---
class ChatRequest(BaseModel):
    message: str
    context: Optional[dict] = None

@app.post("/advisory/chat", tags=["Advisory"])
def chat_with_ai(req: ChatRequest = Body(...), db: Session = Depends(get_db)):
    # 1. Authenticate the AI Engine
    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return {"reply": "⚠️ **System Error:** GEMINI_API_KEY is not set in the backend environment. Please set the variable and restart Uvicorn."}
    
    genai.configure(api_key=api_key)

    # 2. Build the Live RAG Context (Retrieval-Augmented Generation)
    suppliers = db.query(models.Supplier).all()
    supplier_context = "VERIFIED PENTABUILD SUPPLIERS:\n"
    for s in suppliers:
        supplier_context += f"- {s.name} | General Rating: {s.quality_rating}/5 | Location Lat/Lon: {s.latitude}, {s.longitude}\n"

    supplier_materials = db.query(models.SupplierMaterial).all()
    mat_context = "\nKNOWN SUPPLIER CATALOGS & BATCH RATINGS:\n"
    for sm in supplier_materials:
        sup_name = next((s.name for s in suppliers if s.id == sm.supplier_id), "Unknown")
        rating = getattr(sm, 'delivery_rating', 'N/A')
        mat_context += f"- {sup_name} sells {sm.material_name} (Delivery Rating: {rating}/5)\n"

    # =====================================================================
    # 3. THE PARAMETERS (Softened Enterprise System Prompt Guardrails)
    # =====================================================================
    system_instruction = f"""You are MatTrack AI, an enterprise procurement and logistics advisor for Pentabuild construction.

    [SECURITY & SCOPE]:
    - You are an expert in construction logistics, materials, and supplier sourcing.
    - If a user asks a question completely unrelated to construction, business, or your reasoning (e.g., video games, cooking), respectfully decline with a Security Override message.
    - However, you MUST allow conversational follow-ups. If a user asks "how did you know?" or "why did you pick them?", explicitly explain your reasoning using the provided database context.
    - You are allowed to use your general AI knowledge to answer standard construction questions (e.g., "what is a threaded rod used for?", "what should I look out for when buying cement?").

    [VAGUENESS & ASSISTANCE]:
    - If the user's request is vague (e.g., "I need stuff" or "I need steel rebars"), DO NOT block them. Instead, be helpful! Give a general recommendation based on the verified suppliers below, and politely ask them to clarify the specific project site and quantity needed so you can finalize a dispatch.

    [LIVE DATABASE CONTEXT]:
    Use the following real-time database records to answer the user's question. Do NOT invent or hallucinate suppliers.
    {supplier_context}
    {mat_context}

    [BEHAVIOR]:
    - Be concise, highly professional, and analytical. Use bullet points for readability.
    - If asked to source a material, recommend the supplier with the highest rating for that specific material.
    - If asked to write a dispatch message, write a short 2-sentence WhatsApp-style message the manager can copy-paste.
    """
    # =====================================================================

    try:
        # 4. DYNAMIC MODEL SELECTION
        # Instead of guessing the model name, ask Google what models your specific API key is allowed to use!
        available_models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        if not available_models:
            return {"reply": "⚠️ **AI Routing Error:** Your API key is valid, but Google is not providing any accessible models for your region/tier."}
            
        # Try to grab a fast 'flash' model, otherwise just use whatever Google gives us first
        selected_model = available_models[0]
        for m_name in available_models:
            if 'flash' in m_name:
                selected_model = m_name
                break
                
        print(f"--- SUCCESS: Connected to Google AI. Using model: {selected_model} ---")
        
        # Call the Live LLM with the dynamically verified model
        model = genai.GenerativeModel(model_name=selected_model)
        
        # Inject the system instructions directly into the prompt to guarantee compatibility
        full_prompt = f"{system_instruction}\n\n--- USER REQUEST ---\n{req.message}"
        
        response = model.generate_content(full_prompt)
        return {"reply": response.text}
    except Exception as e:
        return {"reply": f"⚠️ **AI Routing Error:** Failed to communicate with the neural network. Details: {str(e)}"}

@app.get("/")
def health_check():
    return {"status": "online", "system": "MatTrack PRO Core", "version": "2.0.0"}