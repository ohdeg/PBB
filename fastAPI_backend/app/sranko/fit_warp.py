"""Deterministic 2D garment warp from body vs garment scale factors (Approach A).

Warp is intentionally **garment-only**: skin and person silhouette edges stay on the
Stage1 VTO pixels so slim scales do not shrink the whole body.

Optional rembg silhouette protect (person preferred, else VTO):
  - Env ``SRANKO_FIT_WARP_REMBG``: ``1``/unset = on, ``0``/false = off (skin+absdiff only).
  - Latency: first call loads u2net (often 1–4s); later calls typically ~0.3–1.5s per
    image depending on resolution. Prefer person JPEG so rembg runs once on the
    source photo; disable via env when profiling or under tight SLOs.
"""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass

import cv2
import numpy as np

logger = logging.getLogger(__name__)

# Mask area as fraction of image; outside → skip warp (return original).
_MASK_AREA_MIN = 0.02
_MASK_AREA_MAX = 0.55
_FACE_TOP_FRAC = 0.18
_HAND_BAND_FRAC = 0.08
_BLEND_SOFTNESS = 7
_ABSDIFF_THRESH = 32
# Outer silhouette band (px) kept at Stage1 — preserves limb/shoulder outline width.
_SILHOUETTE_EDGE_PX = 5
# Erode person FG before intersecting garment mask (pull warp inward from outline).
_FG_ERODE_ITERS = 2


@dataclass(frozen=True)
class FitWarpResult:
    jpeg_bytes: bytes
    warp_applied: bool


def fit_warp(
    vto_jpeg: bytes,
    *,
    person_jpeg: bytes | None = None,
    slot: str = "TOP",
    scale_x: float = 1.0,
    scale_y: float = 1.0,
) -> FitWarpResult:
    """Warp garment region of a VTO JPEG by scale_x/scale_y around mask bbox center."""
    if not vto_jpeg:
        raise ValueError("empty vto image")

    vto = _decode_bgr(vto_jpeg)
    h, w = vto.shape[:2]

    sx = float(scale_x) if np.isfinite(scale_x) else 1.0
    sy = float(scale_y) if np.isfinite(scale_y) else 1.0
    if abs(sx - 1.0) < 1e-4 and abs(sy - 1.0) < 1e-4:
        return FitWarpResult(jpeg_bytes=_encode_jpeg(vto), warp_applied=False)

    person_bgr: np.ndarray | None = None
    if person_jpeg:
        try:
            person_bgr = _decode_bgr(person_jpeg)
            if person_bgr.shape[0] != h or person_bgr.shape[1] != w:
                person_bgr = cv2.resize(person_bgr, (w, h), interpolation=cv2.INTER_AREA)
        except Exception as ex:  # noqa: BLE001
            logger.warning("person image decode/resize failed: %s", ex)
            person_bgr = None

    mask = _build_mask(vto, person_bgr, slot)
    area_frac = float(np.count_nonzero(mask)) / float(h * w)
    if area_frac < _MASK_AREA_MIN or area_frac > _MASK_AREA_MAX:
        logger.info(
            "fit_warp skip: mask area fraction=%.4f outside [%.2f, %.2f]",
            area_frac,
            _MASK_AREA_MIN,
            _MASK_AREA_MAX,
        )
        return FitWarpResult(jpeg_bytes=_encode_jpeg(vto), warp_applied=False)

    ys, xs = np.where(mask > 0)
    x0, x1 = int(xs.min()), int(xs.max())
    y0, y1 = int(ys.min()), int(ys.max())
    cx = 0.5 * (x0 + x1)
    cy = 0.5 * (y0 + y1)

    # Anisotropic scale about mask bbox center.
    matrix = np.array(
        [[sx, 0.0, cx * (1.0 - sx)], [0.0, sy, cy * (1.0 - sy)]],
        dtype=np.float64,
    )
    warped = cv2.warpAffine(
        vto,
        matrix,
        (w, h),
        flags=cv2.INTER_LINEAR,
        borderMode=cv2.BORDER_REFLECT_101,
    )

    soft = cv2.GaussianBlur(mask.astype(np.float32), (_BLEND_SOFTNESS, _BLEND_SOFTNESS), 0)
    soft = np.clip(soft / 255.0, 0.0, 1.0)
    soft3 = soft[:, :, None]
    blended = (warped.astype(np.float32) * soft3 + vto.astype(np.float32) * (1.0 - soft3)).astype(
        np.uint8
    )
    return FitWarpResult(jpeg_bytes=_encode_jpeg(blended), warp_applied=True)


