"""Visible-garment extraction for worn photos using rembg cloth segmentation."""

from __future__ import annotations

import io
import logging
import os
import threading
import time
from dataclasses import dataclass
from typing import Protocol, Sequence

import cv2
import numpy as np
from PIL import Image, ImageFilter
from rembg import new_session

logger = logging.getLogger(__name__)

WORN_GARMENT_SLOTS = frozenset({"TOP", "BOTTOM", "OUTER", "DRESS"})

# rembg's u2net_cloth_seg session returns masks in this exact order when no
# cloth_category/cc is supplied. Evidence: Unet2ClothSession.predict appends
# palette1 (class 1/upper), palette2 (class 2/lower), then palette3
# (class 3/full):
# https://github.com/danielgatis/rembg/blob/main/rembg/sessions/u2net_cloth_seg.py
_UPPER_MASK_INDEX = 0
_LOWER_MASK_INDEX = 1
_FULL_MASK_INDEX = 2
_MIN_AREA_FRACTION = 0.003
_MAX_AREA_FRACTION = 0.80
_CANVAS_PADDING_FRACTION = 0.08
_MIN_CANVAS_PADDING_PX = 8


class ClothSession(Protocol):
    def predict(self, image: Image.Image, *args: object, **kwargs: object) -> Sequence[Image.Image]:
        """Return upper, lower, and full-body clothing masks."""


class GarmentExtractionError(ValueError):
    """Raised when a visible-garment mask is unavailable or unsafe to use."""


@dataclass(frozen=True)
class GarmentExtractionResult:
    png_bytes: bytes
    image: Image.Image
    width: int
    height: int


_cloth_session: ClothSession | None = None
_cloth_session_lock = threading.Lock()


def worn_garment_extraction_enabled() -> bool:
    raw = os.environ.get("SRANKO_WORN_GARMENT_EXTRACTION_ENABLED", "true")
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def get_cloth_session() -> ClothSession:
    """Lazily create and reuse the large ONNX session; no import-time download."""
    global _cloth_session
    if _cloth_session is not None:
        return _cloth_session
    with _cloth_session_lock:
        if _cloth_session is None:
            started = time.perf_counter()
            logger.info("[SrankoGarment] loading u2net_cloth_seg session")
            _cloth_session = new_session("u2net_cloth_seg")
            logger.info(
                "[SrankoGarment] session loaded in %.3fs",
                time.perf_counter() - started,
            )
    return _cloth_session


def _as_binary(mask: Image.Image, size: tuple[int, int]) -> np.ndarray:
    grayscale = mask.convert("L")
    if grayscale.size != size:
        grayscale = grayscale.resize(size, Image.Resampling.LANCZOS)
    return (np.asarray(grayscale, dtype=np.uint8) >= 128).astype(np.uint8)


def _select_target_mask(
    masks: Sequence[Image.Image],
    target_slot: str,
    size: tuple[int, int],
) -> np.ndarray:
    """Select rembg's documented upper/lower/full mask for a Sranko slot."""
    slot = target_slot.strip().upper()
    if slot not in WORN_GARMENT_SLOTS:
        raise GarmentExtractionError("지원하지 않는 착용 의류 종류입니다.")
    if len(masks) < 3:
        raise GarmentExtractionError(
            "의류 분할 모델이 예상한 상의·하의·전신 마스크를 반환하지 않았습니다."
        )

    upper = _as_binary(masks[_UPPER_MASK_INDEX], size)
    lower = _as_binary(masks[_LOWER_MASK_INDEX], size)
    if slot in {"TOP", "OUTER"}:
        return upper
    if slot == "BOTTOM":
        return lower

    full = _as_binary(masks[_FULL_MASK_INDEX], size)
    min_pixels = max(1, int(size[0] * size[1] * _MIN_AREA_FRACTION))
    if int(np.count_nonzero(full)) < min_pixels:
        # Some dresses are classified as touching upper+lower regions instead
        # of class 3. Combining only visible class pixels does not invent any
        # hidden garment area.
        return np.maximum(upper, lower)
    return full


