"""
Supabase client — server-side (service_role key).
Used for all database operations on behalf of authenticated users.
"""
from supabase import create_client, Client
from backend.core.config import SUPABASE_URL, SUPABASE_SERVICE_KEY

_client: Client | None = None


def get_supabase() -> Client:
    """Return a singleton Supabase client using service_role key."""
    global _client
    if _client is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError(
                "SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env. "
                "Get these from: Supabase Dashboard → Project Settings → API"
            )
        _client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return _client
