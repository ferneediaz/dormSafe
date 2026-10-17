from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from dormsafe.api import create_app
from dormsafe.config import Settings


def make_settings(**overrides) -> Settings:
    base = {
        "external_data_mode": "frozen",
        "seed_demo_scenario": False,
        "ncdr_min_request_interval": 0,
    }
    return Settings(_env_file=None, **{**base, **overrides})


@pytest.fixture
def settings() -> Settings:
    return make_settings()


@pytest.fixture
def client(settings: Settings) -> TestClient:
    return TestClient(create_app(settings))
