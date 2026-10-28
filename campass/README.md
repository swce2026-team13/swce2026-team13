# CAMPASS · 서경대학교 캠퍼스 길찾기

Figma 모바일 화면을 바탕으로 구현한 Next.js + Node.js 애플리케이션입니다.

## 실행

Node.js **24.x**가 필요합니다.

```powershell
cd campass
npm ci
Copy-Item .env.example .env.local
npm run db:migrate
npm run dev
```

프로젝트의 `campass` 폴더에서 시작한 경우 `cd campass`는 생략합니다. 브라우저에서 http://localhost:3000 을 엽니다.

- 기본 데모: **면접 보러 왔어요 → 면접 대기실 → 안내 시작**
- 사진 AI가 설정되지 않으면 직접 위치 선택을 사용합니다.
- 관리자는 `.env.local`에 `ADMIN_ID`와 12자 이상의 `ADMIN_PASSWORD`를 설정한 뒤 서버를 다시 시작합니다. 관리자 화면에서 해당 아이디·비밀번호로 로그인합니다.
- 로그인 세션은 PostgreSQL에 저장되며 8시간 후 만료됩니다. 로그아웃하면 서버 세션과 쿠키가 삭제됩니다. 프로덕션에서는 Secure 쿠키를 사용하므로 HTTPS로 접속해야 합니다.
- 같은 접속지에서 10분 내 5회 로그인에 실패하면 다섯 번째 실패부터 10분간 로그인이 제한됩니다. 성공 시 실패 횟수는 초기화됩니다.
- 배포 프록시는 외부의 `X-Forwarded-For` 헤더를 신뢰하지 말고 실제 접속지로 덮어써야 합니다. 애플리케이션 서버 직접 접근은 차단해야 접속지별 제한을 우회할 수 없습니다.
- 데이터는 서버 전용 `DATABASE_URL`의 PostgreSQL에 저장됩니다. `.env.local`은 Git에서 제외합니다.

## 환경변수

`.env.example`을 `.env.local`로 복사해 값을 채웁니다. 모든 값은 서버에서만 읽으며 `NEXT_PUBLIC_` 접두사를 쓰지 않습니다.

| 이름 | 설명 |
| --- | --- |
| `DATABASE_URL` | 앱 전용 Supabase Transaction pooler 연결 문자열 (6543, 서버 전용) |
| `MIGRATION_DATABASE_URL` | 마이그레이션/이전 명령 전용 Direct 또는 Session pooler 연결 문자열 |
| `TEST_DATABASE_URL` | 테스트 전용 로컬 `campass_test` DB. 운영 URL과 구분 |
| `DEMO_DATABASE_URL` | 시연 데이터 전용 로컬 `campass_demo` DB |
| `SQLITE_SOURCE_PATH` | 기존 데이터 이전을 선택할 때 읽을 SQLite 원본 경로 |
| `ADMIN_ID`, `ADMIN_PASSWORD` | 관리자 아이디와 12자 이상 비밀번호 |
| `APP_ORIGIN` | Production 공개 주소. 가변 Preview 도메인에서는 비워 둠 |
| `VISION_API_URL`, `VISION_API_KEY` | 사진 위치 인식 API (비우면 직접 선택) |
| `INTENT_API_URL`, `INTENT_API_KEY` | 외부 목적지 해석 API (비우면 키워드 검색) |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | 자연어 질문 Gemini 보완. 두 값이 모두 있어야 사용합니다. `GEMINI_MODEL`에는 Flash-Lite 계열 모델 이름을 넣습니다. |

### PostgreSQL 연결과 마이그레이션

Supabase Dashboard의 **Connect**에서 앱용 **Transaction pooler** URL을 복사해 `campass/.env.local`의 `DATABASE_URL`에 입력합니다. 새로 설정한 DB 비밀번호를 URL에 넣고 특수문자는 URL 인코딩합니다. 채팅, 코드, PR에는 연결 문자열을 넣지 않습니다. 마이그레이션에는 같은 프로젝트의 **Direct connection** URL을 `MIGRATION_DATABASE_URL`에 넣습니다. Direct 연결이 IPv6 문제로 불가능하면 Session pooler(5432)를 사용합니다. 앱은 연결 풀을 인스턴스당 1개로 제한하고, TLS를 검증하며, named prepared statements와 query pipelining을 사용하지 않습니다.

로컬 PostgreSQL도 사용할 수 있습니다. `campass_dev`, `campass_test`, `campass_demo`라는 서로 다른 DB를 준비하고, `.env.local`의 세 URL을 각각 지정합니다. 테스트 DB 접속 역할에는 `CREATE DATABASE` 권한이 있어야 합니다. 테스트 도우미는 `campass_test`에 직접 쓰지 않고, 무작위 이름의 일회용 DB를 만든 뒤 종료 시 삭제합니다. 테스트와 시연 명령은 로컬 호스트 및 지정된 DB 이름만 허용합니다.

```powershell
cd campass
npm ci
npm run db:migrate
npm run dev
```

