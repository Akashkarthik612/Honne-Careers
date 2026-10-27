"""Tailoring use cases (B6): per-bullet tailor, Keep/Revert, full tailor job.

Shape of every flow: short transaction (load + checks + quota) -> LLM call with no
transaction open -> deterministic truth check -> short transaction (write with
optimistic concurrency). The model never writes a locked field (B5).
"""

from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.agents.runner import AgentRunner
from app.agents.tracing import Span, Tracer
from app.core.errors import (
    AppError,
    InvalidInput,
    JobAlreadyRunning,
    NotFound,
    StaleVersion,
    TruthViolation,
)
from app.core.hashing import content_hash
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWork, UnitOfWorkFactory
from app.domain.auth import AuthUser
from app.domain.career import CareerStage, career_stage, experience_span
from app.domain.cv import Bullet, CvContent, ExperienceItem, Origin, ProjectItem
from app.domain.records import JdRow, JobStep, ResumeRow
from app.domain.tailoring import (
    BulletTailorInput,
    BulletTailorOutput,
    BulletView,
    ItemView,
    SkillsView,
    TailorInput,
    TailorOutput,
)
from app.domain.truth import FactSet
from app.policy.entitlements import Entitlements
from app.policy.limits import DailyAction
from app.policy.quota import QuotaGuard
from app.truth.checker import TruthChecker
from app.truth.copying import fact_text
from app.truth.facts import FactSetBuilder, evidenced
from app.truth.merger import ResumeMerger, keep, propose, replace_bullet, revert
from app.truth.text import norm_skill, skill_keys, unique_skills

log = get_logger(__name__)


@dataclass(frozen=True, slots=True)
class TailorContext:
    resume: ResumeRow
    jd: JdRow
    facts: FactSet


async def load_context(uow: UnitOfWork, user: AuthUser, resume_id: UUID) -> TailorContext:
    """Resume + JD + every fact source (profile, recent uploads, the resume itself)."""
    resume = await uow.resumes.get(user.id, resume_id)
    if resume is None:
        raise NotFound(reason="resume")
    if resume.jd_id is None:
        raise InvalidInput("Paste a job description first.", reason="no_jd")
    jd = await uow.jds.get(user.id, resume.jd_id)
    if jd is None:
        raise InvalidInput("Paste a job description first.", reason="no_jd")
    profile = await uow.profiles.get(user.id)
    uploads = await uow.uploads.list_parsed(user.id)
    sources = [profile.content] if profile else []
    prefills = [u.parsed for u in uploads if u.parsed is not None]
    return TailorContext(resume, jd, FactSetBuilder().build(sources, resume.content, prefills))


def _find_bullet(content: CvContent, bullet_id: str
                 ) -> tuple[ExperienceItem | ProjectItem, Bullet]:
    for item in (*content.experience, *content.projects):
        for bullet in item.bullets:
            if bullet.id == bullet_id:
                return item, bullet
    raise NotFound(reason="bullet")


def _title_context(item: ExperienceItem | ProjectItem) -> tuple[str, str]:
    if isinstance(item, ExperienceItem):
        return item.role or item.company, item.company
    return item.name, ", ".join(item.tech)[:120]


def _kind(content: CvContent, item_id: str) -> str:
    return "experience" if any(e.id == item_id for e in content.experience) else "projects"


def stage_of(content: CvContent, span: Span, resume_id: UUID) -> CareerStage:
    """TAIL-8: fresher (< 2 yrs) gets a professional rewrite, senior (> 8 yrs) is never
    condensed. Unreadable dates are skipped, never guessed (logged, counts only)."""
    exp = experience_span(content, today=date.today())
    stage = career_stage(exp)
    if exp.unreadable:
        log.warning("career_date_unreadable", resume_id=resume_id, roles=exp.roles,
                    unreadable=exp.unreadable, career_stage=stage.value)
    span.update(career_stage=stage.value, experience_months=exp.months)
    return stage


