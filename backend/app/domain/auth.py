from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class AuthUser:
    """A verified caller. Only JwtVerifier creates one."""

    id: UUID
    email: str | None
    provider: str | None
    access_token: str  # forwarded to Supabase Storage so storage RLS applies; never logged

    def __repr__(self) -> str:  # keep the token out of tracebacks and debug output
        return f"AuthUser(id={self.id}, provider={self.provider})"
