# vision-server (사진 인식 서버)

사진을 받아 등록된 기준 사진(201장)과 비교해 후보 지점 3개를 돌려주는 서버.

DINOv2(facebook/dinov2-base)로 사진을 숫자 묶음으로 바꿔 코사인 유사도로 비교

반환하는 confidence는 정답 확률x, 사진 유사도 점수

## 실행 방법 (Windows)

1. cmd에서 이 폴더로 이동: `cd vision-server`
2. 가상환경 만들기: `python -m venv .venv`
3. 가상환경 켜기: `.venv\Scripts\activate`
4. 설치: `pip install -r requirements.txt`
5. 서버 켜기: `uvicorn vision_server:app --host 127.0.0.1 --port 8000`
6. 확인: 브라우저에서 http://127.0.0.1:8000/health 를 열어 `{"ok":true,"refs":201}` 이 나오면 정상

## 앱(campass)과 연결

campass 폴더에 `.env.local` 파일을 만들고 `VISION_API_URL=http://127.0.0.1:8000/recognize` 입력 후 프론트를 다시 키고

http://localhost:3000/api/catalog 에서 visionEnabled 가 true 면 연결 성공

## 주소

- GET /health : 서버 상태
- POST /recognize : image(파일), campusId(글자)를 보내면 candidates를 반환

## 참고

- 방향(direction)은 정확도가 낮아서 지금은 unknown.
- FRONTEND_WAYPOINTS(vision_server.py)에 있는 지점만 후보로 돌려줌. 회의 후 지점이 바뀌면 수정
- 기준 사진 특징 파일(results/ref_embeddings.pt, ref_metadata.csv)은 기준 사진이 바뀌면 다시 만들기
