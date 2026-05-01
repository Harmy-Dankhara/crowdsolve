from sqlalchemy import Column, Integer, String, Float
from database.db import Base


class Issue(Base):
    __tablename__ = "issues"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(String)
    location = Column(String)
    status = Column(String, default="Reported")
    category = Column(String, default="Other")
    severity = Column(String, default="Low")
    department = Column(String)
    image_url = Column(String, nullable=True)
    support_count = Column(Integer, default=0)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)
    resolved_at = Column(String, nullable=True)
    is_deleted = Column(Integer, default=0)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    message = Column(String, nullable=False)
    user_type = Column(String, nullable=False)  # "citizen" or "authority"
    issue_id = Column(Integer, nullable=True)
    is_read = Column(Integer, default=0)  # 0 = unread, 1 = read
    created_at = Column(String, nullable=True)


class Authority(Base):
    __tablename__ = "authorities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, nullable=False, index=True)
    department = Column(String, nullable=False)
    city = Column(String, nullable=False)
    password_hash = Column(String, nullable=False)