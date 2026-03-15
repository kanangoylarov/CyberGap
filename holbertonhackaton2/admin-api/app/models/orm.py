from datetime import datetime

from sqlalchemy import Column, Integer, String, Float, DateTime, func

from app.core.database import Base


class GatewayLog(Base):
    __tablename__ = "gateway_logs"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, index=True)
    fingerprint = Column(String(128), nullable=False, index=True)
    source_ip = Column(String(45), nullable=False, index=True)
    attack_type = Column(Integer, nullable=False, default=0, index=True)
    attack_label = Column(String(32), nullable=False, default="normal")
    confidence = Column(Float, nullable=False, default=0.0)
    upstream = Column(String(256), nullable=True)
    latency_ms = Column(Float, nullable=True)
    method = Column(String(10), nullable=False)
    path = Column(String(2048), nullable=False)
    user_agent = Column(String(512), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
