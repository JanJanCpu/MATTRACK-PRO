from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional
from datetime import datetime

# --- SHARED ---
class MessageResponse(BaseModel):
    status: str
    message: str

# --- AUTH & USERS (NEW) ---
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

class UserResponse(UserBase):
    id: int
    company_name: Optional[str] = None
    
    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    token_type: str

class ActivityLogResponse(BaseModel):
    id: int
    user_id: int
    action: str
    timestamp: datetime

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
    lat: float
    lon: float

# NEW: Added SiteProgressUpdate below SiteCreate
class SiteProgressUpdate(BaseModel):
    stage_status: str
    progress_percentage: int

class SiteResponse(BaseModel):
    id: int
    site_name: str
    latitude: float
    longitude: float
    stage_status: Optional[str] = None # Added to match models.py
    progress_percentage: int = 0 # NEW: Added to handle the 0-100 number

    class Config:
        from_attributes = True

# --- INVENTORY (UPDATED) ---
class InventoryBase(BaseModel):
    item_name: str
    brand: str = "Generic/No Brand"  # Added to match models.py
    quantity: float
    unit: str
    status: str
    fsn_status: str = "FAST"         # Added to match models.py
    site_id: int

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
    updated_at: datetime             # Added to match models.py
    
    class Config:
        from_attributes = True

# --- NEW: SUPPLIER MATERIALS ---
class SupplierMaterialBase(BaseModel):
    material_name: str
    price: float
    stock_level: str

class SupplierMaterialCreate(BaseModel):
    material_name: str
    price: float
    stock_level: str

class SupplierMaterialResponse(SupplierMaterialBase):
    id: int
    supplier_id: int
    class Config:
        from_attributes = True

# --- SUPPLIER ---
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
    address: Optional[str] = None  # <--- FIXED: Added missing address field
    # These catch the extra data from your new React Pin Form
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
    address: Optional[str] = None  # <--- FIXED: Added missing address field
    
    # Returns the nested relational data
    materials: List[SupplierMaterialResponse] = []

    class Config:
        from_attributes = True

# --- REQUESTS ---
class RequestCreate(BaseModel):
    item_name: str
    quantity_needed: int
    site_id: int

class RequestResponse(RequestCreate):
    id: int
    status: str
    class Config:
        from_attributes = True