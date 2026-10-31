"""Builds small real PDF/DOCX files for upload tests."""

import zipfile
from io import BytesIO

from docx import Document

CV_LINES = [
    "Arjun Mehta - Chennai, India - arjun.mehta@mail.com",
    "Software Engineer, Northwind Fintech, Jul 2021 - Present",
    "Cut payment-event latency by 38% (p95) by moving the ledger service to Kafka Streams",
    "Owned the settlement pipeline end to end, scaling it to 2M events/day",
    "Associate Software Engineer, Brightline Systems, Aug 2020 - Jun 2021",
    "Reduced on-call pages by 30% by adding alerting and runbooks across 6 Java services",
    "Skills: Java, Python, SQL, Spring Boot, Kafka Streams, AWS, Docker",
]


def text_pdf(lines: list[str] = CV_LINES, pages: int = 1) -> bytes:
    """A minimal valid PDF whose text pypdf can extract (Helvetica, one Tj per line)."""
    objects: list[bytes] = []
    page_ids = list(range(3, 3 + 2 * pages, 2))
    objects.append(b"<< /Type /Catalog /Pages 2 0 R >>")
    kids = " ".join(f"{i} 0 R" for i in page_ids).encode()
    objects.append(b"<< /Type /Pages /Kids [" + kids + b"] /Count " + str(pages).encode() + b" >>")
    font_id = 3 + 2 * pages
    for n in range(pages):
        content = b"BT /F1 10 Tf 40 760 Td 14 TL " + b" ".join(
            b"(" + line.replace("(", "[").replace(")", "]").encode("latin-1") + b") '"
            for line in lines) + b" ET"
        objects.append(b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources "
                       b"<< /Font << /F1 " + str(font_id).encode() + b" 0 R >> >> /Contents "
                       + str(page_ids[n] + 1).encode() + b" 0 R >>")
        objects.append(b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n"
                       + content + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    return _assemble(objects)


def _assemble(objects: list[bytes]) -> bytes:
    """Numbers `objects` from 1 (1 = catalog) and writes the xref table and trailer."""
    out = BytesIO()
    out.write(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, 1):
        offsets.append(out.tell())
        out.write(f"{i} 0 obj\n".encode() + body + b"\nendobj\n")
    xref = out.tell()
    out.write(f"xref\n0 {len(objects) + 1}\n0000000000 65535 f \n".encode())
    for off in offsets:
        out.write(f"{off:010d} 00000 n \n".encode())
    out.write(f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF"
              .encode())
    return out.getvalue()


# The six merges/splits seen in a real CV (pdfTeX, Latin Modern), as they read correctly.
SPACING_PHRASES = ("microservices and", "APIs for", "the payments", "with 100%",
                   "through Python", "Cognizant Technology Solutions")
SPACING_BROKEN = ("microservicesand", "APIsfor", "thepayments", "with100%", "throughPython",
                  "Cognizant T echnology Solutions")
TECH_TERMS = ("FastAPI", "PostgreSQL", "GitHub", "NextJS")

_SIZE, _CHAR, _GLUE = 9.0, 0.6 * 9.0, 343   # monospace glyph = 0.6 em; TeX glue in TJ units
_SPACE = _GLUE / 1000 * _SIZE


def _tj(text: str) -> tuple[str, float]:
    """One TJ run, words joined by TeX-style glue (no space glyph), and its width in pt."""
    words = [w.replace("(", r"\(").replace(")", r"\)") for w in text.split(" ")]
    return (f"[({f')-{_GLUE}('.join(words)})]TJ",
            len(text.replace(" ", "")) * _CHAR + text.count(" ") * _SPACE)


def kerned_bold_pdf() -> bytes:
    """A PDF laid out the way pdfTeX writes a CV (operators and fonts copied from a real one).

    Inside a run, words are separated by TJ glue; at every regular/bold switch the run ends
    and the next starts one space further on, with no space glyph. As in the real file, the
    bullet fonts hold a non-space glyph at code 32 (F1, F2) and the heading font has no slot
    there (F3), where "T" + "echnology" is kerned by 96. pypdf's default mode then reads the
    six SPACING_BROKEN forms, although the page shows the SPACING_PHRASES (PROF-2).
    """
    lines = [
        [("F1", "Built Python (FastAPI) microservices"), ("F2", "and"), ("F1", "RESTful APIs"),
         ("F2", "for the"), ("F1", "payments"), ("F2", "and logistics modules")],
        [("F1", "Shipped 40 releases a quarter, with"), ("F2", "100%"),
         ("F1", "audit accuracy, through"), ("F2", "Python"), ("F1", "automation and review")],
        [("F3", "[(Cognizant)-383(T)96(echnology)-384(Solutions)]TJ")],
        [("F1", "Stack: FastAPI, PostgreSQL, GitHub Actions, NextJS and Docker for each service "
                "we built and ran in production")],
    ]
    ops, y = ["BT"], 700.0
    for segments in lines:
        x = 40.0
        for font, text in segments:
            body, width = (text, 0.0) if text.startswith("[") else _tj(text)
            ops.append(f"/{font} {_SIZE} Tf 1 0 0 1 {x:.3f} {y} Tm {body}")
            x += width + _SPACE
        y -= 14
    ops.append("ET")
    content = "\n".join(ops).encode("latin-1")
    glyphs = b" ".join([b"600"] * 94)  # codes 33-126 (monospace)

    def font(name: bytes, slot32: bytes | None) -> bytes:
        first, widths = (b"32", slot32 + b" " + glyphs) if slot32 else (b"33", glyphs)
        return (b"<< /Type /Font /Subtype /Type1 /BaseFont /" + name + b" /FirstChar " + first
                + b" /LastChar 126 /Widths [" + widths + b"] >>")

    return _assemble([
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources "
        b"<< /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content
        + b"\nendstream",
        font(b"Courier", b"514"), font(b"Courier-Bold", b"592"), font(b"Courier-Bold", None),
    ])


def docx(lines: list[str] = CV_LINES) -> bytes:
    document = Document()
    for line in lines:
        document.add_paragraph(line)
    out = BytesIO()
    document.save(out)
    return out.getvalue()


def zip_bomb_docx() -> bytes:
    out = BytesIO()
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        archive.writestr("word/document.xml", b"0" * (30 * 1024 * 1024))
    return out.getvalue()
