"""Minimal PostgREST client - just enough for the scraper's needs.

Talks to Supabase via SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, which
bypasses Row Level Security entirely (this is run only from trusted
GitHub Actions, never exposed to the app/browser).
"""

import os

import requests


def _raise_with_body(resp: requests.Response) -> None:
    """requests' default HTTPError drops the response body, which is
    where PostgREST puts the actually useful error message - surface it
    so a failed scraper run doesn't need a live API call to diagnose."""
    if resp.ok:
        return
    raise requests.exceptions.HTTPError(f"{resp.status_code} {resp.url}: {resp.text}", response=resp)


class SupabaseClient:
    def __init__(self):
        self.url = os.environ["SUPABASE_URL"].rstrip("/")
        self.key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
        self.headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
        }

    def select(self, table: str, params: dict | None = None) -> list[dict]:
        resp = requests.get(f"{self.url}/rest/v1/{table}", headers=self.headers, params=params or {})
        _raise_with_body(resp)
        return resp.json()

    def insert(self, table: str, rows: list[dict]) -> list[dict]:
        headers = {**self.headers, "Prefer": "return=representation"}
        resp = requests.post(f"{self.url}/rest/v1/{table}", headers=headers, json=rows)
        _raise_with_body(resp)
        return resp.json()

    def update(self, table: str, values: dict, filters: dict) -> list[dict]:
        headers = {**self.headers, "Prefer": "return=representation"}
        resp = requests.patch(f"{self.url}/rest/v1/{table}", headers=headers, params=filters, json=values)
        _raise_with_body(resp)
        return resp.json()

    def delete(self, table: str, filters: dict) -> list[dict]:
        headers = {**self.headers, "Prefer": "return=representation"}
        resp = requests.delete(f"{self.url}/rest/v1/{table}", headers=headers, params=filters)
        _raise_with_body(resp)
        return resp.json()

    def rpc(self, fn_name: str, args: dict) -> object:
        resp = requests.post(f"{self.url}/rest/v1/rpc/{fn_name}", headers=self.headers, json=args)
        _raise_with_body(resp)
        return resp.json() if resp.text else None
