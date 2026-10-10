# 기존 데이터 보존을 위한 키 분리 전환

상태: 로컬 코드/fixture 검증 완료, 운영 미적용. 암호화 알고리즘이나 기존 DB 암호문을 변경하지 않는다.

## 사전 조건

- 실제 서비스·DB·현재 실행 SHA를 식별한다. 계정간 다른 Render 서비스를 혼동하지 않는다.
- 기존 phone/token/provider 키 설정 여부를 소유 계정에서 확인한다. 각 모듈 fallback 우선순위가 다르므로 전화번호 호환 결과만으로 다른 키를 확정하지 않는다.
- 기존 전화번호 키 후보는 운영 암호문 14/14와 검색 IV가 일치했다. 실제 운영 JWT/refresh 서명과 청구/provider 키 호환성은 별도 상태다.
- 안전한 비밀 저장소에 기존 키를 보관하고 backup/복구를 확인한다. 채팅·Git·일반 보고서에 넣지 않는다.

## 설정과 순서

1. 기존 PHONE_ENC_KEY가 없고 JWT fallback을 사용했다면 검증된 이전 JWT 값을 PHONE_ENC_KEY로 보존한다. 실제 기존 PHONE_ENC_KEY가 있으면 그 값을 유지한다.
2. TOKEN_ENC_KEY는 기존 값을 유지한다. 없었다면 당시 JWT fallback 값을 보존한다. PROVIDER_SECRET_KEY는 기존 값, 없으면 당시 TOKEN_ENC_KEY, 그것도 없으면 당시 JWT 값의 순서로 확인하고 명시한다. 추정으로 교체하지 않는다.
3. 소유자가 안전한 Render 관리 화면에서 새 JWT_SECRET/JWT_REFRESH_SECRET을 입력한다. 각각 최소32자이며 암호화 키와 달라야 한다. 인증키 변경 입력/제출은 사용자가 직접 수행한다. 임의 새 키는 코드에 포함하지 않는다.
4. REQUIRE_SEPARATE_ENCRYPTION_KEYS=true를 지정하면 production에서 세 암호화 키 모두 명시해야 하며 JWT/refresh와 같으면 기동을 거부한다. 명시 키 최소16자/자리표시자 검사가 함께 적용된다.
5. 새 서명키 전환은 기존 로그인 토큰을 무효화한다. 이 호환 영향은 사용자에게 공지하고 재로그인을 검증한다. 이전 노출 JWT를 fallback 검증으로 다시 허용하지 않는다. 기존 암호문은 다시 쓰지 않는다.
6. 승인된 동일 RC를 staging에 적용해 phone 복호화/검색, token/provider 암호문, 새 로그인/refresh/로그아웃/권한 및 금융 여정을 검증한다. 운영 smoke는 deep health 내부 status=ok와 정확한 SHA를 요구한다.
7. 운영 전환 후 14/14 복호화·검색, 새 로그인 및 core smoke를 확인한다. 서명키를 되돌려 노출된 토큰을 재활성화하는 rollback은 피하고 보안 대응 계획에 따라 별도 판단한다.

DB schema migration은 이 분리에 필요하지 않다. 기존 key provenance가 없어 암호문을 읽지 못하면 본 절차를 중단한다. DB/API/PG 자격증명의 노출 후 교체는 각각 해당 공급자의 안전한 절차로 별도 진행한다.

## 테스트 증거

키 분리 누락 재현: key-separation-red.json — 1 failed/13 passed.

수정 후 환경/전화번호/토큰/키분리/smoke 시험: key-separation-green.json — 5 suites, 44 passed/0 failed. 테스트는 로컬 fixture이며 운영 발급 JWT 또는 실제 PG 시험이 아니다.

keySeparation.test.js는 기존 JWT fallback으로 생성한 phone/token/provider 암호문을 별도 명시 키로 유지한 뒤 새 JWT에서 복호화/검색이 유지되는지 확인한다. 다른 매장 AAD는 실패해야 한다. 자동 key 회전 또는 운영 설정 전송은 하지 않는다.
