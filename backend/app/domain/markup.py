"""Bold markup in bullet text: `**term**` is the only formatting a bullet may carry.

Tailoring agents bold the JD skills and the metric a bullet already states (cv_tailor v2,
bullet_tailor v2). LatexRenderer turns spans into \\textbf; truth checks and fact building
read `plain()` so the markers never change what counts as a fact. The frontend mirror is
`boldParts` in frontend/src/data/cvModel.js. Time O(len(text)); no I/O.
"""

from dataclasses import dataclass

MARK = "**"


class MalformedMarkup(ValueError):
    """Unbalanced, empty or nested `**`. A ValueError so Pydantic reports it as a 422."""


@dataclass(frozen=True, slots=True)
class BoldSpan:
    text: str
    bold: bool


def parse(text: str) -> list[BoldSpan]:
    pieces = text.split(MARK)
    if len(pieces) % 2 == 0:
        raise MalformedMarkup("unbalanced ** in bullet")
    spans = [BoldSpan(piece, i % 2 == 1) for i, piece in enumerate(pieces)]
    if any(s.bold and (not s.text.strip() or "*" in s.text) for s in spans):
        raise MalformedMarkup("empty or nested ** in bullet")
    return [s for s in spans if s.text]


def plain(text: str) -> str:
    return text.replace(MARK, "")


def well_formed(text: str) -> str:
    """Pydantic AfterValidator for client-sent bullet text."""
    parse(text)
    return text
