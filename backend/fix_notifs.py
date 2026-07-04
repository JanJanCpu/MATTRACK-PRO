from database import engine
from sqlalchemy import text
import models

# 1. Forcefully destroy the old, broken notifications table
with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS notifications CASCADE;"))
    conn.commit()

# 2. Rebuild it using the updated blueprints in models.py
models.Base.metadata.create_all(bind=engine)

print("✅ Notifications table completely rebuilt with the 'link' column!")