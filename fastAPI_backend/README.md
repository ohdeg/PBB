# PBB FastAPI — Sranko ML

## Setup

1. Python **3.11 or 3.12** (torch does not support 3.14 yet).
2. Copy model weights (gitignored):

```bash
cp "/path/to/DigitalCloset/machine_learning/use.pth" models/use.pth
# or: export SRANKO_MODEL_PATH=/absolute/path/use.pth
```

3. Install & run (Python **3.11–3.12**; use `uv` recommended):

```bash
cd fastAPI_backend
uv venv --python 3.12 --clear .venv
source .venv/bin/activate
uv pip install -e .
# If rembg pulls a broken numba/llvmlite chain:
#   uv pip install 'pymatting>=1.1.15' 'numba>=0.60' onnxruntime
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Health: `GET http://127.0.0.1:8000/ml/health`  
Predict: `POST http://127.0.0.1:8000/ml/predict` (multipart `file`, optional `extractWornGarment`, `targetSlot`, `skipBackgroundRemoval`)
Rembg-only: `POST http://127.0.0.1:8000/ml/rembg` (multipart `file`)
Fit-warp: `POST http://127.0.0.1:8000/ml/fit-warp` (multipart `vto`, optional `person`, form `slot`/`scaleX`/`scaleY`)

### Production (Docker Compose)

`docker-compose.prod.yml` 에 `fastapi` 서비스가 포함됩니다. 호스트 포트는 열지 않고 Spring만 `http://fastapi:8000` 으로 호출합니다.

```bash
# 호스트에 모델 배치 후
cp /path/to/use.pth fastAPI_backend/models/use.pth
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build fastapi
# 또는 전체 스택
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
```

### ITEM+ 착용 사진 옷 추출

- `extractWornGarment=true`일 때 `targetSlot=TOP|BOTTOM|OUTER|DRESS`가 필수입니다. `SHOES`는 지원하지 않습니다.
- `u2net_cloth_seg`의 상의/하의/전신 마스크에서 **사진에 보이는 픽셀만** 투명 PNG로 잘라냅니다. `OUTER`는 모델이 상의와 구분하지 못하므로 보이는 최외곽 상체 옷 영역을 사용합니다.
- 모델 세션은 첫 요청에 지연 생성되고 프로세스에서 재사용됩니다. 첫 요청은 ONNX 모델을 rembg 캐시(기본 `~/.u2net`)에 다운로드하므로 네트워크와 수십 초의 초기 지연이 발생할 수 있습니다. 이후 요청은 캐시와 singleton 세션을 사용합니다.
- 영역이 너무 작거나 사진 대부분을 차지하는 등 품질 검사를 통과하지 못하면 `garmentExtractionApplied=false`, 빈 이미지, 한국어 `extractionWarning`을 반환합니다. 이 결과는 저장하면 안 됩니다.
- `SRANKO_WORN_GARMENT_EXTRACTION_ENABLED=false`로 기능을 비활성화할 수 있습니다(기본 `true`).
- 테스트는 session mask를 mock하므로 모델 다운로드가 필요하지 않습니다.

Fit-warp uses a **garment-only** mask (absdiff + skin exclusion + optional rembg silhouette protect) so slim scales do not shrink the whole body. Env `SRANKO_FIT_WARP_REMBG=0` disables rembg (faster; skin/absdiff only). With rembg on (default): first call may load u2net (1–4s); later ~0.3–1.5s/image.

Spring proxies predict as `POST /api/v1/sranko/ml/predict` (`sranko.ml.base-url`).
Try-on calls fit-warp internally after Vertex VTO Stage1.
