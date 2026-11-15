# AI 메뉴 사진 초안·사업자 승인 등록 결과

2026-11-14. 기준 PR #88 / 244357d6. 최신 CI 43553744295와 보안 43553744302 success, E2E success 확인. 조건부 생략 검사는 통과로 세지 않았고 운영 deploy는 skipped다.

## 구현 및 기존 경로

메뉴 관리 → 사진에서 가져오기 → 사진 전송 동의 → 분석 초안 → 후보 선택 → 기존 ProductModal 검토 → 사업자 가격/알레르기 확인·최종 승인 → 기존 productsAPI.create이다. 사진 분석이나 초안 선택만으로 상품/카테고리를 저장하지 않는다. 기존 수동 등록·수동 일괄 등록·수정/삭제·결제 흐름은 유지한다.

기존 사진 스캔의 시세 가격 보정/가상 메뉴 추론 및 자동 카테고리 생성·일괄 저장 경로를 제거하고 후보별 기존 상품 등록 화면으로 전환했다. 사진 분석의 이름/카테고리/설명/원재료 검토 항목/홍보 문구/이미지 설명은 초안이다. 실제 가격·알레르기는 모델 출력 스키마에서 제외하고, 추가로 반환되더라도 서버와 프런트가 버린다. 외부 이미지 URL도 적용하지 않는다. 불명확한 사진은 빈 후보를 허용하며 메뉴를 지어내도록 강제하지 않는다.

기존 상품폼에는 이름·설명과 일치하는 기존 카테고리만 채운다. 가격·알레르기·대표 이미지는 비워 두며 원재료 검토 항목은 참고용으로만 보여준다. 사업자는 가격 직접 입력/확인, 알레르기 입력 또는 원재료 확인 후 명시적 해당 정보 없음 선택, 알레르기 대조, 전체 등록 승인 후 기존 등록 버튼을 누른다. 값 수정 시 승인을 해제하고 저장 중 중복 제출을 방지한다. 메뉴 관리 매장 변경 시 이전 초안을 폐기한다.

이 승인은 기존 편집 권한이 있는 사업자의 UI 등록 절차다. 일반 수동 상품 API는 기존 권한과 검증을 그대로 사용하며, AI 승인을 증명하는 새 DB 기록/서버 워크플로 테이블을 만들지 않았다. 기존 ProductsService/Product 저장소는 수정하지 않았다.

## 분석 API·동의·유료 호출 경계

- 기존 POST /api/ai/scan-menu-image 경로를 유지하되 인증·대상 store_id 메뉴 편집 권한을 필수화했다. 기존 익명/매장 없는 호출은 더 이상 허용하지 않는다. store_id query/body 충돌도 거부한다. 요청에는 store_id, image(JPEG base64), mimeType, consent:true가 필요하다.
- 새 MenuPhotoDraftService는 @google/genai의 generateContent와 JSON schema를 사용한다. 구 SDK의 다른 기능은 유지한다. 새 경로는 종전의 가상 가격 보정 helper를 호출하지 않는다.
- AI_MENU_DRAFT_ENABLED=false, AI_MENU_DRAFT_ALLOW_PAID=false, AI_MENU_DRAFT_MODEL 빈값이 기본이다. 실제 환경 파일·설정·키는 변경하지 않았다. 두 gate와 명시 모델 설정이 없으면 호출을 거부하고 수동 등록을 안내한다.
- 클라이언트 파일 JPG/PNG/WEBP 최대 5MB를 canvas에서 최대 변 1200px·512KB 이하 JPEG로 재인코딩한다. 서버도 JPEG 구조/크기·EXIF/임의 메타데이터 제한을 재검증한다. 기존 카메라의 320×240/16KB 기본 제한은 유지한다.
- 사용자당 인식 회수로 표현하지 않으며 인증 요청 IP당 분당 6회 제한, 응답 최대 10후보·2048토큰, Provider timeout 20초, 자동 모델 재시도 없음이다. 실제 청구 대사/하드 비용 상한을 보장하지 않는다.
- 원본/재인코딩 사진은 UI 메모리와 명시적 분석 요청에만 사용하고 DB/브라우저 저장소에 저장하지 않는다. 창을 닫거나 새 사진을 선택하면 늦은 분석 결과를 적용하지 않는다. 인식 정확도·음식 재료/알레르기는 사진으로 보장하지 않는다.

## 검증

- 프런트 16파일/66개 PASS: 분석 전 동의, AI 가격/알레르기 폐기, 사업자 값과 승인 전 저장 차단, 승인 후 기존 상품 API 1회, 값 수정 시 승인 해제, 실제 MenuManager→사진 초안→상품폼 전달, 기존 ProductModal 체험 기능, P0/P1/Voice Order/Manager/Vision·Toss ready 회귀.
- 실제 부모 화면 테스트에서 잘못된 모달 콜백 연결을 실패로 재현하고 수정했다. 자식 컴포넌트의 fixture 성공과 실제 부모 연결 검증을 구분했다.
- 백엔드 24개 PASS: 새 모델 gate/동의/price·allergen 제거/인증·매장 범위, 기존 프레임·Live·권한·승인 회귀. HTTP/WSS는 전용 임시 Redis/fake Provider를 사용했고 Redis는 검사 후 종료했다. 실제 SQL DB/유료 API는 사용하지 않았다.
- 변경 파일 ESLint 오류 0, backend typecheck, frontend production build PASS. 기존 aiController unused catch 경고, 번들 크기/wakeup import 경고는 별도로 남아 있다.
- 재현: node scripts/verify-menu-photo-draft-ui.cjs (msedge/Playwright 및 frontend 의존성 필요). 로컬 Vite 5185, 합성 JPEG·가짜 분석/상품 API, 외부 네트워크 차단.
- 390px에서 동의 전 분석 0, 분석/초안 선택 후 상품 저장 0, 사업자 입력 1,000원/우유와 최종 승인 후 fake 상품 1건만 생성. 320px에서는 분석 403 이후 수동 등록 복귀 및 가로 넘침 없음. 실제 등록/DB 변경은 아니다.
- 화면/판정: reports/ai3-menu-photo-20261114/photo-draft-390.png, owner-review-390.png, denied-manual-320.png, browser-check.json. 실제 휴대폰·실제 Gemini OCR/음식 판독 품질을 검증한 결과가 아니다.

## 제출·한계·롤백

별도 feat/ai-menu-photo-drafts 브랜치. main에 미병합인 #84~#88 의존 변경도 main 대상 diff에 포함되며 사진 초안은 별도 커밋으로 구분한다. 운영 머지/배포·실제 환경변수·기존 DB/Prisma/schema/migration 변경·유료 API 호출을 하지 않는다.

실제 계정 모델 가용성·사진/음식 인식 품질·모바일 브라우저 파일 인코딩/크기·요금 대사는 별도 승인 canary가 필요하다. 사업자가 선택한 후보를 1개씩 확인하여 기존 상품폼에서 등록하는 범위이며, 미검토 AI 결과를 여러 건 자동 저장하는 작업이 아니다.

롤백은 분석 gate OFF 및 수동 상품 등록 유지다. 인증/매장 권한 강화는 보존하며 이전 익명/무제한 분석을 복구하지 않는다. DB 역마이그레이션은 필요 없다.
