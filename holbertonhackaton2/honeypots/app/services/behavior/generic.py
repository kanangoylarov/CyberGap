from app.services.behavior.base import BaseBehavior


class GenericBehavior(BaseBehavior):
    def get_type_name(self) -> str:
        return "generic"
