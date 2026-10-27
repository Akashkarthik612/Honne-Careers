"""JakeRenderer: CvContent -> .tex for "Jake's Resume" (B6, PDF-3). Entry-level template.

Adapted from Jake Gutierrez's "Jake's Resume" (MIT). pdfTeX-only lines removed: Tectonic
is XeTeX-based and emits Unicode text natively (ATS-readable, PDF-4). Every user string goes
through app/render/latex.py (escape, escape_url, rich).
"""

from app.domain.cv import Certification, CvContent, ExperienceItem, ProjectItem, SpokenLanguage
from app.domain.layout import SectionKey, SectionOrder
from app.render.latex import escape, escape_url, link_label, rich

PREAMBLE = r"""\documentclass[letterpaper,11pt]{article}
\usepackage{latexsym}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage[usenames,dvipsnames]{color}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{fancyhdr}
\usepackage[english]{babel}
\usepackage{tabularx}
\pagestyle{fancy}
\fancyhf{}
\fancyfoot{}
\renewcommand{\headrulewidth}{0pt}
\renewcommand{\footrulewidth}{0pt}
\addtolength{\oddsidemargin}{-0.5in}
\addtolength{\evensidemargin}{-0.5in}
\addtolength{\textwidth}{1in}
\addtolength{\topmargin}{-.5in}
\addtolength{\textheight}{1.0in}
\urlstyle{same}
\raggedbottom
\raggedright
\setlength{\tabcolsep}{0in}
\titleformat{\section}{\vspace{-4pt}\scshape\raggedright\large}{}{0em}{}[\color{black}\titlerule \vspace{-5pt}]
\newcommand{\resumeItem}[1]{\item\small{{#1 \vspace{-2pt}}}}
\newcommand{\resumeSubheading}[4]{
  \vspace{-2pt}\item
    \begin{tabular*}{0.97\textwidth}[t]{l@{\extracolsep{\fill}}r}
      \textbf{#1} & #2 \\
      \textit{\small#3} & \textit{\small #4} \\
    \end{tabular*}\vspace{-7pt}
}
\newcommand{\resumeProjectHeading}[2]{
    \item
    \begin{tabular*}{0.97\textwidth}{l@{\extracolsep{\fill}}r}
      \small#1 & #2 \\
    \end{tabular*}\vspace{-7pt}
}
\renewcommand\labelitemii{$\vcenter{\hbox{\tiny$\bullet$}}$}
\newcommand{\resumeSubHeadingListStart}{\begin{itemize}[leftmargin=0.15in, label={}]}
\newcommand{\resumeSubHeadingListEnd}{\end{itemize}}
\newcommand{\resumeItemListStart}{\begin{itemize}}
\newcommand{\resumeItemListEnd}{\end{itemize}\vspace{-5pt}}
"""


