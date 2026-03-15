"""
Run the Croppy schema on Supabase via the REST management API.
Uses the service_role key — run once to set up all tables.
"""
import httpx
import sys

SUPABASE_URL = "https://yhvramoilgzowfpjdyor.supabase.co"
SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlodnJhbW9pbGd6b3dmcGpkeW9yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzIxNjk3MywiZXhwIjoyMDg4NzkyOTczfQ.gybvQ5cuKdNIGgElHUr6iZp1-1V2vo8KrZzMdaFaS8o"

with open("supabase_schema.sql", "r", encoding="utf-8") as f:
    sql = f.read()

resp = httpx.post(
    f"{SUPABASE_URL}/rest/v1/rpc/exec_sql",
    headers={
        "apikey":        SERVICE_KEY,
        "Authorization": f"Bearer {SERVICE_KEY}",
        "Content-Type":  "application/json",
    },
    json={"query": sql},
    timeout=60,
)

if resp.status_code == 200:
    print("✅ Schema applied successfully!")
else:
    # Try the pg endpoint instead
    resp2 = httpx.post(
        f"{SUPABASE_URL}/pg/query",
        headers={
            "apikey":        SERVICE_KEY,
            "Authorization": f"Bearer {SERVICE_KEY}",
            "Content-Type":  "application/json",
        },
        json={"query": sql},
        timeout=60,
    )
    print(f"Status: {resp2.status_code}")
    print(resp2.text[:500])
