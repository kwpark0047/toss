# PR #32 최신 main 통합 및 태블릿 검증

2026-11-15 KST. main `144a3934`를 기존 PR #32 브랜치에 통합했다.

기존 767px breakpoint는 640/767px에서 문제를 해결했지만 768px에서 다시 가로 배치가 되어 합성 메뉴 가격이 축소됐다(그리드 가격 clientWidth 43px, scrollWidth 58px). 고정 폭 편집 패널로 미리보기가 좁아지는 태블릿 영역을 포함하도록 메뉴 빌더 전용 breakpoint를 1023px로 보완했다. 1024px부터 기존 가로 배치를 유지한다.

## 화면 검증

로컬 Vite와 실제 MenuBuilder·index.css를 사용했다. 라우터는 격리 MemoryRouter, 매장·카테고리·상품 API는 합성 데이터로 대체했으며 저장·업로드·fetch·WebSocket은 차단했다. 인증/전체 AdminLayout/운영 데이터의 E2E를 대신하는 검증은 아니다. 실제 Android/iPhone 실기기 검증도 아니다.

전체 데스크톱 미리보기 모드에서 각 폭마다 그리드·리스트·매거진을 선택하고 실제 DOM 크기와 화면을 확인했다. 메뉴명은 테스트 삼계탕·테스트 비빔밥, 가격은 10,000원·9,000원이다.

| viewport | 페이지 clientWidth / scrollWidth | 미리보기 clientWidth / scrollWidth | 편집 패널 배치 | 세 레이아웃 |
| --- | --- | --- | --- | --- |
| 640px | 625 / 625 | 561 / 561 | 세로 | 통과 |
| 767px | 752 / 752 | 688 / 688 | 세로 | 통과 |
| 768px | 753 / 753 | 689 / 689 | 세로 | 통과 |
| 1023px | 1008 / 1008 | 944 / 944 | 세로 | 통과 |
| 1024px | 1024 / 1024 | 528 / 528 | 가로 | 통과 |

15개 조합 모두 페이지·미리보기의 가로 넘침 없음, 합성 메뉴명·가격 scrollWidth <= clientWidth 확인. 640/767/768px 화면 증거 9장은 로컬 `reports/pr32-refresh-20261115/final-*.jpg`, 측정값은 같은 폴더의 `final-measurements.json`에 보관했다. 이 증거 파일은 저장소에 커밋하지 않는다.

## 검증과 경계

- `frontend`: MenuBuilder 모듈 테스트 1건 통과.
- `npm run ai:review:check`: 5건 통과. AI 활성화·유료 호출·매장·UI·카메라 gate OFF 유지.
- 최신 커밋의 CI·E2E는 GitHub PR #32에서 별도 확인하며 성공 전 머지하지 않는다.
- 운영 배포·실제 DB/Redis 변경·실제 디자인 저장·유료 API 호출 없음. GitHub 운영 배포 차단과 Render/Vercel 자동 배포 차단은 유지한다.
