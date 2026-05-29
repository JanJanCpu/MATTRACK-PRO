from database import SessionLocal, engine, Base
import models

def seed_data():
    # FIX A: Bind engine context and force table structural generation onto PostgreSQL
    print("Creating tables in PostgreSQL if they don't exist...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("Purging old multi-project records to clear local cache clusters...")
        # Note: Delete in reverse order of foreign keys to avoid referential integrity blocks
        db.query(models.Inventory).delete()
        db.query(models.MaterialRequest).delete()
        db.query(models.Supplier).delete()
        db.query(models.ProjectSite).delete()

        # 2. Add New Project Sites requested for testing
        print("Injecting Manila, Makati, QC, and Taguig project matrices...")
        site1 = models.ProjectSite(site_name="Pentabuild Makati HQ", latitude=14.5558, longitude=121.0028)
        site2 = models.ProjectSite(site_name="Gentry Corporate Tower", latitude=14.5615, longitude=121.0331)
        site3 = models.ProjectSite(site_name="Diliman Heritage House", latitude=14.6346, longitude=121.0365)
        site4 = models.ProjectSite(site_name="McKinley West Development", latitude=14.5305, longitude=121.0423)
        
        db.add_all([site1, site2, site3, site4])
        db.commit() # Committing here guarantees IDs are generated for downstream relational keys

        # 3. Add Suppliers (Including requested Lumber Worx entry)
        print("Adding hardware trading hubs and industrial suppliers...")
        sup1 = models.Supplier(
            name="Lumber Worx Trading Corp", 
            contact="0917-LUMBER-1", 
            latitude=14.6534, 
            longitude=120.9734, 
            quality_rating=4.5,
            categories="Lumber, Wood, Plywood"
        )
        sup2 = models.Supplier(
            name="Manila Steel Supply", 
            contact="0912-STEEL-2", 
            latitude=14.6120, 
            longitude=120.9650, 
            quality_rating=4.2,
            categories="Steel, Rebar"
        )
        
        db.add_all([sup1, sup2])

        # 4. Add Initial Linked Inventory 
        inv1 = models.Inventory(item_name="Deformed Bar 12mm", quantity=500.0, unit="pcs", status="Available", site_id=site1.id)
        inv2 = models.Inventory(item_name="Portland Cement", quantity=120.0, unit="bags", status="Low Stock", site_id=site1.id)
        
        db.add_all([inv1, inv2])
        
        # FIX C: Final data integrity block lock commit
        db.commit()
        print("Database Seeded Successfully for MatTrack PRO clusters!")

    except Exception as e:
        db.rollback()
        print(f"Deployment Seeding Aborted due to engine crash: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()