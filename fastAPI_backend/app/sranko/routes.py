"""Sranko ML HTTP routes — internal only (no auth/CORS for public FE)."""

from __future__ import annotations

import base64
import logging

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field
from PIL import Image
import io

from app.sranko.classifier import classify_image, get_model, remove_background_png
from app.sranko.fit_warp import fit_warp
from app.sranko.garment_extractor import (
    GarmentExtractionError,
    WORN_GARMENT_SLOTS,
    extract_worn_garment,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ml", tags=["sranko-ml"])


class PredictResponse(BaseModel):
    classNum: int
    category1: str
    category2: str
    slot: str | None = None
    categoryCode: str | None = None
    warmth: int | None = None
    taxonomyGroup: str | None = None
    rejected: bool
    width: int
    height: int
    imagePngBase64: str = Field(description="rembg PNG as base64 (no data: prefix)")
    garmentExtractionApplied: bool = False
    extractionWarning: str | None = None


class FitWarpResponse(BaseModel):
    imageJpegBase64: str = Field(description="result JPEG as base64 (no data: prefix)")
    warpApplied: bool
    width: int
    height: int


class RembgResponse(BaseModel):
    imagePngBase64: str = Field(description="rembg PNG as base64 (no data: prefix)")
    width: int
    height: int


@router.get("/health")
def ml_health() -> dict[str, str | bool]:
    try:
        get_model()
        return {"status": "ok", "modelLoaded": True}
    except Exception as ex:  # noqa: BLE001
        return {"status": "degraded", "modelLoaded": False, "error": str(ex)}


_TARGET_DEFAULTS: dict[str, tuple[str, str, str, int]] = {
    "TOP": ("상의", "긴소매", "긴팔", 3),
    "BOTTOM": ("하의", "면바지", "면바지", 3),
    "OUTER": ("상의", "외투", "자켓", 3),
    "DRESS": ("상의", "원피스", "원피스", 3),
}


def _load_upload_image(raw: bytes) -> Image.Image:
    if not raw:
        raise HTTPException(status_code=400, detail="empty file")
    if len(raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="file too large")
    try:
        image = Image.open(io.BytesIO(raw))
        image.load()
    except Exception as ex:  # noqa: BLE001
        logger.warning("invalid image: %s", ex)
        raise HTTPException(status_code=400, detail="cannot read image") from ex
    return image


@router.post("/predict", response_model=PredictResponse)
async def predict(
    file: UploadFile = File(...),
    extractWornGarment: bool = Form(False),
    targetSlot: str | None = Form(None),
    skipBackgroundRemoval: bool = Form(False),
) -> PredictResponse:
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="image file required")

    raw = await file.read()
    image = _load_upload_image(raw)

    width, height = image.size
    normalized_target = targetSlot.strip().upper() if targetSlot else None
    if extractWornGarment and skipBackgroundRemoval:
        raise HTTPException(
            status_code=400,
            detail="skipBackgroundRemoval cannot be used with extractWornGarment",
        )
    if extractWornGarment and normalized_target not in WORN_GARMENT_SLOTS:
        raise HTTPException(
            status_code=400,
            detail="targetSlot must be TOP, BOTTOM, OUTER, or DRESS",
        )

    if extractWornGarment:
        assert normalized_target is not None
        category1, category2, default_category, default_warmth = _TARGET_DEFAULTS[
            normalized_target
        ]
        try:
            extraction = extract_worn_garment(image, normalized_target)
        except GarmentExtractionError as ex:
            logger.info(
                "[SrankoGarment] unusable slot=%s reason=%s",
                normalized_target,
                ex,
            )
            return PredictResponse(
                classNum=-1,
                category1=category1,
                category2=category2,
                slot=normalized_target,
                categoryCode=default_category,
                warmth=default_warmth,
                taxonomyGroup=f"{category1}-{category2}",
                rejected=False,
                width=width,
                height=height,
                imagePngBase64="",
                garmentExtractionApplied=False,
                extractionWarning=str(ex),
            )
        except Exception:  # noqa: BLE001
            logger.exception("[SrankoGarment] extraction failed")
            return PredictResponse(
                classNum=-1,
                category1=category1,
                category2=category2,
                slot=normalized_target,
                categoryCode=default_category,
                warmth=default_warmth,
                taxonomyGroup=f"{category1}-{category2}",
                rejected=False,
                width=width,
                height=height,
                imagePngBase64="",
                garmentExtractionApplied=False,
                extractionWarning=(
                    "착용 사진에서 옷을 추출하지 못했습니다. "
                    "옷이 선명하게 보이는 다른 사진을 사용해 주세요."
                ),
            )

        try:
            label = classify_image(extraction.image)
        except FileNotFoundError as ex:
            raise HTTPException(status_code=503, detail=str(ex)) from ex
        except Exception as ex:  # noqa: BLE001
            logger.exception("classify extracted garment failed")
            raise HTTPException(status_code=500, detail="classification failed") from ex

        category_code = (
            label.category_code
            if not label.rejected
            and label.slot == normalized_target
            and label.category_code is not None
            else default_category
        )
        warmth = (
            label.warmth
            if not label.rejected and label.slot == normalized_target
            else default_warmth
        )
        warning = (
            "아우터와 상의는 모델이 구분하지 못해, 보이는 최외곽 상체 옷 영역을 추출했습니다."
            if normalized_target == "OUTER"
            else None
        )
        return PredictResponse(
            classNum=label.class_num,
            category1=label.category1,
            category2=label.category2,
            slot=normalized_target,
            categoryCode=category_code,
            warmth=warmth,
            taxonomyGroup=label.taxonomy_group,
            rejected=False,
            width=extraction.width,
            height=extraction.height,
            imagePngBase64=base64.b64encode(extraction.png_bytes).decode("ascii"),
            garmentExtractionApplied=True,
            extractionWarning=warning,
        )

    try:
        label = classify_image(image)
    except FileNotFoundError as ex:
        raise HTTPException(status_code=503, detail=str(ex)) from ex
    except Exception as ex:  # noqa: BLE001
        logger.exception("classify failed")
        raise HTTPException(status_code=500, detail="classification failed") from ex

    if label.rejected:
        return PredictResponse(
            classNum=label.class_num,
            category1=label.category1,
            category2=label.category2,
            slot=None,
            categoryCode=None,
            warmth=None,
            taxonomyGroup=label.taxonomy_group,
            rejected=True,
            width=width,
            height=height,
            imagePngBase64="",
            garmentExtractionApplied=False,
            extractionWarning=None,
        )

    if skipBackgroundRemoval:
        return PredictResponse(
            classNum=label.class_num,
            category1=label.category1,
            category2=label.category2,
            slot=label.slot,
            categoryCode=label.category_code,
            warmth=label.warmth,
            taxonomyGroup=label.taxonomy_group,
            rejected=False,
            width=width,
            height=height,
            imagePngBase64="",
            garmentExtractionApplied=False,
            extractionWarning=None,
        )

    try:
        png_bytes = remove_background_png(image)
    except Exception as ex:  # noqa: BLE001
        logger.exception("rembg failed")
        raise HTTPException(status_code=500, detail="background removal failed") from ex

    return PredictResponse(
        classNum=label.class_num,
        category1=label.category1,
        category2=label.category2,
        slot=label.slot,
        categoryCode=label.category_code,
        warmth=label.warmth,
        taxonomyGroup=label.taxonomy_group,
        rejected=False,
        width=width,
        height=height,
        imagePngBase64=base64.b64encode(png_bytes).decode("ascii"),
        garmentExtractionApplied=False,
        extractionWarning=None,
    )


