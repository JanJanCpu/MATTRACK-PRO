from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# --- SHARED ---
class MessageResponse(BaseModel):
    status: str
    message: str

# --- AUTH & USERS ---
class UserBase(BaseModel):
    username: str
    email: EmailStr
    role: str

class UserCreate(UserBase):
    password: str
    company_name: Optional[str] = None
    company_address: Optional[str] = None
    company_contact: Optional[str] = None
    company_website: Optional[str] = None
    supplier_id: Optional[int] = None

class UserResponse(UserBase):
    id: int
    company_name: Optional[str] = None
    supplier_id: Optional[int] = None
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class PasswordUpdate(BaseModel):
    current_password: str
    new_password: str

class SessionResponse(BaseModel):
    id: int
    device_info: str
    ip_address: str
    created_at: str
    last_active: str
    is_current_session: bool = False 
    class Config:
        from_attributes = True

# --- ACTIVITY LOGS ---
class ActivityLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    timestamp: str 
    is_security_event: bool = False 
    class Config:
        from_attributes = True

# --- NOTIFICATIONS ---
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    title: str
    message: str
    link: Optional[str] = None 
    is_read: bool
    created_at: str 
    class Config:
        from_attributes = True

# --- SITE ---
class SiteBase(BaseModel):
    name: str = Field(..., alias="site_name") 
    lat: float = Field(..., alias="latitude")
    lon: float = Field(..., alias="longitude")
    class Config:
        populate_by_name = True 

class SiteCreate(BaseModel):
    name: str 
    address: Optional[str] = None 
    lat: float
    lon: float
    manager_id: Optional[int] = None 

class SiteProgressUpdate(BaseModel):
    stage_status: str

class ProjectStatusUpdate(BaseModel):
    stage_status: str

class SiteResponse(BaseModel):
    id: int
    site_name: str
    address: Optional[str] = None 
    latitude: float
    longitude: float
    stage_status: Optional[str] = None 
    progress_percentage: int = 0 
    manager_id: Optional[int] = None 
    class Config:
        from_attributes = True

# --- INVENTORY ---
class InventoryBase(BaseModel):
    item_name: str
    brand: str = "Generic/No Brand"
    quantity: float
    unit: str
    status: str
    fsn_status: str = "FAST"
    site_id: int
    supplier_id: Optional[int] = None
    batch_rating: Optional[float] = None
    baseline_quantity: Optional[float] = 0.0
    is_locked_status: Optional[bool] = False

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    updated_at: datetime 
    baseline_quantity: float
    class Config:
        from_attributes = True

class InventoryStatusOverride(BaseModel):
    status: str 

# --- SUPPLIER MATERIALS ---
class SupplierMaterialBase(BaseModel):
    material_name: str
    price: float
    stock_level: str
    delivery_rating: float = 0.0 

class SupplierMaterialCreate(BaseModel):
    material_name: str
    price: float
    stock_level: str

class SupplierMaterialResponse(SupplierMaterialBase):
    id: int
    supplier_id: int
    brand: Optional[str] = "Generic/No Brand"
    quantity: Optional[float] = 0.0
    unit: Optional[str] = "Pcs"
    class Config:
        from_attributes = True

# --- SUPPLIERS ---
class SupplierBase(BaseModel):
    name: str
    contact: str
    lat: float = Field(..., alias="latitude")
    lon: float = Field(..., alias="longitude")
    rating: float = Field(..., alias="quality_rating")
    is_sister_company: bool = False
    class Config:
        populate_by_name = True

class SupplierCreate(BaseModel):
    name: str
    contact: str
    lat: float
    lon: float
    rating: float
    address: Optional[str] = None
    material: Optional[str] = None
    price: Optional[str] = None
    stockLevel: Optional[str] = "High"

class SupplierResponse(BaseModel):
    id: int
    name: str
    contact: str
    latitude: float
    longitude: float
    quality_rating: float
    is_sister_company: bool
    address: Optional[str] = None
    materials: List[SupplierMaterialResponse] = []
    class Config:
        from_attributes = True

# --- MATERIAL REQUESTS ---
class RequestCreate(BaseModel):
    item_name: str
    brand: str = "Generic/No Brand"
    quantity_needed: float
    unit: str = "Pcs"
    site_id: int

class RequestStatusUpdate(BaseModel):
    status: str

class RequestResponse(RequestCreate):
    id: int
    status: str
    requested_by_id: Optional[int] = None
    created_at: datetime
    class Config:
        from_attributes = True

# --- MATERIAL TRANSFERS ---
class TransferCreate(BaseModel):
    source_site_id: int
    destination_site_id: int
    item_name: str
    brand: str = "Generic/No Brand"
    quantity: float
    unit: str

class TransferResponse(BaseModel):
    id: int
    item_name: str
    brand: str
    quantity: float
    unit: str
    source_site_id: int
    destination_site_id: int
    status: str
    dispatched_at: datetime
    received_at: Optional[datetime] = None
    class Config:
        from_attributes = True

class PurchaseOrderCreate(BaseModel):
    supplier_id: int
    site_id: int
    material_name: str
    quantity: float
    total_price: float