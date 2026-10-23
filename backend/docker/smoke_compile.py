"""CI smoke test inside the built image, run with networking off:
compiles the Jake template through the production TectonicCompiler (offline cache only),
checks one page, and reports Tectonic's peak memory (decides Render Starter vs Standard).
"""

import asyncio
import os
import resource
import subprocess  # noqa: S404
import sys
import tempfile
from io import BytesIO
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pypdf import PdfReader  # noqa: E402

from app.core.errors import RenderFailed  # noqa: E402
from app.ingest.extractors import PdfExtractor  # noqa: E402
from app.render.compiler import CompileQueue, TectonicCompiler  # noqa: E402
from app.render.inspector import PdfInspector  # noqa: E402
from app.render.latex import LatexRenderer  # noqa: E402
from docker.warm_cache import CV, EXPECTED_TEXT  # noqa: E402


def diagnose(tex: str) -> None:
    """The production compiler logs no stderr (it can quote CV text). This is the fixed
    fixture CV, so rerun Tectonic directly, without the rlimits, and surface its output as a
    GitHub annotation (readable without log access)."""
    work = Path(tempfile.mkdtemp(prefix="smoke-"))
    (work / "resume.tex").write_text(tex, encoding="utf-8")
    env = {"PATH": os.environ.get("PATH", ""), "HOME": str(work),
           "TECTONIC_CACHE_DIR": os.environ.get("TECTONIC_CACHE_DIR", "")}
    xdg = os.environ.get("XDG_CACHE_HOME", "/nonexistent")
    env["XDG_CACHE_HOME"] = xdg
    out = f"uid={os.getuid()}\n"
    for d in (Path(xdg) / "Tectonic" / "formats", Path(env["TECTONIC_CACHE_DIR"] or "/none")):
        listing = (", ".join(f"{p.name}:{p.stat().st_size}:{oct(p.stat().st_mode)}"
                             for p in sorted(d.iterdir()))[:1500] if d.is_dir() else "missing")
        out += f"[{d}] {listing}\n"
    argv = ["tectonic", "--untrusted", "--only-cached",
            "--outdir", str(work), str(work / "resume.tex")]
    for run in (1, 2):
        proc = subprocess.run(  # noqa: S603 - fixed argv, fixture input
            argv, cwd=work, env=env, stdin=subprocess.DEVNULL, capture_output=True,
            text=True, timeout=120, check=False)
        out += f"--- run {run} exit {proc.returncode}\n{(proc.stdout + proc.stderr)[-2500:]}\n"
    out = out.replace("%", "%25").replace("\r", "").replace("\n", "%0A")
    print(f"::error title=tectonic without rlimits::{out}")


async def main() -> None:
    compiler = TectonicCompiler("tectonic", 60, 1536, CompileQueue(1, 0, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    tex = LatexRenderer().render(CV)
    try:
        pdf = await compiler.compile(tex)
    except RenderFailed as exc:
        diagnose(tex)
        sys.exit(f"offline compile failed: {exc!r}")
    pages = PdfInspector().page_count(pdf)
    peak_mb = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024
    print(f"offline compile OK: pages={pages} bytes={len(pdf)} tectonic_peak_rss_mb={peak_mb:.0f}")
    if pages != 1:
        sys.exit("expected a one-page PDF")
    check_text_layer(pdf)


def check_text_layer(pdf: bytes) -> None:
    """PDF-4: words must come back apart. Our own upload extractor must read them (else
    a re-uploaded CV gets "validationtoil"); pypdf's default mode is a rough ATS proxy, so
    a miss there is a warning annotation, not a failure."""
    ours = PdfExtractor(2).extract(pdf)
    missing = [t for t in EXPECTED_TEXT if t not in ours]
    if missing:
        sys.exit(f"text layer read back without {missing!r}")
    plain = " ".join(PdfReader(BytesIO(pdf)).pages[0].extract_text().split())
    rough = [t for t in EXPECTED_TEXT if t not in plain]
    if rough:
        print(f"::warning title=PDF text layer::default pypdf extraction misses {rough!r}")
    print("text layer OK")


if __name__ == "__main__":
    asyncio.run(main())
