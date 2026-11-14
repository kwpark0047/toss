# Gemini Vision 카메라 도우미 구현·검증

2026-11-14. 기준 PR #87 / fe95b733. 최신 CI 43552101901 및 보안 43552101702 success, E2E success 확인. 조건부 skipped 검사는 통과로 세지 않았고 운영 deploy는 skipped다.

## 사용자 흐름

팅커벨 Live의 기존 음성 동의/연결 이후 별도 카메라 동의를 받는다. ‘카메라 켜기’ → 로컬 미리보기 → ‘사진 확인’ → ‘이 사진 전송’ 순서이며 자동 촬영 전송이나 프레임 큐를 만들지 않는다. 장치 접근은 video만 요청하고 음성용 스트림과 분리한다. 권한 거부·사진 전송 오류 시 음성·텍스트 연결을 유지한다. 기존 Live 장애 폴백도 유지한다.

메뉴판·음식 사진의 설명을 요청할 수 있으나 이번 단계는 이미지 입력 연결 구현이다. 실제 Gemini 인식 정확도·번역·음식 식별은 유료 API 없이 검증하지 않았다. 사진만으로 가격/품절/알레르기·식품 안전을 확정하지 않도록 UI와 Provider 지침을 적용하고, 이미지 속 지시문은 신뢰하지 않는다. 주문·결제/관리자 변경 도구를 추가하지 않았다.

## 동의·전송·비용 경계

| 항목 | 적용 |
|---|---|
| UI | VITE_AI_LIVE_CAMERA_UI_ENABLED=false 기본, 기존 Live UI flag와 별개 |
| 서버 | AI_LIVE_CAMERA_ENABLED=false 기본, 기존 전역/유료 Live gate 별도 |
| 매장 | AI_LIVE_STORE_POLICIES의 cameraEnabled===true를 별도로 요구 |
| 세션 | customer 목적만 허용, 서버에 저장된 cameraAllowed capability와 현재 gate를 매 전송에 확인 |
| 모델·요금 | 현재 검토한 3.1 Flash Live/2.5 Native Audio 모델 허용 범위, IMAGE와 VIDEO 입력 요금 모두 명시되어야 camera capability 제공. 3.8은 이미지 지원 별도 확인 전 차단 |
| 동의 | 음성 동의를 카메라 동의로 간주하지 않음. WSS cameraConsent=true 전 image 거부 |
| 이미지 | 320×240 이내 baseline JPEG, 디코딩 바이트 최대 16,384, WSS 기존 maxPayload 24,000 유지 |
| 빈도·개수 | 클라이언트/서버 모두 최소 1,000ms 간격, 대화당 최대 30장. 카메라 off/on에도 서버 count 유지 |
| 저장 | 원본 사진·영상·base64를 DB/감사 로그/브라우저 저장소에 기록하지 않음. 미리보기는 메모리의 최신 한 장만 유지 |
| 종료 | 카메라 끄기·동의 해제·track 종료·페이지 숨김/pagehide·Live 종료/unmount 시 트랙/미리보기 정리. 늦은 권한 허용도 즉시 stop |

브라우저 canvas에서 영상 프레임을 JPEG로 인코딩하며 원본 파일 업로드/EXIF를 전달하지 않는다. 서버는 JPEG 헤더/스캔 구조와 실제 SOF 크기, EXIF/댓글/임의 APP 세그먼트를 검사한다. 캔버스가 생성하는 제한 크기의 ICC 색상 프로필은 허용한다. 이 검사는 완전한 픽셀 디코더나 이미지 의미 검증이 아니다. 인코딩이 규격에 맞지 않으면 전송을 중단하고 음성/텍스트를 안내한다.

단가는 코드에 고정하지 않는다. 기존 서버 usage 계량·예약 예산을 재사용하고 미가격 모달리티는 차단한다. 수치 제한은 보수적 애플리케이션 상한이며 Google 실제 청구 금액을 정확히 보장하지 않는다. 실제 환경 파일·유료 flag·매장 설정은 변경하지 않았다.

## 검증

- 프런트 11파일/58개 PASS: 카메라 동의 전 접근 0, 별도 사진 확인/전송, 서버 capability 차단, 늦은 권한/숨김·종료 해제, 프레임 전송 제한과 기존 P0/P1/Voice Order/Manager/결제 계약 회귀. 최종 세션 key 보강 후 관련 3파일도 재확인했다.
- 백엔드 22개 PASS: 합성 JPEG의 형식·크기·metadata·1fps·30장·요금 gate, SDK video JPEG payload, 실제 임시 Redis HTTP/WSS의 동의 없는 이미지 차단/허용/과속 차단/서버 설정 해제 후 차단 및 음성·텍스트 유지, 기존 인증·승인·사용량 회귀. 임시 Redis는 검사 후 종료했다.
- 변경 파일 lint, backend typecheck, frontend production build 검증. 기존 번들 크기/wakeup import 경고는 별도로 남아 있다.
- 재현: node scripts/verify-live-camera-ui.cjs (msedge/Playwright 및 frontend 의존성 필요). 로컬 Vite 5184, 합성 canvas.captureStream, 가짜 마이크/WSS/발급 API, 외부 네트워크 차단. 실제 카메라/실제 고객/유료 API를 사용하지 않는다.
- 390px에서 동의 전 카메라 요청 없음, 사진 확인 전 image 송신 0건, 확인 후 16KB 이하 JPEG 1건, hidden 트랙 ended, 카메라 거부 뒤 텍스트 입력 활성 상태 확인. 320px 가로 넘침 없음.
- 증거: reports/ai3-camera-20261114/browser-check.json, camera-preview-390.png, camera-denied-voice-390.png, camera-fallback-320.png. 테스트 fixture 사진은 합성 메뉴판이며 실제 고객 사진 저장이 아니다.

## 공식 근거·한계·제출

확인한 공식 공개 문서: https://ai.google.dev/gemini-api/docs/live 및 https://ai.google.dev/gemini-api/docs/live-guide — JPEG 이미지 최대 1fps 및 sendRealtimeInput({video:{data,mimeType:'image/jpeg'}}). SDK 3.3.0의 video Blob 입력 타입과 대조했다. 문서 조회는 유료 API 호출이 아니다.

실제 Android/iPhone 카메라·권한 복구·각 브라우저 JPEG 인코더·회전·자동재생, 실제 모델별 영상 지원/품질/청구는 미검증이다. 기본 OFF를 유지하고 별도 승인된 합성 입력 canary로 확인해야 한다. 카메라 UI는 이번 한국어 안내를 추가하며 기존 9개 언어 음성/팅커벨 경로는 보존했다.

별도 feat/gemini-vision-camera 브랜치로 제출한다. main 미병합인 #84~#87 의존 변경도 main 대상 diff에 포함되며 이번 Vision은 별도 커밋으로 구분한다. 운영 머지/배포·기존 DB/Prisma/schema/migration 변경·유료 API 호출은 하지 않는다.

롤백: 카메라 UI/서버/매장 gate OFF와 트랙 종료. 기존 음성/텍스트·주문·승인 경로 및 P0 예약·감사 원장은 보존한다. DB 역마이그레이션은 필요 없다.
