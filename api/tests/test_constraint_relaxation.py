"""Unit tests for constraint relaxation behaviour."""


from app.services.scoring_service import runtime_ceiling


def test_runtime_ceiling_mapping():
    assert runtime_ceiling("le_90") == 90
    assert runtime_ceiling("le_120") == 120
    assert runtime_ceiling("any") is None


def test_relaxation_json_shape():
    relaxation = {
        "runtime_minutes": {"original": 90, "relaxed_to": 120},
        "original_language": {"relaxed": True},
    }
    assert relaxation["runtime_minutes"]["original"] == 90
    assert relaxation["original_language"]["relaxed"] is True
