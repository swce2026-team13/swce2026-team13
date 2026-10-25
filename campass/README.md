# CAMPASS · 서경대학교 캠퍼스 길찾기

Figma 모바일 화면을 바탕으로 구현한 Next.js + Node.js 애플리케이션입니다.

## 실행

Node.js **24.x**가 필요합니다.

```powershell
cd campass
npm ci
Copy-Item .env.example .env.local
npm run dev
```

프로젝트의 `campass` 폴더에서 시작한 경우 `cd campass`는 생략합니다. 브라우저에서 http://localhost:3000 을 엽니다.

- 기본 데모: **면접 보러 왔어요 → 면접 대기실 → 안내 시작**
- 사진 AI가 설정되지 않으면 직접 위치 선택을 사용합니다.
- 관리자는 `.env.local`에 `ADMIN_ID`와 12자 이상의 `ADMIN_PASSWORD`를 설정한 뒤 서버를 다시 시작합니다. 관리자 화면에서 해당 아이디·비밀번호로 로그인합니다.
- 로그인 세션은 SQLite에 저장되며 8시간 후 만료됩니다. 로그아웃하면 서버 세션과 쿠키가 삭제됩니다. 프로덕션에서는 Secure 쿠키를 사용하므로 HTTPS로 접속해야 합니다.
- 같은 접속지에서 10분 내 5회 로그인에 실패하면 다섯 번째 실패부터 10분간 로그인이 제한됩니다. 성공 시 실패 횟수는 초기화됩니다.
- 배포 프록시는 외부의 `X-Forwarded-For` 헤더를 신뢰하지 말고 실제 접속지로 덮어써야 합니다. 애플리케이션 서버 직접 접근은 차단해야 접속지별 제한을 우회할 수 없습니다.
- 데이터는 기본적으로 `data/campass.sqlite`에 저장됩니다. 폴더와 `.env.local`은 Git에서 제외합니다.

## 환경변수

`.env.example`을 `.env.local`로 복사해 값을 채웁니다. 모든 값은 서버에서만 읽으며 `NEXT_PUBLIC_` 접두사를 쓰지 않습니다.

| 이름 | 설명 |
| --- | --- |
| `DATABASE_PATH` | SQLite 파일 경로 (기본 `./data/campass.sqlite`) |
| `ADMIN_ID`, `ADMIN_PASSWORD` | 관리자 아이디와 12자 이상 비밀번호 |
| `APP_ORIGIN` | 프로덕션 공개 주소 |
| `VISION_API_URL`, `VISION_API_KEY` | 사진 위치 인식 API (비우면 직접 선택) |
| `INTENT_API_URL`, `INTENT_API_KEY` | 외부 목적지 해석 API (비우면 키워드 검색) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 자연어 질문 Gemini 보완. 두 값이 모두 있어야 사용합니다. `GEMINI_MODEL`에는 Flash-Lite 계열 모델 이름을 넣습니다. |

Gemini는 규칙으로 장소·이동 조건·다음 이동을 찾지 못한 질문에만 호출됩니다. 사용자 문장과 장소 목록(id·이름·별칭·건물·층)만 보내고, 등록된 장소 id만 최대 5개 사용합니다. 편의시설 24곳도 종류와 함께 보내며, 호실 목록은 보내지 않습니다. 규칙이 찾은 조건이 우선입니다. 3초 안에 응답하지 않거나 오류·한도 초과(429)·잘못된 JSON이면 키워드 검색 결과로 응답합니다. Gemini 결과를 쓰면 `/api/intent` 응답의 `mode`가 `"llm"`입니다.

`npm run eval:intent`로 32개 질문의 키워드 검색과 Gemini 보완 정답률을 화면에서 비교할 수 있습니다. 키가 없으면 Gemini 평가는 건너뜁니다. `npm run eval:intent -- --keyword-only`는 외부 요청 없이 키워드 검색만 평가합니다. Gemini 평가는 문장 사이에 4초씩 쉬며, 결과 파일이나 API 키를 출력하지 않습니다.

## 검사와 배포용 실행

```powershell
npm test
npm run lint
npm run build
npm run test:api
npm start
```

API 테스트는 별도 임시 SQLite DB와 임의 포트의 서버를 생성합니다. `npm run build`가 먼저 완료되어야 합니다.

## 문서

- [Figma 사진 출처](public/images/README.md)

**공식 자료에서 확인한 건물·강의실과 시연용 실내 동선을 구분합니다.** 실제 캠퍼스에서 사용할 경로·거리·사진·접근성은 현장 검증이 필요합니다. 모델 학습과 외부 API 계약은 아직 수행하지 않았습니다.

## 페이지 경로

- `/`: 홈
- `/search`: 목적지 검색
- `/directions`: 출발지·경로 선택
- `/directions/photo`, `/directions/recognition`, `/directions/failed`, `/directions/recovery`: 사진·위치 확인
- `/guide`, `/guide/arrival`: 안내·도착
- `/map`, `/map/places`, `/guide/map`, `/help`: 지도·건물·이용 안내
- `/admin`: 관리자

`app/` 폴더의 `page.tsx`가 각 URL에 대응합니다. 공통 상태는 루트 레이아웃의 `CampusProvider`에서 유지합니다. 검색어·목적지·출발지·건물은 URL 쿼리로 복원하며, 진행 세션은 기존 브라우저의 세션 저장소에서 복원합니다.

지도·건물 상세·이용 안내는 앱 내 이동 시 `@modal` 인터셉트 모달로 열립니다. 직접 주소 접속과 새로고침은 독립 페이지로 표시합니다. 닫기·Esc·배경 클릭은 이전 화면으로 돌아가고 브라우저 앞으로 가기로 다시 열 수 있습니다.

`docs/`, `Doc/`, 상세 백엔드 문서는 로컬 전용이며 Git에서 제외합니다.

## 관리자 시연 데이터

`npm run seed:demo`는 최근 14일의 예시 세션 40개를 넣어요. 다시 실행하면 기존 예시만 교체해요. `npm run seed:demo:clear`는 예시 기록만 지워요. DB는 `DATABASE_PATH`를 따르고, 없으면 `./data/campass.sqlite`를 사용해요.

배포 DB에는 넣지 마세요. 넣었다면 시연 뒤 지워 주세요. 시험할 때는 `DATABASE_PATH`를 임시 폴더의 새 파일로 지정해요.