def _decode_bgr(data: bytes) -> np.ndarray:
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("cannot decode image")
    return img


def _encode_jpeg(bgr: np.ndarray) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), 92])
    if not ok:
        raise ValueError("cannot encode jpeg")
    return buf.tobytes()


def _slot_roi(h: int, w: int, slot: str) -> tuple[int, int, int, int]:
    """Return (y0, y1, x0, x1) ROI bounds for the garment slot."""
    s = (slot or "TOP").strip().upper()
    if s in ("BOTTOM",):
        return int(h * 0.40), int(h * 0.95), int(w * 0.15), int(w * 0.85)
    if s in ("DRESS", "ONEPIECE", "JUMPSUIT"):
        return int(h * 0.18), int(h * 0.92), int(w * 0.12), int(w * 0.88)
    if s in ("SHOES",):
        return int(h * 0.80), h, int(w * 0.15), int(w * 0.85)
    # TOP / OUTER / default torso
    return int(h * 0.18), int(h * 0.72), int(w * 0.12), int(w * 0.88)


def _rembg_enabled() -> bool:
    raw = os.environ.get("SRANKO_FIT_WARP_REMBG", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _person_foreground_mask(bgr: np.ndarray) -> np.ndarray | None:
    """Return uint8 0/255 person FG via rembg ``only_mask``, or None on failure/disabled.

    Reuses the same ``rembg.remove`` stack as ``classifier.remove_background_png``.
    """
    if not _rembg_enabled():
        return None
    try:
        from PIL import Image
        from rembg import remove
    except Exception as ex:  # noqa: BLE001
        logger.info("fit_warp rembg unavailable: %s", ex)
        return None

    try:
        rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
        pil = Image.fromarray(rgb)
        # only_mask=True → single-channel mask; avoids full RGBA composite cost.
        out = remove(pil, only_mask=True)
        if isinstance(out, Image.Image):
            alpha = np.asarray(out.convert("L"))
        else:
            alpha = np.asarray(out)
            if alpha.ndim == 3:
                alpha = alpha[:, :, -1] if alpha.shape[2] >= 4 else alpha[:, :, 0]
        if alpha.shape[0] != bgr.shape[0] or alpha.shape[1] != bgr.shape[1]:
            alpha = cv2.resize(
                alpha.astype(np.uint8),
                (bgr.shape[1], bgr.shape[0]),
                interpolation=cv2.INTER_NEAREST,
            )
        _, fg = cv2.threshold(alpha.astype(np.uint8), 127, 255, cv2.THRESH_BINARY)
        return fg
    except Exception as ex:  # noqa: BLE001
        logger.warning("fit_warp rembg silhouette failed: %s", ex)
        return None


def _skin_mask(bgr: np.ndarray) -> np.ndarray:
    """Rough skin detector (HSV ∪ YCrCb). Used to keep limbs/face out of the warp mask."""
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    ycrcb = cv2.cvtColor(bgr, cv2.COLOR_BGR2YCrCb)

    # Broad skin ranges; false positives on beige garments are OK (safer = less body warp).
    hsv_skin = cv2.inRange(hsv, (0, 30, 50), (25, 180, 255))
    hsv_skin2 = cv2.inRange(hsv, (160, 30, 50), (180, 180, 255))
    cr = ycrcb[:, :, 1]
    cb = ycrcb[:, :, 2]
    ycrcb_skin = ((cr > 133) & (cr < 173) & (cb > 77) & (cb < 127)).astype(np.uint8) * 255

    skin = cv2.bitwise_or(hsv_skin, hsv_skin2)
    skin = cv2.bitwise_or(skin, ycrcb_skin)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    skin = cv2.morphologyEx(skin, cv2.MORPH_OPEN, kernel)
    skin = cv2.dilate(skin, kernel, iterations=1)
    return skin


def _protect_silhouette(mask: np.ndarray, fg: np.ndarray) -> np.ndarray:
    """Clear warp near person outline; keep Stage1 body width.

    - Intersect garment mask with eroded FG (stay inside body, away from outline).
    - Zero a thin outer silhouette ring so shoulder/limb edges are never scaled.
    """
    k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    eroded = cv2.erode(fg, k, iterations=_FG_ERODE_ITERS)
    ring_k = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (_SILHOUETTE_EDGE_PX * 2 + 1, _SILHOUETTE_EDGE_PX * 2 + 1)
    )
    dilated = cv2.dilate(fg, ring_k, iterations=1)
    soft_erode = cv2.erode(fg, ring_k, iterations=1)
    outer_ring = cv2.bitwise_and(dilated, cv2.bitwise_not(soft_erode))

    out = cv2.bitwise_and(mask, eroded)
    out[outer_ring > 0] = 0
    return out


