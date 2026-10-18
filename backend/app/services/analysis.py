"""AnalysisService (B6, A4 #7): run or return cached; same content + JD = 0 LLM calls."""

from uuid import UUID

from app.agents.runner import AgentRunner
from app.analysis.scores import CvTextRenderer, ScoreCalculator
from app.core.errors import InvalidInput, NotFound
from app.core.logging import get_logger
from app.db.unit_of_work import UnitOfWorkFactory
from app.domain.analysis import AnalysisJudgment, AnalystInput
from app.domain.auth import AuthUser
from app.domain.records import AnalysisRow
from app.policy.quota import QuotaGuard

log = get_logger(__name__)


class AnalysisService:
    def __init__(self, uow: UnitOfWorkFactory, runner: AgentRunner, scores: ScoreCalculator,
                 quota: QuotaGuard) -> None:
        self._uow = uow
        self._runner = runner
        self._scores = scores
        self._quota = quota

    async def analyse(self, user: AuthUser, resume_id: UUID) -> tuple[AnalysisRow, bool]:
        """Returns (analysis, cached)."""
        async with self._uow(user.id) as uow:
            row = await uow.resumes.get(user.id, resume_id)
            if row is None:
                raise NotFound(reason="resume")
            jd = await uow.jds.get(user.id, row.jd_id) if row.jd_id else None
            if jd is None:
                raise InvalidInput("Paste a job description first.", reason="no_jd")
            cached = await uow.analyses.get_cached(user.id, resume_id, row.content_hash,
                                                   jd.content_hash)
            if cached is None:
                await self._quota.consume(uow, user.id, "analysis")
        if cached is not None:
            log.info("analysis_cache_hit", resume_id=resume_id)
            return cached, True

        run = await self._runner.run(
            "cv_analyst", AnalystInput(jd_text=jd.text,
                                       cv_text=CvTextRenderer().to_text(row.content)[:40000]),
            AnalysisJudgment, user_id=user.id, entity_id=resume_id)
        scores = self._scores.compute(run.output, row.content)
        async with self._uow(user.id) as uow:
            saved = await uow.analyses.insert(
                user.id, resume_id, row.content_hash, jd.content_hash, scores.keyword,
                scores.experience, scores.narrative, scores.details, run.run_id)
        log.info("analysis_done", resume_id=resume_id, keyword=scores.keyword,
                 experience=scores.experience, narrative=scores.narrative)
        return saved, False
