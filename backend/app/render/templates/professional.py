"""ProfessionalRenderer: CvContent -> .tex for "Honne Professional" (PDF-1). Experienced-hire
template, reproducing the CANAL+ reference CV (CANAL_Plus_Exact_Template.tex).

The preamble and macros are the reference's, verbatim, with two measured changes:
  * fontenc T1 / inputenc / lmodern dropped: under Tectonic (XeTeX) they load Type1 Latin
    Modern, whose ligatures extract as U+FB01 ("Certiﬁed"), which an ATS may not match
    (PDF-4). XeTeX's default is the same Latin Modern design as OpenType; every text line of
    the reference sits within 0.33 pt of the pdfLaTeX original that way.
  * \\pdfgentounicode (pdfTeX only) is guarded so the file also compiles under pdfLaTeX.
  * \\projecthead takes the whole title (bold name + optional link) as #1, so the link
    is the project's own, not hardcoded in the macro.
Every user string goes through app/render/latex.py (escape, escape_url, rich).
"""

from app.domain.cv import Certification, CvContent, ExperienceItem, ProjectItem, SpokenLanguage
from app.domain.layout import SectionKey, SectionOrder
from app.render.latex import escape, escape_url, link_label, rich

PREAMBLE = r"""\documentclass[letterpaper,10pt]{article}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{needspace}
\usepackage{microtype}
\ifdefined\pdfgentounicode
  \input{glyphtounicode}
  \pdfgentounicode=1
\fi
\pagestyle{empty}
\addtolength{\oddsidemargin}{-0.46in}
\addtolength{\evensidemargin}{-0.46in}
\addtolength{\textwidth}{0.92in}
\addtolength{\topmargin}{-0.54in}
\addtolength{\textheight}{1.12in}
\setlength{\parindent}{0pt}
\setlength{\parskip}{0pt}
\raggedright
\raggedbottom
\setlength{\tabcolsep}{0pt}
\emergencystretch=1em
\titleformat{\section}{\normalsize\bfseries\scshape}{}{0em}{}[\titlerule]
\titlespacing*{\section}{0pt}{8pt}{4pt}
\newcommand{\experience}[4]{%
  \par\addvspace{8pt}\needspace{48pt}%
  \begin{tabular*}{\linewidth}{@{}p{0.79\linewidth}@{\extracolsep{\fill}}r@{}}%
    \textbf{#1} & {\footnotesize #2}\\[-1pt]
    {\footnotesize\textit{#3}} & {\footnotesize #4}\\
  \end{tabular*}\par\nobreak\vspace{1pt}%
}
\newcommand{\cvbullets}[1]{%
\begin{itemize}[leftmargin=0.19in, topsep=2pt, itemsep=1.6pt, parsep=0pt, partopsep=0pt]
\fontsize{9.15}{11.1}\selectfont #1
\end{itemize}\par\vspace{0pt}%
}
\newcommand{\projecthead}[2]{%
 \par\addvspace{2pt}\needspace{42pt}%
 \begin{tabular*}{\linewidth}{@{}p{0.79\linewidth}@{\extracolsep{\fill}}r@{}}%
 #1 & {\footnotesize #2}\\
 \end{tabular*}\par\vspace{1pt}%
}
\newcommand{\education}[4]{%
\par\addvspace{3pt}%
\begin{tabular*}{\linewidth}{@{}p{0.78\linewidth}@{\extracolsep{\fill}}r@{}}%
\textbf{#1} & {\footnotesize #2}\\[-1pt]
{\footnotesize #3} & {\footnotesize #4}\\
\end{tabular*}\par
}
"""

_SMALL = r"{\fontsize{9.0}{10.7}\selectfont "  # skills, certifications, languages
_SEP = " $|$ "


