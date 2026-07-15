import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Get the absolute path to the folder this database.py file is in
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Tell Python exactly where the .env file should be
ENV_PATH = os.path.join(BASE_DIR, ".env")
print(f"DEBUG: Looking for .env file at: {ENV_PATH}")

# 3. Force load from that exact path
load_dotenv(ENV_PATH)

# 4. Fetch the variable, with the fallback included for ultimate safety
SQLALCHEMY_DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://postgres:S0ftandW3t@localhost:5432/mattrack_db"
)

print(f"DEBUG: Database URL loaded as: {SQLALCHEMY_DATABASE_URL}")

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()