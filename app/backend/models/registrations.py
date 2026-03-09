from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Registrations(Base):
    __tablename__ = "registrations"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    user_id = Column(String, nullable=False)
    event_id = Column(Integer, nullable=False)
    driver_name = Column(String, nullable=False)
    competition_number = Column(String, nullable=False)
    phone = Column(String, nullable=False)
    class_name = Column(String, nullable=False)
    car = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    payment_reference = Column(String, nullable=True)
    payment_status = Column(String, nullable=True)
    submitted_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)