`db:migrate`는 `supabase/migrations/`의 SQL을 순서대로 한 트랜잭션에서 적용하고 체크섬을 기록합니다. 앱의 요청 처리나 빌드 과정에서는 스키마를 변경하지 않습니다. 이전에 적용한 파일이 바뀌면 명령이 중단됩니다. SQL은 세션·통과·혼란·피드백·사진 인식 피드백·요청 제한·관리자 세션과 제약조건을 생성합니다. `public` 테이블에 RLS를 켜고 Supabase Data API의 `anon`, `authenticated`, `service_role` 권한을 철회합니다. 브라우저는 Supabase Data API를 직접 쓰지 않으며, 기존 Next.js API가 서버에서 DB에 접근합니다.

### 기존 SQLite 데이터가 필요한 경우

기존 `data/campass.sqlite` 및 `-wal`, `-shm` 파일은 원본 그대로 보관합니다. 먼저 기존 앱의 쓰기를 중지하고 원본 파일 묶음의 안전한 복사본을 만든 뒤, `SQLITE_SOURCE_PATH`에 **복사본**의 `.sqlite` 경로를 지정합니다. 읽기 전용 검사:

```powershell
npm run db:import-sqlite
```

표시된 7개 테이블의 행 수를 확인한 뒤, 새롭고 비어 있는 대상 PostgreSQL DB를 `MIGRATION_DATABASE_URL`로 지정하여 명시적으로 이전합니다.

```powershell
npm run db:import-sqlite -- --apply
```

이 명령은 원본을 읽기 전용으로 열고, 대상 테이블 중 하나라도 비어 있지 않으면 중단합니다. 모든 행 삽입과 행 수 확인은 하나의 트랜잭션이며 오류 시 롤백합니다. 이후 `DATABASE_URL`을 그 대상 DB로 변경하고 `/api/health`, 안내 세션, 관리자 통계를 확인합니다. 기존 DB를 삭제하거나 초기화하지 않습니다.

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

테스트가 DB 관련 검증을 실제로 수행하려면 `TEST_DATABASE_URL`을 로컬 `campass_test` PostgreSQL에 연결해야 합니다. 설정하지 않으면 `npm test`의 DB 통합 테스트는 건너뛰고, `npm run test:api`는 명시적으로 실패합니다. `npm run build`가 `npm run test:api`보다 먼저 완료되어야 합니다. CI는 PostgreSQL 16 서비스와 일회용 테스트 DB를 사용합니다.

### Vercel 배포

1. Vercel에서 이 저장소를 가져오고 **Root Directory**를 `campass`로 설정합니다.
2. **Node.js 24.x**, **Install Command** `npm ci`, **Build Command** `npm run build`를 사용합니다.
3. Production과 Preview에 **서로 다른 Supabase 프로젝트/DB**를 준비하고, 각각 마이그레이션을 별도로 적용합니다. 검증 배포에는 Preview DB만 사용합니다.
4. 각 환경의 서버 전용 `DATABASE_URL`에 해당 프로젝트의 Transaction pooler URL을 입력합니다. `ADMIN_ID`와 12자 이상 `ADMIN_PASSWORD`도 환경별로 입력합니다. Production의 `APP_ORIGIN`은 실제 HTTPS 공개 주소로 설정하고, 주소가 바뀌는 Preview에서는 비워 두어 요청의 Host와 Origin을 비교하게 합니다. 선택형 AI 변수는 필요한 환경에만 입력합니다. `MIGRATION_DATABASE_URL`, `TEST_DATABASE_URL`, `DEMO_DATABASE_URL`, `SQLITE_SOURCE_PATH`는 Vercel 앱 환경변수에 넣지 않습니다.
5. Preview에서 `/api/health`, 장소 검색, 경로 생성, 세션 다음·이전 이동, 다른 브라우저의 세션 접근 거부, 피드백 중복 방지, 관리자 로그인·로그아웃·통계, 요청 제한을 확인합니다. 재배포 뒤 기존 세션과 통계가 남는지도 확인한 후 Production으로 전환합니다.

프로덕션 DB URL과 관리자 비밀번호는 새 값으로 설정합니다. Supabase Auth, 화면, 사진 인식 서버는 이 배포 설정에서 변경하지 않습니다.

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

## 코드 구조

- `app/`: URL별 페이지와 API 진입점을 모아요. API의 공통 인증·요청 검증은 `server/services/api.ts`에서 유지해요.
- `features/`: `search`, `navigation`, `recognition`, `feedback`, `admin`별 화면과 기능 컴포넌트를 모아요.
- `components/ui/`: 공통 버튼·카드·아이콘·모달을 모아요. 전체 화면 틀은 `components/app-shell.tsx`에 있어요.
- `server/`: `db`는 저장소, `auth`는 인증, `services`는 요청·장소 처리, `integrations`는 외부 연동을 맡아요.
- `shared/`: 화면과 서버에서 함께 쓰는 자료형은 `types`, 공통 함수는 `utils`에 모아요.
- `campus-data`, `styles`, `tests`, `scripts`, `public`의 기존 위치는 유지해요.

## 관리자 시연 데이터

`npm run seed:demo`는 최근 14일의 예시 세션 40개를 넣습니다. 다시 실행하면 기존 예시만 교체합니다. `npm run seed:demo:clear`는 예시 기록만 지웁니다. 두 명령은 `DEMO_DATABASE_URL`이 로컬 `campass_demo`를 가리키지 않으면 실행되지 않습니다. 먼저 그 DB에 `db:migrate`를 적용합니다.
