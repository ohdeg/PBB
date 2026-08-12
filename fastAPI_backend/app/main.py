from fastapi import FastAPI

from app.sranko.routes import router as sranko_ml_router

app = FastAPI(title="PBB FastAPI", version="0.2.0")
app.include_router(sranko_ml_router)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": "pbb-fastapi", "docs": "/docs"}
