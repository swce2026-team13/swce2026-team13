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
- 관리자는 `.env.local`에 24자 이상의 `ADMIN_TOKEN`을 설정한 뒤 서버를 다시 시작합니다.
- 개발용 토큰 생성: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
- 데이터는 기본적으로 `data/campass.sqlite`에 저장됩니다. 폴더와 `.env.local`은 Git에서 제외합니다.

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