class BulletTailorService:
    def __init__(self, uow: UnitOfWorkFactory, runner: AgentRunner, quota: QuotaGuard,
                 entitlements: Entitlements, tracer: Tracer) -> None:
        self._uow = uow
        self._tracer = tracer
        self._runner = runner
        self._quota = quota
        self._entitlements = entitlements

    async def tailor(self, user: AuthUser, resume_id: UUID, bullet_id: str) -> tuple[Bullet, int]:
        async with self._tracer.span("bullet_tailor_job", user_id=user.id,
                                     entity_id=resume_id) as span:
            return await self._tailor(span, user, resume_id, bullet_id)

    async def _tailor(self, span: Span, user: AuthUser, resume_id: UUID, bullet_id: str
                      ) -> tuple[Bullet, int]:
        async with self._uow(user.id) as uow:
            ctx = await load_context(uow, user, resume_id)
            if ctx.resume.status == "tailoring":
                raise JobAlreadyRunning(reason="bullet_during_full_tailor")
            account = await uow.accounts.get(user.id)
            self._entitlements.require(account.plan if account else "free", "tailor_mode")
            item, bullet = _find_bullet(ctx.resume.content, bullet_id)
            await self._quota.consume(uow, user.id, DailyAction.BULLET_TAILOR)

        title, context = _title_context(item)
        siblings = [b.text for b in item.bullets if b.id != bullet_id and b.origin is not Origin.AI]
        source_text = fact_text(bullet)  # re-tailor from the fact, never from AI wording
        run = await self._runner.run(
            "bullet_tailor",
            BulletTailorInput(jd_text=ctx.jd.text, item_title=title, item_context=context,
                              item_facts=siblings, bullet_text=source_text,
                              career_stage=stage_of(ctx.resume.content, span, resume_id)),
            BulletTailorOutput, user_id=user.id, entity_id=resume_id)

        path = f"{_kind(ctx.resume.content, item.id)}[{item.id}].bullets[{bullet_id}]"
        violations = TruthChecker(ctx.facts).check_bullet(item.id, path, run.output.text)
        span.update(truth_violations=len(violations))
        if violations:
            # B9: suggestion rejected, bullet unchanged. Rules only in details (no text).
            log.warning("bullet_tailor_rejected", resume_id=resume_id, bullet_id=bullet_id,
                        rules=sorted({v.rule.value for v in violations}))
            raise TruthViolation(rules=sorted({v.rule.value for v in violations}))

        proposed = propose(bullet, run.output.text)
        version = await self._write(user, resume_id, ctx.resume.row_version, bullet_id,
                                    bullet, proposed)
        log.info("bullet_tailored", resume_id=resume_id, bullet_id=bullet_id,
                 row_version=version)
        return proposed, version

    async def settle(self, user: AuthUser, resume_id: UUID, bullet_id: str, action: str,
                     expected_version: int) -> tuple[Bullet, int]:
        """Keep or Revert a proposed bullet (B6). 0 LLM calls."""
        async with self._uow(user.id) as uow:
            row = await uow.resumes.get(user.id, resume_id, for_update=True)
            if row is None:
                raise NotFound(reason="resume")
            if row.row_version != expected_version:
                raise StaleVersion(reason="resume", current_version=row.row_version)
            _, bullet = _find_bullet(row.content, bullet_id)
            settled = keep(bullet) if action == "keep" else revert(bullet)
            content = replace_bullet(row.content, bullet_id, settled)
            version = await uow.resumes.update_content(
                user.id, resume_id, content, content_hash(content), expected_version, None)
            if version is None:
                raise JobAlreadyRunning(reason="settle_during_tailor")
        log.info("bullet_settled", resume_id=resume_id, bullet_id=bullet_id, action=action)
        return settled, version

    async def _write(self, user: AuthUser, resume_id: UUID, read_version: int, bullet_id: str,
                     before: Bullet, proposed: Bullet) -> int:
        async with self._uow(user.id) as uow:
            row = await uow.resumes.get(user.id, resume_id, for_update=True)
            if row is None:
                raise NotFound(reason="resume")
            _, current = _find_bullet(row.content, bullet_id)
            if row.row_version != read_version and current != before:
                # The user edited this bullet while the AI was working: their edit wins (B5).
                raise StaleVersion(reason="bullet_changed")
            content = replace_bullet(row.content, bullet_id, proposed)
            version = await uow.resumes.update_content(
                user.id, resume_id, content, content_hash(content), row.row_version, None)
            if version is None:
                raise JobAlreadyRunning(reason="bullet_during_full_tailor")
            return version


