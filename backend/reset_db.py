from database import engine, Base
import models

print("Wiping old PostgreSQL tables...")
Base.metadata.drop_all(bind=engine)

print("Building fresh tables with the new Address column...")
Base.metadata.create_all(bind=engine)

print("✅ MatTrack Database successfully rebuilt!")