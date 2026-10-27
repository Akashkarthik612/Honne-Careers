"""Build-time only: compile every registered template once so every package they need lands
in TECTONIC_CACHE_DIR. Then prove an offline (--only-cached) compile works, or fail the build.
A new template in TemplateRegistry is warmed here with no change to this file.
"""

import os
import subprocess  # noqa: S404
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.domain.cv import (  # noqa: E402
    Bullet,
    Certification,
    CvContent,
    EducationItem,
    ExperienceItem,
    Header,
    Link,
    Origin,
    ProjectItem,
    SkillItem,
    Skills,
    SpokenLanguage,
)
from app.render.templates import TemplateRegistry  # noqa: E402

B = [Bullet(id="b1", text="Cut latency by 38% & shipped – “quoted” text", origin=Origin.USER,
            locked=True)]
# Bold next to plain words and an italic kerned "Te": the PDF text layer must keep them
# apart (smoke_compile.py reads it back).
BOLD = Bullet(id="b2", text="Cut ticket validation **toil** by 90% through **Python automation**",
              origin=Origin.USER, locked=True)
def _skills(*names: str) -> list[SkillItem]:
    return [SkillItem(name=n, origin=Origin.USER) for n in names]


# At least two items in every list section: separators between items ($|$ in Honne
# Professional) are typeset at each section's own size, and the offline cache only holds the
# fonts this fixture made Tectonic load. One spoken language once left the 9 pt maths font
# uncached, so a real CV with three languages failed in production (27 Oct 2026).
# tests/unit/test_templates.py: test_warm_fixture_has_two_of_everything guards this.
CV = CvContent(
    header=Header(name="Warm Cache", location="Chennai, India", email="a@b.co",
                  phone="+91 1", links=[Link(label="site", url="https://example.com"),
                                        Link(label="GitHub", url="https://github.com/x")]),
    experience=[ExperienceItem(id="e", role="AI/ML Engineer — Intern",
                               company="Cognizant Technology Solutions", location="Paris",
                               start="2021", end="Present", bullets=[*B, BOLD]),
                ExperienceItem(id="e2", role="Engineer", company="Inria", location="Chennai",
                               start="2019", end="2021", bullets=B)],
    projects=[ProjectItem(id="p", name="Proj", tech=["Python"], date="2023",
                          link="https://example.com/app", bullets=B),
              ProjectItem(id="p2", name="Proj two", tech=["Go"], date="2022",
                          link="https://example.com/two", bullets=[BOLD])],
    education=[EducationItem(id="u", school="Uni", degree="B.E.", years="2016 – 2020",
                             location="Chennai"),
               EducationItem(id="u2", school="Métiers", degree="Master’s", years="2023")],
    skills=Skills(languages=_skills("Python", "C++"), frameworks=_skills("FastAPI", ".NET"),
                  tools=_skills("AWS", "CI/CD")),
    spoken_languages=[SpokenLanguage(name="French", level="professional"),
                      SpokenLanguage(name="Tamil", level="native")],
    certifications=[Certification(name="AWS Certified Solutions Architect", date="2024"),
                    Certification(name="AWS AI League", issuer="Amazon")],
)
# What every template's read-back must contain, word for word ("fi": no ligature glyph).
EXPECTED_TEXT = ("validation toil by 90% through Python automation",
                 "Cognizant Technology Solutions", "AWS Certified Solutions Architect", "French")


def render_all() -> dict[str, str]:
    """template id -> .tex of the fixture CV, for every registered template."""
    return {t.id: t.renderer.render(CV, t.default_order) for t in TemplateRegistry().all()}


def main() -> None:
    env = {**os.environ}
    for template_id, tex in render_all().items():
        work = Path(tempfile.mkdtemp())
        (work / "resume.tex").write_text(tex, encoding="utf-8")
        base = ["tectonic", "--untrusted", "--chatter", "minimal", "--outdir", str(work),
                str(work / "resume.tex")]
        subprocess.run(base, check=True, env=env)  # noqa: S603 - downloads packages
        (work / "resume.pdf").unlink()
        subprocess.run([*base[:2], "--only-cached", *base[2:]], check=True, env=env)  # noqa: S603
        if not (work / "resume.pdf").is_file():
            sys.exit(f"offline compile produced no PDF for template {template_id}")
        print(f"tectonic cache warm; offline compile OK: {template_id}")


if __name__ == "__main__":
    main()
