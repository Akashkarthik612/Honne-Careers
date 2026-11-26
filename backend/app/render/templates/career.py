"""Single-column LaTeX presets for the graduate and business CV templates."""

from app.domain.cv import CvContent, ExperienceItem, ProjectItem
from app.render.latex import escape, escape_url
from app.render.templates.professional import BASE_PREAMBLE, ProfessionalRenderer

# Keep headings and dates in the same text flow so PDF extraction follows reading order.
PREAMBLE = BASE_PREAMBLE + r"""
\newcommand{\experience}[4]{%
  \par\addvspace{7pt}\needspace{42pt}%
  \textbf{#3}\par\nobreak
  {\small #1\if\relax\detokenize{#2}\relax\else\space -- #2\fi
  \if\relax\detokenize{#4}\relax\else\space -- #4\fi\par}\nobreak
}
\newcommand{\projecthead}[2]{%
  \par\addvspace{4pt}\needspace{36pt}%
  #1\if\relax\detokenize{#2}\relax\else\space -- #2\fi\par\nobreak
}
\newcommand{\education}[4]{%
  \par\addvspace{4pt}\needspace{28pt}%
  \textbf{#1}\par\nobreak
  {\small #3\if\relax\detokenize{#2}\relax\else\space -- #2\fi
  \if\relax\detokenize{#4}\relax\else\space -- #4\fi\par}
}
\newcommand{\cvbullets}[1]{%
  \begin{itemize}[leftmargin=0.19in, topsep=2pt, itemsep=1.6pt, parsep=0pt]
    #1
  \end{itemize}
}
"""


class CareerRenderer(ProfessionalRenderer):
    def __init__(self, project_title: str, accent: str) -> None:
        self._project_title = project_title
        self.preamble = PREAMBLE + rf"""
\usepackage{{color}}
\definecolor{{careeraccent}}{{rgb}}{{{accent}}}
\titleformat{{\section}}{{\normalsize\bfseries\color{{careeraccent}}}}{{}}{{0em}}{{}}[\titlerule]
"""

    def _experience(self, items: list[ExperienceItem]) -> str:
        return super()._experience(items).replace(
            r"\section{Professional Experience}", r"\section{Experience}", 1
        )

    def _projects(self, items: list[ProjectItem]) -> str:
        rows = [rf"\section{{{self._project_title}}}"]
        for project in items:
            title = rf"\textbf{{{escape(project.name)}}}"
            if project.link:
                title += rf" $|$ \href{{{escape_url(project.link)}}}{{\underline{{View project}}}}"
            if project.tech:
                title += " -- " + escape(", ".join(project.tech))
            rows.append(rf"\projecthead{{{title}}}{{{escape(project.date)}}}")
            rows.extend(self._bullets(project))
        return "\n".join(rows)

    @staticmethod
    def _skills(cv: CvContent) -> str | None:
        skills = [escape(item.name) for items in (
            cv.skills.languages, cv.skills.frameworks, cv.skills.tools
        ) for item in items]
        return r"\section{Skills}" + "\n" + ", ".join(skills) if skills else None
