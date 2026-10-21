"""LatexRenderer: CvContent -> .tex for the fixed Jake template (B6, PDF-3).

The model never writes LaTeX. Every user string goes through `escape()`; URLs go
through `escape_url()`. Bullets may carry `**bold**` (app/domain/markup.py): `rich()` wraps
each escaped bold span in \\textbf. Nothing user-supplied can open a command, a group or math mode,
so \\input, \\write18 and friends render as literal text.
Adapted from Jake Gutierrez's "Jake's Resume" (MIT). pdfTeX-only lines removed: Tectonic
is XeTeX-based and emits Unicode text natively (ATS-readable, PDF-4).
"""

import re
from urllib.parse import quote, urlparse

from app.domain.cv import CvContent, ExperienceItem, Link, ProjectItem
from app.domain.markup import parse

_ESCAPES = str.maketrans({
    "\\": r"\textbackslash{}", "&": r"\&", "%": r"\%", "$": r"\$", "#": r"\#", "_": r"\_",
    "{": r"\{", "}": r"\}", "~": r"\textasciitilde{}", "^": r"\textasciicircum{}",
    "<": r"\textless{}", ">": r"\textgreater{}", "|": r"\textbar{}",
    "\n": " ", "\r": " ", "\t": " ",
})
_CONTROL = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


def escape(text: str) -> str:
    return _CONTROL.sub("", text).translate(_ESCAPES)


def escape_url(url: str) -> str:
    """Percent-encode everything outside a URL-safe set, then escape what \\href still sees."""
    encoded = quote(_CONTROL.sub("", url), safe=":/?=&@.-_~+,;!*'()")
    return encoded.replace("%", r"\%").replace("#", r"\#").replace("&", r"\&")


def rich(text: str) -> str:
    """Bullet text with its **bold** spans as \\textbf; every span is escaped first."""
    return "".join(rf"\textbf{{{escape(s.text)}}}" if s.bold else escape(s.text)
                   for s in parse(text))


def link_label(link: Link) -> str:
    """What a header link prints as: its label, else LinkedIn / GitHub / Portfolio by host."""
    if link.label:
        return link.label
    host = urlparse(link.url).netloc.lower().removeprefix("www.")
    if host == "linkedin.com" or host.endswith(".linkedin.com"):
        return "LinkedIn"
    if host == "github.com":
        return "GitHub"
    return "Portfolio"


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


class LatexRenderer:
    """Jake template only (TemplateRegistry). A second template becomes a Strategy then."""

    def render(self, cv: CvContent) -> str:
        parts = [PREAMBLE, r"\begin{document}", self._header(cv)]
        if cv.education:
            parts.append(self._education(cv))
        if cv.experience:
            parts.append(self._experience(cv.experience))
        if cv.projects:
            parts.append(self._projects(cv.projects))
        if any(getattr(cv.skills, c) for c in ("languages", "frameworks", "tools")):
            parts.append(self._skills(cv))
        parts.append(r"\end{document}")
        return "\n".join(parts) + "\n"

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
            title = rf"\textbf{{{escape(p.name)}}}" + (rf" $|$ \emph{{{tech}}}" if tech else "")
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
