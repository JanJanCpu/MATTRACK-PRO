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
        print("Seeding System Users...")
        admin = models.User(
            username="admin",
            email="admin@pentabuild.com",
            hashed_password=pwd_context.hash("admin123"),
            role="admin",
            company_name="Pentabuild Corp"
        )
        
        staff_juan = models.User(
            username="juan_staff",
            email="juan@pentabuild.com",
            hashed_password=pwd_context.hash("staff123"), 
            role="staff",
            company_name="Pentabuild Corp"
        )

        staff_maria = models.User(
            username="maria_staff",
            email="maria@pentabuild.com",
            hashed_password=pwd_context.hash("staff123"), 
            role="staff",
            company_name="Pentabuild Corp"
        )
        
        db.add_all([admin, staff_juan, staff_maria])
        db.commit() 

        # 2. Add New Project Sites
        print("Injecting expanded site matrices...")
        storage = models.ProjectSite(
            site_name="Main Storage", address="Port Area, Manila", 
            latitude=14.6042, longitude=120.9822, manager_id=admin.id
        )
        makati = models.ProjectSite(
            site_name="Makati Fit-out", address="1200 Ayala Ave, Makati City", 
            latitude=14.5547, longitude=121.0244, manager_id=admin.id
        )
        paco = models.ProjectSite(
            site_name="Paco CNC Bldg", address="1007 Quirino Ave, Paco, Manila", 
            latitude=14.5826, longitude=120.9931, manager_id=staff_juan.id
        )
        bgc = models.ProjectSite(
            site_name="BGC Tower 4", address="32nd St, Taguig", 
            latitude=14.5548, longitude=121.0476, manager_id=staff_maria.id
        )
        qc = models.ProjectSite(
            site_name="QC Mall Annex", address="North Ave, Quezon City", 
            latitude=14.6542, longitude=121.0305, manager_id=admin.id
        )
        
        db.add_all([storage, makati, paco, bgc, qc])
        db.commit() 

        # 3. Add Hardware Suppliers
        print("Adding expanded Hardware Suppliers...")
        sup1 = models.Supplier(name="BuildPro Hardware", address="Quezon City", contact="0917-111-2222", latitude=14.6200, longitude=121.0200, quality_rating=4.5)
        sup2 = models.Supplier(name="Manila Steelworks", address="Tondo, Manila", contact="0918-333-4444", latitude=14.6100, longitude=120.9700, quality_rating=4.8)
        sup3 = models.Supplier(name="Prime Cement Co.", address="Pasig City", contact="0919-555-6666", latitude=14.5764, longitude=121.0851, quality_rating=4.2)
        sup4 = models.Supplier(name="Global PowerTools", address="Mandaluyong", contact="0920-777-8888", latitude=14.5794, longitude=121.0359, quality_rating=4.9)
        sup5 = models.Supplier(name="EcoLumber Trading", address="Valenzuela", contact="0921-999-0000", latitude=14.5800, longitude=121.0300, quality_rating=3.9)
        
        db.add_all([sup1, sup2, sup3, sup4, sup5])
        db.commit()

        # 4. SEED THE SELLER PORTAL ACCOUNTS
        print("Seeding Seller accounts for the Portal...")
        seller_buildpro = models.User(
            username="buildpro_seller", email="seller@buildpro.com",
            hashed_password=pwd_context.hash("seller123"), role="seller",
            supplier_id=sup1.id, company_name="BuildPro Hardware"
        )
        seller_steel = models.User(
            username="steelworks_seller", email="seller@steelworks.com",
            hashed_password=pwd_context.hash("seller123"), role="seller",
            supplier_id=sup2.id, company_name="Manila Steelworks"
        )
        db.add_all([seller_buildpro, seller_steel])
        db.commit()

        # 5. Add Supplier Catalogs (Overlap created intentionally for AI to choose the best one)
        print("Injecting robust Supplier Material Catalogs...")
        db.add_all([
            # BuildPro Catalog
            models.SupplierMaterial(supplier_id=sup1.id, material_name="Plywood 1/2 inch", price=850.00, stock_level="High", delivery_rating=4.5),
            models.SupplierMaterial(supplier_id=sup1.id, material_name="Portland Cement", price=245.00, stock_level="Medium", delivery_rating=4.2),
            models.SupplierMaterial(supplier_id=sup1.id, material_name="Common Wire Nails", price=75.00, stock_level="High", delivery_rating=4.5),
            
            # Manila Steelworks Catalog
            models.SupplierMaterial(supplier_id=sup2.id, material_name="Deformed Rebar 10mm", price=175.00, stock_level="High", delivery_rating=4.9),
            models.SupplierMaterial(supplier_id=sup2.id, material_name="Deformed Rebar 12mm", price=210.00, stock_level="High", delivery_rating=4.8),
            models.SupplierMaterial(supplier_id=sup2.id, material_name="Tie Wire", price=85.00, stock_level="Medium", delivery_rating=4.7),

            # Prime Cement Co. Catalog (Competitor for BuildPro)
            models.SupplierMaterial(supplier_id=sup3.id, material_name="Portland Cement", price=235.00, stock_level="High", delivery_rating=4.8), # Cheaper and better rating!
            models.SupplierMaterial(supplier_id=sup3.id, material_name="White Cement", price=300.00, stock_level="Low", delivery_rating=4.0),

            # Global PowerTools Catalog
            models.SupplierMaterial(supplier_id=sup4.id, material_name="Angle Grinder 800W", price=3500.00, stock_level="Medium", delivery_rating=5.0),
            models.SupplierMaterial(supplier_id=sup4.id, material_name="Impact Drill 12V", price=4200.00, stock_level="High", delivery_rating=4.9),

            # EcoLumber Catalog
            models.SupplierMaterial(supplier_id=sup5.id, material_name="Plywood 1/2 inch", price=800.00, stock_level="Low", delivery_rating=3.5), # Cheaper but bad rating
            models.SupplierMaterial(supplier_id=sup5.id, material_name="Lumber 2x4x8", price=250.00, stock_level="Medium", delivery_rating=4.1),
        ])
        db.commit()

        # 6. Add Initial Linked Inventory 
        print("Seeding Massive Bodegero Inventory & Assets...")
        inventory_items = [
            # Tools
            models.Inventory(item_name="Angle Grinder", brand="Bosch 800W", quantity=2.0, unit="Unit", status="In Use", site_id=makati.id),
            models.Inventory(item_name="Angle Grinder", brand="Makita 800W", quantity=1.0, unit="Unit", status="Available", site_id=storage.id),
            models.Inventory(item_name="Hand Drill", brand="DeWalt 12V", quantity=1.0, unit="Unit", status="Maintenance", site_id=paco.id),
            models.Inventory(item_name="Hand Drill", brand="Makita 12V", quantity=5.0, unit="Unit", status="Surplus", site_id=qc.id), # Surplus tool!
            
            # Gypsum / Boards
            models.Inventory(item_name="Gypsum Board", brand="12mm Standard", quantity=100.0, unit="Pcs", status="Surplus", site_id=storage.id),
            models.Inventory(item_name="Gypsum Board", brand="12mm Standard", quantity=5.0, unit="Pcs", status="Critical", site_id=bgc.id), # Needs a transfer!
            models.Inventory(item_name="Plywood 1/2 inch", brand="SantaClara", quantity=45.0, unit="Pcs", status="Healthy", site_id=makati.id),
            
            # Steel & Hardware
            models.Inventory(item_name="Deformed Rebar 10mm", brand="SteelAsia", quantity=500.0, unit="Pcs", status="Healthy", site_id=bgc.id),
            models.Inventory(item_name="Deformed Rebar 10mm", brand="SteelAsia", quantity=10.0, unit="Pcs", status="Low Stock", site_id=paco.id),
            models.Inventory(item_name="Tie Wire", brand="Generic", quantity=50.0, unit="Kilos", status="Surplus", site_id=bgc.id),
            models.Inventory(item_name="Tie Wire", brand="Generic", quantity=2.0, unit="Kilos", status="Critical", site_id=makati.id),
            models.Inventory(item_name="Threaded Rod", brand="8mm Galvanized", quantity=3.0, unit="Pcs", status="Low Stock", site_id=storage.id),
            models.Inventory(item_name="Threaded Rod", brand="8mm Galvanized", quantity=0.0, unit="Pcs", status="Critical", site_id=paco.id),
            
            # Cement (The main testing ground)
            models.Inventory(item_name="Portland Cement", brand="Republic", quantity=300.0, unit="Bags", status="Surplus", site_id=makati.id),
            models.Inventory(item_name="Portland Cement", brand="Holcim", quantity=15.0, unit="Bags", status="Low Stock", site_id=qc.id),
            models.Inventory(item_name="Portland Cement", brand="Eagle", quantity=0.0, unit="Bags", status="Critical", site_id=paco.id),
            
            # Paint
            models.Inventory(item_name="Latex Paint White", brand="Boysen", quantity=20.0, unit="Pails", status="Healthy", site_id=qc.id),
            models.Inventory(item_name="Latex Paint White", brand="Davies", quantity=50.0, unit="Pails", status="Surplus", site_id=storage.id),
        ]
        
        db.add_all(inventory_items)
        db.commit()
        print("✅ Database Seeded Successfully for MatTrack PRO clusters with Admin, Staff, & Seller Accounts included!")

    except Exception as e:
        db.rollback()
        print(f"❌ Deployment Seeding Aborted due to engine crash: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()