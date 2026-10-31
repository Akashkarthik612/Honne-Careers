# Claude Code task: pixel-faithful CANAL+ template replication in Honne Careers

Repository: `Akashkarthik612/Honne-Careers`

## Goal (specific and non-negotiable)

Register a NEW production template ID `honne_professional_exact` whose PDF output replicates the typography, margin geometry, font choices, aligned headings, list indents, and spacing of the attached `CANAL_Plus_AI_Builder_FR_No_Subtitle.pdf`.

The attached `CANAL_Plus_AI_Builder_FR_No_Subtitle.tex` is the AUTHORITATIVE typography/layout specification. Do NOT base the new design on the current Jake renderer with isolated CSS changes. Preserve the current `jake` template as-is. Don't hardcode any private resume content into production code.

The separately attached `honne_existing.pdf` is the CURRENT APP output for comparison, not the visual target.

## Verified technical comparison (PDFs inspected)

| Parameter | CANAL+ reference | Current Honne PDF |
|---|---|---|
| Document | `letterpaper,10pt` | `letterpaper,11pt` |
| Fonts | Latin Modern | Latin Modern at larger sizes |
| Name rendered font | approximately 17.2 pt | approximately 24.8 pt |
| Section heading | approximately 10 pt bold small caps | approximately 12 pt small caps |
| Bullet font | explicit 9.15 pt/11.1 pt baseline | approximately 10 pt |
| Experience left x | approximately 38.9 pt | approximately 46.8 pt |
| Bullet marker left x | approximately 40.3 pt | approximately 61.5 pt |
| Employer gap | 8pt through custom macro | tight negative `\vspace` approach |

These measurements are taken from the supplied PDFs, not guessed. Note that paragraph wrapping necessarily changes with different candidate text; identical style is the goal, not identical page coordinates for unlike content.

## Design tokens -- copy EXACTLY from reference

```latex
\documentclass[letterpaper,10pt]{article}
\usepackage[T1]{fontenc}
\usepackage[utf8]{inputenc}
\usepackage{lmodern}
\usepackage[empty]{fullpage}
\usepackage{titlesec}
\usepackage{enumitem}
\usepackage[hidelinks]{hyperref}
\usepackage{needspace}
\usepackage{microtype}
% pdfTeX-only glyph mapping must be guarded for Tectonic/XeTeX:
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
 \textbf{#1} & {\footnotesize #2}\\
 \end{tabular*}\par\vspace{1pt}%
}
\newcommand{\education}[4]{%
\par\addvspace{3pt}%
\begin{tabular*}{\linewidth}{@{}p{0.78\linewidth}@{\extracolsep{\fill}}r@{}}%
\textbf{#1} & {\footnotesize #2}\\[-1pt]
{\footnotesize #3} & {\footnotesize #4}\\
\end{tabular*}\par
}
```

Header is specifically:

```latex
\begin{center}
{\LARGE\bfseries [candidate name]}\\[2pt]
{\footnotesize [contact links separated by $|$]}
\end{center}
\vspace{-5pt}
```

Technical skills, certifications and languages are **plain text**, not a `\small{\item{...}}` list. They use `\fontsize{9.0}{10.7}\selectfont`. Multiple skills rows use `\\` line breaks. Align their labels with the left section margin, not with an itemize indent.

Bullets are created with `\cvbullets{\item ...}`. Convert stored `**bold**` spans with the existing safe `rich()` function. Do not introduce or trim spaces around bold spans.

## Functional requirements and file-level checklist

