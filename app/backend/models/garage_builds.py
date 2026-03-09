from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Garage_builds(Base):
    __tablename__ = "garage_builds"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    name = Column(String, nullable=False)
    car = Column(String, nullable=False)
    drivetrain = Column(String, nullable=True)
    class_name = Column(String, nullable=False)
    mods = Column(String, nullable=True)
    photo_url = Column(String, nullable=True)
    status = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)