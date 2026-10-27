"""Render's /health polling is dropped from the access log; every other request is kept."""

import logging

from app.core.logging import HealthCheckFilter, configure_logging


def access_record(path: str) -> logging.LogRecord:
    args = ("10.0.0.1:1", "GET", path, "1.1", 200)
    return logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1,
                             '%s - "%s %s HTTP/%s" %d', args, None)


def test_drops_health_and_keeps_other_requests():
    f = HealthCheckFilter()
    assert not f.filter(access_record("/health"))
    assert not f.filter(access_record("/health?x=1"))
    assert f.filter(access_record("/resumes"))
    assert f.filter(access_record("/healthz"))


def test_keeps_lines_without_access_args():
    rec = logging.LogRecord("uvicorn.access", logging.INFO, __file__, 1, "started", None, None)
    assert HealthCheckFilter().filter(rec)


def test_configure_logging_installs_the_filter_once():
    configure_logging()
    configure_logging()
    access = logging.getLogger("uvicorn.access")
    assert sum(isinstance(f, HealthCheckFilter) for f in access.filters) == 1
