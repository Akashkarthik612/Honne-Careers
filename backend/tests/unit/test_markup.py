"""**bold** markup in bullets: parser, renderer, client validation, header link labels."""

import pytest
from pydantic import ValidationError

from app.domain.cv import BulletIn, Link
from app.domain.markup import BoldSpan, MalformedMarkup, parse, plain
from app.render.latex import link_label, rich


def test_parse_splits_bold_and_plain():
    assert parse("Cut **p95 latency** by **38%**") == [
        BoldSpan("Cut ", False), BoldSpan("p95 latency", True), BoldSpan(" by ", False),
        BoldSpan("38%", True)]
    assert parse("no markers") == [BoldSpan("no markers", False)]


@pytest.mark.parametrize("text", ["Cut **latency", "Cut **** latency", "Cut ** ** now",
                                  "Cut ***latency*** now"])
def test_parse_rejects_malformed(text):
    with pytest.raises(MalformedMarkup):
        parse(text)


def test_plain_drops_markers():
    assert plain("Cut **p95 latency** by 38%") == "Cut p95 latency by 38%"


def test_rich_escapes_inside_bold():
    assert rich("Built **C#** tools for **50%** & more") == \
        r"Built \textbf{C\#} tools for \textbf{50\%} \& more"


def test_rich_cannot_open_a_command():
    assert rich(r"**\input{x}**") == r"\textbf{\textbackslash{}input\{x\}}"


def test_client_bullet_with_bad_markup_is_rejected():
    assert BulletIn(id="b1", text="Shipped **Kafka** consumers").text
    with pytest.raises(ValidationError):
        BulletIn(id="b1", text="Shipped **Kafka consumers")


@pytest.mark.parametrize(("url", "label"), [
    ("https://www.linkedin.com/in/arjun", "LinkedIn"),
    ("https://in.linkedin.com/in/arjun", "LinkedIn"),
    ("https://github.com/arjun", "GitHub"),
    ("https://arjun.github.io", "Portfolio"),
    ("https://arjun.dev", "Portfolio"),
])
def test_link_label_by_host(url, label):
    assert link_label(Link(url=url)) == label


def test_link_label_keeps_the_users_label():
    assert link_label(Link(label="Blog", url="https://github.com/arjun")) == "Blog"
