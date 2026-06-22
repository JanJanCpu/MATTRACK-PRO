from database import SessionLocal, engine, Base
import models
from passlib.context import CryptContext

# Set up the password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_data():
    # --- THE DROP COMMAND ---
    print("Dropping old database tables to apply new schema changes...")
    Base.metadata.drop_all(bind=engine)

    print("Creating tables in PostgreSQL if they don't exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # 1. Accounts
        print("Seeding default Admin System Owner...")
        admin = models.User(
            username="admin",
            email="admin@pentabuild.com",
            hashed_password=pwd_context.hash("admin123"), # Securely hashes "admin123"
            role="admin",
            company_name="Pentabuild Corp"
        )
        
        print("Seeding a test Staff Member...")
        staff_juan = models.User(
            username="juan_staff",
            email="juan@pentabuild.com",
            hashed_password=pwd_context.hash("staff123"), 
            role="staff",
            company_name="Pentabuild Corp"
        )
        
        # Add both to DB so they both get assigned an ID
        db.add_all([admin, staff_juan])
        db.commit() 

        # 2. Add New Project Sites
        print("Injecting site matrices (Storage, Makati, Paco)...")
        storage = models.ProjectSite(
            site_name="Main Storage", address="Port Area, Manila", 
            latitude=14.6042, longitude=120.9822, manager_id=admin.id # Link to Admin
        )
        makati = models.ProjectSite(
            site_name="Makati Fit-out", address="1200 Ayala Ave, Makati City", 
            latitude=14.5547, longitude=121.0244, manager_id=admin.id # Link to Admin
        )
        paco = models.ProjectSite(
            site_name="Paco CNC Bldg", address="1007 Quirino Ave, Paco, Manila", 
            latitude=14.5826, longitude=120.9931, manager_id=staff_juan.id # <-- STAFF MANAGES PACO
        )
        
        db.add_all([storage, makati, paco])
        db.commit() 

        # 3. Add AI-Compatible Suppliers
        print("Adding AI-ready hardware trading hubs and industrial suppliers...")
        sup1 = models.Supplier(name="SteelAsia Manila", address="Quezon City", contact="0917-123-4567", latitude=14.6000, longitude=121.0000, quality_rating=4.8)
        sup2 = models.Supplier(name="Holcim Philippines", address="Taguig City", contact="0918-987-6543", latitude=14.5500, longitude=121.0500, quality_rating=4.5)
        sup3 = models.Supplier(name="Apex Hardware (Sister Co)", address="Manila", contact="0919-555-8888", latitude=14.6200, longitude=120.9800, quality_rating=3.2, is_sister_company=True)
        db.add_all([sup1, sup2, sup3])
        db.commit()

        # Add Supplier Catalogs (CRITICAL FOR AI RAG CONTEXT)
        print("Injecting Supplier Material Catalogs for AI Advisory Engine...")
        db.add_all([
            models.SupplierMaterial(supplier_id=sup1.id, material_name="Threaded Rod", price=150.00, stock_level="High", delivery_rating=4.9),
            models.SupplierMaterial(supplier_id=sup1.id, material_name="Deformed Rebar 10mm", price=180.00, stock_level="Medium", delivery_rating=4.7),
            models.SupplierMaterial(supplier_id=sup2.id, material_name="Portland Cement", price=240.00, stock_level="High", delivery_rating=4.6),
            models.SupplierMaterial(supplier_id=sup3.id, material_name="Threaded Rod", price=145.00, stock_level="Low", delivery_rating=2.1), # Cheaper, but terrible delivery!
            models.SupplierMaterial(supplier_id=sup3.id, material_name="PVC Pipe 2 inch", price=120.00, stock_level="High", delivery_rating=3.5),
        ])
        db.commit()

        # 4. Add Initial Linked Inventory 
        print("Seeding Bodegero Inventory & Assets...")
        inventory_items = [
            models.Inventory(item_name="Grinder", brand="Bosch 800W", quantity=1.0, unit="Unit", status="In Use", site_id=makati.id),
            models.Inventory(item_name="Hand Drill", brand="Makita 12V", quantity=1.0, unit="Unit", status="Available", site_id=storage.id),
            models.Inventory(item_name="Gypsum Board", brand="12mm Standard", quantity=10.0, unit="Pcs", status="Surplus", site_id=storage.id),
            models.Inventory(item_name="Gypsum Board", brand="12mm Standard", quantity=50.0, unit="Pcs", status="Healthy", site_id=makati.id),
            models.Inventory(item_name="Threaded Rod", brand="8mm Galvanized", quantity=3.0, unit="Pcs", status="Low Stock", site_id=storage.id),
            models.Inventory(item_name="Threaded Rod", brand="8mm Galvanized", quantity=0.0, unit="Pcs", status="Critical", site_id=paco.id),
            models.Inventory(item_name="Portland Cement", brand="Republic", quantity=120.0, unit="Bags", status="Surplus", site_id=makati.id)
        ]
        
        db.add_all(inventory_items)
        db.commit()
        print("✅ Database Seeded Successfully for MatTrack PRO clusters with Admin & Staff Accounts included!")

    except Exception as e:
        db.rollback()
        print(f"❌ Deployment Seeding Aborted due to engine crash: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()