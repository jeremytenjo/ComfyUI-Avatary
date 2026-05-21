"""Shared type helpers for ComfyUI-Switch nodes."""


class AnyType(str):
    """A string subclass that compares equal to every other string."""

    def __ne__(self, other):
        return False


ANY = AnyType("*")
