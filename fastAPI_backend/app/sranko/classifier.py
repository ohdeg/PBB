"""ResNet18 clothing classifier + rembg background removal."""

from __future__ import annotations

import io
import logging
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from rembg import remove
from torchvision import models, transforms

from app.sranko.labels import ClassLabel, label_for

logger = logging.getLogger(__name__)

MEAN = [0.485, 0.456, 0.406]
STD = [0.229, 0.224, 0.225]

TRANSFORM = transforms.Compose(
    [
        transforms.Resize((224, 224)),
        transforms.ToTensor(),
        transforms.Normalize(mean=MEAN, std=STD),
    ]
)

DEFAULT_MODEL = (
    Path(__file__).resolve().parents[2] / "models" / "use.pth"
)


def _model_path() -> Path:
    override = os.environ.get("SRANKO_MODEL_PATH", "").strip()
    if override:
        return Path(override)
    return DEFAULT_MODEL


@lru_cache(maxsize=1)
def get_model() -> nn.Module:
    path = _model_path()
    if not path.is_file():
        raise FileNotFoundError(
            f"Sranko model not found at {path}. "
            "Copy use.pth into fastAPI_backend/models/ or set SRANKO_MODEL_PATH."
        )
    model = models.resnet18(weights=None)
    num_ftrs = model.fc.in_features
    model.fc = nn.Linear(num_ftrs, 12)
    try:
        state = torch.load(path, map_location="cpu", weights_only=True)
    except TypeError:
        state = torch.load(path, map_location="cpu")
    model.load_state_dict(state)
    model.eval()
    logger.info("Loaded Sranko classifier from %s", path)
    return model


def classify_image(image: Image.Image) -> ClassLabel:
    model = get_model()
    rgb = image.convert("RGB")
    tensor = TRANSFORM(rgb).unsqueeze(0)
    with torch.no_grad():
        outputs = model(tensor)
        predicted = int(torch.argmax(outputs, dim=1).item())
    return label_for(predicted)


def remove_background_png(image: Image.Image) -> bytes:
    """Return PNG bytes with background removed (RGBA)."""
    rgba = image.convert("RGBA")
    # rembg accepts PIL or ndarray; PIL path is simpler
    result = remove(rgba)
    if isinstance(result, Image.Image):
        out = result
    else:
        out = Image.fromarray(np.asarray(result))
    buf = io.BytesIO()
    out.save(buf, format="PNG")
    return buf.getvalue()
