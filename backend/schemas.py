from pydantic import BaseModel
from typing import List, Optional

class InventoryBase(BaseModel):
    item_name: str
    quantity: int
    unit: str
    status: str
    site_id: int  # <-- This must be an int, not a string

class InventoryCreate(InventoryBase):
    pass

class InventoryResponse(InventoryBase):
    id: int

    class Config:
        from_attributes = True

class SupplierBase(BaseModel):
    name: str
    contact: str
    latitude: float
    longitude: float
    quality_rating: float

class SupplierResponse(SupplierBase):
    id: int

    class Config:
        from_attributes = True

class SupplierCreate(SupplierBase):
    pass

class SiteBase(BaseModel):
    site_name: str
    latitude: float
    longitude: float

class SiteResponse(SiteBase):
    id: int

    class Config:
        from_attributes = True

class RequestCreate(BaseModel):
    item_name: str
    quantity_needed: int
    site_id: int

class RequestResponse(RequestCreate):
    id: int
    status: str
    class Config:
        from_attributes = True

