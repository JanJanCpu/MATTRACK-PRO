from database import SessionLocal, engine, Base
import models
from passlib.context import CryptContext

# Set up the password hasher
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_data():
    print("Creating tables in PostgreSQL if they don't exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Purging old multi-project records to clear local cache clusters...")
        # Note: Delete in reverse order of foreign keys to avoid referential integrity blocks
        db.query(models.ActivityLog).delete() 
        db.query(models.Inventory).delete()
        db.query(models.MaterialRequest).delete()
        db.query(models.Supplier).delete()
        db.query(models.ProjectSite).delete()
        
        # --- CRITICAL: WIPE OLD USERS SO WE CAN INJECT THE NEW ONE ---
        db.query(models.User).delete() 

        # --- THE MASTER KEY: ADD THE ADMIN ACCOUNT ---
        print("Seeding default Admin System Owner...")
        admin = models.User(
            username="admin",
            email="admin@pentabuild.com",
            hashed_password=pwd_context.hash("admin123"), # Securely hashes "admin123"
            role="admin",
            company_name="Pentabuild Corp"
        )
        db.add(admin)
        db.commit() # Commit here so the admin gets User ID 1

        # 2. Add New Project Sites (Now with explicitly injected addresses!)
        print("Injecting site matrices (Storage, Makati, Paco)...")
        storage = models.ProjectSite(
            site_name="Main Storage", address="Port Area, Manila", 
            latitude=14.6042, longitude=120.9822
        )
        makati = models.ProjectSite(
            site_name="Makati Fit-out", address="1200 Ayala Ave, Makati City", 
            latitude=14.5547, longitude=121.0244
        )
        paco = models.ProjectSite(
            site_name="Paco CNC Bldg", address="1007 Quirino Ave, Paco, Manila", 
            latitude=14.5826, longitude=120.9931
        )
        
        db.add_all([storage, makati, paco])
        db.commit() 

        # 3. Add Suppliers
        print("Adding hardware trading hubs and industrial suppliers...")
        sup1 = models.Supplier(
            name="Lumber Worx Trading Corp", 
            address="Grace Park, Caloocan City", 
            contact="0917-LUMBER-1", 
            latitude=14.6534, 
            longitude=120.9734, 
            quality_rating=4.5,
            categories="Lumber, Wood, Plywood"
        )
        sup2 = models.Supplier(
            name="Manila Steel Supply", 
            address="Binondo, Manila", 
            contact="0912-STEEL-2", 
            latitude=14.6120, 
            longitude=120.9650, 
            quality_rating=4.2,
            categories="Steel, Rebar"
        )
        db.add_all([sup1, sup2])

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
        print("✅ Database Seeded Successfully for MatTrack PRO clusters with Admin Account included!")

    except Exception as e:
        db.rollback()
        print(f"❌ Deployment Seeding Aborted due to engine crash: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()