@router.post("/rembg", response_model=RembgResponse)
async def rembg_only(
    file: UploadFile = File(...),
) -> RembgResponse:
    """Background removal only — used after classify-first ITEM+ flow."""
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="image file required")

    raw = await file.read()
    image = _load_upload_image(raw)
    width, height = image.size

    try:
        png_bytes = remove_background_png(image)
    except Exception as ex:  # noqa: BLE001
        logger.exception("rembg failed")
        raise HTTPException(status_code=500, detail="background removal failed") from ex

    return RembgResponse(
        imagePngBase64=base64.b64encode(png_bytes).decode("ascii"),
        width=width,
        height=height,
    )


@router.post("/fit-warp", response_model=FitWarpResponse)
async def fit_warp_endpoint(
    vto: UploadFile = File(..., description="Vertex VTO Stage1 JPEG"),
    person: UploadFile | None = File(None, description="Original person JPEG for absdiff mask"),
    slot: str = Form("TOP"),
    scaleX: float = Form(1.0),
    scaleY: float = Form(1.0),
) -> FitWarpResponse:
    if not vto.content_type or not vto.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="vto image file required")

    vto_raw = await vto.read()
    if not vto_raw:
        raise HTTPException(status_code=400, detail="empty vto file")
    if len(vto_raw) > 12 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="vto file too large")

    person_raw: bytes | None = None
    if person is not None and person.filename:
        person_raw = await person.read()
        if person_raw and len(person_raw) > 12 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="person file too large")
        if not person_raw:
            person_raw = None

    try:
        result = fit_warp(
            vto_raw,
            person_jpeg=person_raw,
            slot=slot,
            scale_x=scaleX,
            scale_y=scaleY,
        )
    except ValueError as ex:
        raise HTTPException(status_code=400, detail=str(ex)) from ex
    except Exception as ex:  # noqa: BLE001
        logger.exception("fit_warp failed")
        raise HTTPException(status_code=500, detail="fit warp failed") from ex

    try:
        image = Image.open(io.BytesIO(result.jpeg_bytes))
        image.load()
        out_w, out_h = image.size
    except Exception:  # noqa: BLE001
        out_w, out_h = 0, 0

    return FitWarpResponse(
        imageJpegBase64=base64.b64encode(result.jpeg_bytes).decode("ascii"),
        warpApplied=result.warp_applied,
        width=out_w,
        height=out_h,
    )
