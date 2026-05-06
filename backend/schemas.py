from pydantic import BaseModel, Field
from typing import List, Dict, Optional

# --- SHARED ---
class MessageResponse(BaseModel):
    status: str
    message: str

# --- SITE ---
class SiteBase(BaseModel):
    name: str = Field(..., alias="site_name") # Maps 'name' from Vite to 'site_name' in DB
    lat: float = Field(..., alias="latitude")
    lon: float = Field(..., alias="longitude")

    class Config:
        populate_by_name = True # Allows using both 'lat' and 'latitude'

class SiteCreate(BaseModel):
    name: str
    lat: float
    lon: float

class SiteResponse(SiteBase):
    id: int
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

# --- SUPPLIER ---
class SupplierBase(BaseModel):
    name: str
    contact: str
    lat: float = Field(..., alias="latitude")
    lon: float = Field(..., alias="longitude")
    rating: float = Field(..., alias="quality_rating")

class SupplierCreate(BaseModel):
    name: str
    contact: str
    lat: float
    lon: float
    rating: float

class SupplierResponse(SupplierBase):
    id: int
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