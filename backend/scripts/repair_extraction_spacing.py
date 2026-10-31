"""One-off repair of spacing broken by the pre-fix PDF extractor (PROF-2, TRUTH-1).

Run from backend/ with the production .env. Three steps, each its own command:

  dry-run   reads one user's rows (RLS as that user), writes backup.json, plan.json and a
            private diff.md to --out, prints counts/ids/paths only. Writes nothing to the DB.
  apply     writes plan.json in ONE transaction with row_version checks; any concurrent edit
            rolls everything back. Needs --confirm <plan sha256> from the dry run.
  rollback  restores backup.json for the rows in receipt.json, again only where the row is
            still at the version apply left it.

  python -m scripts.repair_extraction_spacing dry-run --user U --upload U \
      --source-pdf F --expect-md5 M --out DIR
  python -m scripts.repair_extraction_spacing apply --plan DIR/plan.json --confirm SHA
  python -m scripts.repair_extraction_spacing rollback --receipt DIR/receipt.json

--source-pdf is a local copy of the stored original; --expect-md5 is the stored object's eTag
(storage.objects.metadata->>'eTag'), so the proof is the very file that was uploaded. --out
must be outside the repository: its files hold CV text. Never commit or share them.

cv_uploads has no UPDATE grant (uploads are immutable by design), so the upload row's repair
is reported in the plan but not written; changing that needs a migration and a decision.
Applications (cv_content + PDF) are the record of what was sent and are never changed.
"""

import argparse
import asyncio
import hashlib
import json
import sys
import uuid
from collections import Counter
from io import BytesIO
from pathlib import Path
from typing import Any
from uuid import UUID

from pypdf import PdfReader

from app.core import context
from app.core.config import get_settings
from app.core.hashing import content_hash
from app.core.logging import configure_logging, get_logger
from app.db.session import Database
from app.domain.cv import CvContent
from app.domain.tailoring import PrefillCv
from app.ingest.extractors import PdfExtractor
from app.ingest.spacing_repair import (
    ContentRepair,
    ContentRepairer,
    ExtractionAlignment,
    PassageMatcher,
    Reason,
)
from app.repositories.profiles import ProfileRepository
from app.repositories.resumes import ResumeRepository
from app.repositories.spacing_repair import SpacingRepairReads

log = get_logger("spacing_repair")
REPO_ROOT = Path(__file__).resolve().parents[2]
UPLOAD_BLOCKED = "cv_uploads has no UPDATE grant: needs a migration + decision; not written"


class RepairError(RuntimeError):
    """Stops the run with a specific message (missing row, wrong file, stale version)."""


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _dump(path: Path, payload: Any) -> bytes:
    data = json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True).encode("utf-8")
    path.write_bytes(data)
    return data


def _readings(pdf: bytes, max_pages: int) -> tuple[str, str]:
    """(what the old extractor stored, what today's extractor reads) from the same file."""
    reader = PdfReader(BytesIO(pdf))
    broken = "\n".join(page.extract_text() or "" for page in reader.pages)
    return broken, PdfExtractor(max_pages).extract(pdf)


def _row(table: str, row_id: str, version: int | None, before: dict[str, Any],
         repair: ContentRepair, chash: str | None) -> dict[str, Any]:
    return {"table": table, "id": row_id, "expected_version": version,
            "content": repair.content, "content_hash": chash,
            "fixes": [f.path for f in repair.fixes],
            "reviews": [{"path": r.path, "reason": r.reason.value} for r in repair.reviews],
            "changed": repair.content != before}


