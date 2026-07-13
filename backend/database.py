import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Get the absolute path to the folder this database.py file is in
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Tell Python exactly where the .env file should be located
ENV_PATH = os.path.join(BASE_DIR, ".env")
print(f"DEBUG: Looking for .env file at: {ENV_PATH}")

# 3. Force load from that exact path
load_dotenv(ENV_PATH)

# 4. Fetch the variable, with your local PostgreSQL fallback included
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:S0ftandW3t@localhost:5432/mattrack_db"
)

# 5. CRITICAL CLOUD FIX: Normalize 'postgres://' to 'postgresql://' for NeonDB/Render compatibility
if SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

print(f"DEBUG: Database URL loaded as: {SQLALCHEMY_DATABASE_URL}")

# 6. Configure Engine dynamically based on the database dialect
if "sqlite" in SQLALCHEMY_DATABASE_URL:
    # SQLite requires check_same_thread=False for FastAPI multithreading
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"check_same_thread": False}
    )
else:
    # PostgreSQL / NeonDB standard engine configuration
    engine = create_engine(SQLALCHEMY_DATABASE_URL)

# 7. Create the Session factory and Base class for ORM models
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 8. Dependency injection generator for FastAPI route handlers
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()