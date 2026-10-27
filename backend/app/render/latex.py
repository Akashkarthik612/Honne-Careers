"""LaTeX text helpers shared by every template renderer (B6, PDF-3).

The model never writes LaTeX. Every user string goes through `escape()`; URLs go
through `escape_url()`. Bullets may carry `**bold**` (app/domain/markup.py): `rich()` wraps
each escaped bold span in \\textbf. Nothing user-supplied can open a command, a group or math mode,
so \\input, \\write18 and friends render as literal text. Templates live in app/render/templates/.
"""

import re
from urllib.parse import quote, urlparse

from app.domain.cv import Link
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
    """Bullet text with its **bold** spans as \\textbf; every span is escaped first.
    Spaces around a span are kept exactly as stored: none added, none trimmed."""
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