1. `backend/app/render/templates.py`: register `honne_professional_exact` as a separate template in addition to `jake`.
2. `backend/app/api/schemas.py`: permit `honne_professional_exact` on `CreateResume`; leave legacy `jake` valid.
3. `backend/app/render/latex.py`: factor safe escaping/link functions into shared helpers; create `HonneProfessionalExactRenderer` that uses the reference preamble and actual macros. It must render arbitrary structured `CvContent`, not a static `.tex` example. Use the candidate's real link URLs dynamically. Handle projects with/without link.
4. `backend/app/services/pdf.py`: `build()` MUST choose the renderer by `row.template`. Currently it calls `self._renderer.render(row.content)` with no template parameter, which would silently keep using Jake. Ensure template ID, renderer revision and selected `section_order` are part of PDF cache identity (content hash alone is insufficient when switching layouts).
5. `backend/app/domain/cv.py` and existing PATCH persistence: add a validated, persisted `section_order` when the UI reordering feature is implemented. Use it both for rendering and UI preview; otherwise set `honne_professional_exact` default to Experience → Projects → Skills → Education → Certifications → Languages. Keep employers themselves reverse chronological; don't reorder them by JD relevance.
6. `frontend/src/data/templates.js`, `frontend/src/pages/new/TemplatePage.jsx`, and related selection state: add new template and ensure the selected ID is actually submitted, not hardcoded to `jake`.
7. `frontend/src/components/CvDoc.jsx`: the current Times New Roman HTML preview isn't equivalent to Latin Modern. For genuine preview-to-PDF parity, present an embedded/generated PDF preview for this template (or clearly distinguish a style-approximate HTML thumbnail from the real PDF). The user's actual PDF is the authoritative visual output.
8. The current `CvContent` doesn't have Certifications. If no candidates have that section in the current model, don't fabricate it. If product requirements include certifications, add it as structured candidate-provided data in a deliberate schema migration; render only when present.
9. Keep CV rewriting and layout separate. Existing JSON → truth checker → merger → renderer → PDF is correct. Never send user-authored raw LaTeX to the compiler or have the LLM emit LaTeX.
10. The existing `PdfInspector` counts pages only. Add automated tests for bounding boxes/text extraction/overlap so different CV lengths don't silently clip or overlap content.

## Additional defect visible in the app-produced PDF

The Honne output currently has visible merged words such as `microservicesand`, `APIsfor`, and `thepayments`. Determine whether those missing spaces occur in the stored JSON **before** TeX rendering or emerge from the TeX generated by `rich()`. Do not blindly insert spaces around bold markers: `**Python**/FastAPI` is legitimate, but `microservices**and**` may indicate an AI output spacing defect. Add tests for bold transitions and extracted PDF words.

## Compilation-engine consistency

The ChatGPT reference file was compiled using pdfLaTeX (`pdfTeX-1.40.26`). The app-produced PDF uses `xdvipdfmx` from a XeTeX-based compiler. A control test using the same CANAL+ source under XeLaTeX generated 1 page with nearly unchanged vertical geometry (top coordinates within about 0.05 PDF point for the corresponding 60 extracted text lines). Thus the existing Tectonic approach is reasonable; the dominant problem is the **different renderer macros and text layout**, not inherently the compiler.

Guard `\pdfgentounicode` for XeTeX; verify that required packages/fonts are baked into the offline Tectonic cache/image.

## Required verification -- do not consider work complete without this

A. Golden-sample rendering: Feed the *same* fixed reference content from `CANAL_Plus_AI_Builder_FR_No_Subtitle.tex` through the new dynamic renderer, compile with production compiler, and compare to `CANAL_Plus_AI_Builder_FR_No_Subtitle.pdf`. Don't compare unlike CV content as a pixel test.
B. Measure geometry: header, 6 section baselines, employer heading x, bullet marker x, body font sizes, full-page width and height. Where geometry differs, adjust code until consistent with reference. Permit negligible cross-engine rasterization/font differences.
C. Regression: existing Jake output unchanged, arbitrary candidate names/links, multiple employers, French accents, long bullets, no projects, junior and senior (two-page) CVs.
D. Security: compiled content must still go through the existing `escape()`/`escape_url()` and safe bold-span parser. No raw user text into LaTeX commands.
E. Cache: generating both templates for the same content must yield distinct PDFs; switching templates/section order must invalidate or correctly segregate PDF cache.
F. Final report: list modified files, rendered sample screenshots, extracted bounding-box comparison and automated test results.

Do not deploy to production automatically. Do not modify factual CV content or the CV Tailor prompt as part of this template-only task unless a change is necessary to preserve exact output formatting.
