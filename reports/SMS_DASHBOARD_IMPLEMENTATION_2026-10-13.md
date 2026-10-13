# 최고관리자 SMS 공급자 설정 구현

최고관리자 공통 API 설정에 Coolsms를 추가했다. SMS_API_KEY·SMS_API_SECRET·SMS_SENDER를 기존 provider_credentials 암호화 저장소에 global 범위로 저장한다. SMS_ENV=coolsms는 선택된 공급자 자체로 표현하며 Render 환경변수 값을 UI에서 변경하지 않는다. DB 설정이 우선이며 미등록 때만 기존 SMS_ENV=coolsms 환경변수를 사용한다. 명시적 비활성은 fallback도 막는다.

SMS 설정 링크를 통합 SMS 화면에 추가했다. 키 원문 재조회 없음, 입력 초기화, 마지막 4자리 마스킹, 최고관리자만 global API 관리, 매장 단위 SMS 등록 차단. 설정 확인은 실발송 없이 'configured'로 표시하며 'verified'로 오인하지 않는다.

운영 SMS 함수는 동적으로 공통 설정을 읽는다. 미설정/실패/공급자 거부를 성공으로 처리하지 않고, 8초 timeout과 비밀값·번호·본문 없는 로그를 사용한다. 접수 ID와 실제 배송은 분리한다. 대량 발송도 sent:true만 성공 집계한다. UI의 미구현 자동 광고문구/정산 차감 안내는 수정했다.

검증: backend 12개 통과, provider credential 7개 통과, UI/기존 관리자 모듈 12개 통과. 격리 PostgreSQL에서 신규 제약, 암호화 저장/조회, 마스킹, 매장 SMS 등록 차단 통과. DB 테스트는 전부 rollback. 실발송 0건.

신규 migration: prisma/migrations/20261012171456_add_global_sms_credentials/migration.sql. Supabase CLI로 생성한 식별자를 프로젝트 Prisma 경로에 사용했다. 기존 provider enum CHECK와 global scope CHECK에 coolsms를 추가한다. 운영 DB 적용·커밋·배포는 아직 하지 않았다. 기존 운영 수정과 별도로 migration 및 프론트/백엔드 반영이 필요하다. 이전 SMS 실발송 보류 요청을 유지한다.

잔여: 실제 공급자 API 인증·등록 발신번호·단말 배송, 수신 동의 관리 및 durable 대량 발송 큐는 미완료. SMS 설정 등록 기능만으로 해당 기능이 완료되는 것은 아니다.
