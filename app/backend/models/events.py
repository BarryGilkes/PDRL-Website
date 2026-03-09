from core.database import Base
from sqlalchemy import Column, DateTime, Integer, String


class Events(Base):
    __tablename__ = "events"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    title = Column(String, nullable=False)
    date = Column(String, nullable=False)
    location = Column(String, nullable=False)
    start_time = Column(String, nullable=False)
    end_time = Column(String, nullable=False)
    buyin = Column(String, nullable=True)
    payout = Column(String, nullable=True)
    format = Column(String, nullable=True)
    price = Column(String, nullable=True)
    payment_method = Column(String, nullable=True)
    status = Column(String, nullable=False)
    notes = Column(String, nullable=True)
    flyer_key = Column(String, nullable=True)
    flyer_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
