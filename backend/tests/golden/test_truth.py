"""Golden tests for TRUTH-1..4: invented facts rejected, honest rewording accepted."""

import pytest

from app.domain.cv import Origin, TailorState
from app.domain.tailoring import BulletOut, ItemOut, SkillsView, TailorOutput
from app.domain.truth import Rule
from app.truth.checker import TruthChecker
from app.truth.facts import FactSetBuilder
from app.truth.merger import ResumeMerger, keep, propose, revert
from tests.fixtures import b, sample_cv

CV = sample_cv()
FACTS = FactSetBuilder().build([], CV)
CHECK = TruthChecker(FACTS)
P = "experience[nw].bullets[nw1]"


def rules(text: str, item: str = "nw", missing: list[str] | None = None) -> set[Rule]:
    return {v.rule for v in CHECK.check_bullet(item, P, text, missing)}


# ---------- honest rewording passes ----------

@pytest.mark.parametrize("text", [
    "Reduced p95 payment-event latency by 38% by migrating the ledger service to Kafka Streams "
    "on AWS using Java",
    "Scaled the settlement pipeline to 2M events/day with zero data loss by building "
    "idempotent consumers and replay tooling",
    "Mentored two interns to their first production launch in under 8 weeks",  # TRUTH-4
    "Improved reliability of event-driven payment services in Java on AWS",
])
def test_reworded_facts_pass(text):
    assert rules(text) == set()


# ---------- invention is caught ----------

def test_invented_metric():
    assert rules("Cut payment-event latency by 45% by moving to Kafka Streams") == {
        Rule.UNKNOWN_NUMBER}


def test_metric_moved_from_another_job():
    # 30% belongs to Brightline, not Northwind: item-scoped numbers.
    assert Rule.UNKNOWN_NUMBER in rules("Cut payment-event latency by 30% using Kafka Streams")


def test_invented_skill():
    assert rules("Moved the ledger service to Kafka Streams on Kubernetes") == {
        Rule.UNKNOWN_SKILL}


def test_skill_alias_is_the_same_fact():
    facts = FactSetBuilder().build([], CV.model_copy(update={"projects": []}))
    # PostgreSQL only appears in the project; once removed, "Postgres" must be unknown.
    assert Rule.UNKNOWN_SKILL in {v.rule for v in TruthChecker(facts).check_bullet(
        "nw", P, "Moved the ledger to Postgres")}
    assert rules("Built a ledger on Postgres", item="ll") == set()


def test_missing_jd_skill_written_in():
    assert Rule.MISSING_SKILL_USED in rules(
        "Owned distributed systems tracing with Honeycomb across the settlement pipeline",
        missing=["Honeycomb"])


def test_invented_employer_or_product():
    assert rules("Cut latency by 38% for Stripe by moving the ledger to Kafka Streams") == {
        Rule.UNKNOWN_SKILL}  # Stripe is a lexicon term
    assert rules("Cut latency by 38% for Zentrix Payments using Kafka Streams") == {
        Rule.UNKNOWN_NAME}


def test_invented_year():
    assert rules("Cut latency by 38% in 2019 by moving to Kafka Streams") == {Rule.UNKNOWN_DATE}


def test_react_as_a_verb_is_not_a_skill():
    assert rules("Helped the team react faster to incidents with runbooks", item="bl") == set()


# ---------- full tailor: structure + merge ----------

def _output(**overrides) -> TailorOutput:
    base = dict(
        experience_order=["bl", "nw"],
        items=[
            ItemOut(id="nw", bullets=[
                BulletOut(id="nw2", text="Scaled the settlement pipeline to 2M events/day with "
                                         "zero data loss via idempotent consumers"),
                BulletOut(id="nw1", text="Cut p95 latency by 45% with Kafka Streams"),  # invented
                BulletOut(id="nw3", text=CV.experience[0].bullets[2].text),
            ]),
            ItemOut(id="bl", bullets=[BulletOut(id="bl1", text=CV.experience[1].bullets[0].text),
                                      BulletOut(id="bl2", text=CV.experience[1].bullets[1].text)]),
            ItemOut(id="ll", bullets=[BulletOut(id="ll1", text=CV.projects[0].bullets[0].text)]),
        ],
        skills=SkillsView(languages=["SQL", "Java", "Python"],
                          frameworks=["Kafka Streams", "Spring Boot", "JUnit"],
                          tools=["AWS", "Docker", "Git", "Grafana"]),
        missing_skills=["Kubernetes"],
    )
    base.update(overrides)
    return TailorOutput(**base)


