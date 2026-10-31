import io
import os
from pathlib import Path

import pandas as pd
import torch
import torch.nn.functional as F
from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from PIL import Image
from transformers import AutoImageProcessor, AutoModel

BASE_DIR = Path(__file__).resolve().parent
RESULT_DIR = BASE_DIR / "results"
MODEL_NAME = "facebook/dinov2-base"
API_KEY = os.environ.get("VISION_API_KEY", "")  # 비워 두면 인증 안 함
MAX_BYTES = 5 * 1024 * 1024

# test_val_v2.py와 같은 지점 합치기
WAYPOINT_ALIAS = {
    "hallim_eunju_passage": "hallim_6f_corridor",
    "eunju_5f_entrance": "eunju1_5f_front",
    "p1_parking": "parking",
}

# 프론트 routing.ts의 waypoints id 목록. 비워 두면 거르지 않음(테스트용)
FRONTEND_WAYPOINTS = {
    "bus_stop_2115", "main_bus_stop_passage", "main_corridor",
    "main_elevator_front", "to_hallim", "hallim_to_elevator",
    "hallim_elevator_front", "hallim_6f_elevator", "hallim_6f_corridor",
    "eunju1_5f_front", "parking", "parking-entry",
    "hyein", "stairs", "interview",
}

app = FastAPI()

saved = torch.load(
    RESULT_DIR / "ref_embeddings.pt", map_location="cpu", weights_only=True
)
ref_features = F.normalize(saved["features"].float(), p=2, dim=1)
ref_meta = pd.read_csv(RESULT_DIR / "ref_metadata.csv", encoding="utf-8-sig")
ref_meta.columns = [str(c).strip() for c in ref_meta.columns]
ref_wps = [
    WAYPOINT_ALIAS.get(str(w).strip(), str(w).strip())
    for w in ref_meta["waypoint_id"]
]

processor = AutoImageProcessor.from_pretrained(MODEL_NAME)
model = AutoModel.from_pretrained(MODEL_NAME)
model.eval()


@app.get("/health")
def health():
    return {"ok": True, "refs": len(ref_wps)}


@app.post("/recognize")
def recognize(
    image: UploadFile = File(...),
    campusId: str = Form(default=""),
    authorization: str = Header(default=""),
):
    if API_KEY and authorization != f"Bearer {API_KEY}":
        raise HTTPException(status_code=401, detail="unauthorized")

    data = image.file.read(MAX_BYTES + 1)
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="image too large")
    try:
        img = Image.open(io.BytesIO(data)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="invalid image")

    with torch.inference_mode():
        inputs = processor(images=img, return_tensors="pt")
        out = model(**inputs)
        query = F.normalize(out.last_hidden_state[:, 0, :].float(), p=2, dim=1)
        sims = (query @ ref_features.T).squeeze(0)

    # 지점마다 가장 비슷한 사진 1장만 남겨 서로 다른 지점 3개를 후보로
    candidates = []
    seen = set()
    for idx in torch.argsort(sims, descending=True).tolist():
        wp = ref_wps[idx]
        if wp in seen:
            continue
        seen.add(wp)
        if FRONTEND_WAYPOINTS and wp not in FRONTEND_WAYPOINTS:
            continue
        candidates.append(
            {
                "waypointId": wp,
                "confidence": round(max(0.0, min(1.0, float(sims[idx]))), 4),
                "direction": "unknown",
            }
        )
        if len(candidates) == 3:
            break

    return {"candidates": candidates}