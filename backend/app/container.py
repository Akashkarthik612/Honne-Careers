"""Composition root: builds every collaborator once at startup (DIP).

Routes and services never construct their dependencies; tests build a Container with
fakes (FakeProvider, fake verifier, fake storage) through the same function.
"""

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx

from app.agents.providers.base import LlmProvider
from app.agents.providers.gemini import GeminiProvider
from app.agents.recorder import DbAgentRunRecorder
from app.agents.registry import AgentRegistry, ModelResolver, ProviderFactory
from app.agents.runner import AgentRunner
from app.agents.tracing import LangSmithTracer, NoopTracer, Tracer, langsmith_client
from app.analysis.scores import ScoreCalculator
from app.auth.jwt_verifier import JwtVerifier
from app.core.config import Settings
from app.core.errors import ConfigError
from app.db.session import Database
from app.db.unit_of_work import UnitOfWorkFactory, make_uow_factory
from app.domain.applications import RetentionWindow
from app.ingest.extractors import TextExtractor
from app.policy.entitlements import Entitlements
from app.policy.quota import QuotaGuard
from app.render.compiler import CompileQueue, LatexCompiler, TectonicCompiler
from app.render.inspector import PdfInspector
from app.render.latex import LatexRenderer
from app.render.templates import TemplateRegistry
from app.services.accounts import AccountService, SupabaseAdmin
from app.services.analysis import AnalysisService
from app.services.applications import ApplicationRecorder, ApplicationService
from app.services.janitor import JanitorLoop, RetentionJanitor
from app.services.pdf import PdfService
from app.services.profiles import ProfileService
from app.services.resumes import ResumeService
from app.services.settings import SettingsService
from app.services.tailoring import BulletTailorService, TailorService
from app.services.uploads import UploadService
from app.storage.admin import StorageAdmin
from app.storage.file_store import CvFileStore

BACKEND_DIR = Path(__file__).resolve().parents[1]


@dataclass
class Container:
    settings: Settings
    db: Database
    http: httpx.AsyncClient
    jwt_verifier: Any  # JwtVerifier or a test double with .verify()
    uow: UnitOfWorkFactory
    runner: AgentRunner
    files: Any         # CvFileStore or a test double
    accounts: AccountService
    templates: TemplateRegistry
    profiles: ProfileService
    resumes: ResumeService
    bullet_tailor: BulletTailorService
    tailor: TailorService
    quota: QuotaGuard
    entitlements: Entitlements
    pdf: PdfService
    uploads: UploadService
    analysis: AnalysisService
    user_settings: SettingsService
    applications: ApplicationService
    recorder: ApplicationRecorder
    janitor: RetentionJanitor
    janitor_loop: JanitorLoop

    async def start(self) -> None:
        await self.db.open()
        if self.settings.janitor_enabled:
            self.janitor_loop.start()

    async def stop(self) -> None:
        await self.janitor_loop.stop()
        await self.db.close()
        await self.http.aclose()


def build_container(settings: Settings, *, providers: dict[str, LlmProvider] | None = None,
                    jwt_verifier: Any = None, files: Any = None, admin: Any = None,
                    compiler: LatexCompiler | None = None,
                    tracer: Tracer | None = None, storage_admin: Any = None) -> Container:
    http = httpx.AsyncClient(follow_redirects=False)
    db = Database(str(settings.database_url), settings.db_pool_min, settings.db_pool_max)
    uow = make_uow_factory(db)

    resolver = ModelResolver({"strong": settings.llm_strong, "light": settings.llm_light})
    if providers is None:
        providers = {"gemini": GeminiProvider(settings.gemini_api_key.get_secret_value())}
    missing = resolver.providers() - providers.keys()
    if missing:
        raise ConfigError(f"no adapter for configured providers: {sorted(missing)}")
    registry = AgentRegistry.load(BACKEND_DIR / "agents", BACKEND_DIR)
    key = settings.langsmith_api_key  # Settings rejects tracing on without a key
    if tracer is None:
        tracer = (LangSmithTracer(langsmith_client(key.get_secret_value(),
                                                   settings.langsmith_endpoint),
                                  settings.langsmith_project)
                  if settings.langsmith_tracing and key is not None else NoopTracer())
    runner = AgentRunner(registry, resolver, ProviderFactory(providers),
                         DbAgentRunRecorder(uow), settings.llm_backoff_base_s, tracer)

    verifier = jwt_verifier or JwtVerifier(http, settings.jwks_url, settings.jwt_issuer,
                                           settings.jwt_audience, settings.jwt_leeway_s,
                                           settings.jwks_cache_ttl_s)
    file_store = files or CvFileStore(http, str(settings.supabase_url),
                                      settings.supabase_anon_key.get_secret_value(),
                                      settings.storage_bucket, settings.signed_url_ttl_s)
    supabase_admin = admin or SupabaseAdmin(
        http, str(settings.supabase_url), settings.supabase_service_role_key.get_secret_value())

    templates = TemplateRegistry()
    latex = compiler or TectonicCompiler(
        settings.tectonic_bin, settings.latex_timeout_s, settings.latex_memory_mb,
        CompileQueue(settings.latex_max_concurrent, settings.latex_max_waiting,
                     settings.latex_queue_wait_s),
        settings.tectonic_cache_dir)
    entitlements = Entitlements(settings.beta_free_tailoring)
    quota = QuotaGuard({
        "full_tailor": settings.quota_full_tailor_per_day,
        "bullet_tailor": settings.quota_bullet_tailor_per_day,
        "pdf": settings.quota_pdf_per_day,
        "analysis": settings.quota_analysis_per_day,
        "upload": settings.quota_upload_per_day,
    })
    window = RetentionWindow(settings.application_retention_days)
    janitor = RetentionJanitor(
        db, storage_admin or StorageAdmin(http, str(settings.supabase_url),
                                          settings.supabase_service_role_key.get_secret_value(),
                                          settings.storage_bucket),
        window, timedelta(hours=settings.janitor_every_h), settings.janitor_batch,
        settings.janitor_max_batches)
    return Container(
        settings=settings, db=db, http=http, jwt_verifier=verifier, uow=uow, runner=runner,
        files=file_store, accounts=AccountService(uow, file_store, supabase_admin),
        templates=templates, profiles=ProfileService(uow),
        resumes=ResumeService(uow, templates, file_store, settings.tailor_job_timeout_s),
        bullet_tailor=BulletTailorService(uow, runner, quota, entitlements, tracer),
        tailor=TailorService(uow, runner, quota, entitlements, settings.tailor_job_timeout_s,
                             tracer),
        quota=quota, entitlements=entitlements,
        pdf=PdfService(uow, LatexRenderer(), latex, PdfInspector(), file_store, quota),
        uploads=UploadService(
            uow, TextExtractor(settings.upload_max_bytes, settings.upload_max_pages,
                               settings.docx_max_uncompressed_bytes, settings.parse_timeout_s),
            runner, file_store, quota),
        analysis=AnalysisService(uow, runner, ScoreCalculator(), quota),
        user_settings=SettingsService(uow),
        applications=ApplicationService(uow, file_store, window, settings.application_list_max),
        recorder=ApplicationRecorder(uow, file_store, window),
        janitor=janitor,
        janitor_loop=JanitorLoop(janitor, settings.janitor_tick_s, settings.janitor_start_delay_s),
    )