def _clean_mask(mask: np.ndarray) -> np.ndarray:
    h, w = mask.shape
    kernel_size = int(round(min(h, w) * 0.008))
    kernel_size = min(11, max(3, kernel_size | 1))
    kernel = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE,
        (kernel_size, kernel_size),
    )
    cleaned = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel)
    # Closing may bridge tiny gaps, but output must never include pixels the
    # model did not mark as visible garment.
    cleaned = np.minimum(cleaned, mask)

    count, labels, stats, _ = cv2.connectedComponentsWithStats(cleaned, connectivity=8)
    if count <= 1:
        return cleaned
    component_areas = stats[1:, cv2.CC_STAT_AREA]
    largest = int(component_areas.max())
    min_component = max(24, int(h * w * 0.0005), int(largest * 0.04))
    retained = np.zeros_like(cleaned)
    for label_index in range(1, count):
        if int(stats[label_index, cv2.CC_STAT_AREA]) >= min_component:
            retained[labels == label_index] = 1
    return retained


def _validated_bounds(mask: np.ndarray) -> tuple[int, int, int, int]:
    h, w = mask.shape
    foreground = int(np.count_nonzero(mask))
    fraction = foreground / float(h * w)
    if fraction < _MIN_AREA_FRACTION:
        raise GarmentExtractionError(
            "선택한 옷 영역을 충분히 찾지 못했습니다. 옷이 잘 보이는 사진을 사용해 주세요."
        )
    if fraction > _MAX_AREA_FRACTION:
        raise GarmentExtractionError(
            "옷 영역이 사진 대부분을 차지해 인물과 분리할 수 없습니다. 다른 사진을 사용해 주세요."
        )

    ys, xs = np.nonzero(mask)
    left, right = int(xs.min()), int(xs.max()) + 1
    top, bottom = int(ys.min()), int(ys.max()) + 1
    if right - left < max(8, int(w * 0.04)) or bottom - top < max(8, int(h * 0.04)):
        raise GarmentExtractionError(
            "찾은 옷 영역이 너무 작거나 가늘어 안전하게 저장할 수 없습니다."
        )
    return left, top, right, bottom


def extract_worn_garment(
    image: Image.Image,
    target_slot: str,
    *,
    session: ClothSession | None = None,
) -> GarmentExtractionResult:
    """Extract model-observed garment pixels onto a padded transparent canvas."""
    if not worn_garment_extraction_enabled():
        raise GarmentExtractionError(
            "착용 사진 옷 추출 기능이 현재 비활성화되어 있습니다."
        )

    slot = target_slot.strip().upper()
    rgb_image = image.convert("RGB")
    started = time.perf_counter()
    active_session = session if session is not None else get_cloth_session()
    masks = active_session.predict(rgb_image)
    selected = _select_target_mask(masks, slot, rgb_image.size)
    cleaned = _clean_mask(selected)
    left, top, right, bottom = _validated_bounds(cleaned)

    # A light feather smooths aliasing only around observed mask edges. It does
    # not fill holes or synthesize any hidden garment pixels.
    h, w = cleaned.shape
    feathered = np.asarray(
        Image.fromarray(cleaned * 255, mode="L").filter(
            ImageFilter.GaussianBlur(radius=0.8)
        ),
        dtype=np.uint8,
    ).copy()
    feathered[cleaned == 0] = 0
    alpha = Image.fromarray(feathered, mode="L")
    rgba = rgb_image.convert("RGBA")
    rgba.putalpha(alpha)
    cropped = rgba.crop((left, top, right, bottom))
    padding_x = max(
        _MIN_CANVAS_PADDING_PX,
        int(round(cropped.width * _CANVAS_PADDING_FRACTION)),
    )
    padding_y = max(
        _MIN_CANVAS_PADDING_PX,
        int(round(cropped.height * _CANVAS_PADDING_FRACTION)),
    )
    padded = Image.new(
        "RGBA",
        (cropped.width + 2 * padding_x, cropped.height + 2 * padding_y),
        (0, 0, 0, 0),
    )
    padded.paste(cropped, (padding_x, padding_y))

    output = io.BytesIO()
    padded.save(output, format="PNG", optimize=True)
    logger.info(
        "[SrankoGarment] extracted slot=%s source=%dx%d output=%dx%d area=%.4f time=%.3fs",
        slot,
        w,
        h,
        padded.width,
        padded.height,
        int(np.count_nonzero(cleaned)) / float(w * h),
        time.perf_counter() - started,
    )
    return GarmentExtractionResult(
        png_bytes=output.getvalue(),
        image=padded,
        width=padded.width,
        height=padded.height,
    )
