"""Synthetic worn-garment extraction tests; no model download or inference."""

from __future__ import annotations

import io
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image

from app.sranko.classifier import remove_background_png
from app.sranko.garment_extractor import (
    GarmentExtractionError,
    _select_target_mask,
    extract_worn_garment,
)


def _mask(width: int, height: int, box: tuple[int, int, int, int] | None) -> Image.Image:
    values = np.zeros((height, width), dtype=np.uint8)
    if box is not None:
        left, top, right, bottom = box
        values[top:bottom, left:right] = 255
    return Image.fromarray(values, mode="L")


class FakeSession:
    def __init__(self, masks: list[Image.Image]) -> None:
        self.masks = masks
        self.calls = 0

    def predict(self, image: Image.Image, *args: object, **kwargs: object) -> list[Image.Image]:
        self.calls += 1
        return self.masks


class GarmentExtractorTests(unittest.TestCase):
    def test_slot_selects_documented_mask_order(self) -> None:
        size = (100, 120)
        upper = _mask(*size, (10, 10, 40, 45))
        lower = _mask(*size, (45, 50, 75, 100))
        full = _mask(*size, (20, 20, 80, 105))
        masks = [upper, lower, full]

        self.assertEqual(int(_select_target_mask(masks, "TOP", size)[20, 20]), 1)
        self.assertEqual(int(_select_target_mask(masks, "OUTER", size)[20, 20]), 1)
        self.assertEqual(int(_select_target_mask(masks, "BOTTOM", size)[70, 60]), 1)
        self.assertEqual(int(_select_target_mask(masks, "DRESS", size)[100, 70]), 1)

    def test_dress_falls_back_to_visible_upper_and_lower(self) -> None:
        size = (100, 120)
        upper = _mask(*size, (15, 15, 55, 55))
        lower = _mask(*size, (35, 55, 75, 105))
        full = _mask(*size, None)

        selected = _select_target_mask([upper, lower, full], "DRESS", size)

        self.assertEqual(int(selected[25, 25]), 1)
        self.assertEqual(int(selected[75, 50]), 1)
        self.assertEqual(int(selected[5, 5]), 0)

    def test_extract_makes_person_pixels_transparent(self) -> None:
        width, height = 120, 160
        pixels = np.full((height, width, 3), (205, 170, 140), dtype=np.uint8)
        pixels[45:115, 35:85] = (30, 80, 210)
        image = Image.fromarray(pixels, mode="RGB")
        session = FakeSession(
            [
                _mask(width, height, (35, 45, 85, 115)),
                _mask(width, height, None),
                _mask(width, height, None),
            ]
        )

        result = extract_worn_garment(image, "TOP", session=session)
        output = Image.open(io.BytesIO(result.png_bytes)).convert("RGBA")
        alpha = np.asarray(output.getchannel("A"))

        self.assertEqual(session.calls, 1)
        self.assertEqual(int(alpha[0, 0]), 0)
        self.assertGreater(int(alpha[alpha.shape[0] // 2, alpha.shape[1] // 2]), 240)
        self.assertLess(output.width, width)
        self.assertLess(output.height, height)

    def test_extract_adds_transparent_canvas_padding_at_source_edges(self) -> None:
        width, height = 120, 160
        pixels = np.full((height, width, 3), (205, 170, 140), dtype=np.uint8)
        pixels[0:80, 0:50] = (30, 80, 210)
        image = Image.fromarray(pixels, mode="RGB")
        session = FakeSession(
            [
                _mask(width, height, (0, 0, 50, 80)),
                _mask(width, height, None),
                _mask(width, height, None),
            ]
        )

        result = extract_worn_garment(image, "TOP", session=session)
        output = Image.open(io.BytesIO(result.png_bytes)).convert("RGBA")
        alpha = np.asarray(output.getchannel("A"))

        # 8% of the 50x80 garment bbox rounds below the 8 px minimum.
        self.assertEqual(output.size, (50 + 2 * 8, 80 + 2 * 8))
        self.assertEqual((result.width, result.height), output.size)
        self.assertTrue(np.all(alpha[:8, :] == 0))
        self.assertTrue(np.all(alpha[-8:, :] == 0))
        self.assertTrue(np.all(alpha[:, :8] == 0))
        self.assertTrue(np.all(alpha[:, -8:] == 0))

        center = output.getpixel((8 + 25, 8 + 40))
        self.assertEqual(center[:3], (30, 80, 210))
        self.assertGreater(center[3], 240)

    def test_tiny_mask_is_rejected(self) -> None:
        width, height = 200, 200
        image = Image.new("RGB", (width, height), "white")
        session = FakeSession(
            [
                _mask(width, height, (95, 95, 99, 99)),
                _mask(width, height, None),
                _mask(width, height, None),
            ]
        )

        with self.assertRaisesRegex(GarmentExtractionError, "충분히 찾지 못했습니다"):
            extract_worn_garment(image, "TOP", session=session)

    def test_normal_background_removal_still_uses_generic_rembg(self) -> None:
        source = Image.new("RGB", (20, 30), "navy")
        expected = Image.new("RGBA", source.size, (0, 0, 128, 255))

        with patch("app.sranko.classifier.remove", return_value=expected) as remove_mock:
            png = remove_background_png(source)

        remove_mock.assert_called_once()
        output = Image.open(io.BytesIO(png))
        self.assertEqual(output.mode, "RGBA")
        self.assertEqual(output.size, source.size)


if __name__ == "__main__":
    unittest.main()
