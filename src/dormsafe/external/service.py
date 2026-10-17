"""Loads external data according to the configured mode, with provenance.

frozen mode: bundled real snapshot                              -> data_mode "frozen_real"
live mode:   official source                                    -> "live"
             same live result again within cache_ttl_seconds    -> "cached_real"
             source unavailable / rate-limited / malformed      -> frozen snapshot, "frozen_real"

Each source (NCDR feed + CAP docs, NFA locations, NFA status) is loaded and cached on its own;
the public results are derived from them. A combined result reports the weakest data mode
of its inputs (frozen_real < cached_real < live).
"""

from __future__ import annotations

import json
import logging
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from functools import cached_property
from pathlib import Path
from typing import Any, Generic, TypeVar

from dormsafe.config import Settings
from dormsafe.external import ncdr, nfa, nfa_status
from dormsafe.external.http import SourceUnavailableError, Throttle, fetch_bytes
from dormsafe.external.models import DataMode, Earthquake, ExternalAlert, Shelter
from dormsafe.external.parsing import parse_datetime

log = logging.getLogger(__name__)

T = TypeVar("T")
Fetcher = Callable[[str, Settings, Throttle | None], bytes]

_FETCH_ERRORS = (SourceUnavailableError, ValueError, ET.ParseError)
_MODE_RANK: dict[DataMode, int] = {"frozen_real": 0, "cached_real": 1, "live": 2}


@dataclass(frozen=True)
class Provenance:
    data_mode: DataMode
    source: str
    source_url: str
    retrieved_at: datetime | None


@dataclass
class ExternalResult(Generic[T]):
    items: list[T]
    data_mode: DataMode
    source: str
    source_url: str
    retrieved_at: datetime | None


@dataclass
class NcdrData:
    entries: list[ncdr.FeedEntry]
    caps: dict[str, ncdr.CapAlert]


