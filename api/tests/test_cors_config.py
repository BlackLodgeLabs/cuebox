"""CORS origin configuration tests."""

from app.core.config import get_cors_allow_origins


def test_cors_allow_origins_default():
    assert get_cors_allow_origins() == ["http://localhost:3000"]


def test_cors_allow_origins_from_env(monkeypatch):
    monkeypatch.setenv("LAN_HOST", "192.168.1.50")
    assert get_cors_allow_origins() == [
        "http://localhost:3000",
        "http://192.168.1.50:3000",
    ]


def test_cors_allow_origins_loads_dotenv_before_reading(monkeypatch):
    load_calls = 0

    def fake_load_dotenv(*_args, **_kwargs):
        nonlocal load_calls
        load_calls += 1
        monkeypatch.setenv("LAN_HOST", "192.168.1.99")

    monkeypatch.setattr("dotenv.load_dotenv", fake_load_dotenv)
    monkeypatch.delenv("LAN_HOST", raising=False)

    assert get_cors_allow_origins() == [
        "http://localhost:3000",
        "http://192.168.1.99:3000",
    ]
    assert load_calls == 1
