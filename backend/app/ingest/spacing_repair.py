"""Spacing repair (PROF-2, TRUTH-1): a one-off fix for text stored by the pre-fix extractor.

Until df4b8e5, PdfExtractor read uploads with pypdf's default mode, which drops the space at a
regular/bold switch ("throughPython") and splits kerned pairs ("T echnology"). The parser
copied that into cv_uploads.parsed, the profile, and every CV made from it.

The proof is the user's own original file, read twice: `broken` = default mode (what was
stored), `fixed` = today's PdfExtractor. Their non-space characters agree, so aligning them
shows exactly where only whitespace differs (`WhitespaceEdit`). A stored string is changed
only where the broken passage, with its neighbouring words, matches the file and every
matching edit gives the same spacing. No dictionary or regex guesses; every change keeps the
text identical once whitespace is removed, so no fact changes (TRUTH-1).

Pure: no I/O. scripts/repair_extraction_spacing.py does the reading and writing.
Time O(n) to align (n = characters in the file's text, difflib on equal-ish strings) and
O(m * e) to scan stored strings (m tokens, e edits, both small).
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from enum import StrEnum
from typing import Any

CONTEXT = 2          # neighbouring words that must agree on each side (or reach the string's edge)
MAX_UNIT = 4         # tokens in one broken passage ("Cognizant T echnology" -> 2 used)
MIN_ALIGNED = 0.95   # share of characters the two readings must agree on, else stop
_TOKEN = re.compile(r"\S+")
_SPACE = re.compile(r"\s+")

# Keys whose values are never prose: ids, links, enums, flags.
SKIP_KEYS = frozenset({"id", "url", "email", "phone", "link", "origin", "original_origin",
                       "locked", "tailor_state", "level"})


class Reason(StrEnum):
    AMBIGUOUS = "ambiguous"                    # matching edits disagree on the spacing
    NO_PASSAGE = "no_passage"                  # broken form present, context doesn't match the file
    PROVENANCE_UNKNOWN = "provenance_unknown"  # passage not traceable to the affected upload
    LOCKED_EDIT = "locked_edit"                # user-owned text that differs from the upload
    TEXT_ORIGINAL_MISMATCH = "text_original_mismatch"  # only one of text/original_text fixable
    HISTORICAL = "historical"                  # applications: the record of what was sent


class AlignmentTooWeak(ValueError):
    """The two readings of the file differ in more than whitespace: not a proof."""


class InvariantBroken(AssertionError):
    """A repair changed something other than whitespace in a string. Never written."""


@dataclass(frozen=True, slots=True)
class WhitespaceEdit:
    broken: tuple[str, ...]   # tokens as the default mode read them
    fixed: tuple[str, ...]    # the same characters as the page shows them
    before: tuple[str, ...]   # up to CONTEXT broken-stream tokens before
    after: tuple[str, ...]    # up to CONTEXT broken-stream tokens after


@dataclass(frozen=True, slots=True)
class Applied:
    window: tuple[str, ...]   # stored tokens that matched (context + passage), for tracing
    before: str
    after: str


@dataclass(frozen=True, slots=True)
class Match:
    text: str
    applied: tuple[Applied, ...] = ()
    issues: tuple[Reason, ...] = ()

    @property
    def touched(self) -> bool:
        return bool(self.applied or self.issues)


@dataclass(frozen=True, slots=True)
class SpacingFix:
    path: str
    before: str
    after: str


@dataclass(frozen=True, slots=True)
class ReviewItem:
    path: str
    reason: Reason


@dataclass(slots=True)
class ContentRepair:
    content: dict[str, Any]
    fixes: list[SpacingFix] = field(default_factory=list)
    reviews: list[ReviewItem] = field(default_factory=list)


def squash(text: str) -> str:
    return _SPACE.sub("", text)


def _starts(tokens: list[str]) -> tuple[list[int], list[int]]:
    """Char offset where each token starts in "".join(tokens), and the owner token of each char."""
    starts, owner = [], []
    for i, tok in enumerate(tokens):
        starts.append(len(owner))
        owner.extend([i] * len(tok))
    return starts, owner


class ExtractionAlignment:
    """Two readings of one file -> the places where only whitespace differs."""

    @staticmethod
    def edits(broken_text: str, fixed_text: str) -> list[WhitespaceEdit]:
        b_tok, f_tok = broken_text.split(), fixed_text.split()
        b_chars, f_chars = "".join(b_tok), "".join(f_tok)
        matcher = SequenceMatcher(None, b_chars, f_chars, autojunk=False)
        to_fixed = [-1] * len(b_chars)
        for a, b, size in matcher.get_matching_blocks():
            for k in range(size):
                to_fixed[a + k] = b + k
        aligned = sum(1 for x in to_fixed if x >= 0)
        if aligned < MIN_ALIGNED * max(len(b_chars), len(f_chars), 1):
            raise AlignmentTooWeak(f"only {aligned} of {len(b_chars)} characters align")
        b_start, _ = _starts(b_tok)
        f_start, f_owner = _starts(f_tok)
        f_end = [s + len(t) for s, t in zip(f_start, f_tok, strict=True)]

        def mapped(lo: int, hi: int) -> bool:  # chars lo..hi map onto one contiguous range
            base = to_fixed[lo]
            return base >= 0 and all(to_fixed[x] == base + x - lo for x in range(lo, hi + 1))

        edits, i = [], 0
        while i < len(b_tok):
            lo = b_start[i]
            fs = to_fixed[lo]
            if fs < 0 or f_start[f_owner[fs]] != fs:
                i += 1
                continue
            unit_end = None
            for k in range(i, min(i + MAX_UNIT, len(b_tok))):
                hi = b_start[k] + len(b_tok[k]) - 1
                if not mapped(lo, hi):
                    break
                fe = to_fixed[hi]
                if f_end[f_owner[fe]] - 1 == fe:   # both readings end a token here
                    unit_end = (k, f_owner[fe])
                    break
            if unit_end is None:
                i += 1
                continue
            k, j1 = unit_end
            j0 = f_owner[fs]
            if k > i or j1 > j0:
                edits.append(WhitespaceEdit(tuple(b_tok[i:k + 1]), tuple(f_tok[j0:j1 + 1]),
                                            tuple(b_tok[max(0, i - CONTEXT):i]),
                                            tuple(b_tok[k + 1:k + 1 + CONTEXT])))
            i = k + 1
        return edits


def _agree(stored: list[str], expected: tuple[str, ...], step: int, start: int) -> int:
    """How many tokens agree walking from `start` in direction `step` (-1 left, +1 right)."""
    order = expected[::-1] if step < 0 else expected
    n = 0
    for want in order:
        pos = start + step * n
        if not 0 <= pos < len(stored) or stored[pos] != want:
            break
        n += 1
    return n


class PassageMatcher:
    """Applies WhitespaceEdits to a stored string where the file proves them."""

    def __init__(self, edits: list[WhitespaceEdit]) -> None:
        self._by_broken: dict[tuple[str, ...], list[WhitespaceEdit]] = {}
        for e in edits:
            self._by_broken.setdefault(e.broken, []).append(e)

    @property
    def broken_forms(self) -> list[tuple[str, ...]]:
        return list(self._by_broken)

    def contains_broken(self, text: str) -> bool:
        return any(" ".join(b) in text for b in self._by_broken)

    def match(self, text: str) -> Match:
        spans = [(m.start(), m.end(), m.group()) for m in _TOKEN.finditer(text)]
        stored = [s[2] for s in spans]
        hits: list[tuple[int, int, WhitespaceEdit, int, int]] = []
        issues: list[Reason] = []
        for broken, candidates in self._by_broken.items():
            n = len(broken)
            for p in range(len(stored) - n + 1):
                if tuple(stored[p:p + n]) != broken:
                    continue
                proven = []
                for e in candidates:
                    left = _agree(stored, e.before, -1, p - 1)
                    right = _agree(stored, e.after, +1, p + n)
                    left_ok = left >= min(CONTEXT, len(e.before)) or p - left == 0
                    right_ok = right >= min(CONTEXT, len(e.after)) or p + n + right == len(stored)
                    if left_ok and right_ok and left + right >= 1:
                        proven.append((e, left, right))
                if not proven:
                    issues.append(Reason.NO_PASSAGE)
                elif len({e.fixed for e, _, _ in proven}) > 1:
                    issues.append(Reason.AMBIGUOUS)
                else:
                    e, left, right = proven[0]
                    hits.append((p, n, e, left, right))
        hits.sort(key=lambda h: h[0])
        if any(a[0] + a[1] > b[0] for a, b in zip(hits, hits[1:], strict=False)):
            return Match(text, (), (Reason.AMBIGUOUS,))   # overlapping passages: don't guess
        out, applied = text, []
        for p, n, e, left, right in reversed(hits):
            lo, hi = spans[p][0], spans[p + n - 1][1]
            after = " ".join(e.fixed)
            applied.append(Applied(tuple(stored[p - left:p + n + right]), text[lo:hi], after))
            out = out[:lo] + after + out[hi:]
        return Match(out, tuple(reversed(applied)), tuple(issues))


def _walk(node: Any, path: str = "") -> Iterator[tuple[str, Any, str | int, Any]]:
    """(path, parent, key, value) for every string leaf outside SKIP_KEYS."""
    items = node.items() if isinstance(node, dict) else enumerate(node)
    for key, value in items:
        if key in SKIP_KEYS:
            continue
        here = f"{path}.{key}" if isinstance(key, str) else f"{path}[{key}]"
        here = here.lstrip(".")
        if isinstance(value, str):
            yield here, node, key, value
        elif isinstance(value, dict | list):
            yield from _walk(value, here)


def _copy(node: Any) -> Any:
    if isinstance(node, dict):
        return {k: _copy(v) for k, v in node.items()}
    if isinstance(node, list):
        return [_copy(v) for v in node]
    return node


def check_invariant(before: Any, after: Any, path: str = "") -> None:
    """Same shape, same non-string values; changed strings differ only in whitespace."""
    if type(before) is not type(after):
        raise InvariantBroken(f"type changed at {path or '<root>'}")
    if isinstance(before, dict):
        if before.keys() != after.keys():
            raise InvariantBroken(f"keys changed at {path or '<root>'}")
        for k in before:
            check_invariant(before[k], after[k], f"{path}.{k}")
    elif isinstance(before, list):
        if len(before) != len(after):
            raise InvariantBroken(f"length changed at {path}")
        for i, (b, a) in enumerate(zip(before, after, strict=True)):
            check_invariant(b, a, f"{path}[{i}]")
    elif isinstance(before, str):
        if before != after and squash(before) != squash(after):
            raise InvariantBroken(f"non-space change at {path}")
    elif before != after:
        raise InvariantBroken(f"value changed at {path}")


class ContentRepairer:
    """Repairs one stored JSON document under the provenance rules (safeguards 1-3).

    `source` is the affected upload's parsed JSON as stored (before repair): a profile or
    CV passage is changed only when the matched words also appear, contiguously, in it.
    """

    def __init__(self, matcher: PassageMatcher, source: dict[str, Any]) -> None:
        self._matcher = matcher
        leaves = [v for _, _, _, v in _walk(source)]
        self._source_strings = frozenset(leaves)
        self._source_tokens = [tuple(v.split()) for v in leaves]

    def _traced(self, window: tuple[str, ...]) -> bool:
        n = len(window)
        return any(window == toks[i:i + n] for toks in self._source_tokens
                   for i in range(len(toks) - n + 1))

    def _decide(self, text: str, *, is_source: bool, user_owned: bool
                ) -> tuple[Match, Reason | None]:
        """The match for `text`, and why it can't be applied (None = it can)."""
        m = self._matcher.match(text)
        if not m.touched:
            return m, None
        if m.issues:
            return m, m.issues[0]
        if is_source:
            return m, None
        if user_owned and text not in self._source_strings:
            return m, Reason.LOCKED_EDIT
        if not all(self._traced(a.window) for a in m.applied):
            return m, Reason.PROVENANCE_UNKNOWN
        return m, None

    def repair_upload(self, parsed: dict[str, Any]) -> ContentRepair:
        return self._repair(parsed, is_source=True)

    def repair_cv(self, content: dict[str, Any]) -> ContentRepair:
        return self._repair(content, is_source=False)

    def _repair(self, doc: dict[str, Any], *, is_source: bool) -> ContentRepair:
        out = ContentRepair(_copy(doc))
        bullets: set[int] = set()
        for path, parent, key, value in list(_walk(out.content)):
            if key == "text" and isinstance(parent, dict) and "origin" in parent:
                if id(parent) not in bullets:
                    bullets.add(id(parent))
                    self._bullet(path.removesuffix(".text"), parent, out, is_source)
                continue
            if key == "original_text":
                continue  # handled with its bullet
            user_owned = isinstance(parent, dict) and parent.get("origin") == "user"
            m, reason = self._decide(value, is_source=is_source, user_owned=user_owned)
            self._record(path, parent, key, value, m, reason, out)
        check_invariant(doc, out.content)
        return out

    def _bullet(self, path: str, bullet: dict[str, Any], out: ContentRepair,
                is_source: bool) -> None:
        """text and original_text move together, so Keep/Revert can't restore a broken fact."""
        user_owned = bool(bullet.get("locked")) or bullet.get("origin") == "user"
        text_m, text_r = self._decide(bullet["text"], is_source=is_source, user_owned=user_owned)
        original = bullet.get("original_text")
        if original is None:
            self._record(f"{path}.text", bullet, "text", bullet["text"], text_m, text_r, out)
            return
        # original_text is the fact behind an AI wording: its own origin decides ownership.
        orig_m, orig_r = self._decide(original, is_source=is_source,
                                      user_owned=bullet.get("original_origin") == "user")
        # Both broken: both must be fixable, or neither changes. Only one broken: fixing it
        # alone is safe, since the other already reads correctly.
        if text_m.touched and orig_m.touched and (text_r is None) != (orig_r is None):
            for name in ("text", "original_text"):
                out.reviews.append(ReviewItem(f"{path}.{name}", Reason.TEXT_ORIGINAL_MISMATCH))
            return
        self._record(f"{path}.text", bullet, "text", bullet["text"], text_m, text_r, out)
        self._record(f"{path}.original_text", bullet, "original_text", original, orig_m, orig_r,
                     out)

    @staticmethod
    def _record(path: str, parent: Any, key: str | int, value: str, m: Match,
                reason: Reason | None, out: ContentRepair) -> None:
        if not m.touched:
            return
        if reason is not None:
            out.reviews.append(ReviewItem(path, reason))
            return
        parent[key] = m.text
        out.fixes.append(SpacingFix(path, value, m.text))
