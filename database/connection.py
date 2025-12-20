"""
Database connection and session management for WaveDesigner.

Usage:
    from database.connection import get_db, engine
    
    # In FastAPI dependency:
    def get_db_session():
        with get_db() as session:
            yield session
    
    # Direct usage:
    with get_db() as session:
        species = session.query(WoodSpecies).all()
"""

import os
from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from database.models import Base


def get_database_url() -> str:
    """
    Get database URL from environment.
    
    Priority:
    1. DATABASE_URL (Render.com provides this)
    2. Construct from individual vars (local development)
    
    Returns:
        PostgreSQL connection string
    """
    if url := os.environ.get("DATABASE_URL"):
        # Render.com uses postgres://, SQLAlchemy needs postgresql://
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    
    # Local development defaults
    host = os.environ.get("POSTGRES_HOST", "localhost")
    port = os.environ.get("POSTGRES_PORT", "5432")
    user = os.environ.get("POSTGRES_USER", "postgres")
    password = os.environ.get("POSTGRES_PASSWORD", "dev")
    db = os.environ.get("POSTGRES_DB", "wavedesigner")
    
    return f"postgresql://{user}:{password}@{host}:{port}/{db}"


# Engine configuration
DATABASE_URL = get_database_url()

engine = create_engine(
    DATABASE_URL,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,  # Verify connections before use
    echo=os.environ.get("SQL_ECHO", "").lower() == "true"
)

# Session factory
SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False
)


@contextmanager
def get_db() -> Generator[Session, None, None]:
    """
    Context manager for database sessions.
    
    Automatically handles commit on success, rollback on error.
    
    Usage:
        with get_db() as session:
            species = session.query(WoodSpecies).all()
    """
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db() -> None:
    """
    Initialize database tables.
    
    For development only - use Alembic migrations in production.
    """
    Base.metadata.create_all(bind=engine)


def drop_all_tables() -> None:
    """
    Drop all tables. USE WITH CAUTION.
    
    For development/testing only.
    """
    Base.metadata.drop_all(bind=engine)