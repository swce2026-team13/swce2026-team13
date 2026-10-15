# CAMPASS · swce2026-team13

서경대학교 캠퍼스 길찾기 웹 애플리케이션입니다. Node.js 24.x를 사용합니다.

## 실행

저장소 최상위 폴더에서 실행합니다.

```powershell
npm --prefix campass ci
npm run dev
```

브라우저에서 http://localhost:3000 을 엽니다. 3000번 포트가 사용 중이면 터미널에 표시된 주소로 접속합니다.

실제 앱과 의존성은 `campass` 폴더에 있습니다. 최상위의 npm 스크립트가 해당 폴더로 명령을 전달하므로, 최상위와 `campass` 양쪽에서 `npm run dev`를 실행할 수 있습니다.

- [환경 변수 및 상세 실행 안내](campass/README.md)
