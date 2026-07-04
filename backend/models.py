import datetime
import enum
from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text, Enum as SQLEnum
from sqlalchemy.orm import relationship 
from database import Base

# --- ENUMS for System Logic ---
class UserRole(str, enum.Enum):
    OWNER = "owner"
    ADMIN = "admin"
    STAFF = "staff"
    SELLER = "seller" #new role for suppliers

class FSNStatus(str, enum.Enum):
    FAST = "FAST"
    SLOW = "SLOW"
    NON_MOVING = "NON_MOVING"

class TransferStatus(str, enum.Enum):
    IN_TRANSIT = "IN_TRANSIT"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"

# --- RBAC User Table ---
class User(Base):
    __tablename__ = "users"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(String(20), default=UserRole.STAFF.value, nullable=False)
    
    company_name = Column(String(100), nullable=True)
    company_address = Column(Text, nullable=True)
    company_contact = Column(String(50), nullable=True)
    company_website = Column(String(100), nullable=True)

    supplier_id = Column(Integer, ForeignKey("suppliers.id"), nullable=True)

    logs = relationship("ActivityLog", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    sessions = relationship("ActiveSession", back_populates="user", cascade="all, delete-orphan")

    supplier = relationship("Supplier", back_populates="users")

# --- ISO 27001 Active Session Tracker ---
class ActiveSession(Base):
    __tablename__ = "active_sessions"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    token = Column(String(500), unique=True, index=True, nullable=False)
    device_info = Column(String(255), default="Unknown Device")
    ip_address = Column(String(50), default="Unknown IP")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    last_active = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sessions")

# --- Audit Trail Ledger ---
class ActivityLog(Base):
    __tablename__ = "activity_logs"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(String(255), nullable=False) 
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
    is_security_event = Column(Boolean, default=False) 

    user = relationship("User", back_populates="logs")

# --- Project Sites ---
class ProjectSite(Base):
    __tablename__ = "project_sites"
    __table_args__ = {'extend_existing': True} 
    
    id = Column(Integer, primary_key=True, index=True)
    site_name = Column(String, unique=True, index=True)
    address = Column(String, nullable=True) 
    latitude = Column(Float)
    longitude = Column(Float)
    
    stage_status = Column(String(50), default="Pre-construction") 
    progress_percentage = Column(Integer, default=0) 
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    manager_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    manager = relationship("User")
    
    inventory = relationship("Inventory", back_populates="site")
    requests = relationship("MaterialRequest", back_populates="site")

# --- Inventory ---
class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, index=True)
    brand = Column(String(50), default="Generic/No Brand", nullable=False)
    fsn_status = Column(String(20), default=FSNStatus.FAST.value, nullable=False)
    updated_at = Column(DateTime, default=datetime.datetime.utcnow, onupdate=datetime.datetime.utcnow)

    quantity = Column(Float)
    unit = Column(String)
    status = Column(String) 
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    
    site = relationship("ProjectSite", back_populates="inventory")

# --- Suppliers ---
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
    address = Column(String, nullable=True)

    materials = relationship("SupplierMaterial", back_populates="supplier", cascade="all, delete-orphan")
    
    # ADD THIS LINE RIGHT HERE:
    users = relationship("User", back_populates="supplier")

# --- Supplier Catalog ---
class SupplierMaterial(Base):
    __tablename__ = "supplier_materials"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"))
    material_name = Column(String, index=True)
    price = Column(Float, default=0.0)
    stock_level = Column(String, default="Unknown") 
    
    delivery_rating = Column(Float, default=0.0) 

    supplier = relationship("Supplier", back_populates="materials")

# --- Material Requests ---
class MaterialRequest(Base):
    __tablename__ = "material_requests"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String)
    quantity_needed = Column(Integer)
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    status = Column(String, default="Pending")
    
    site = relationship("ProjectSite", back_populates="requests")

# --- Material Transfers ---
class MaterialTransfer(Base):
    __tablename__ = "material_transfers"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, index=True, nullable=False)
    brand = Column(String(50), default="Generic/No Brand")
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)

    source_site_id = Column(Integer, ForeignKey("project_sites.id"), nullable=False)
    destination_site_id = Column(Integer, ForeignKey("project_sites.id"), nullable=False)
    status = Column(String, default=TransferStatus.IN_TRANSIT.value)

    dispatched_at = Column(DateTime, default=datetime.datetime.utcnow)
    received_at = Column(DateTime, nullable=True)

    source_site = relationship("ProjectSite", foreign_keys=[source_site_id])
    destination_site = relationship("ProjectSite", foreign_keys=[destination_site_id])

# --- User Notifications ---
class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(100), nullable=False)
    message = Column(Text, nullable=False)
    link = Column(String(255), nullable=True) 
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="notifications")

# --- Purchase Orders (Pentabuild -> External Supplier) ---
class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    
    material_name = Column(String)
    quantity = Column(Float)
    total_price = Column(Float)
    
    # Statuses: Pending, Accepted, Shipped, Delivered, Cancelled
    status = Column(String, default="Pending") 
    order_date = Column(DateTime, default=datetime.datetime.utcnow)

    supplier = relationship("Supplier")
    site = relationship("ProjectSite")