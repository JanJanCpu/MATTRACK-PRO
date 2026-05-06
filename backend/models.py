from sqlalchemy import Column, Integer, String, Float, ForeignKey
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

class MaterialRequest(Base):
    __tablename__ = "material_requests"
    __table_args__ = {'extend_existing': True}

    id = Column(Integer, primary_key=True, index=True)
    item_name = Column(String)
    quantity_needed = Column(Integer)
    site_id = Column(Integer, ForeignKey("project_sites.id"))
    status = Column(String, default="Pending")