async def dry_run(args: argparse.Namespace) -> None:
    out = Path(args.out).resolve()
    if out == REPO_ROOT or REPO_ROOT in out.parents:
        raise RepairError("--out must be outside the repository (its files hold CV text)")
    out.mkdir(parents=True, exist_ok=True)
    pdf = Path(args.source_pdf).read_bytes()
    if hashlib.md5(pdf, usedforsecurity=False).hexdigest() != args.expect_md5.strip('"'):
        raise RepairError("source PDF is not the stored upload (md5 differs from the eTag)")
    settings = get_settings()
    broken, fixed = _readings(pdf, settings.upload_max_pages)
    matcher = PassageMatcher(ExtractionAlignment.edits(broken, fixed))
    log.info("spacing_edits_found", count=len(matcher.broken_forms))

    db = Database(str(settings.database_url), 1, 1)
    await db.open()
    try:
        async with db.user_session(args.user) as conn:
            reads = SpacingRepairReads(conn)
            upload = await reads.upload(args.user, args.upload)
            if upload is None or upload["parsed"] is None:
                raise RepairError("upload not found for this user, or it has no parsed text")
            if upload["source_type"] != "pdf" or not upload["storage_path"].endswith(
                    f"/uploads/{args.upload}.pdf"):
                raise RepairError("upload is not the expected PDF object")
            profile = await ProfileRepository(conn).get(args.user)
            resumes_repo = ResumeRepository(conn)
            resumes = [await resumes_repo.get(args.user, s.id)
                       for s in await resumes_repo.list_summaries(args.user)]
            applications = await reads.applications(args.user)
    finally:
        await db.close()

    repairer = ContentRepairer(matcher, upload["parsed"])
    backup: list[dict[str, Any]] = []
    rows: list[dict[str, Any]] = []

    parsed = upload["parsed"]
    up = repairer.repair_upload(parsed)
    PrefillCv.model_validate(up.content)
    backup.append({"table": "cv_uploads", "id": str(args.upload), "content": parsed})
    rows.append({**_row("cv_uploads", str(args.upload), None, parsed, up, None),
                 "blocked": UPLOAD_BLOCKED})

    cv_rows = ([("personal_profiles", str(args.user), profile.row_version, profile.content,
                 profile.content_hash)] if profile else [])
    cv_rows += [("resumes", str(r.id), r.row_version, r.content, r.content_hash)
                for r in resumes if r is not None]
    for table, row_id, version, model, old_hash in cv_rows:
        before = model.model_dump(mode="json")
        repair = repairer.repair_cv(before)
        new_model = CvContent.model_validate(repair.content)
        backup.append({"table": table, "id": row_id, "expected_version": version,
                       "content": before, "content_hash": old_hash})
        rows.append(_row(table, row_id, version, before, repair, content_hash(new_model)))

    for app in applications:
        if matcher.contains_broken(json.dumps(app["cv_content"], ensure_ascii=False)):
            rows.append({"table": "applications", "id": str(app["id"]), "fixes": [],
                         "reviews": [{"path": "cv_content", "reason": Reason.HISTORICAL.value}],
                         "changed": False})

    backup_bytes = _dump(out / "backup.json", {"user": str(args.user), "rows": backup})
    plan = {"user": str(args.user), "upload": str(args.upload),
            "backup_sha256": _sha(backup_bytes), "source_md5": args.expect_md5.strip('"'),
            "rows": rows}
    plan_sha = _sha(_dump(out / "plan.json", plan))
    _write_diff(out / "diff.md", backup, rows, repairer, plan_sha)
    _summary(rows, plan_sha, out)


def _write_diff(path: Path, backup: list[dict[str, Any]], rows: list[dict[str, Any]],
                repairer: ContentRepairer, plan_sha: str) -> None:
    """Private before/after for review. Holds CV text: stays in --out, never in logs."""
    befores = {(b["table"], b["id"]): b["content"] for b in backup}
    lines = [f"# Spacing repair dry run (plan {plan_sha[:12]})", "",
             "Private: contains CV text. Do not commit or share.", ""]
    for row in rows:
        if row["table"] == "applications":
            lines += [f"## applications {row['id']}: historical, unchanged", ""]
            continue
        before = befores[(row["table"], row["id"])]
        repair = (repairer.repair_upload(before) if row["table"] == "cv_uploads"
                  else repairer.repair_cv(before))
        lines.append(f"## {row['table']} {row['id']}"
                     + (f" (v{row['expected_version']})" if row.get("expected_version") else "")
                     + (f": {row['blocked']}" if row.get("blocked") else ""))
        for f in repair.fixes:
            lines += [f"- `{f.path}`", f"  - before: {f.before}", f"  - after:  {f.after}"]
        for r in repair.reviews:
            lines.append(f"- REVIEW `{r.path}`: {r.reason.value}")
        lines.append("")
    path.write_text("\n".join(lines), encoding="utf-8")


def _summary(rows: list[dict[str, Any]], plan_sha: str, out: Path) -> None:
    """Counts, ids and JSON paths only: no CV text on stdout."""
    print(f"plan sha256: {plan_sha}\nfiles: {out}")
    for row in rows:
        reasons = Counter(r["reason"] for r in row["reviews"])
        extra = f"  [{row['blocked']}]" if row.get("blocked") else ""
        print(f"- {row['table']:18} {row['id']}  fixes={len(row['fixes'])}  "
              f"review={dict(reasons) or 0}{extra}")
        for p in row["fixes"]:
            print(f"    fix    {p}")
        for r in row["reviews"]:
            print(f"    review {r['path']}  ({r['reason']})")
    total = Counter(row["table"] for row in rows if row["fixes"])
    print(f"rows with fixes: {dict(total)}")


