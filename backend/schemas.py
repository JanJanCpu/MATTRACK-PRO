from pydantic import BaseModel, Field
from typing import List, Optional

# --- SHARED ---
class MessageResponse(BaseModel):
    status: str
    message: str

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

class SiteResponse(BaseModel):
    id: int
    site_name: str
    latitude: float
    longitude: float

    class Config:
        from_attributes = True

# --- INVENTORY ---
class InventoryBase(BaseModel):
    item_name: str
    quantity: float
    unit: str
    status: str
    site_id: int

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int
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