def _largest_component(mask: np.ndarray) -> np.ndarray:
    """Keep largest connected component; drop scattered absdiff noise."""
    n, labels, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
    if n <= 1:
        return mask
    # label 0 is background
    areas = stats[1:, cv2.CC_STAT_AREA]
    best = int(np.argmax(areas)) + 1
    out = np.zeros_like(mask)
    out[labels == best] = 255
    return out


def _build_mask(
    vto: np.ndarray,
    person: np.ndarray | None,
    slot: str,
) -> np.ndarray:
    h, w = vto.shape[:2]
    y0, y1, x0, x1 = _slot_roi(h, w, slot)

    if person is not None:
        diff = cv2.absdiff(vto, person)
        gray = cv2.cvtColor(diff, cv2.COLOR_BGR2GRAY)
        _, mask = cv2.threshold(gray, _ABSDIFF_THRESH, 255, cv2.THRESH_BINARY)
    else:
        # Heuristic: mid-saturation / mid-value clothing-ish region inside ROI.
        hsv = cv2.cvtColor(vto, cv2.COLOR_BGR2HSV)
        sat = hsv[:, :, 1]
        val = hsv[:, :, 2]
        mask = np.zeros((h, w), dtype=np.uint8)
        mask[(sat > 25) & (val > 40) & (val < 245)] = 255

    roi = np.zeros_like(mask)
    roi[y0:y1, x0:x1] = mask[y0:y1, x0:x1]
    mask = roi

    # Protect face (top band) and approximate hand side bands in torso region.
    face_h = int(h * _FACE_TOP_FRAC)
    mask[:face_h, :] = 0
    hand_w = int(w * _HAND_BAND_FRAC)
    hand_y0 = int(h * 0.35)
    hand_y1 = int(h * 0.70)
    mask[hand_y0:hand_y1, :hand_w] = 0
    mask[hand_y0:hand_y1, w - hand_w :] = 0

    # Exclude skin so limb/torso flesh stays Stage1 (garment-only warp).
    skin = _skin_mask(vto)
    mask[skin > 0] = 0

    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    # Prefer slight erode over dilate so mask does not bleed onto body outline.
    mask = cv2.erode(mask, kernel, iterations=1)

    # Silhouette protect via rembg (person preferred; VTO fallback).
    fg_src = person if person is not None else vto
    fg = _person_foreground_mask(fg_src)
    if fg is not None and np.count_nonzero(fg) > 0:
        mask = _protect_silhouette(mask, fg)
    else:
        # Cheap fallback without rembg: drop a thin outer ring of the absdiff blob
        # so extreme silhouette pixels stay Stage1.
        if np.count_nonzero(mask) > 0:
            ring_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
            inner = cv2.erode(mask, ring_k, iterations=1)
            mask = inner

    mask = _largest_component(mask)
    return mask
