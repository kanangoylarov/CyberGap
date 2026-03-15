from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class GatewayLog(Base):
    __tablename__ = "gateway_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    fingerprint: Mapped[str] = mapped_column(String(128), index=True, nullable=False)
    source_ip: Mapped[str] = mapped_column(String(45), index=True, nullable=False)
    attack_type: Mapped[int] = mapped_column(Integer, index=True, nullable=False)
    attack_label: Mapped[str] = mapped_column(String(32), nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    upstream: Mapped[str] = mapped_column(String(256), nullable=False)
    latency_ms: Mapped[float] = mapped_column(Float, nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False)
    path: Mapped[str] = mapped_column(String(2048), nullable=False)
    user_agent: Mapped[str] = mapped_column(String(512), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