class TailorService:
    """Full tailor (returning user's "Tailor my CV", or "Tailor all"): 202 + job + polling."""

    def __init__(self, uow: UnitOfWorkFactory, runner: AgentRunner, quota: QuotaGuard,
                 entitlements: Entitlements, job_timeout_s: int, tracer: Tracer) -> None:
        self._uow = uow
        self._tracer = tracer
        self._runner = runner
        self._quota = quota
        self._entitlements = entitlements
        self._job_timeout_s = job_timeout_s

    async def start(self, user: AuthUser, resume_id: UUID) -> int:
        """Checks, counts quota and flips status to 'tailoring'. Returns the version the
        job starts from; the caller schedules run()."""
        async with self._uow(user.id) as uow:
            ctx = await load_context(uow, user, resume_id)
            content = ctx.resume.content
            if not any(i.bullets for i in (*content.experience, *content.projects)):
                raise InvalidInput("Add some experience or projects first.", reason="empty_cv")
            account = await uow.accounts.get(user.id)
            self._entitlements.require(account.plan if account else "free", "tailor_mode")
            await self._quota.consume(uow, user.id, DailyAction.FULL_TAILOR)
            started = await uow.resumes.start_tailoring(user.id, resume_id, self._job_timeout_s)
            if started is None:
                raise JobAlreadyRunning(reason="full_tailor")
        log.info("tailor_job_started", resume_id=resume_id, row_version=started)
        return started

    async def run(self, user: AuthUser, resume_id: UUID, started_version: int, scope: str
                  ) -> None:
        """The job. Any failure marks the resume failed with a code; content is untouched."""
        try:
            async with self._tracer.span("tailor_job", user_id=user.id, entity_id=resume_id,
                                         scope=scope) as span:
                await self._run(span, user, resume_id, started_version, scope)
        except AppError as exc:
            await self._fail(user, resume_id, exc.code)
            log.warning("tailor_job_failed", resume_id=resume_id, code=exc.code)
        except Exception:
            # Job boundary: log with traceback, leave a clear state, never stuck "tailoring".
            log.exception("tailor_job_crashed", resume_id=resume_id)
            await self._fail(user, resume_id, "internal_error")

    async def _run(self, span: Span, user: AuthUser, resume_id: UUID, started_version: int,
                   scope: str) -> None:
        async with self._uow(user.id) as uow:  # job_step 'reading' was set by start()
            ctx = await load_context(uow, user, resume_id)
        content = ctx.resume.content
        if not await self._step(user, resume_id, "rewriting"):
            return
        payload = TailorInput(
            jd_text=ctx.jd.text, scope=scope,  # type: ignore[arg-type]
            career_stage=stage_of(content, span, resume_id),
            items=[ItemView(id=i.id, kind="experience" if isinstance(i, ExperienceItem)
                            else "project", title=_title_context(i)[0],
                            context=_title_context(i)[1],
                            bullets=[BulletView(id=b.id, text=b.text, editable=not b.locked)
                                     for b in i.bullets])
                   for i in (*content.experience, *content.projects)],
            skills=SkillsView(**{cat: [s.name for s in getattr(content.skills, cat)]
                                 for cat in ("languages", "frameworks", "tools")}),
        )
        run = await self._runner.run("cv_tailor", payload, TailorOutput, user_id=user.id,
                                     entity_id=resume_id)
        output = run.output
        if not await self._step(user, resume_id, "checking"):
            return
        # TAIL-6: a JD skill the user already has, or that their experience shows, is not
        # missing; what's left is offered for one-click confirmation, never added by us.
        missing = [s for s in output.missing_skills
                   if norm_skill(s) not in ctx.facts.skills and not evidenced(ctx.facts, s)]

        report = TruthChecker(ctx.facts).check_tailor(content, output, missing, scope)
        merged = ResumeMerger().merge_tailor(content, output, report, scope)
        have = skill_keys(merged.content)
        missing = unique_skills([s for s in missing if norm_skill(s) not in have])
        gaps = [g.model_dump() for g in output.gaps]
        # tailor_report holds no CV/JD text: rejected skill additions are counted, not named.
        paths = report.violating_paths()
        dropped = {p for p in paths if p.startswith("skills.") and p.endswith("]")}
        summary = {"changed": merged.changed, "kept_original": sorted(paths - dropped),
                   "dropped_locked": merged.dropped_locked,
                   "added_skills": merged.added_skills, "rejected_skills": len(dropped),
                   "rules": sorted({v.rule.value for v in report.violations})}
        span.update(truth_violations=len(report.violations), changed=merged.changed,
                    added_skills=merged.added_skills)
        if not report.passed:
            log.warning("tailor_truth_violations", resume_id=resume_id,
                        count=len(report.violations), rules=summary["rules"])

        async with self._uow(user.id) as uow:
            version = await uow.resumes.finish_tailoring(
                user.id, resume_id, merged.content, content_hash(merged.content), missing,
                gaps, summary, started_version)
        if version is None:
            log.warning("tailor_job_result_discarded", resume_id=resume_id,
                        reason="resume deleted, timed out or changed")
            return
        log.info("tailor_job_finished", resume_id=resume_id, changed=merged.changed,
                 kept_original=merged.kept_original, added_skills=merged.added_skills,
                 missing_skills=len(missing), gaps=len(gaps), row_version=version)

    async def _step(self, user: AuthUser, resume_id: UUID, step: JobStep) -> bool:
        """TAIL-3 progress. False = the job is no longer live (timed out as stale, or the
        resume was deleted): stop here rather than spend an LLM call on a dead job."""
        async with self._uow(user.id) as uow:
            live = await uow.resumes.set_job_step(user.id, resume_id, step)
        if not live:
            log.warning("tailor_job_gone", resume_id=resume_id, step=step)
        return live

    async def _fail(self, user: AuthUser, resume_id: UUID, code: str) -> None:
        async with self._uow(user.id) as uow:
            await uow.resumes.fail_tailoring(user.id, resume_id, code)
