from sqlalchemy import Column, String, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from database import Base
import datetime
import uuid

class UserDB(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: f"user_{uuid.uuid4().hex[:8]}")
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    tests = relationship("TestDB", back_populates="author")

class TestDB(Base):
    __tablename__ = "tests"

    id = Column(String, primary_key=True, default=lambda: f"test_{uuid.uuid4().hex[:6]}")
    teacher_id = Column(String, ForeignKey("users.id"), index=True, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    
    meta_data = Column(JSONB, nullable=False)
    modules = Column(JSONB, nullable=False)

    author = relationship("UserDB", back_populates="tests")