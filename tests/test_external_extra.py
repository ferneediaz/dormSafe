"""Shelter status (NFA 12849), nearest shelters, earthquake reports."""

from __future__ import annotations

from dormsafe.external import ncdr, nfa, nfa_status
from dormsafe.external.http import SourceUnavailableError
from dormsafe.external.models import Shelter
from dormsafe.external.service import ExternalDataService
from tests.conftest import make_settings


def _shelter(sid: str, name: str, lat: float, lon: float, **kw) -> Shelter:
    return Shelter(id=sid, name=name, latitude=lat, longitude=lon, source="NFA", **kw)


STATUS_XML = """<?xml version='1.0' encoding='utf-8'?>
<SheltersInfoList><ShletersInfo>
 <ShletersInfo><name>大安國小</name><lat>25.0300</lat><lon>121.5400</lon>
   <openstatus>開設</openstatus><shelterId>1</shelterId></ShletersInfo>
 <ShletersInfo><name>大安國小</name><lat>25.0300</lat><lon>121.5400</lon>
   <openstatus>開設</openstatus><shelterId>1</shelterId></ShletersInfo>
 <ShletersInfo><name>七堵國小</name><lat>25.1000</lat><lon>121.7000</lon>
   <openstatus>已滿</openstatus><shelterId>2</shelterId></ShletersInfo>
 <ShletersInfo><name>遠方中心</name><lat>24.0000</lat><lon>120.6000</lon>
   <openstatus>撤除</openstatus><shelterId>3</shelterId></ShletersInfo>
 <ShletersInfo><name>無座標</name><openstatus>開設</openstatus><shelterId>4</shelterId>
 </ShletersInfo>
</ShletersInfo></SheltersInfoList>"""


def test_parse_status_dedupes_and_needs_coordinates():
    records = nfa_status.parse_status_xml(STATUS_XML.encode("utf-8"))
    assert [(r.record_id, r.status) for r in records] == [
        ("1", "open"),
        ("2", "full"),
        ("3", "withdrawn"),
    ]


def test_normalize_status_never_guesses():
    assert nfa_status.normalize_status("撤除") == "withdrawn"
    assert nfa_status.normalize_status("something new") == "unknown"
    assert nfa_status.normalize_status(None) == "unknown"


def test_merge_status_exact_fuzzy_and_unmatched():
    shelters = [
        _shelter("a", "臺安國小", 25.0301, 121.5401, status="designated"),  # 台/臺 + ~15 m
        _shelter("b", "七堵國小活動中心", 25.1001, 121.7001, status="designated"),  # fuzzy
        _shelter("c", "遠方中心", 22.0, 120.0, status="designated"),  # same name, far away
    ]
    records = [
        nfa_status.StatusRecord("1", "台安國小", 25.0300, 121.5400, "open"),
        nfa_status.StatusRecord("2", "七堵國小", 25.1000, 121.7000, "full"),
        nfa_status.StatusRecord("3", "遠方中心", 24.0, 120.6, "withdrawn"),
    ]
    merged = nfa_status.merge_status(shelters, records)
    assert [s.status for s in merged] == ["open", "full", "designated"]
    assert [s.status for s in shelters] == ["designated"] * 3  # inputs untouched


def test_frozen_shelters_carry_status(settings):
    shelters = ExternalDataService(settings).shelters().items
    statuses = {s.status for s in shelters}
    assert statuses <= {"open", "full", "withdrawn", "unknown", "designated"}
    assert "withdrawn" in statuses  # every record in the 2026-10-14 snapshot was 撤除


def test_nearest_sorted_and_filtered():
    shelters = [
        _shelter("far", "Far", 25.10, 121.54, disaster_types=["earthquake"]),
        _shelter("near", "Near", 25.02, 121.54, disaster_types=["flood"]),
        _shelter("mid", "Mid", 25.05, 121.54, disaster_types=["earthquake"], status="full"),
        _shelter("none", "No types", 25.021, 121.54),
    ]
    got = nfa.nearest(shelters, 25.0174, 121.5405, limit=10)
    assert [s.id for s in got] == ["near", "none", "mid", "far"]
    assert got[0].distance_km < got[1].distance_km

    quake = nfa.nearest(shelters, 25.0174, 121.5405, disaster_type="earthquake")
    assert [s.id for s in quake] == ["mid", "far"]  # unknown suitability is excluded

    not_full = nfa.nearest(
        shelters, 25.0174, 121.5405, disaster_type="earthquake", exclude_status={"full"}
    )
    assert [s.id for s in not_full] == ["far"]
    assert len(nfa.nearest(shelters, 25.0174, 121.5405, limit=1)) == 1


def test_live_fetches_earthquake_cap_first(settings):
    live = make_settings(external_data_mode="live", ncdr_max_cap_docs=1)
    feed = (settings.frozen_data_dir / "ncdr_feed.xml").read_bytes()
    entries = ncdr.parse_feed(feed)
    quake_entry = next(e for e in entries if ncdr.is_earthquake_entry(e))
    cap = (settings.frozen_data_dir / "ncdr_cap" / ncdr.cap_filename(quake_entry.identifier))
    calls: list[str] = []

    def fetcher(url, _settings, _throttle):
        calls.append(url)
        if url == live.ncdr_feed_url:
            return feed
        if url == quake_entry.cap_url:
            return cap.read_bytes()
        raise SourceUnavailableError(url, "not in this test")

    result = ExternalDataService(live, fetcher=fetcher).earthquakes()
    assert calls == [live.ncdr_feed_url, quake_entry.cap_url]
    assert result.data_mode == "live"
    assert [q.magnitude for q in result.items] == [4.3]


def test_frozen_earthquake_report(settings):
    quakes = ExternalDataService(settings).earthquakes().items
    assert len(quakes) == 1
    q = quakes[0]
    assert q.id == "ncdr:CWA-EQ115069-2026-1013-173010"
    assert q.magnitude == 4.3
    assert q.depth_km == 33.8
    assert (q.epicenter_latitude, q.epicenter_longitude) == (23.559, 121.453)
    assert q.epicenter_location == "花蓮縣豐濱鄉"
    assert q.max_intensity == "3級"
    assert q.county_intensities[0].county == "花蓮縣"
    assert any(ci.county == "臺中市" and ci.intensity == "1級" for ci in q.county_intensities)
    assert q.publisher == "中央氣象署"
    assert q.data_mode == "frozen_real"
    assert q.origin_time is not None and q.origin_time.isoformat() == "2026-10-13T17:30:10+08:00"
