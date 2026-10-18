"""Deterministic text normalisation shared by FactSetBuilder and TruthChecker."""

import re
from functools import lru_cache

from app.truth.lexicon import CASE_SENSITIVE, canonical_map

_CANON = canonical_map()
_NUMBER_WORDS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6", "seven": "7",
    "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12", "fifteen": "15",
    "twenty": "20", "thirty": "30", "fifty": "50", "hundred": "100", "dozen": "12",
    "half": "50", "double": "2", "twice": "2", "triple": "3",
}
_NUMBER = re.compile(r"(?<![\w.])\d+(?:[.,]\d+)*")
_YEAR = re.compile(r"(?<!\d)(?:19|20)\d{2}(?!\d)")
_WORD = re.compile(r"[A-Za-z][A-Za-z0-9+#.\-/]*")
_NAMEISH = re.compile(r"(?<![\w.])[A-Z][A-Za-z0-9+#\-]*[A-Za-z0-9+#]|(?<![\w.])[A-Z](?![\w])")

# Capitalised words that are not facts on their own (acronyms of activities, not entities).
COMMON_CAPITALISED = frozenset({
    "i", "api", "apis", "ui", "ux", "qa", "mvp", "kpi", "kpis", "sla", "slas", "okr", "okrs",
    "b2b", "b2c", "saas", "etl", "rest", "restful", "crud", "ci", "cd", "sdk", "sdks", "cli",
    "p95", "p99", "roi", "e2e", "poc", "rfc", "rfcs", "pr", "prs", "id", "ids", "it", "hr",
    "ai", "nlp", "ocr", "faq", "seo", "gdpr", "pii", "tdd", "oop", "devops", "mlops",
    "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "sept", "oct", "nov",
    "dec", "january", "february", "march", "april", "june", "july", "august", "september",
    "october", "november", "december", "q1", "q2", "q3", "q4",
})


def norm_skill(name: str) -> str:
    key = " ".join(name.lower().split())
    return _CANON.get(key, key)


def numbers_in(text: str) -> set[str]:
    """Numbers as normalised strings, years excluded (dates are checked separately)."""
    found = {m.group().replace(",", "") for m in _NUMBER.finditer(text)
             if not _YEAR.fullmatch(m.group())}
    lowered = text.lower()
    for word, digit in _NUMBER_WORDS.items():
        if re.search(rf"\b{word}\b", lowered):
            found.add(digit)
    return {_strip_zeros(n) for n in found}


def _strip_zeros(number: str) -> str:
    return number.rstrip("0").rstrip(".") if "." in number else number.lstrip("0") or "0"


def years_in(text: str) -> set[str]:
    return set(_YEAR.findall(text))


def words_in(text: str) -> set[str]:
    return {w.lower().strip(".-/") for w in _WORD.findall(text)}


def name_candidates(text: str) -> list[str]:
    """Capitalised tokens that are not the first word of a sentence."""
    out: list[str] = []
    for match in _NAMEISH.finditer(text):
        before = text[: match.start()].rstrip()
        if not before or before[-1] in ".!?:;":
            continue  # sentence start: capitalisation carries no signal
        out.append(match.group())
    return out


@lru_cache(maxsize=1)
def _skill_pattern() -> re.Pattern[str]:
    forms = sorted(_CANON, key=len, reverse=True)
    alternation = "|".join(re.escape(f) for f in forms)
    return re.compile(rf"(?<![\w+#.])(?:{alternation})(?![\w+#]|\.\w)", re.IGNORECASE)


@lru_cache(maxsize=1)
def _case_sensitive_pattern() -> re.Pattern[str]:
    alternation = "|".join(re.escape(t) for t in CASE_SENSITIVE)
    return re.compile(rf"(?<![\w+#.])(?:{alternation})(?![\w+#]|\.\w|-)")


def skills_in(text: str) -> set[str]:
    """Canonical skill names mentioned in free text."""
    found = {norm_skill(m.group()) for m in _skill_pattern().finditer(text)}
    found |= {m.group().lower() for m in _case_sensitive_pattern().finditer(text)}
    return found


def mentions(text: str, term: str) -> bool:
    """Whole-word, case-insensitive mention of an arbitrary term (e.g. a missing JD skill)."""
    if not term.strip():
        return False
    pattern = rf"(?<![\w+#.]){re.escape(term.strip())}(?![\w+#])"
    return re.search(pattern, text, re.IGNORECASE) is not None
