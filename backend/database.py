import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# 1. Get the absolute path to the folder this database.py file is in
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 2. Tell Python exactly where the .env file should be
ENV_PATH = os.path.join(BASE_DIR, ".env")

# 3. Force load from that exact path
load_dotenv(ENV_PATH)

# 4. Fetch the variable — no hardcoded credential fallback; fail fast instead
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")
if not SQLALCHEMY_DATABASE_URL:
    raise RuntimeError(
        "DATABASE_URL environment variable is not set. Define it in backend/.env "
        "(e.g. postgresql://user:password@localhost:5432/mattrack_db)."
    )

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()