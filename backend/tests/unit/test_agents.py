import uuid
from pathlib import Path

import pytest

from app.agents.providers.base import LlmPermanentError, LlmTransientError
from app.agents.providers.fake import FakeProvider
from app.agents.registry import AgentRegistry, ModelResolver, ProviderFactory
from app.agents.runner import AgentRunner
from app.core.errors import ConfigError, LlmOutputInvalid, LlmUnavailable
from app.domain.tailoring import BulletTailorInput, BulletTailorOutput

BACKEND = Path(__file__).resolve().parents[2]
USER = uuid.uuid4()


class MemoryRecorder:
    def __init__(self):
        self.runs = []

    async def record(self, run):
        self.runs.append(run)
        return uuid.uuid4()


def _runner(fake):
    registry = AgentRegistry.load(BACKEND / "agents", BACKEND)
    resolver = ModelResolver({"strong": "fake:strong-model", "light": "fake:light-model"})
    recorder = MemoryRecorder()
    runner = AgentRunner(registry, resolver, ProviderFactory({"fake": fake}), recorder,
                         backoff_base_s=0.001)
    return runner, recorder


PAYLOAD = BulletTailorInput(jd_text="Python role", item_title="Engineer",
                            item_context="Acme", bullet_text="Built APIs in Python")


def test_registry_loads_all_agent_files():
    registry = AgentRegistry.load(BACKEND / "agents", BACKEND)
    assert registry.ids() == ["bullet_tailor", "cv_analyst", "cv_parser", "cv_tailor"]


def test_registry_rejects_unknown_schema(tmp_path):
    (tmp_path / "agents").mkdir()
    (tmp_path / "p.md").write_text("x")
    (tmp_path / "agents" / "bad.yaml").write_text(
        "id: bad\nversion: 1\ndescription: d\nmodel_tier: light\ntemperature: 0\n"
        "max_output_tokens: 100\ninstructions: p.md\ninput_schema: os.system\n"
        "output_schema: ParsedCv\ntimeout_s: 10\nmax_retries: 0\n")
    with pytest.raises(ConfigError, match="unknown schema"):
        AgentRegistry.load(tmp_path / "agents", tmp_path)


def test_registry_rejects_prompt_outside_base(tmp_path):
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "bad.yaml").write_text(
        "id: bad\nversion: 1\ndescription: d\nmodel_tier: light\ntemperature: 0\n"
        "max_output_tokens: 100\ninstructions: ../../etc/passwd\ninput_schema: ParserInput\n"
        "output_schema: ParsedCv\ntimeout_s: 10\nmax_retries: 0\n")
    with pytest.raises(ConfigError, match="prompt file"):
        AgentRegistry.load(tmp_path / "agents", tmp_path)


async def test_success_records_run_and_wraps_input_as_data():
    fake = FakeProvider()
    fake.push({"text": "Built Python APIs"})
    runner, recorder = _runner(fake)
    run = await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert run.output.text == "Built Python APIs"
    assert recorder.runs[0].status == "succeeded"
    assert recorder.runs[0].model == "strong-model"
    assert "untrusted DATA" in fake.calls[0]["user"]


async def test_transient_errors_retry_then_succeed():
    fake = FakeProvider()
    fake.push(LlmTransientError("429"), LlmTransientError("503"), {"text": "ok"})
    runner, recorder = _runner(fake)
    run = await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert run.output.text == "ok"
    assert recorder.runs[0].attempts == 3


async def test_retries_are_bounded():
    fake = FakeProvider()
    fake.push(*[LlmTransientError("503")] * 3)
    runner, recorder = _runner(fake)
    with pytest.raises(LlmUnavailable):
        await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert recorder.runs[0].status == "failed"
    assert recorder.runs[0].attempts == 3  # 1 + max_retries(2)


async def test_permanent_error_is_not_retried():
    fake = FakeProvider()
    fake.push(LlmPermanentError("400"))
    runner, recorder = _runner(fake)
    with pytest.raises(LlmUnavailable):
        await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert recorder.runs[0].attempts == 1


async def test_schema_invalid_output_fails_without_retry():
    fake = FakeProvider()
    fake.push({"wrong": "shape"})
    runner, recorder = _runner(fake)
    with pytest.raises(LlmOutputInvalid):
        await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert recorder.runs[0].error_code == "llm_output_invalid"
    assert len(fake.calls) == 1
