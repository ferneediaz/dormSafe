"""The only place external network requests are made."""

from __future__ import annotations

import logging
import threading
import time

import httpx

from dormsafe.config import Settings

log = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


class SourceUnavailableError(RuntimeError):
    """An external source could not be fetched (network error, timeout, bad status)."""

    def __init__(self, url: str, reason: str) -> None:
        super().__init__(f"Source unavailable: {url} ({reason})")
        self.url = url
        self.reason = reason


class Throttle:
    """Enforces a minimum interval between requests (NCDR rejects requests < 3 s apart)."""

    def __init__(self, min_interval: float) -> None:
        self.min_interval = min_interval
        self._last = 0.0
        self._lock = threading.Lock()

    def wait(self) -> None:
        with self._lock:
            delay = self._last + self.min_interval - time.monotonic()
            if delay > 0:
                time.sleep(delay)
            self._last = time.monotonic()


def fetch_bytes(url: str, settings: Settings, throttle: Throttle | None = None) -> bytes:
    if throttle is not None:
        throttle.wait()
    try:
        response = httpx.get(
            url,
            timeout=settings.http_timeout,
            headers={"User-Agent": settings.user_agent},
            follow_redirects=True,
        )
    except httpx.TransportError as exc:
        raise SourceUnavailableError(url, f"{type(exc).__name__}: {exc}") from exc
    if response.status_code != 200:
        raise SourceUnavailableError(url, f"HTTP {response.status_code}")
    log.info("fetched %s (%d bytes)", url, len(response.content))
    return response.content