class JakeRenderer:
    """Strategy for template "jake". Sections print in `order`; an empty one is skipped."""

    def render(self, cv: CvContent, order: SectionOrder) -> str:
        parts = [PREAMBLE, r"\begin{document}", self._header(cv)]
        for key in order:
            if section := self._section(cv, key):
                parts.append(section)
        parts.append(r"\end{document}")
        return "\n".join(parts) + "\n"

    def _section(self, cv: CvContent, key: SectionKey) -> str | None:
        match key:
            case SectionKey.EDUCATION:
                return self._education(cv) if cv.education else None
            case SectionKey.EXPERIENCE:
                return self._experience(cv.experience) if cv.experience else None
            case SectionKey.PROJECTS:
                return self._projects(cv.projects) if cv.projects else None
            case SectionKey.SKILLS:
                has_skills = any(getattr(cv.skills, c) for c in ("languages", "frameworks",
                                                                  "tools"))
                return self._skills(cv) if has_skills else None
            case SectionKey.CERTIFICATIONS:
                return self._certifications(cv.certifications) if cv.certifications else None
            case SectionKey.LANGUAGES:
                return self._spoken(cv.spoken_languages) if cv.spoken_languages else None

    @staticmethod
    def _header(cv: CvContent) -> str:
        h = cv.header
        contact = [escape(x) for x in (h.location, h.phone) if x]
        if h.email:
            contact.append(rf"\href{{mailto:{escape_url(h.email)}}}{{\underline{{{escape(h.email)}}}}}")
        for link in h.links:
            contact.append(
                rf"\href{{{escape_url(link.url)}}}{{\underline{{{escape(link_label(link))}}}}}")
        return "\n".join([
            r"\begin{center}",
            rf"    \textbf{{\Huge \scshape {escape(h.name) or 'Your Name'}}} \\ \vspace{{1pt}}",
            rf"    \small {' $|$ '.join(contact)}" if contact else "",
            r"\end{center}",
        ])

    @staticmethod
    def _bullets(item: ExperienceItem | ProjectItem) -> list[str]:
        if not item.bullets:
            return []  # an empty itemize is a LaTeX error
        return [r"      \resumeItemListStart",
                *[rf"        \resumeItem{{{rich(b.text)}}}" for b in item.bullets],
                r"      \resumeItemListEnd"]

    def _education(self, cv: CvContent) -> str:
        rows = [rf"    \resumeSubheading{{{escape(e.school)}}}{{{escape(e.location)}}}"
                rf"{{{escape(e.degree)}}}{{{escape(e.years)}}}" for e in cv.education]
        return "\n".join([r"\section{Education}", r"  \resumeSubHeadingListStart", *rows,
                          r"  \resumeSubHeadingListEnd"])

    def _experience(self, items: list[ExperienceItem]) -> str:
        rows: list[str] = []
        for e in items:
            dates = " -- ".join(escape(x) for x in (e.start, e.end) if x)
            rows.append(rf"    \resumeSubheading{{{escape(e.role)}}}{{{dates}}}"
                        rf"{{{escape(e.company)}}}{{{escape(e.location)}}}")
            rows += self._bullets(e)
        return "\n".join([r"\section{Experience}", r"  \resumeSubHeadingListStart", *rows,
                          r"  \resumeSubHeadingListEnd"])

    def _projects(self, items: list[ProjectItem]) -> str:
        rows: list[str] = []
        for p in items:
            tech = escape(", ".join(p.tech))
            title = rf"\textbf{{{escape(p.name)}}}"
            if p.link:
                title += rf" $|$ \href{{{escape_url(p.link)}}}{{\underline{{Click here}}}}"
            if tech:
                title += rf" $|$ \emph{{{tech}}}"
            rows.append(rf"    \resumeProjectHeading{{{title}}}{{{escape(p.date)}}}")
            rows += self._bullets(p)
        return "\n".join([r"\section{Projects}", r"  \resumeSubHeadingListStart", *rows,
                          r"  \resumeSubHeadingListEnd"])

    @staticmethod
    def _skills(cv: CvContent) -> str:
        labels = {"languages": "Languages", "frameworks": "Frameworks",
                  "tools": "Cloud \\& Tools"}
        lines = [rf"     \textbf{{{label}}}{{: {escape(', '.join(s.name for s in items))}}}"
                 for cat, label in labels.items() if (items := getattr(cv.skills, cat))]
        return "\n".join([
            r"\section{Technical Skills}",
            r" \begin{itemize}[leftmargin=0.15in, label={}]",
            r"    \small{\item{",
            " \\\\\n".join(lines),
            r"    }}",
            r" \end{itemize}",
        ])

    @staticmethod
    def _certifications(items: list[Certification]) -> str:
        lines = [rf"     \textbf{{{escape(c.name)}}}"
                 + "".join(f" -- {escape(x)}" for x in (c.issuer, c.date) if x) for c in items]
        return "\n".join([
            r"\section{Certifications}",
            r" \begin{itemize}[leftmargin=0.15in, label={}]",
            r"    \small{\item{",
            " \\\\\n".join(lines),
            r"    }}",
            r" \end{itemize}",
        ])

    @staticmethod
    def _spoken(languages: list[SpokenLanguage]) -> str:
        """Human languages, e.g. "English (Native), French (Professional)"."""
        text = ", ".join(escape(s.name) + (f" ({s.level.value.capitalize()})" if s.level else "")
                         for s in languages)
        return "\n".join([
            r"\section{Languages}",
            r" \begin{itemize}[leftmargin=0.15in, label={}]",
            rf"    \small{{\item{{{text}}}}}",
            r" \end{itemize}",
        ])
