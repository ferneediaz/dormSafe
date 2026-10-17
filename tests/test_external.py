from __future__ import annotations

import pytest

from dormsafe.external import ncdr, nfa
from dormsafe.external.http import SourceUnavailableError
from dormsafe.external.models import EVENT_TYPES
from dormsafe.external.service import ExternalDataService
from tests.conftest import make_settings

# ------------------------------------------------------------------ NCDR


def test_frozen_alerts_are_real_and_tagged(settings):
    result = ExternalDataService(settings).alerts()
    assert result.data_mode == "frozen_real"
    assert result.items
    assert {a.data_mode for a in result.items} == {"frozen_real"}
    assert {a.source for a in result.items} == {"NCDR"}
    assert {a.event_type for a in result.items} <= set(EVENT_TYPES)
    assert len({a.id for a in result.items}) == len(result.items)


def test_frozen_earthquake_alert_is_normalized(settings):
    alerts = ExternalDataService(settings).alerts().items
    quake = next(a for a in alerts if a.id == "ncdr:CWA-EQ115069-2026-1013-173010")
    assert quake.event_type == "earthquake"
    assert quake.severity == "minor"
    assert quake.headline == "地震報告"
    assert "花蓮縣" in (quake.description or "")
    assert quake.affected_areas
    assert quake.effective_at is not None and quake.effective_at.utcoffset() is not None


@pytest.mark.parametrize(
    ("code", "label", "expected"),
    [
        ("earthquake", None, "earthquake"),
        ("Typhoon", None, "typhoon"),
        ("rainfall", None, "heavy_rain"),
        (None, "淹水警戒", "flood"),
        (None, "豪雨特報", "heavy_rain"),
        ("StrongWind", "強風特報", "other"),
        ("ReservoirDis", None, "other"),
        (None, None, "other"),
    ],
)
def test_classify_event(code, label, expected):
    assert ncdr.classify_event(code, label) == expected


def test_rate_limit_warning_is_not_an_empty_feed():
    body = "<WarningMessage><Warning>限制存取間隔時間為3秒</Warning></WarningMessage>"
    with pytest.raises(ValueError, match="refused"):
        ncdr.parse_feed(body.encode("utf-8"))


def test_superseded_and_cancelled_alerts_are_dropped():
    entries = [
        ncdr.FeedEntry("old", "地震", None, None, "Actual", "Alert", None, None),
        ncdr.FeedEntry("new", "地震", None, None, "Actual", "Update", None, None),
        ncdr.FeedEntry("gone", "地震", None, None, "Actual", "Cancel", None, None),
        ncdr.FeedEntry("drill", "地震", None, None, "Exercise", "Alert", None, None),
    ]
    caps = {"new": ncdr.CapAlert("new", "Actual", "Update", references=["old"])}
    alerts = ncdr.build_alerts(entries, caps, "live")
    assert [a.id for a in alerts] == ["ncdr:new"]


def _frozen_feed_bytes(settings) -> bytes:
    return (settings.frozen_data_dir / "ncdr_feed.xml").read_bytes()


def test_live_then_cached(settings):
    live_settings = make_settings(external_data_mode="live")
    feed = _frozen_feed_bytes(settings)
    calls: list[str] = []

    def fetcher(url, _settings, _throttle):
        calls.append(url)
        if url == live_settings.ncdr_feed_url:
            return feed
        raise SourceUnavailableError(url, "CAP docs not served in this test")

    service = ExternalDataService(live_settings, fetcher=fetcher)
    first = service.alerts()
    assert first.data_mode == "live"
    assert first.items and {a.data_mode for a in first.items} == {"live"}

    n_calls = len(calls)
    second = service.alerts()
    assert second.data_mode == "cached_real"
    assert {a.data_mode for a in second.items} == {"cached_real"}
    assert len(calls) == n_calls  # served from cache


def test_live_failure_falls_back_to_frozen():
    def fetcher(url, _settings, _throttle):
        raise SourceUnavailableError(url, "offline")

    service = ExternalDataService(make_settings(external_data_mode="live"), fetcher=fetcher)
    alerts = service.alerts()
    shelters = service.shelters()
    assert alerts.data_mode == "frozen_real" and alerts.items
    assert {a.data_mode for a in alerts.items} == {"frozen_real"}
    assert shelters.data_mode == "frozen_real" and shelters.items


# ------------------------------------------------------------------ NFA

CSV_HEADER = (
    "序號,縣市及鄉鎮市區,村里,避難收容處所地址,經度,緯度,避難收容處所名稱,預計收容村里,"
    "預計收容人數,適用災害類別,管理人姓名,管理人電話,室內,室外,適合避難弱者安置\n"
)


def test_parse_shelter_row_and_drop_personal_data():
    csv = CSV_HEADER + (
        "1,臺北市大安區,學府里,羅斯福路四段1號,121.5395,25.0170,測試國小,學府里,300,"
        '"水災,震災",王小明,0912345678,是,是,是\n'
        "2,臺北市大安區,學府里,,10.0,10.0,Outside Taiwan,,,,,,,,\n"
    )
    shelters = nfa.parse_shelters_csv(("﻿" + csv).encode("utf-8"))
    assert len(shelters) == 1
    s = shelters[0]
    assert s.name == "測試國小"
    assert s.planned_capacity == 300
    assert s.disaster_types == ["flood", "earthquake"]
    assert s.suitable_for_vulnerable_people is True
    assert s.status == "designated"
    assert s.source == "NFA"
    dumped = s.model_dump_json()
    assert "王小明" not in dumped and "0912345678" not in dumped


def test_shelter_csv_schema_change_is_loud():
    with pytest.raises(ValueError, match="schema changed"):
        nfa.parse_shelters_csv("a,b,c\n1,2,3\n".encode())


def test_frozen_shelters(settings):
    result = ExternalDataService(settings).shelters()
    assert result.data_mode == "frozen_real"
    assert len(result.items) > 5000
    assert len({s.id for s in result.items}) == len(result.items)
    nearby = nfa.within_radius(result.items, settings.dorm_latitude, settings.dorm_longitude, 5)
    assert 0 < len(nearby) < len(result.items)
