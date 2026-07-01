from __future__ import annotations

import torch
import torch.nn.functional as F


class CarouselSplit:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
            },
        }

    RETURN_TYPES = ("IMAGE", "INT", "IMAGE")
    RETURN_NAMES = ("panels", "count", "preview")
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
    def _axis_differences(single_image: torch.Tensor, axis: str) -> torch.Tensor:
        if axis == "x":
            return (single_image[:, 1:, :] - single_image[:, :-1, :]).abs().mean(dim=2)
        return (single_image[1:, :, :] - single_image[:-1, :, :]).abs().mean(dim=2)

    @classmethod
    def _detect_separator_ranges(
        cls,
        single_image: torch.Tensor,
        axis: str,
    ) -> tuple[list[tuple[int, int]], list[int]]:
        diffs = cls._axis_differences(single_image, axis=axis)
        if diffs.numel() == 0:
            return ([], [])

        scores = diffs.mean(dim=0 if axis == "x" else 1)
        if scores.numel() == 0:
            return ([], [])

        median = scores.median()
        mad = (scores - median).abs().median()
        std = scores.std(unbiased=False)
        spread = torch.maximum(mad * 1.4826, std * 0.25)
        if float(spread) <= 1e-8:
            return ([], [])

        threshold = median + (spread * 5.0)
        if scores.numel() >= 20:
            threshold = torch.maximum(threshold, torch.quantile(scores, 0.98))
        candidate_indexes = torch.nonzero(scores > threshold, as_tuple=False).flatten().tolist()
        if not candidate_indexes:
            return ([], [])

        length = int(single_image.shape[1] if axis == "x" else single_image.shape[0])
        min_panel_px = max(32, int(length * 0.12))
        gap_join_px = max(2, int(length * 0.02))
        robust_pixel_level = diffs.median() + diffs.std(unbiased=False)

        groups: list[list[int]] = []
        current_group: list[int] = []
        for index in candidate_indexes:
            if not current_group or index <= current_group[-1] + gap_join_px:
                current_group.append(index)
                continue
            groups.append(current_group)
            current_group = [index]
        if current_group:
            groups.append(current_group)

        candidates: list[tuple[tuple[int, int], list[int], float]] = []
        for group in groups:
            if axis == "x":
                group_diffs = diffs[:, group]
            else:
                group_diffs = diffs[group, :]
            support = float((group_diffs > robust_pixel_level).float().mean())
            if support < 0.55:
                continue

            start = int(group[0]) + 1
            end = int(group[-1]) + 1
            if start < min_panel_px:
                continue
            if length - end < min_panel_px:
                continue

            line_positions = [start] if start == end else [start, end]
            score = float(scores[group].mean()) * support
            candidates.append(((start, end), line_positions, score))

        if not candidates:
            return ([], [])

        selected = cls._select_plausible_separators(
            image_length=length,
            candidates=candidates,
            min_panel_px=min_panel_px,
        )
        separator_ranges = [item[0] for item in selected]
        line_positions = [line for item in selected for line in item[1]]
        return (separator_ranges, line_positions)

    @staticmethod
    def _select_plausible_separators(
        image_length: int,
        candidates: list[tuple[tuple[int, int], list[int], float]],
        min_panel_px: int,
    ) -> list[tuple[tuple[int, int], list[int], float]]:
        ordered = sorted(candidates, key=lambda item: item[2], reverse=True)
        selected: list[tuple[tuple[int, int], list[int], float]] = []
        max_separators = 7
        for candidate in ordered:
            start, end = candidate[0]
            if any(abs(start - existing[0][0]) < min_panel_px for existing in selected):
                continue
            proposed = sorted([*selected, candidate], key=lambda item: item[0][0])
            spans = CarouselSplit._spans_from_separator_ranges(
                image_length,
                [item[0] for item in proposed],
            )
            if any((span_end - span_start) < min_panel_px for span_start, span_end in spans):
                continue
            selected = proposed
            if len(selected) >= max_separators:
                break

        return sorted(selected, key=lambda item: item[0][0])

    @staticmethod
    def _spans_from_separator_ranges(
        length: int,
        separator_ranges: list[tuple[int, int]],
    ) -> list[tuple[int, int]]:
        spans: list[tuple[int, int]] = []
        start = 0
        for separator_start, separator_end in separator_ranges:
            if separator_start > start:
                spans.append((start, separator_start))
            start = separator_end
        if start < length:
            spans.append((start, length))
        return spans or [(0, length)]

    @staticmethod
    def _crop_panels(
        single_image: torch.Tensor,
        x_spans: list[tuple[int, int]],
        y_spans: list[tuple[int, int]],
    ) -> list[torch.Tensor]:
        return [single_image[y0:y1, x0:x1, :] for y0, y1 in y_spans for x0, x1 in x_spans]

    @staticmethod
    def _draw_preview(
        single_image: torch.Tensor,
        x_boundaries: list[int],
        y_boundaries: list[int],
    ) -> torch.Tensor:
        preview = single_image.clone()
        channels = preview.shape[2]
        red = torch.zeros((channels,), dtype=preview.dtype, device=preview.device)
        red[0] = 1.0
        if channels > 1:
            red[1] = 0.0
        if channels > 2:
            red[2] = 0.0
        if channels > 3:
            red[3] = 1.0

        for x_pos in x_boundaries:
            start = max(0, min(int(x_pos) - 1, preview.shape[1] - 1))
            end = max(start + 1, min(start + 3, preview.shape[1]))
            preview[:, start:end, :] = red
        for y_pos in y_boundaries:
            start = max(0, min(int(y_pos) - 1, preview.shape[0] - 1))
            end = max(start + 1, min(start + 3, preview.shape[0]))
            preview[start:end, :, :] = red
        return preview

    @staticmethod
    def _pad_to_batch(panels: list[torch.Tensor]) -> torch.Tensor:
        max_height = max(int(panel.shape[0]) for panel in panels)
        max_width = max(int(panel.shape[1]) for panel in panels)
        padded_panels = []
        for panel in panels:
            pad_height = max_height - int(panel.shape[0])
            pad_width = max_width - int(panel.shape[1])
            padded_panels.append(F.pad(panel, (0, 0, 0, pad_width, 0, pad_height)))
        return torch.stack(padded_panels, dim=0)

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
            x_separators, x_boundaries = self._detect_separator_ranges(single_image, axis="x")
            x_spans = self._spans_from_separator_ranges(int(single_image.shape[1]), x_separators)
            y_spans = [(0, int(single_image.shape[0]))]

            all_panels.extend(
                self._crop_panels(
                    single_image,
                    x_spans=x_spans,
                    y_spans=y_spans,
                )
            )
            previews.append(
                self._draw_preview(
                    single_image,
                    x_boundaries=x_boundaries,
                    y_boundaries=[],
                )
            )

        panel_batch = self._pad_to_batch(all_panels)
        preview_batch = torch.stack(previews, dim=0)
        return (panel_batch, int(panel_batch.shape[0]), preview_batch)


NODE_CLASS_MAPPINGS = {
    "GridSplit": CarouselSplit,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "GridSplit": "Carousel Split Avatary",
}
