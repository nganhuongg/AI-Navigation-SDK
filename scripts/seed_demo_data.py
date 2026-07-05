"""Seed/reset demo runtime data.

For the current backend, seeding means clearing mutable state and ensuring the
runtime directories exist. Reference data is already checked in under data/.
"""

from __future__ import annotations

from reset_runtime_state import main as reset_runtime_state


if __name__ == "__main__":
    reset_runtime_state()
