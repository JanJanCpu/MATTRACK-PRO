from database import SessionLocal, engine
import models

def seed_data():
    db = SessionLocal()
    
    # 1. Clear existing data (Optional, but ensures a clean demo)
    db.query(models.Inventory).delete()
    db.query(models.MaterialRequest).delete()
    db.query(models.Supplier).delete()
    db.query(models.ProjectSite).delete()

    # 2. Add Project Sites (PENTABUILD typical locations)
    site1 = models.ProjectSite(site_name="PLM Campus Expansion", latitude=14.5866, longitude=120.9762)
    site2 = models.ProjectSite(site_name="Intramuros Heritage Village", latitude=14.5894, longitude=120.9753)
    site3 = models.ProjectSite(site_name="Manila Bay View Condos", latitude=14.5637, longitude=120.9822)
    
    db.add_all([site1, site2, site3])
    db.commit()

    # 3. Add Official Suppliers
    sup1 = models.Supplier(
        name="Manila Steel Corp", 
        contact="0917-123-4567", 
        latitude=14.6000, 
        longitude=120.9800, 
        quality_rating=4.8,
        categories="Steel, Rebar, Beams"
    )
    sup2 = models.Supplier(
        name="Paco Cement Hub", 
        contact="0918-987-6543", 
        latitude=14.5800, 
        longitude=120.9900, 
        quality_rating=4.2,
        categories="Cement, Concrete, Aggregates"
    )
    
    db.add_all([sup1, sup2])
    db.commit()

    # 4. Add Initial Inventory for Site 1
    inv1 = models.Inventory(item_name="Deformed Bar 12mm", quantity=500.0, unit="pcs", status="Available", site_id=site1.id)
    inv2 = models.Inventory(item_name="Portland Cement", quantity=120.0, unit="bags", status="Low Stock", site_id=site1.id)
    
    db.add_all([inv1, inv2])
    db.commit()
    
    print("Database Seeded Successfully for MatTrack PRO!")
    db.close()

if __name__ == "__main__":
    seed_data()