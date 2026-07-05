import os
import sys
import types

# The scraper is a flat script folder, not a package - make its modules
# importable from tests/.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# push.py reads VAPID env vars at import time and supabase_client at
# init - give tests harmless placeholders so imports don't explode.
os.environ.setdefault("SUPABASE_URL", "https://placeholder.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "placeholder-key")
os.environ.setdefault("VAPID_PRIVATE_KEY", "placeholder-vapid-key")
os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")

# Stub out pywebpush so unit tests never touch real push infrastructure
# (and don't need its native http-ece build dependency installed).
if "pywebpush" not in sys.modules:
    fake_pywebpush = types.ModuleType("pywebpush")

    class WebPushException(Exception):
        def __init__(self, *args, response=None, **kwargs):
            super().__init__(*args)
            self.response = response

    fake_pywebpush.WebPushException = WebPushException
    fake_pywebpush.webpush = lambda **kwargs: None
    sys.modules["pywebpush"] = fake_pywebpush
