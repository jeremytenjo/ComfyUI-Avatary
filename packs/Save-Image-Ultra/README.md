# ComfyUI Save Image Ultra

Custom ComfyUI output node that mirrors core `Save Image` behavior and adds a boolean toggle (Ultra edition):

- `attach_prompt_metadata` (default: `false`)

When enabled, the node writes prompt-related PNG metadata. When disabled, this node writes no PNG metadata.

## Install

1. Copy/clone this folder into `ComfyUI/custom_nodes/`
2. Restart ComfyUI

## Node

- Display name: `Save Image Ultra`
- Category: `image`
- Inputs:
  - `images` (`IMAGE`)
  - `filename_prefix` (`STRING`)
  - `attach_prompt_metadata` (`BOOLEAN`, default `false`)

## Metadata Structure

This node writes PNG text chunks (`tEXt`) using ComfyUI's standard behavior.

When `attach_prompt_metadata = true`:

- `prompt`: plain prompt text (best match extracted from prompt `text` fields).

When `attach_prompt_metadata = false`:

- No PNG metadata is written by this node.

Example shape of saved text entries:

```json
{
  "prompt": "mirror selfie of a young woman ... relaxed editorial mood"
}
```

Notes:

- Only the `prompt` text key is written by this node when enabled.
- If ComfyUI is started with metadata disabled (for example `--disable-metadata`), no PNG text metadata is written.

## View Metadata

You can inspect PNG metadata with any of these methods:

- macOS/Linux (`exiftool`):

```bash
exiftool -a -G1 -s output.png
```

- Node.js (`png-chunks-extract` + `png-chunk-text`):

```bash
npm i png-chunks-extract png-chunk-text
node -e 'const fs=require("fs");const extract=require("png-chunks-extract");const text=require("png-chunk-text");const chunks=extract(fs.readFileSync("output.png"));for(const c of chunks){if(c.name==="tEXt"){const d=text.decode(c.data);console.log(d.keyword+":", d.text)}}'
```

- ComfyUI workflow tools that read PNG text chunks (many "Load/Info" nodes expose these fields).
