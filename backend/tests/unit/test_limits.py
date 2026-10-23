"""config/limits.yaml: loads, and any bad value stops startup (ConfigError, no fallback)."""

from pathlib import Path

import pytest
import yaml

from app.core.errors import ConfigError
from app.policy.limits import ConfiguredLimitPolicy, DailyAction, LimitsConfig, TotalLimit

BETA = Path(__file__).resolve().parents[2] / "config" / "limits.yaml"


def raw() -> dict:
    return yaml.safe_load(BETA.read_text("utf-8"))


def write(tmp_path: Path, data: dict) -> Path:
    path = tmp_path / "limits.yaml"
    path.write_text(yaml.safe_dump(data), encoding="utf-8")
    return path


def test_beta_file_has_the_launch_limits():
    beta = ConfiguredLimitPolicy(LimitsConfig.load(BETA)).limits_for(None)
    assert beta.daily[DailyAction.FULL_TAILOR] == 3
    assert beta.daily[DailyAction.CHAT_START] == 5
    assert beta.total[TotalLimit.CUSTOM_AGENTS] == 2


def test_beta_applies_to_every_account_plan():
    policy = ConfiguredLimitPolicy(LimitsConfig.load(BETA))
    assert not policy.needs_account_plan
    assert policy.limits_for("pro") == policy.limits_for("free") == policy.limits_for(None)


def test_per_plan_limits_once_switched_on(tmp_path):
    data = raw()
    beta = data["plans"]["beta"]
    data["plans"] = {"beta": beta, **{p: {**beta, "total": {"custom_agents": n}}
                                      for p, n in (("free", 1), ("plus", 5), ("pro", 10),
                                                   ("pro_plus", 20))}}
    data["use_account_plan"] = True
    policy = ConfiguredLimitPolicy(LimitsConfig.load(write(tmp_path, data)))
    assert policy.needs_account_plan
    assert policy.limits_for("plus").total[TotalLimit.CUSTOM_AGENTS] == 5
    with pytest.raises(ConfigError):
        policy.limits_for(None)


def _broken(data: dict, case: str) -> dict:
    daily = data["plans"]["beta"]["daily"]
    match case:
        case "missing_action":
            del daily["chat_start"]
        case "negative":
            daily["pdf"] = -1
        case "unknown_action":
            daily["teleport"] = 1
        case "extra_key":
            data["prices"] = {"beta": 0}
        case "no_default_block":
            data["default_plan"] = "gold"
        case "plan_blocks_missing":
            data["use_account_plan"] = True
    return data


@pytest.mark.parametrize("case", ["missing_action", "negative", "unknown_action", "extra_key",
                                  "no_default_block", "plan_blocks_missing"])
def test_bad_file_stops_startup(tmp_path, case):
    with pytest.raises(ConfigError):
        LimitsConfig.load(write(tmp_path, _broken(raw(), case)))


def test_missing_file_stops_startup(tmp_path):
    with pytest.raises(ConfigError):
        LimitsConfig.load(tmp_path / "nope.yaml")
