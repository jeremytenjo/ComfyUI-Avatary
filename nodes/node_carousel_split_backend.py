from __future__ import annotations

import torch


class CarouselSplit:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE", "IMAGE")
    RETURN_NAMES = ("images", "preview")
    OUTPUT_IS_LIST = (True, False)
    FUNCTION = "split"
    CATEGORY = "👑 Avatary/Image"

    @staticmethod
    def _validate_image(image: torch.Tensor) -> None:
        if not isinstance(image, torch.Tensor):
            raise ValueError("Expected IMAGE tensor with shape [B, H, W, C]")
        if image.ndim != 4:
            raise ValueError("Expected IMAGE tensor with shape [B, H, W, C]")
        if image.shape[1] < 1 or image.shape[2] < 1 or image.shape[3] < 1:
            raise ValueError("Expected non-empty IMAGE tensor with shape [B, H, W, C]")

    @staticmethod
    def _runs(mask: list[bool]) -> list[tuple[int, int]]:
        runs: list[tuple[int, int]] = []
        start: int | None = None
        for index, value in enumerate(mask):
            if value and start is None:
                start = index
            elif not value and start is not None:
                runs.append((start, index - 1))
                start = None
        if start is not None:
            runs.append((start, len(mask) - 1))
        return runs

    @staticmethod
    def _robust_z(values: torch.Tensor) -> torch.Tensor:
        median = values.median()
        mad = (values - median).abs().median()
        if float(mad) < 1e-6:
            mad = (values.std(unbiased=False) / 1.4826) + 1e-6
        return (values - median) / (1.4826 * mad)

    @staticmethod
    def _axis_length(gray: torch.Tensor, axis: str) -> int:
        return int(gray.shape[1] if axis == "x" else gray.shape[0])

    @staticmethod
    def _line_std(gray: torch.Tensor, axis: str) -> torch.Tensor:
        return gray.std(dim=0, unbiased=False) if axis == "x" else gray.std(dim=1, unbiased=False)

    @classmethod
    def _gutter_runs(cls, gray: torch.Tensor, axis: str, min_panel_px: int) -> list[tuple[int, int]]:
        length = cls._axis_length(gray, axis)
        max_gutter_width = max(1, int(length * 0.06))
        flat = (cls._line_std(gray, axis) < 0.01).tolist()
        gutters: list[tuple[int, int]] = []
        for start, end in cls._runs([bool(value) for value in flat]):
            if start <= 1 or end >= length - 2:
                continue
            width = end - start + 1
            if width < 2 or width > max_gutter_width:
                continue
            center = (start + end) // 2
            if center < min_panel_px or (length - center) < min_panel_px:
                continue
            gutters.append((start, end))

        line_mean = gray.mean(dim=0 if axis == "x" else 1)
        extreme_tone = ((line_mean < 0.03) | (line_mean > 0.97)).tolist()
        for start, end in cls._runs([bool(value) for value in extreme_tone]):
            if start <= 1 or end >= length - 2:
                continue
            width = end - start + 1
            if width < 2 or width > max_gutter_width:
                continue
            center = (start + end) // 2
            if center < min_panel_px or (length - center) < min_panel_px:
                continue
            gutters.append((start, end))

        gutters = sorted(set(gutters))
        return gutters

    @classmethod
    def _best_gutter(
        cls,
        gray: torch.Tensor,
        allowed_axes: tuple[str, ...],
        min_panel_px: int,
    ) -> tuple[str, tuple[int, int]] | None:
        best: tuple[str, tuple[int, int], int] | None = None
        for axis in allowed_axes:
            if cls._axis_length(gray, axis) < (2 * min_panel_px) + 1:
                continue
            for start, end in cls._gutter_runs(gray, axis, min_panel_px):
                width = end - start + 1
                if best is None or width > best[2]:
                    best = (axis, (start, end), width)
        if best is None:
            return None
        return (best[0], best[1])

    @classmethod
    def _trim_solid_frame(cls, gray: torch.Tensor) -> tuple[int, int, int, int]:
        height, width = int(gray.shape[0]), int(gray.shape[1])
        row_std = gray.std(dim=1, unbiased=False)
        col_std = gray.std(dim=0, unbiased=False)
        top = 0
        bottom = height
        left = 0
        right = width
        while top < bottom - 1 and float(row_std[top]) < 0.01:
            top += 1
        while bottom > top + 1 and float(row_std[bottom - 1]) < 0.01:
            bottom -= 1
        while left < right - 1 and float(col_std[left]) < 0.01:
            left += 1
        while right > left + 1 and float(col_std[right - 1]) < 0.01:
            right -= 1
        if bottom - top < int(height * 0.5):
            top = 0
            bottom = height
        if right - left < int(width * 0.5):
            left = 0
            right = width
        return (top, bottom, left, right)

    @classmethod
    def _decompose_gutters(
        cls,
        gray: torch.Tensor,
        y0: int,
        x0: int,
        allowed_axes: tuple[str, ...],
        min_panel_px: int,
        depth: int,
        boxes: list[tuple[int, int, int, int]],
    ) -> None:
        height, width = int(gray.shape[0]), int(gray.shape[1])
        if depth >= 12:
            boxes.append((y0, y0 + height, x0, x0 + width))
            return

        gutter = cls._best_gutter(gray, allowed_axes, min_panel_px)
        if gutter is None:
            boxes.append((y0, y0 + height, x0, x0 + width))
            return

        axis, (start, end) = gutter
        if axis == "x":
            cls._decompose_gutters(
                gray[:, :start],
                y0,
                x0,
                allowed_axes,
                min_panel_px,
                depth + 1,
                boxes,
            )
            cls._decompose_gutters(
                gray[:, end + 1 :],
                y0,
                x0 + end + 1,
                allowed_axes,
                min_panel_px,
                depth + 1,
                boxes,
            )
        else:
            cls._decompose_gutters(
                gray[:start, :],
                y0,
                x0,
                allowed_axes,
                min_panel_px,
                depth + 1,
                boxes,
            )
            cls._decompose_gutters(
                gray[end + 1 :, :],
                y0 + end + 1,
                x0,
                allowed_axes,
                min_panel_px,
                depth + 1,
                boxes,
            )

    @classmethod
    def _gutter_boxes(
        cls,
        gray: torch.Tensor,
        allowed_axes: tuple[str, ...],
        min_panel_px: int,
    ) -> list[tuple[int, int, int, int]]:
        if not any(cls._gutter_runs(gray, axis, min_panel_px) for axis in allowed_axes):
            return []
        top, bottom, left, right = cls._trim_solid_frame(gray)
        trimmed = gray[top:bottom, left:right]
        boxes: list[tuple[int, int, int, int]] = []
        cls._decompose_gutters(
            trimmed,
            top,
            left,
            allowed_axes,
            min_panel_px,
            depth=0,
            boxes=boxes,
        )
        return boxes

    @classmethod
    def _seam_ranges_1d(
        cls,
        profile: torch.Tensor,
        diffs: torch.Tensor,
        length: int,
        min_panel_px: int,
    ) -> list[tuple[int, int]]:
        if profile.numel() < 3:
            return []
        z_scores = cls._robust_z(profile)
        support_threshold = diffs.median() + diffs.std(unbiased=False)
        candidates: list[int] = []
        for index in range(1, int(profile.numel()) - 1):
            local_start = max(0, index - 3)
            local_end = min(int(profile.numel()), index + 4)
            local_max = profile[local_start:local_end].max()
            support = float((diffs[:, index] > support_threshold).float().mean())
            if (
                float(z_scores[index]) >= 5.0
                and float(profile[index]) >= float(local_max) - 1e-9
                and support >= 0.55
            ):
                candidates.append(index)
        if not candidates:
            return []

        strongest = max(float(z_scores[index]) for index in candidates)
        cutoff = 0.3 * strongest
        min_gap = max(4, int(length * 0.05))
        peaks: list[int] = []
        for index in candidates:
            if float(z_scores[index]) < cutoff:
                continue
            if peaks and index - peaks[-1] < min_gap:
                if float(profile[index]) > float(profile[peaks[-1]]):
                    peaks[-1] = index
                continue
            peaks.append(index)

        seams: list[int] = []
        previous = 0
        for peak in peaks:
            position = peak + 1
            if position - previous >= min_panel_px and length - position >= min_panel_px:
                seams.append(position)
                previous = position
        return cls._ranges_from_seams(seams, length)

    @staticmethod
    def _ranges_from_seams(seams: list[int], length: int) -> list[tuple[int, int]]:
        ranges: list[tuple[int, int]] = []
        index = 0
        max_gutter_width = max(2, int(length * 0.03))
        while index < len(seams):
            current = seams[index]
            if index + 1 < len(seams) and 0 < seams[index + 1] - current <= max_gutter_width:
                ranges.append((current, seams[index + 1]))
                index += 2
                continue
            ranges.append((current, current))
            index += 1
        return ranges

    @staticmethod
    def _spans_from_ranges(length: int, ranges: list[tuple[int, int]]) -> list[tuple[int, int]]:
        spans: list[tuple[int, int]] = []
        start = 0
        for separator_start, separator_end in ranges:
            if separator_start > start:
                spans.append((start, separator_start))
            start = separator_end
        if start < length:
            spans.append((start, length))
        return spans or [(0, length)]

    @classmethod
    def _seamless_boxes(
        cls,
        gray: torch.Tensor,
        allowed_axes: tuple[str, ...],
        min_panel_px: int,
    ) -> list[tuple[int, int, int, int]]:
        height, width = int(gray.shape[0]), int(gray.shape[1])
        x_ranges: list[tuple[int, int]] = []
        y_ranges: list[tuple[int, int]] = []
        if "x" in allowed_axes:
            x_diffs = (gray[:, 1:] - gray[:, :-1]).abs()
            dcol = x_diffs.mean(dim=0)
            x_ranges = cls._seam_ranges_1d(dcol, x_diffs, width, min_panel_px)
        if "y" in allowed_axes:
            y_diffs = (gray[1:, :] - gray[:-1, :]).abs()
            drow = y_diffs.mean(dim=1)
            y_ranges = cls._seam_ranges_1d(drow, y_diffs.transpose(0, 1), height, min_panel_px)

        xs = cls._spans_from_ranges(width, x_ranges)
        ys = cls._spans_from_ranges(height, y_ranges)
        return [
            (y0, y1, x0, x1)
            for y0, y1 in ys
            for x0, x1 in xs
        ]

    @classmethod
    def _find_boxes(
        cls,
        single_image: torch.Tensor,
        direction: str,
    ) -> list[tuple[int, int, int, int]]:
        gray = single_image.float().mean(dim=2)
        min_panel_px = max(32, int(min(int(gray.shape[0]), int(gray.shape[1])) * 0.08))
        if direction == "horizontal":
            allowed_axes = ("y",)
        elif direction == "auto":
            allowed_axes = ("x", "y")
        else:
            allowed_axes = ("x",)

        boxes = cls._gutter_boxes(gray, allowed_axes, min_panel_px)
        if not boxes:
            boxes = cls._seamless_boxes(gray, allowed_axes, min_panel_px)
        boxes = [
            box
            for box in boxes
            if (box[1] - box[0]) >= min_panel_px and (box[3] - box[2]) >= min_panel_px
        ]
        return sorted(boxes or [(0, int(gray.shape[0]), 0, int(gray.shape[1]))], key=lambda box: (box[0], box[2]))

    @staticmethod
    def _crop_panels(
        single_image: torch.Tensor,
        boxes: list[tuple[int, int, int, int]],
    ) -> list[torch.Tensor]:
        return [single_image[y0:y1, x0:x1, :] for y0, y1, x0, x1 in boxes]

    @staticmethod
    def _draw_preview(
        single_image: torch.Tensor,
        boxes: list[tuple[int, int, int, int]],
    ) -> torch.Tensor:
        preview = single_image.clone()
        if boxes == [(0, int(single_image.shape[0]), 0, int(single_image.shape[1]))]:
            return preview
        channels = preview.shape[2]
        red = torch.zeros((channels,), dtype=preview.dtype, device=preview.device)
        red[0] = 1.0
        if channels > 1:
            red[1] = 0.0
        if channels > 2:
            red[2] = 0.0
        if channels > 3:
            red[3] = 1.0

        thickness = 3
        height, width = int(preview.shape[0]), int(preview.shape[1])
        for y0, y1, x0, x1 in boxes:
            preview[max(0, y0) : min(height, y0 + thickness), max(0, x0) : min(width, x1), :] = red
            preview[max(0, y1 - thickness) : min(height, y1), max(0, x0) : min(width, x1), :] = red
            preview[max(0, y0) : min(height, y1), max(0, x0) : min(width, x0 + thickness), :] = red
            preview[max(0, y0) : min(height, y1), max(0, x1 - thickness) : min(width, x1), :] = red
        return preview

    def split(
        self,
        image: torch.Tensor,
        **_ignored,
    ):
        self._validate_image(image)

        all_panels: list[torch.Tensor] = []
        previews: list[torch.Tensor] = []
        for batch_index in range(image.shape[0]):
            single_image = image[batch_index]
            boxes = self._find_boxes(single_image, direction="auto")

            all_panels.extend(
                self._crop_panels(
                    single_image,
                    boxes=boxes,
                )
            )
            previews.append(
                self._draw_preview(
                    single_image,
                    boxes=boxes,
                )
            )

        panel_images = [panel.unsqueeze(0) for panel in all_panels]
        preview_batch = torch.stack(previews, dim=0)
        return (panel_images, preview_batch)


NODE_CLASS_MAPPINGS = {
    "GridSplit": CarouselSplit,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GridSplit": "Carousel Split Avatary",
}
