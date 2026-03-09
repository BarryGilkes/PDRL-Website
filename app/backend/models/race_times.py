from core.database import Base
from sqlalchemy import Boolean, Column, DateTime, Float, Integer, String


class Race_times(Base):
    __tablename__ = "race_times"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    registration_id = Column(Integer, nullable=False)
    event_id = Column(Integer, nullable=False)
    round = Column(String, nullable=True)
    sixty_foot = Column(Float, nullable=True)
    three_thirty_foot = Column(Float, nullable=True)
    eighth_mile_time = Column(Float, nullable=True)
    eighth_mile_speed = Column(Float, nullable=True)
    quarter_mile_time = Column(Float, nullable=True)
    quarter_mile_speed = Column(Float, nullable=True)
    reaction_time = Column(Float, nullable=True)
    notes = Column(String, nullable=True)
    recorded_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=True)
    race_date_time = Column(DateTime(timezone=True), nullable=True)
    lane = Column(String, nullable=True)
    redlight = Column(Boolean, nullable=True)
    dial_in = Column(Float, nullable=True)
    driver_name = Column(String, nullable=True)
    breakout = Column(Boolean, nullable=True)
    win = Column(Boolean, nullable=True)
    competition_number = Column(Integer, nullable=True)