class ExternalDataService:
    def __init__(self, settings: Settings, fetcher: Fetcher = fetch_bytes) -> None:
        self.settings = settings
        self._fetch = fetcher
        self._ncdr_throttle = Throttle(settings.ncdr_min_request_interval)
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, Provenance, Any]] = {}
        self._merged: tuple[tuple[int, int], list[Shelter]] | None = None

    # ------------------------------------------------------------ public

    def alerts(self) -> ExternalResult[ExternalAlert]:
        prov, data = self._ncdr()
        return _result(ncdr.build_alerts(data.entries, data.caps, prov.data_mode), prov)

    def earthquakes(self) -> ExternalResult[Earthquake]:
        """Earthquake reports (newest first) among the current, non-superseded alerts."""
        prov, data = self._ncdr()
        current = {a.id for a in ncdr.build_alerts(data.entries, data.caps, prov.data_mode)}
        quakes = [
            q
            for cap in data.caps.values()
            if f"ncdr:{cap.identifier}" in current
            and (q := ncdr.earthquake_from_cap(cap, prov.data_mode)) is not None
        ]
        quakes.sort(key=lambda q: q.origin_time or datetime.min.replace(tzinfo=UTC), reverse=True)
        return _result(quakes, prov)

    def shelters(self) -> ExternalResult[Shelter]:
        """NFA shelter locations with status merged in from the NFA status dataset."""
        loc_prov, locations = self._get("nfa_shelters", self._live_shelters, self._frozen_shelters)
        st_prov, statuses = self._get("nfa_status", self._live_status, self._frozen_status)
        with self._lock:
            key = (id(locations), id(statuses))
            if self._merged is None or self._merged[0] != key:
                self._merged = (key, nfa_status.merge_status(locations, statuses))
            merged = self._merged[1]
        mode = min(loc_prov.data_mode, st_prov.data_mode, key=_MODE_RANK.__getitem__)
        return _result(merged, replace(loc_prov, data_mode=mode))

    # ------------------------------------------------------------ mode / cache

    def _get(
        self,
        key: str,
        live: Callable[[], tuple[Provenance, Any]],
        frozen: Callable[[], tuple[Provenance, Any]],
    ) -> tuple[Provenance, Any]:
        if self.settings.external_data_mode == "frozen":
            return frozen()
        with self._lock:
            cached = self._cache.get(key)
            if cached and cached[0] > time.monotonic():
                prov, payload = cached[1], cached[2]
                if prov.data_mode == "live":
                    prov = replace(prov, data_mode="cached_real")
                return prov, payload
            try:
                prov, payload = live()
            except _FETCH_ERRORS as exc:
                log.warning("%s live fetch failed (%s); serving frozen snapshot", key, exc)
                prov, payload = frozen()
            self._cache[key] = (time.monotonic() + self.settings.cache_ttl_seconds, prov, payload)
            return prov, payload

    def _ncdr(self) -> tuple[Provenance, NcdrData]:
        return self._get("ncdr", self._live_ncdr, self._frozen_ncdr)

    # ------------------------------------------------------------ live

    def _live_ncdr(self) -> tuple[Provenance, NcdrData]:
        url = self.settings.ncdr_feed_url
        entries = ncdr.parse_feed(self._fetch(url, self.settings, self._ncdr_throttle))
        # Earthquake reports first, so they always get full CAP details within the budget.
        ordered = sorted(entries, key=lambda e: not ncdr.is_earthquake_entry(e))
        caps: dict[str, ncdr.CapAlert] = {}
        for entry in ordered[: self.settings.ncdr_max_cap_docs]:
            if not entry.cap_url:
                continue
            try:
                content = self._fetch(entry.cap_url, self.settings, self._ncdr_throttle)
                caps[entry.identifier] = ncdr.parse_cap(content)
            except _FETCH_ERRORS as exc:
                log.warning("CAP %s unavailable (%s); using feed entry only", entry.identifier, exc)
        prov = Provenance("live", ncdr.NCDR_SOURCE, url, datetime.now(UTC))
        return prov, NcdrData(entries, caps)

    def _live_shelters(self) -> tuple[Provenance, list[Shelter]]:
        url = self.settings.nfa_shelters_url
        shelters = nfa.parse_shelters_csv(self._fetch(url, self.settings, None))
        return Provenance("live", nfa.NFA_SOURCE, url, datetime.now(UTC)), shelters

    def _live_status(self) -> tuple[Provenance, list[nfa_status.StatusRecord]]:
        url = self.settings.nfa_status_url
        records = nfa_status.parse_status_xml(self._fetch(url, self.settings, None))
        return Provenance("live", nfa.NFA_SOURCE, url, datetime.now(UTC)), records

    # ------------------------------------------------------------ frozen (parsed once)

    @property
    def _frozen_dir(self) -> Path:
        return self.settings.frozen_data_dir

    def _frozen_meta(self, key: str) -> tuple[dict, Provenance]:
        meta = json.loads((self._frozen_dir / "metadata.json").read_text(encoding="utf-8"))
        source = meta["sources"][key]
        prov = Provenance(
            "frozen_real", source["source"], source["url"], parse_datetime(source["retrieved_at"])
        )
        return source, prov

    def _frozen_ncdr(self) -> tuple[Provenance, NcdrData]:
        return self._frozen_ncdr_cached

    def _frozen_shelters(self) -> tuple[Provenance, list[Shelter]]:
        return self._frozen_shelters_cached

    def _frozen_status(self) -> tuple[Provenance, list[nfa_status.StatusRecord]]:
        return self._frozen_status_cached

    @cached_property
    def _frozen_ncdr_cached(self) -> tuple[Provenance, NcdrData]:
        meta, prov = self._frozen_meta("ncdr_alerts")
        entries = ncdr.parse_feed((self._frozen_dir / meta["file"]).read_bytes())
        caps: dict[str, ncdr.CapAlert] = {}
        for entry in entries:
            path = self._frozen_dir / meta["cap_dir"] / ncdr.cap_filename(entry.identifier)
            if path.exists():
                caps[entry.identifier] = ncdr.parse_cap(path.read_bytes())
        return prov, NcdrData(entries, caps)

    @cached_property
    def _frozen_shelters_cached(self) -> tuple[Provenance, list[Shelter]]:
        meta, prov = self._frozen_meta("nfa_shelters")
        return prov, nfa.parse_shelters_csv((self._frozen_dir / meta["file"]).read_bytes())

    @cached_property
    def _frozen_status_cached(self) -> tuple[Provenance, list[nfa_status.StatusRecord]]:
        meta, prov = self._frozen_meta("nfa_status")
        return prov, nfa_status.parse_status_xml((self._frozen_dir / meta["file"]).read_bytes())


def _result(items: list[T], prov: Provenance) -> ExternalResult[T]:
    return ExternalResult(items, prov.data_mode, prov.source, prov.source_url, prov.retrieved_at)