async def apply(args: argparse.Namespace) -> None:
    plan_path = Path(args.plan)
    raw = plan_path.read_bytes()
    if _sha(raw) != args.confirm:
        raise RepairError("--confirm does not match plan.json's sha256 (plan changed?)")
    plan = json.loads(raw)
    backup_raw = (plan_path.parent / "backup.json").read_bytes()
    if _sha(backup_raw) != plan["backup_sha256"]:
        raise RepairError("backup.json does not match the plan")
    user = UUID(plan["user"])
    writes = [r for r in plan["rows"]
              if r["changed"] and r["table"] in ("personal_profiles", "resumes")]
    for r in plan["rows"]:
        if r["changed"] and r.get("blocked"):
            log.warning("spacing_repair_not_written", table=r["table"], entity_id=r["id"],
                        reason="no_update_grant")
    receipt = await _write_rows(user, [(r["table"], r["id"], r["expected_version"],
                                        r["content"], r["content_hash"]) for r in writes])
    _dump(plan_path.parent / "receipt.json",
          {"user": plan["user"], "plan_sha256": args.confirm, "rows": receipt})
    print(f"applied {len(receipt)} rows; receipt: {plan_path.parent / 'receipt.json'}")


async def rollback(args: argparse.Namespace) -> None:
    receipt_path = Path(args.receipt)
    receipt = json.loads(receipt_path.read_bytes())
    backup = json.loads((receipt_path.parent / "backup.json").read_bytes())
    old = {(b["table"], b["id"]): b for b in backup["rows"]}
    user = UUID(receipt["user"])
    restored = await _write_rows(user, [
        (r["table"], r["id"], r["new_version"], old[(r["table"], r["id"])]["content"],
         old[(r["table"], r["id"])]["content_hash"]) for r in receipt["rows"]])
    print(f"rolled back {len(restored)} rows")


async def _write_rows(user: UUID, rows: list[tuple[str, str, int, dict[str, Any], str]]
                      ) -> list[dict[str, Any]]:
    """All rows in ONE transaction. A row whose version moved (a concurrent edit, or a
    running tailor job) raises, which rolls back every write."""
    settings = get_settings()
    db = Database(str(settings.database_url), 1, 1)
    await db.open()
    done: list[dict[str, Any]] = []
    try:
        async with db.user_session(user) as conn:
            profiles, resumes = ProfileRepository(conn), ResumeRepository(conn)
            for table, row_id, version, content, chash in rows:
                model = CvContent.model_validate(content)
                if content_hash(model) != chash:
                    raise RepairError(f"content hash mismatch for {table} {row_id}")
                if table == "personal_profiles":
                    new = await profiles.update(user, model, chash, version)
                else:
                    new = await resumes.update_content(user, UUID(row_id), model, chash,
                                                       version, wizard_step=None)
                if new is None:
                    log.warning("spacing_repair_stale", table=table, entity_id=row_id,
                                expected_version=version)
                    raise RepairError(f"{table} {row_id} changed since the plan "
                                      f"(expected v{version}); nothing was written")
                done.append({"table": table, "id": row_id, "old_version": version,
                             "new_version": new})
                log.info("spacing_repair_row", table=table, entity_id=row_id, version=new)
    finally:
        await db.close()
    return done


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    sub = parser.add_subparsers(dest="cmd", required=True)
    d = sub.add_parser("dry-run")
    d.add_argument("--user", type=UUID, required=True)
    d.add_argument("--upload", type=UUID, required=True)
    d.add_argument("--source-pdf", required=True)
    d.add_argument("--expect-md5", required=True)
    d.add_argument("--out", required=True)
    a = sub.add_parser("apply")
    a.add_argument("--plan", required=True)
    a.add_argument("--confirm", required=True)
    r = sub.add_parser("rollback")
    r.add_argument("--receipt", required=True)
    args = parser.parse_args()

    configure_logging("INFO")
    context.correlation_id.set(f"spacing-repair-{uuid.uuid4().hex[:12]}")
    if getattr(args, "user", None):
        context.user_id.set(str(args.user))
    run = {"dry-run": dry_run, "apply": apply, "rollback": rollback}[args.cmd]
    # psycopg's async driver needs the selector loop on Windows (local runs only).
    factory = asyncio.SelectorEventLoop if sys.platform == "win32" else None
    try:
        asyncio.run(run(args), loop_factory=factory)
    except RepairError as exc:
        log.error("spacing_repair_stopped", error=str(exc))
        sys.exit(f"stopped: {exc}")


if __name__ == "__main__":
    main()
