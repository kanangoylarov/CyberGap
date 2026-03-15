# Bait controller placeholder
#
# Extra bait routes are NOT defined here. Instead, each behavior class
# (e.g. GenericBehavior, SQLiBehavior, etc.) can override the
# ``get_extra_router()`` method from ``BaseBehavior`` to return an
# ``APIRouter`` with behaviour-specific honeypot endpoints.
#
# Those routers are dynamically included in ``app/main.py`` at startup
# via:
#
#     _extra_router = _behavior.get_extra_router()
#     if _extra_router:
#         app.include_router(_extra_router)
#
# This keeps bait logic co-located with the behaviour that defines it,
# rather than centralised in a single controller file.
