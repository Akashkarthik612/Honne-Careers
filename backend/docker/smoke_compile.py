"""CI smoke test inside the built image, run with networking off:
compiles the Jake template through the production TectonicCompiler (offline cache only),
checks one page, and reports Tectonic's peak memory (decides Render Starter vs Standard).
"""

import asyncio
import os
import resource
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.render.compiler import CompileQueue, TectonicCompiler  # noqa: E402
from app.render.inspector import PdfInspector  # noqa: E402
from app.render.latex import LatexRenderer  # noqa: E402
from docker.warm_cache import CV  # noqa: E402


async def main() -> None:
    compiler = TectonicCompiler("tectonic", 60, 1536, CompileQueue(1, 0, 60),
                                os.environ.get("TECTONIC_CACHE_DIR"))
    pdf = await compiler.compile(LatexRenderer().render(CV))
    pages = PdfInspector().page_count(pdf)
    peak_mb = resource.getrusage(resource.RUSAGE_CHILDREN).ru_maxrss / 1024
    print(f"offline compile OK: pages={pages} bytes={len(pdf)} tectonic_peak_rss_mb={peak_mb:.0f}")
    if pages != 1:
        sys.exit("expected a one-page PDF")


if __name__ == "__main__":
    asyncio.run(main())
