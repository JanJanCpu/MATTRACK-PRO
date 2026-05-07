from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship 
from database import Base

class ProjectSite(Base):
    __tablename__ = "project_sites"
    __table_args__ = {'extend_existing': True} 
    
    id = Column(Integer, primary_key=True, index=True)
    site_name = Column(String, unique=True, index=True)
    latitude = Column(Float)
    longitude = Column(Float)
    
    inventory = relationship("Inventory", back_populates="site")

class Inventory(Base):
    __tablename__ = "inventory"
    __table_args__ = {'extend_existing': True}
    
    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String, index=True)
    quantity = Column(Float)
    unit = Column(String)
    status = Column(String)
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    
    site = relationship("ProjectSite", back_populates="inventory")

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
    is_sister_company = Column(Boolean, default=False) # Added for Logic

    # 1-to-Many Relationship to Materials
    materials = relationship("SupplierMaterial", back_populates="supplier", cascade="all, delete-orphan")

# --- NEW: Relational Sub-Table for Inventory ---
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

class MaterialRequest(Base):
    __tablename__ = "material_requests"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String)
    quantity_needed = Column(Integer)
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    status = Column(String, default="Pending")