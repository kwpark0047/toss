# PR #84~#90 순차 병합 시 운영 배포 제외

## 보호 설정

- GitHub Actions 운영 `deploy` 잡은 repository variable `ENABLE_PRODUCTION_DEPLOY`가 정확히 `true`일 때만 기존 이벤트 조건을 평가한다. 변수 미설정/false는 배포 차단이다. 이번 병합에서는 변수를 false로 설정·확인한다. CI·보안·테스트 잡은 비활성화하지 않는다.
- 저장소 root와 frontend의 `vercel.json`에 `git.deploymentEnabled.main/master=false`를 적용한다. Vercel 공식 공개 JSON schema가 지원하는 설정이다. 기능 브랜치의 PR preview는 유지하고 main/master 자동 Git 배포는 차단한다.
- 운영 대상 Render `wemarket` 서비스는 읽기 전용 조회에서 `autoDeploy=no`, `autoDeployTrigger=off`였다. GitHub Actions의 deploy hook도 위 변수로 막으므로 main 병합 시 운영 빌드·마이그레이션을 요청하지 않는다.
- 배포 허용 변수나 Vercel 자동 배포를 이 작업 후 자동으로 복구하지 않는다. 추후 운영 배포가 별도로 승인되면 해당 릴리스 범위에서 다시 검토한다.

## 병합 절차

1. 위 보호 변경을 #84에 커밋하고 같은 변경 이력을 #85~#90에 병합한다. 기존 기능 커밋을 rebase/force-push하지 않는다.
2. 각 최종 head의 CI·보안·E2E 통과와 충돌 여부를 확인한다.
3. 순서는 #84 → #85 → #86 → #87 → #88 → #89 → #90. 머지 커밋으로 공통 조상과 기능 이력을 보존한다. 각 병합 전 예상 결과 tree와 CI가 검증한 head tree가 같은지도 확인한다.
4. 최종 main CI, 운영 deploy SKIP, Render 기존 배포 ID 및 Vercel 기존 production 배포 ID 유지 여부를 확인한다.

PR #83의 두 설계 문서는 이미 #84의 조상 커밋에 포함되어 있다. 별도의 #83 병합 명령은 실행하지 않는다. #84~#90의 누적 변경에는 Prisma schema/migrations 및 render.yaml 변경이 없음을 확인했다.

운영 배포·앱 DB 변경·유료 AI 호출·외부 SNS 게시를 실행하지 않는다. CI의 격리 테스트 데이터/Redis만 사용하며 기존 음성 폴백·매장 권한·사업자 승인·공용 월 예산 정책은 유지한다.
