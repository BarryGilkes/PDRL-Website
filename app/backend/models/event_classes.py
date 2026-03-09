from core.database import Base
from sqlalchemy import Column, Integer, String


class Event_classes(Base):
    __tablename__ = "event_classes"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    event_id = Column(Integer, nullable=False)
    name = Column(String, nullable=False)
    cap = Column(Integer, nullable=False)
    filled = Column(Integer, nullable=False)