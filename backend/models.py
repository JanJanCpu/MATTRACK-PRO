import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship 
from database import Base
import enum

# --- ENUMS for System Logic ---
class UserRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"

class FSNStatus(str, enum.Enum):
    FAST = "FAST"
    SLOW = "SLOW"
    NON_MOVING = "NON_MOVING"

# --- NEW: RBAC User Table ---
class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.STAFF.value, nullable=False)
    
    # Owner profile details (Nullable if the user is staff/admin)
    company_name = Column(String(100), nullable=True)
    company_address = Column(Text, nullable=True)
    company_contact = Column(String(50), nullable=True)
    company_website = Column(String(100), nullable=True)

    logs = relationship("ActivityLog", back_populates="user")

# --- NEW: Audit Trail Ledger ---
class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(255), nullable=False) # e.g., "Added 50 bags of Holcim Cement"
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="logs")

# --- MERGED: Project Sites ---
class ProjectSite(Base):
    __tablename__ = "project_sites"
    __table_args__ = {'extend_existing': True} 
    
    id = Column(Integer, primary_key=True, index=True)
    site_name = Column(String, unique=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    
    # NEW Integrations:
    stage_status = Column(String(50), default="Pre-construction") 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    inventory = relationship("Inventory", back_populates="site")
    requests = relationship("MaterialRequest", back_populates="site")

# --- MERGED: Inventory (With FSN & Brand) ---
class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, index=True)
    
    # NEW Integrations:
    brand = Column(String(50), default="Generic/No Brand", nullable=False)
    fsn_status = Column(String(20), default=FSNStatus.FAST.value, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    quantity = Column(Float)
    unit = Column(String)
    status = Column(String) # e.g., "Critical", "Healthy"
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    
    site = relationship("ProjectSite", back_populates="inventory")

# --- EXISTING: Suppliers ---
class Supplier(Base):
    __tablename__ = "suppliers"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    contact = Column(String)
    latitude = Column(Float)
    longitude = Column(Float)
    quality_rating = Column(Float, default=5.0)
    categories = Column(String, nullable=True)
    is_sister_company = Column(Boolean, default=False) 

    # 1-to-Many Relationship to Materials
    materials = relationship("SupplierMaterial", back_populates="supplier", cascade="all, delete-orphan")

# --- EXISTING: Relational Sub-Table for Inventory ---
class SupplierMaterial(Base):
    __tablename__ = "supplier_materials"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"))
    
    material_name = Column(String, index=True)
    price = Column(Float)
    stock_level = Column(String) 

    # Link back to parent
    supplier = relationship("Supplier", back_populates="materials")

# --- EXISTING: Material Requests ---
class MaterialRequest(Base):
    __tablename__ = "material_requests"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String)
    quantity_needed = Column(Integer)
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    status = Column(String, default="Pending")
    
    # Link back to site
    site = relationship("ProjectSite", back_populates="requests")