class AvataryFeatures:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "noop"
    CATEGORY = "👑 Avatary/Utilities"

    def noop(self):
        return ()


NODE_CLASS_MAPPINGS = {
    "AvataryFeatures": AvataryFeatures,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "AvataryFeatures": "Features Avatary",
}
