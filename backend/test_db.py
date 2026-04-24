from database import engine, Base
import models

def check_connection():
    try:
        print("Connecting to MatTrack DB...")
        # This command tells SQLAlchemy to create all tables defined in models.py
        Base.metadata.create_all(bind=engine)
        print("✅ Connection Successful! Tables created in mattrack_db.")
    except Exception as e:
        print("❌ Connection Failed.")
        print(f"Error: {e}")

if __name__ == "__main__":
    check_connection()