class ProfessionalRenderer:
    """Strategy for template "honne_professional". Sections print in `order`; an empty one
    is skipped. Employers print in their stored order (never re-sorted here)."""

    def render(self, cv: CvContent, order: SectionOrder) -> str:
        parts = [PREAMBLE, r"\begin{document}", self._header(cv)]
        for key in order:
            if section := self._section(cv, key):
                parts.append(section)
        parts.append(r"\end{document}")
        return "\n".join(parts) + "\n"

    def _section(self, cv: CvContent, key: SectionKey) -> str | None:
        match key:
            case SectionKey.EXPERIENCE:
                return self._experience(cv.experience) if cv.experience else None
            case SectionKey.PROJECTS:
                return self._projects(cv.projects) if cv.projects else None
            case SectionKey.SKILLS:
                return self._skills(cv)
            case SectionKey.EDUCATION:
                return self._education(cv) if cv.education else None
            case SectionKey.CERTIFICATIONS:
                return self._certifications(cv.certifications) if cv.certifications else None
            case SectionKey.LANGUAGES:
                return self._spoken(cv.spoken_languages) if cv.spoken_languages else None

    @staticmethod
    def _header(cv: CvContent) -> str:
        """Name, then phone | email | links | location, as in the reference."""
        h = cv.header
        contact = [escape(h.phone)] if h.phone else []
        if h.email:
            contact.append(rf"\href{{mailto:{escape_url(h.email)}}}{{{escape(h.email)}}}")
        contact += [rf"\href{{{escape_url(link.url)}}}{{{escape(link_label(link))}}}"
                    for link in h.links]
        if h.location:
            contact.append(escape(h.location))
        name = rf"{{\LARGE\bfseries {escape(h.name) or 'Your Name'}}}"
        lines = [r"\begin{center}"]
        if contact:
            lines += [name + r"\\[2pt]", "", rf"{{\footnotesize {_SEP.join(contact)}}}"]
        else:
            lines.append(name)
        return "\n".join([*lines, r"\end{center}", r"\vspace{-5pt}"])

    @staticmethod
    def _bullets(item: ExperienceItem | ProjectItem) -> list[str]:
        if not item.bullets:
            return []  # an empty itemize is a LaTeX error
        return [r"\cvbullets{", *[rf"\item {rich(b.text)}" for b in item.bullets], "}"]

    def _experience(self, items: list[ExperienceItem]) -> str:
        rows = [r"\section{Professional Experience}"]
        for e in items:
            dates = " -- ".join(escape(x) for x in (e.start, e.end) if x)
            rows.append(rf"\experience{{{escape(e.company)}}}{{{dates}}}"
                        rf"{{{escape(e.role)}}}{{{escape(e.location)}}}")
            rows += self._bullets(e)
        return "\n".join(rows)

    def _projects(self, items: list[ProjectItem]) -> str:
        rows = [r"\section{Projects}"]
        for p in items:
            title = rf"\textbf{{{escape(p.name)}}}"
            if p.link:
                title += rf"{_SEP}\href{{{escape_url(p.link)}}}{{\underline{{View project}}}}"
            rows.append(rf"\projecthead{{{title}}}{{{escape(p.date)}}}")
            rows += self._bullets(p)
        return "\n".join(rows)

    @staticmethod
    def _skills(cv: CvContent) -> str | None:
        labels = {"languages": "Languages", "frameworks": "Frameworks",
                  "tools": "Cloud \\& Tools"}
        lines = [rf"\textbf{{{label}:}} {escape(', '.join(s.name for s in items))}"
                 for cat, label in labels.items() if (items := getattr(cv.skills, cat))]
        if not lines:
            return None
        return "\n".join([r"\section{Technical Skills}",
                          _SMALL + "\\\\\n".join(lines) + r"\par}"])

    @staticmethod
    def _education(cv: CvContent) -> str:
        rows = [rf"\education{{{escape(e.school)}}}{{{escape(e.years)}}}"
                rf"{{{escape(e.degree)}}}{{{escape(e.location)}}}" for e in cv.education]
        return "\n".join([r"\section{Education}", *rows])

    @staticmethod
    def _certifications(items: list[Certification]) -> str:
        text = _SEP.join(rf"\textbf{{{escape(c.name)}}}"
                         + "".join(f" -- {escape(x)}" for x in (c.issuer, c.date) if x)
                         for c in items)
        return "\n".join([r"\section{Certifications}", _SMALL + text + r"\par}"])

    @staticmethod
    def _spoken(languages: list[SpokenLanguage]) -> str:
        """e.g. "English -- Native | French -- Professional", as in the reference."""
        text = _SEP.join(escape(s.name) + (f" -- {s.level.value.capitalize()}" if s.level else "")
                         for s in languages)
        return "\n".join([r"\section{Languages}", _SMALL + text + r"\par}"])