def test_full_tailor_keeps_violating_bullet_and_applies_the_rest():
    out = _output()
    report = CHECK.check_tailor(CV, out, out.missing_skills, "all")
    assert {v.field_path for v in report.violations} == {P}

    result = ResumeMerger().merge_tailor(CV, out, report, "all")
    nw = next(e for e in result.content.experience if e.id == "nw")
    by_id = {x.id: x for x in nw.bullets}
    assert by_id["nw1"].text == CV.experience[0].bullets[0].text      # kept original
    assert by_id["nw2"].tailor_state is TailorState.PROPOSED          # applied
    assert by_id["nw2"].original_text == CV.experience[0].bullets[1].text
    assert [e.id for e in result.content.experience] == ["bl", "nw"]  # TAIL-5 order
    assert [s.name for s in result.content.skills.languages] == ["SQL", "Java", "Python"]
    assert (result.changed, result.kept_original) == (1, 1)


def test_added_skill_rejected_and_skills_left_alone():
    out = _output(skills=SkillsView(languages=["Java", "Python", "Go"],
                                    frameworks=["Spring Boot", "Kafka Streams", "JUnit"],
                                    tools=["AWS", "Docker", "Git", "Grafana"]))
    report = CHECK.check_tailor(CV, out, [], "all")
    assert Rule.SKILL_SET_CHANGED in {v.rule for v in report.violations}
    merged = ResumeMerger().merge_tailor(CV, out, report, "all").content
    assert [s.name for s in merged.skills.languages] == ["Java", "Python", "SQL"]


def test_dropped_bullet_rejects_the_whole_item():
    out = _output()
    items = [ItemOut(id="nw", bullets=out.items[0].bullets[:2]), *out.items[1:]]
    report = CHECK.check_tailor(CV, out.model_copy(update={"items": items}), [], "all")
    assert Rule.COUNT_CHANGED in {v.rule for v in report.violations}


def test_locked_bullet_is_never_changed():
    locked = b("nw1", CV.experience[0].bullets[0].text, origin=Origin.USER, locked=True)
    exp = CV.experience[0].model_copy(update={"bullets": [locked, *CV.experience[0].bullets[1:]]})
    cv = CV.model_copy(update={"experience": [exp, CV.experience[1]]})
    out = _output()
    # The "model" rewrites the locked nw1 honestly; the merger must still ignore it.
    honest =out.model_copy(update={"items": [ItemOut(id="nw", bullets=[
        BulletOut(id="nw1", text="Reduced latency by 38% with Kafka Streams in Java"),
        *out.items[0].bullets[::2]]), *out.items[1:]]})
    report = TruthChecker(FactSetBuilder().build([], cv)).check_tailor(cv, honest, [], "all")
    result = ResumeMerger().merge_tailor(cv, honest, report, "all")
    nw1 = next(x for e in result.content.experience for x in e.bullets if x.id == "nw1")
    assert nw1 == locked
    assert result.dropped_locked == 1


# ---------- keep / revert ----------

def test_revert_restores_user_text_and_lock():
    user = b("x", "Wrote it myself", origin=Origin.USER, locked=True)
    proposed = propose(user, "AI version")
    assert (proposed.origin, proposed.locked) == (Origin.AI, False)
    assert revert(proposed) == user.model_copy(update={"tailor_state": TailorState.NONE})
    assert keep(proposed).tailor_state is TailorState.KEPT


def test_retailoring_keeps_the_first_original():
    first = propose(b("x", "Original"), "AI v1")
    second = propose(first, "AI v2")
    assert second.original_text == "Original"


def test_ai_text_is_never_a_fact():
    ai = b("nw1", "Cut latency by 77% with Kafka Streams", origin=Origin.AI)
    exp = CV.experience[0].model_copy(update={"bullets": [ai]})
    facts = FactSetBuilder().build([], CV.model_copy(update={"experience": [exp]}))
    assert "77" not in facts.numbers_by_item["nw"]
