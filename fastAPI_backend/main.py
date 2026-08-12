"""ASGI entry: `uvicorn main:app --reload --port 8000` from fastAPI_backend/."""

from app.main import app

__all__ = ["app"]
