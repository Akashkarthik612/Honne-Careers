"""TemplateRegistry (B7): Jake only in beta (A2 #10). Adding a template = one entry."""

from dataclasses import dataclass

from app.core.errors import InvalidInput


@dataclass(frozen=True, slots=True)
class TemplateInfo:
    id: str
    name: str
    description: str


class TemplateRegistry:
    def __init__(self) -> None:
        self._templates = {
            "jake": TemplateInfo("jake", "Jake's Resume",
                                 "Single-column, ATS-safe, compiled with LaTeX"),
        }

    def all(self) -> list[TemplateInfo]:
        return list(self._templates.values())

    def require(self, template_id: str) -> TemplateInfo:
        try:
            return self._templates[template_id]
        except KeyError as exc:
            raise InvalidInput("Unknown template.", reason="template") from exc
