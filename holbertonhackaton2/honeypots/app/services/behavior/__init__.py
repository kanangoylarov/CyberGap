from app.services.behavior.base import BaseBehavior
from app.services.behavior.generic import GenericBehavior
from app.services.behavior.exploits import ExploitsBehavior
from app.services.behavior.fuzzers import FuzzersBehavior
from app.services.behavior.dos import DosBehavior
from app.services.behavior.reconnaissance import ReconnaissanceBehavior
from app.services.behavior.analysis import AnalysisBehavior
from app.services.behavior.backdoor import BackdoorBehavior
from app.services.behavior.shellcode import ShellcodeBehavior
from app.services.behavior.worms import WormsBehavior

BEHAVIOR_MAP: dict[str, type[BaseBehavior]] = {
    "generic": GenericBehavior,
    "exploits": ExploitsBehavior,
    "fuzzers": FuzzersBehavior,
    "dos": DosBehavior,
    "reconnaissance": ReconnaissanceBehavior,
    "analysis": AnalysisBehavior,
    "backdoor": BackdoorBehavior,
    "shellcode": ShellcodeBehavior,
    "worms": WormsBehavior,
}


def get_behavior(honeypot_type: str) -> BaseBehavior:
    """Factory function that returns the appropriate behavior instance for the given honeypot type.

    Falls back to GenericBehavior if the honeypot_type is not recognized.
    """
    behavior_class = BEHAVIOR_MAP.get(honeypot_type, GenericBehavior)
    return behavior_class()
