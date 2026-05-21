class ComfyUIGroupBypasser:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {}}

    RETURN_TYPES = ()
    RETURN_NAMES = ()
    FUNCTION = "noop"
    CATEGORY = "utils"

    def noop(self):
        return ()


NODE_CLASS_MAPPINGS = {
    "ComfyUI-Group-Bypasser": ComfyUIGroupBypasser,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "ComfyUI-Group-Bypasser": "Group Bypasser",
}
