"""Composition root: builds every collaborator once at startup (DIP).

Routes and services never construct their dependencies; tests build a Container with
fakes (FakeProvider, fake verifier, fake storage) through the same function.
"""

from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx

from app.agents.chat.catalog import AgentCatalog
from app.agents.chat.graph import LoopLimits, TurnGraph
from app.agents.chat.runner import ChatAgentRunner
from app.agents.chat.state_store import AgentStateStore
from app.agents.chat.tools import KnowledgeTools
from app.agents.providers.base import LlmProvider
from app.agents.providers.gemini import GeminiProvider
from app.agents.recorder import DbAgentRunRecorder
from app.agents.registry import AgentRegistry, ModelResolver, ProviderFactory
from app.agents.retry import RetryingCall
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
from app.policy.limits import ConfiguredLimitPolicy, LimitsConfig
from app.policy.quota import QuotaGuard
from app.policy.slots import TurnSlots
from app.render.compiler import CompileQueue, LatexCompiler, TectonicCompiler
from app.render.inspector import PdfInspector
from app.render.templates import TemplateRegistry
from app.services.accounts import AccountService, SupabaseAdmin
from app.services.analysis import AnalysisService
from app.services.applications import ApplicationRecorder, ApplicationService
from app.services.chats import ChatLimits, ChatService
from app.services.custom_agents import CustomAgentService
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
    agent_state: AgentStateStore
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
    custom_agents: CustomAgentService
    chats: ChatService

    async def start(self) -> None:
        await self.db.open()
        await self.agent_state.open()
        if self.settings.janitor_enabled:
            self.janitor_loop.start()

    async def stop(self) -> None:
        await self.janitor_loop.stop()
        await self.agent_state.close()
        await self.db.close()
        await self.http.aclose()


def build_container(settings: Settings, *, providers: dict[str, LlmProvider] | None = None,
                    jwt_verifier: Any = None, files: Any = None, admin: Any = None,
                    compiler: LatexCompiler | None = None,
                    tracer: Tracer | None = None, storage_admin: Any = None) -> Container:
    http = httpx.AsyncClient(follow_redirects=False)
    db = Database(str(settings.database_url), settings.db_pool_min, settings.db_pool_max)
    agent_state = AgentStateStore(str(settings.database_url), settings.agent_state_pool_max)
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
    provider_factory = ProviderFactory(providers)
    recorder = DbAgentRunRecorder(uow)
    runner = AgentRunner(registry, resolver, provider_factory, recorder,
                         settings.llm_backoff_base_s, tracer)

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
    # Usage limits per plan: config/limits.yaml (a bad file stops startup).
    quota = QuotaGuard(ConfiguredLimitPolicy(LimitsConfig.load(settings.limits_file)))
    window = RetentionWindow(settings.application_retention_days)
    janitor = RetentionJanitor(
        db, storage_admin or StorageAdmin(http, str(settings.supabase_url),
                                          settings.supabase_service_role_key.get_secret_value(),
                                          settings.storage_bucket),
        window, timedelta(hours=settings.janitor_every_h), settings.janitor_batch,
        settings.janitor_max_batches)
    profiles = ProfileService(uow)
    resumes = ResumeService(uow, templates, file_store, settings.tailor_job_timeout_s)
    applications = ApplicationService(uow, file_store, window, settings.application_list_max)

    # Day 3: chat agents. One runner for user-made and built-in agents.
    catalog = AgentCatalog.load(BACKEND_DIR / "agents" / "chat", BACKEND_DIR)
    chat_runner = ChatAgentRunner(
        resolver, provider_factory,
        KnowledgeTools(uow, profiles, resumes, applications, settings.agent_tool_text_max_chars),
        TurnGraph(RetryingCall(settings.llm_backoff_base_s), LoopLimits(
            rounds_max=settings.agent_tool_rounds_max, calls_max=settings.agent_tool_calls_max,
            tool_timeout_s=settings.agent_tool_timeout_s,
            llm_timeout_s=settings.agent_llm_timeout_s,
            llm_max_retries=settings.agent_llm_max_retries,
            temperature=settings.agent_temperature,
            max_output_tokens=settings.agent_max_output_tokens,
            thinking_budget=settings.agent_thinking_budget),
            checkpointer=agent_state.saver),
        recorder, tracer)
    slots = TurnSlots(settings.chat_concurrent_turns_max, settings.chat_turn_timeout_s)
    return Container(
        settings=settings, db=db, agent_state=agent_state, http=http, jwt_verifier=verifier,
        uow=uow, runner=runner,
        files=file_store, accounts=AccountService(uow, file_store, supabase_admin, quota),
        templates=templates, profiles=profiles, resumes=resumes,
        bullet_tailor=BulletTailorService(uow, runner, quota, entitlements, tracer),
        tailor=TailorService(uow, runner, quota, entitlements, settings.tailor_job_timeout_s,
                             tracer),
        quota=quota, entitlements=entitlements,
        pdf=PdfService(uow, templates, latex, PdfInspector(), file_store, quota),
        uploads=UploadService(
            uow, TextExtractor(settings.upload_max_bytes, settings.upload_max_pages,
                               settings.docx_max_uncompressed_bytes, settings.parse_timeout_s),
            runner, file_store, quota),
        analysis=AnalysisService(uow, runner, ScoreCalculator(), quota),
        user_settings=SettingsService(uow),
        applications=applications,
        recorder=ApplicationRecorder(uow, file_store, window, templates),
        janitor=janitor,
        janitor_loop=JanitorLoop(janitor, settings.janitor_tick_s, settings.janitor_start_delay_s),
        custom_agents=CustomAgentService(uow, catalog, chat_runner, quota, slots),
        chats=ChatService(uow, catalog, chat_runner, quota, slots, window, ChatLimits(
            turns_max=settings.chat_turns_max, long_warn_turns=settings.chat_long_warn_turns,
            history_turns=settings.chat_history_turns, list_max=settings.chat_list_max,
            turn_timeout_s=settings.chat_turn_timeout_s)),
    )
