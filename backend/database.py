from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Ensure your password and DB name are correct here
SQLALCHEMY_DATABASE_URL = "postgresql://postgres:S0ftandW3t@localhost:5432/mattrack_db"

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

# ADD THIS PART:
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()