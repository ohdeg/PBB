"""Unit tests for deterministic fit-warp (synthetic images, no model)."""

from __future__ import annotations

import os
import unittest

import cv2
import numpy as np

# Keep tests fast/deterministic: no rembg u2net download or inference.
os.environ["SRANKO_FIT_WARP_REMBG"] = "0"

from app.sranko.fit_warp import fit_warp  # noqa: E402
from app.sranko import fit_warp as fit_warp_mod  # noqa: E402


def _jpeg_bgr(bgr: np.ndarray, quality: int = 90) -> bytes:
    ok, buf = cv2.imencode(".jpg", bgr, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
    assert ok
    return buf.tobytes()


class FitWarpTests(unittest.TestCase):
    def test_scale_near_one_skips_warp(self) -> None:
        img = np.full((120, 80, 3), 40, dtype=np.uint8)
        img[30:90, 20:60] = (180, 90, 40)
        raw = _jpeg_bgr(img)
        result = fit_warp(raw, scale_x=1.0, scale_y=1.0, slot="TOP")
        self.assertFalse(result.warp_applied)
        self.assertTrue(len(result.jpeg_bytes) > 0)

    def test_mask_too_small_skips_warp(self) -> None:
        # Nearly identical person/vto → absdiff mask tiny → skip.
        base = np.full((200, 140, 3), 80, dtype=np.uint8)
        person = _jpeg_bgr(base)
        vto = _jpeg_bgr(base.copy())
        result = fit_warp(
            vto,
            person_jpeg=person,
            slot="TOP",
            scale_x=1.08,
            scale_y=1.0,
        )
        self.assertFalse(result.warp_applied)

    def test_absdiff_mask_applies_warp(self) -> None:
        h, w = 240, 160
        person = np.full((h, w, 3), 50, dtype=np.uint8)
        vto = person.copy()
        # Distinct garment patch in torso ROI (below face band); non-skin cyan.
        vto[55:150, 35:125] = (20, 160, 220)
        result = fit_warp(
            _jpeg_bgr(vto),
            person_jpeg=_jpeg_bgr(person),
            slot="TOP",
            scale_x=1.10,
            scale_y=1.02,
        )
        self.assertTrue(result.warp_applied)
        self.assertGreater(len(result.jpeg_bytes), 100)

    def test_heuristic_mask_without_person(self) -> None:
        h, w = 240, 160
        vto = np.full((h, w, 3), 30, dtype=np.uint8)
        vto[55:150, 35:125] = (40, 180, 200)
        result = fit_warp(_jpeg_bgr(vto), slot="TOP", scale_x=0.92, scale_y=1.0)
        # Heuristic may or may not clear area thresholds; either path is valid.
        self.assertIsInstance(result.warp_applied, bool)
        self.assertGreater(len(result.jpeg_bytes), 100)

    def test_skin_limbs_preserved_under_slim_scale(self) -> None:
        """Skin-colored limb pixels stay Stage1; only non-skin garment may warp."""
        h, w = 240, 160
        # Neutral background person.
        person = np.full((h, w, 3), 40, dtype=np.uint8)
        vto = person.copy()
        # Skin-tone arms (BGR ≈ light skin) in hand bands / sides of torso.
        skin_bgr = (90, 130, 190)
        vto[90:140, 8:28] = skin_bgr
        vto[90:140, w - 28 : w - 8] = skin_bgr
        # Non-skin garment center (strong absdiff vs person).
        vto[60:145, 40:120] = (30, 40, 200)

        vto_jpeg = _jpeg_bgr(vto)
        person_jpeg = _jpeg_bgr(person)
        result = fit_warp(
            vto_jpeg,
            person_jpeg=person_jpeg,
            slot="TOP",
            scale_x=0.90,
            scale_y=1.0,
        )
        self.assertTrue(result.warp_applied)

        out = cv2.imdecode(np.frombuffer(result.jpeg_bytes, dtype=np.uint8), cv2.IMREAD_COLOR)
        assert out is not None
        # Sample arm skin: should match Stage1 VTO (not pulled inward by slim scale).
        left_arm = out[110, 15]
        right_arm = out[110, w - 15]
        np.testing.assert_allclose(left_arm, vto[110, 15], atol=18)
        np.testing.assert_allclose(right_arm, vto[110, w - 15], atol=18)

    def test_build_mask_excludes_skin_from_garment_region(self) -> None:
        h, w = 240, 160
        person = np.full((h, w, 3), 45, dtype=np.uint8)
        vto = person.copy()
        vto[60:140, 40:120] = (25, 50, 210)  # garment
        vto[100:130, 50:70] = (95, 135, 195)  # skin patch inside torso ROI

        mask = fit_warp_mod._build_mask(vto, person, "TOP")
        # Skin island should not be in warp mask.
        self.assertEqual(int(mask[115, 60]), 0)
        # Garment pixel away from skin should still be eligible (may erode edges).
        self.assertGreater(int(np.count_nonzero(mask[70:90, 80:100])), 0)


if __name__ == "__main__":
    unittest.main()
