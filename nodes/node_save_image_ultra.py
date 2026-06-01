import os

import numpy as np
from PIL import Image
from PIL.PngImagePlugin import PngInfo

import folder_paths
from comfy.cli_args import args


class SaveImageWithPromptToggle:
    def __init__(self):
        self.output_dir = folder_paths.get_output_directory()
        self.type = "output"
        self.prefix_append = ""
        self.compress_level = 4

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "images": ("IMAGE", {"tooltip": "The images to save."}),
                "filename_prefix": (
                    "STRING",
                    {
                        "default": "ComfyUI",
                        "tooltip": "The prefix for the file to save.",
                    },
                ),
                "attach_prompt_metadata": (
                    "BOOLEAN",
                    {
                        "default": False,
                        "tooltip": "When enabled, writes prompt data into PNG metadata.",
                    },
                ),
            },
            "hidden": {
                "prompt": "PROMPT",
                "extra_pnginfo": "EXTRA_PNGINFO",
            },
        }

    RETURN_TYPES = ()
    FUNCTION = "save_images"
    OUTPUT_NODE = True
    CATEGORY = "👑 Avatary/Image"
    DESCRIPTION = "Saves images like the core Save Image node, with optional prompt metadata embedding."

    @staticmethod
    def _extract_prompt_text(prompt):
        if isinstance(prompt, str):
            text = prompt.strip()
            return text or None

        if not isinstance(prompt, (dict, list)):
            return None

        text_values = []
        stack = [prompt]
        while stack:
            current = stack.pop()
            if isinstance(current, dict):
                for key, value in current.items():
                    if key == "text" and isinstance(value, str):
                        text = value.strip()
                        if text:
                            text_values.append(text)
                    elif isinstance(value, (dict, list)):
                        stack.append(value)
            elif isinstance(current, list):
                for value in current:
                    if isinstance(value, (dict, list)):
                        stack.append(value)
                    elif isinstance(value, str):
                        text = value.strip()
                        if text:
                            text_values.append(text)

        if not text_values:
            return None

        # Prefer the most descriptive prompt candidate when multiple text fields exist.
        return max(text_values, key=len)

    def save_images(
        self,
        images,
        filename_prefix="ComfyUI",
        attach_prompt_metadata=False,
        prompt=None,
        extra_pnginfo=None,
    ):
        filename_prefix += self.prefix_append
        full_output_folder, filename, counter, subfolder, _ = folder_paths.get_save_image_path(
            filename_prefix,
            self.output_dir,
            images[0].shape[1],
            images[0].shape[0],
        )

        results = []
        for batch_number, image in enumerate(images):
            i = 255.0 * image.cpu().numpy()
            img = Image.fromarray(np.clip(i, 0, 255).astype(np.uint8))

            metadata = None
            if not args.disable_metadata and attach_prompt_metadata and prompt is not None:
                prompt_text = self._extract_prompt_text(prompt)
                if prompt_text is not None:
                    metadata = PngInfo()
                    metadata.add_text("prompt", prompt_text)

            filename_with_batch_num = filename.replace("%batch_num%", str(batch_number))
            file = f"{filename_with_batch_num}_{counter:05}_.png"
            img.save(
                os.path.join(full_output_folder, file),
                pnginfo=metadata,
                compress_level=self.compress_level,
            )

            results.append(
                {
                    "filename": file,
                    "subfolder": subfolder,
                    "type": self.type,
                }
            )
            counter += 1

        return {"ui": {"images": results}}


NODE_CLASS_MAPPINGS = {
    "SaveImageWithPromptToggle": SaveImageWithPromptToggle,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "SaveImageWithPromptToggle": "Save Image Ultra Avatary",
}
