from __future__ import annotations

from pathlib import Path

import cv2
import fitz
import numpy as np

from .models import DesignMetrics


def _warning_metrics(metrics: dict[str, float | int]) -> list[str]:
    warnings: list[str] = []
    # These values describe the content bounding box, not the percentage of
    # black pixels. Pixel-ink ratios are tiny for every text document and made
    # the previous crowded-layout threshold impossible to reach.
    if float(metrics["whitespace_ratio"]) > 0.62: warnings.append("excessive_whitespace")
    if float(metrics["content_density"]) > 0.88: warnings.append("crowded_layout")
    if float(metrics["visual_balance"]) < 0.55: warnings.append("unbalanced_page")
    if float(metrics["contrast_ratio"]) < 0.35: warnings.append("low_colour_contrast")
    if int(metrics["column_count"]) > 2: warnings.append("complex_columns")
    if max(float(metrics["margin_left_ratio"]), float(metrics["margin_right_ratio"])) > 0.25: warnings.append("wide_side_margin")
    return warnings


def _metrics(image: np.ndarray, page_number: int) -> DesignMetrics:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = gray.shape
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    _, ink = cv2.threshold(blurred, 245, 255, cv2.THRESH_BINARY_INV)
    rows = np.flatnonzero(np.any(ink > 0, axis=1))
    columns = np.flatnonzero(np.any(ink > 0, axis=0))
    top = int(rows[0]) if rows.size else 0
    bottom = int(rows[-1]) if rows.size else height - 1
    left = int(columns[0]) if columns.size else 0
    right = int(columns[-1]) if columns.size else width - 1
    projection = np.mean(ink > 0, axis=0)
    occupied = projection > 0.012
    transitions = np.diff(np.pad(occupied.astype(np.int8), (1, 1)))
    regions = list(zip(np.flatnonzero(transitions == 1), np.flatnonzero(transitions == -1)))
    substantial = [(start, end) for start, end in regions if end - start > width * 0.08]
    component_count, _labels, stats, _centroids = cv2.connectedComponentsWithStats(ink, 8)
    components = stats[1:] if component_count > 1 else np.empty((0, 5), dtype=np.int32)
    component_area = float(np.sum(components[:, cv2.CC_STAT_AREA])) if len(components) else 0.0
    bounding_area = float(np.sum(components[:, cv2.CC_STAT_WIDTH] * components[:, cv2.CC_STAT_HEIGHT])) if len(components) else 1.0
    left_ink = float(np.sum(ink[:, : width // 2] > 0))
    right_ink = float(np.sum(ink[:, width // 2 :] > 0))
    balance = 1.0 - abs(left_ink - right_ink) / max(1.0, left_ink + right_ink)
    line_rows = np.flatnonzero(np.mean(ink > 0, axis=1) > 0.01)
    line_gaps = np.diff(line_rows) if len(line_rows) > 1 else np.array([0.0])
    content_width = max(1, right - left + 1)
    content_height = max(1, bottom - top + 1)
    content_box_ratio = min(1.0, (content_width * content_height) / max(1.0, width * height)) if rows.size else 0.0
    values: dict[str, float | int] = {
        "margin_left_ratio": left / width,
        "margin_right_ratio": (width - 1 - right) / width,
        "margin_top_ratio": top / height,
        "margin_bottom_ratio": (height - 1 - bottom) / height,
        "whitespace_ratio": 1.0 - content_box_ratio,
        "content_density": content_box_ratio,
        "column_count": max(1, len(substantial)),
        "alignment_variance": float(np.var(components[:, cv2.CC_STAT_LEFT] / width)) if len(components) else 0.0,
        "indentation_variance": float(np.std(components[:, cv2.CC_STAT_LEFT] / width)) if len(components) else 0.0,
        "component_overlap_ratio": min(1.0, component_area / max(1.0, bounding_area)),
        "visual_balance": balance,
        "contrast_ratio": float((np.percentile(gray, 95) - np.percentile(gray, 5)) / 255.0),
        "spacing_variance": float(np.var(line_gaps / max(1, height))),
    }
    return DesignMetrics(page=page_number, warnings=_warning_metrics(values) if rows.size else ["blank_rendered_page"], **values)


def analyse_pdf_pages(pdf_path: Path, temporary_directory: Path, dpi: int) -> tuple[list[DesignMetrics], list[bytes]]:
    results: list[DesignMetrics] = []
    page_images: list[bytes] = []
    document = fitz.open(pdf_path)
    try:
        for page_number, page in enumerate(document, start=1):
            image_path = temporary_directory / f"page-{page_number}.png"
            try:
                scale = dpi / 72.0
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
                pix.save(image_path)
                image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
                if image is None: raise RuntimeError(f"Could not render page {page_number}")
                results.append(_metrics(image, page_number))
                encoded, jpeg = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 88])
                if not encoded: raise RuntimeError(f"Could not encode page {page_number}")
                page_images.append(jpeg.tobytes())
            finally:
                image_path.unlink(missing_ok=True)
    finally:
        document.close()
    return results, page_images

