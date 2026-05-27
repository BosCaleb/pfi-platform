"""
Shared slowapi rate-limiter instance.

Import ``limiter`` from this module in both ``main.py`` (to register the
exception handler) and any router that needs ``@limiter.limit()``.
Using a single module-level object ensures that all decorators share the
same backing store, so limits accumulate correctly across all routes.

Storage:
  Default: ``memory://``  — in-process only, resets on restart.
  Production: Set ``SLOWAPI_STORAGE_URI=redis://host:6379`` to share
  limits across multiple workers / containers.
"""

import os

from slowapi import Limiter
from slowapi.util import get_remote_address

_storage_uri = os.getenv("SLOWAPI_STORAGE_URI", "memory://")

limiter = Limiter(key_func=get_remote_address, storage_uri=_storage_uri)
