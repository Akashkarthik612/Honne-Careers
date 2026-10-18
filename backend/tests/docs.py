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
