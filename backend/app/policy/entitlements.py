"""Entitlements (PLAN-1, A2 #10): one check per feature, so pricing can be switched on later
without touching feature code."""

from app.core.errors import EntitlementRequired

PAID_PLANS = frozenset({"plus", "pro", "pro_plus"})
# feature -> plans that include it once beta ends. Adding a feature = one entry (OCP).
FEATURE_PLANS: dict[str, frozenset[str]] = {
    "tailor_mode": PAID_PLANS,
}


class Entitlements:
    def __init__(self, beta_free_tailoring: bool) -> None:
        self._beta_free = beta_free_tailoring

    def can(self, plan: str, feature: str) -> bool:
        if feature == "tailor_mode" and self._beta_free:
            return True
        return plan in FEATURE_PLANS.get(feature, frozenset())

    def require(self, plan: str, feature: str) -> None:
        if not self.can(plan, feature):
            raise EntitlementRequired(feature=feature)
