"""Loads external data according to the configured mode, with provenance.

frozen mode: bundled real snapshot                              -> data_mode "frozen_real"
live mode:   official source                                    -> "live"
             same live result again within cache_ttl_seconds    -> "cached_real"
             source unavailable / rate-limited / malformed      -> frozen snapshot, "frozen_real"
"""

from __future__ import annotations

import json
import logging
import threading
import time
import xml.etree.ElementTree as ET
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from functools import cached_property
from pathlib import Path
from typing import Generic, TypeVar

from dormsafe.config import Settings
from dormsafe.external import ncdr, nfa
from dormsafe.external.http import SourceUnavailableError, Throttle, fetch_bytes
from dormsafe.external.models import DataMode, ExternalAlert, Shelter
from dormsafe.external.parsing import parse_datetime

log = logging.getLogger(__name__)

T = TypeVar("T")
Fetcher = Callable[[str, Settings, Throttle | None], bytes]

_FETCH_ERRORS = (SourceUnavailableError, ValueError, ET.ParseError)


@dataclass
class ExternalResult(Generic[T]):
    items: list[T]
    data_mode: DataMode
    source: str
    source_url: str
    retrieved_at: datetime | None


class ExternalDataService:
    def __init__(self, settings: Settings, fetcher: Fetcher = fetch_bytes) -> None:
        self.settings = settings
        self._fetch = fetcher
        self._ncdr_throttle = Throttle(settings.ncdr_min_request_interval)
        self._lock = threading.Lock()
        self._cache: dict[str, tuple[float, ExternalResult]] = {}

    # ------------------------------------------------------------ public

    def alerts(self) -> ExternalResult[ExternalAlert]:
        return self._get("ncdr_alerts", self._live_alerts, lambda: self._frozen_alerts)

    def shelters(self) -> ExternalResult[Shelter]:
        return self._get("nfa_shelters", self._live_shelters, lambda: self._frozen_shelters)

    # ------------------------------------------------------------ mode / cache

    def _get(
        self,
        key: str,
        live: Callable[[], ExternalResult],
        frozen: Callable[[], ExternalResult],
    ) -> ExternalResult:
        if self.settings.external_data_mode == "frozen":
            return frozen()
        with self._lock:
            cached = self._cache.get(key)
            if cached and cached[0] > time.monotonic():
                result = cached[1]
                if result.data_mode == "live":
                    return _with_mode(result, "cached_real")
                return result
            try:
                result = live()
            except _FETCH_ERRORS as exc:
                log.warning("%s live fetch failed (%s); serving frozen snapshot", key, exc)
                result = frozen()
            self._cache[key] = (time.monotonic() + self.settings.cache_ttl_seconds, result)
            return result

    # ------------------------------------------------------------ live

    def _live_alerts(self) -> ExternalResult[ExternalAlert]:
        url = self.settings.ncdr_feed_url
        entries = ncdr.parse_feed(self._fetch(url, self.settings, self._ncdr_throttle))
        caps: dict[str, ncdr.CapAlert] = {}
        for entry in entries[: self.settings.ncdr_max_cap_docs]:
            if not entry.cap_url:
                continue
            try:
                content = self._fetch(entry.cap_url, self.settings, self._ncdr_throttle)
                caps[entry.identifier] = ncdr.parse_cap(content)
            except _FETCH_ERRORS as exc:
                log.warning("CAP %s unavailable (%s); using feed entry only", entry.identifier, exc)
        return ExternalResult(
            items=ncdr.build_alerts(entries, caps, "live"),
            data_mode="live",
            source=ncdr.NCDR_SOURCE,
            source_url=url,
            retrieved_at=datetime.now(UTC),
        )

    def _live_shelters(self) -> ExternalResult[Shelter]:
        url = self.settings.nfa_shelters_url
        return ExternalResult(
            items=nfa.parse_shelters_csv(self._fetch(url, self.settings, None)),
            data_mode="live",
            source=nfa.NFA_SOURCE,
            source_url=url,
            retrieved_at=datetime.now(UTC),
        )

    # ------------------------------------------------------------ frozen (parsed once)

    @property
    def _frozen_dir(self) -> Path:
        return self.settings.frozen_data_dir

    def _frozen_meta(self, key: str) -> dict:
        meta = json.loads((self._frozen_dir / "metadata.json").read_text(encoding="utf-8"))
        return meta["sources"][key]

    @cached_property
    def _frozen_alerts(self) -> ExternalResult[ExternalAlert]:
        meta = self._frozen_meta("ncdr_alerts")
        entries = ncdr.parse_feed((self._frozen_dir / meta["file"]).read_bytes())
        caps: dict[str, ncdr.CapAlert] = {}
        for entry in entries:
            path = self._frozen_dir / meta["cap_dir"] / ncdr.cap_filename(entry.identifier)
            if path.exists():
                caps[entry.identifier] = ncdr.parse_cap(path.read_bytes())
        return ExternalResult(
            items=ncdr.build_alerts(entries, caps, "frozen_real"),
            data_mode="frozen_real",
            source=meta["source"],
            source_url=meta["url"],
            retrieved_at=parse_datetime(meta["retrieved_at"]),
        )

    @cached_property
    def _frozen_shelters(self) -> ExternalResult[Shelter]:
        meta = self._frozen_meta("nfa_shelters")
        return ExternalResult(
            items=nfa.parse_shelters_csv((self._frozen_dir / meta["file"]).read_bytes()),
            data_mode="frozen_real",
            source=meta["source"],
            source_url=meta["url"],
            retrieved_at=parse_datetime(meta["retrieved_at"]),
        )


def _with_mode(result: ExternalResult, mode: DataMode) -> ExternalResult:
    items = [
        item.model_copy(update={"data_mode": mode}) if isinstance(item, ExternalAlert) else item
        for item in result.items
    ]
    return ExternalResult(items, mode, result.source, result.source_url, result.retrieved_at)
