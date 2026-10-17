"""Configuration, read from `DORMSAFE_*` environment variables or a `.env` file."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]

# frozen = always serve the bundled real snapshot (deterministic; default for dev and tests)
# live   = fetch from the official source, cache for `cache_ttl_seconds`, fall back to frozen
ExternalDataMode = Literal["frozen", "live"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="DORMSAFE_",
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # --- external data ---
    external_data_mode: ExternalDataMode = "frozen"
    frozen_data_dir: Path = REPO_ROOT / "data" / "frozen"
    cache_ttl_seconds: int = Field(default=300, ge=0)
    http_timeout: float = Field(default=30.0, gt=0)
    user_agent: str = "dormsafe/0.1 (hackathon prototype)"

    # 國家災害防救科技中心 (NCDR) 民生示警公開資料平台, Atom feed of CAP alerts.
    # The platform enforces >= 3 s between requests from one client.
    ncdr_feed_url: str = "https://alerts.ncdr.nat.gov.tw/RssAtomFeed.ashx"
    ncdr_min_request_interval: float = Field(default=3.1, ge=0)
    ncdr_max_cap_docs: int = Field(default=10, ge=0)

    # 內政部消防署 避難收容處所點位檔 (data.gov.tw dataset 73242), CSV, UTF-8 with BOM
    nfa_shelters_url: str = (
        "https://opdadm.moi.gov.tw/api/v1/no-auth/resource/api/dataset/"
        "ED6CF735-6C03-4573-A882-72C1BEC799CB/resource/"
        "54550E2F-4567-4C8F-BD2E-E54E9D0386B8/download"
    )
    # Default radius for GET /external/shelters (0 = all of Taiwan, ~6000 records).
    shelter_radius_km: float = Field(default=5.0, ge=0)

    # --- demo dorm (fictional building; coordinates near NTU, Taipei) ---
    dorm_id: str = "demo-dorm-a"
    dorm_name: str = "DormSafe Demo Dorm A (simulated)"
    dorm_address: str | None = "No. 1, Sec. 4, Roosevelt Rd., Da'an Dist., Taipei City (demo)"
    dorm_latitude: float = 25.0174
    dorm_longitude: float = 121.5405
    dorm_floor_count: int = Field(default=8, ge=1, le=30)
    dorm_rooms_per_floor: int = Field(default=6, ge=1, le=40)
    dorm_residents_per_room: int = Field(default=2, ge=1, le=6)

    # Apply demo scenario (fire/smoke, blocked stairwell, resident needing help) at startup.
    seed_demo_scenario: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
