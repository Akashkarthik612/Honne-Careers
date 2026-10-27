"""The design's sample CV (frontend/src/data/sampleCv.js) as CvContent, plus its JD."""

from app.domain.cv import (
    Bullet,
    CvContent,
    EducationItem,
    ExperienceItem,
    Header,
    LanguageLevel,
    Origin,
    ProjectItem,
    SkillItem,
    Skills,
    SpokenLanguage,
)

TEMPLATE_IDS = ("jake", "honne_professional")


def render(cv: CvContent, template: str = "jake", order=None) -> str:
    """.tex of `cv` in a registered template, in its default order unless `order` is given."""
    from app.render.templates import TemplateRegistry
    info = TemplateRegistry().require(template)
    return info.renderer.render(cv, order or info.default_order)


def b(bid: str, text: str, origin: Origin = Origin.PROFILE, locked: bool = False) -> Bullet:
    return Bullet(id=bid, text=text, origin=origin, locked=locked)


def s(*names: str) -> list[SkillItem]:
    return [SkillItem(name=n, origin=Origin.PROFILE) for n in names]


def sample_cv() -> CvContent:
    return CvContent(
        header=Header(name="Arjun Mehta", location="Chennai, India",
                      email="arjun.mehta@mail.com"),
        experience=[
            ExperienceItem(id="nw", role="Software Engineer", company="Northwind Fintech",
                           location="Bengaluru, India", start="Jul 2021", end="Present",
                           bullets=[
                b("nw1", "Cut payment-event latency by 38% (p95) by moving the ledger service "
                         "to Kafka Streams in Java on AWS"),
                b("nw2", "Owned the settlement pipeline end to end, scaling it to 2M events/day "
                         "with zero data loss through idempotent consumers and replay tooling"),
                b("nw3", "Mentored 2 interns to their first production launch, both shipping "
                         "in under 8 weeks"),
            ]),
            ExperienceItem(id="bl", role="Associate Software Engineer",
                           company="Brightline Systems", location="Chennai, India",
                           start="Aug 2020", end="Jun 2021", bullets=[
                b("bl1", "Reduced on-call pages by 30% by adding alerting and runbooks across "
                         "6 Java services"),
                b("bl2", "Wrote SQL migrations for a 40M-row orders table with no downtime"),
            ]),
        ],
        projects=[
            ProjectItem(id="ll", name="Ledger-lite",
                        tech=["Java", "Spring Boot", "PostgreSQL", "Docker"], date="2023",
                        link="https://ledger-lite.example.dev",
                        bullets=[b("ll1", "Built a double-entry ledger that sustained 1,000 TPS "
                                          "in load tests, measured with k6")]),
        ],
        education=[EducationItem(id="au", school="Anna University",
                                 degree="B.E. in Computer Science and Engineering",
                                 years="2016 – 2020", location="Chennai, India")],
        skills=Skills(languages=s("Java", "Python", "SQL"),
                      frameworks=s("Spring Boot", "Kafka Streams", "JUnit"),
                      tools=s("AWS", "Docker", "Git", "Grafana")),
        spoken_languages=[SpokenLanguage(name="English", level=LanguageLevel.PROFESSIONAL),
                          SpokenLanguage(name="Tamil", level=LanguageLevel.NATIVE)],
    )


SAMPLE_JD = """SDE-2, Backend · Chennai
You'll build the high-scale services behind our customer platform, and own them in production.
• Design and own event-driven services in Java and Kafka on AWS
• Improve the reliability and latency of systems handling millions of events a day
• Mentor junior engineers and review code
• 3+ years of backend experience
• Strong Java, distributed systems and SQL
• Experience with Kubernetes is a plus"""
