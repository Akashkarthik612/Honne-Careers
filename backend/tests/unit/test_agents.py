import uuid
from pathlib import Path

import pytest

from app.agents.providers.base import LlmPermanentError, LlmTransientError
from app.agents.providers.fake import FakeProvider
from app.agents.registry import AgentRegistry, ModelResolver, ProviderFactory
from app.agents.runner import AgentRunner
from app.core.errors import ConfigError, LlmOutputInvalid, LlmUnavailable
from app.domain.tailoring import BulletTailorInput, BulletTailorOutput
from tests.fakes import FakeTracer

BACKEND = Path(__file__).resolve().parents[2]
USER = uuid.uuid4()


class MemoryRecorder:
    def __init__(self):
        self.runs = []

    async def record(self, run):
        self.runs.append(run)
        return uuid.uuid4()


def _runner(fake, tracer=None):
    registry = AgentRegistry.load(BACKEND / "agents", BACKEND)
    resolver = ModelResolver({"strong": "fake:strong-model", "light": "fake:light-model"})
    recorder = MemoryRecorder()
    runner = AgentRunner(registry, resolver, ProviderFactory({"fake": fake}), recorder,
                         backoff_base_s=0.001, tracer=tracer or FakeTracer())
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


# ---------- tracing: one metadata-only span per run ----------

async def test_trace_span_has_run_metadata_and_no_text():
    fake, tracer = FakeProvider(), FakeTracer()
    fake.push({"text": "Built Python APIs at Acme"})
    runner, recorder = _runner(fake, tracer)
    await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    [span] = tracer.spans
    assert span["name"] == "bullet_tailor" and span["run_type"] == "llm"
    assert span["status"] == "succeeded" and span["attempts"] == 1
    assert span["model"] == "strong-model" and span["agent_version"] == 3
    assert span["user_id"] == USER and span["run_id"] is not None
    values = " ".join(str(v) for v in span.values())
    for text in ("Python role", "Built APIs in Python", "Built Python APIs at Acme", "Acme"):
        assert text not in values


async def test_trace_span_records_failure():
    fake, tracer = FakeProvider(), FakeTracer()
    fake.push({"wrong": "shape"})
    runner, _ = _runner(fake, tracer)
    with pytest.raises(LlmOutputInvalid):
        await runner.run("bullet_tailor", PAYLOAD, BulletTailorOutput, user_id=USER)
    assert tracer.spans[0]["status"] == "failed"
    assert tracer.spans[0]["error_code"] == "llm_output_invalid"


async def test_langsmith_spans_send_no_text_and_only_the_error_class(monkeypatch):
    from langsmith.run_trees import RunTree

    from app.agents.tracing import LangSmithTracer

    sent: list[RunTree] = []
    monkeypatch.setattr(RunTree, "post", lambda self, *a, **k: sent.append(self))
    monkeypatch.setattr(RunTree, "patch", lambda self, *a, **k: None)
    tracer = LangSmithTracer(object(), "test-project")  # type: ignore[arg-type]  # never called
    with pytest.raises(ValueError, match="secret CV text"):
        async with (tracer.span("tailor_job", entity_id=USER) as job,
                    tracer.span("cv_tailor", "llm") as agent):
            agent.update(attempts=1)
            job.update(truth_violations=0)
            raise ValueError("secret CV text")
    parent, child = sent
    assert child.parent_run_id == parent.id  # agent span nests under the job span
    for run in sent:
        assert run.inputs == {} and not run.outputs
        assert run.error == "ValueError"
    assert parent.extra["metadata"]["entity_id"] == str(USER)
    assert child.extra["metadata"]["attempts"] == 1
