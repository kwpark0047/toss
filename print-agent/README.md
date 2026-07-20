# WeMarket Print Agent

매장 POS PC에서 WeMarket 백엔드의 인쇄 대기 작업을 가져와 USB/LAN 감열식 프린터로 자동 인쇄하는 로컬 데몬.

## 요구사항

- Node.js 18+
- TCP/LAN 프린터 (9100 포트 기본) 또는 USB 프린터
- WeMarket 백엔드 API 접근 가능

## 설치

```bash
cd print-agent
cp .env.example .env
# .env 파일 수정 (백엔드 URL, API 키, 프린터 설정)
npm install
```

## 실행

```bash
npm start
```

## 프린터 설정

### TCP/LAN 프린터 (기본)
```
PRINTER_TYPE=tcp
PRINTER_HOST=192.168.1.100
PRINTER_PORT=9100
```

### USB 프린터
```
PRINTER_TYPE=usb
PRINTER_VID=0x0456
PRINTER_PID=0x0808
```

## 아키텍처

```
[WeMarket Backend] ← API → [Print Agent Daemon] → [ESC/POS] → [프린터]
   (print_jobs DB)           (이 파일)              (USB/LAN)
```

1. 에이전트가 `POLL_INTERVAL`마다 백엔드에서 pending 작업 조회
2. 각 작업을 claim (처리 중 상태로 변경)
3. ESC/POS 바이트를 프린터로 전송
4. 완료/실패 상태를 백엔드에 리포트

## 참고

- `print_jobs` 테이블의 `payload_b64` 필드에 인코딩된 ESC/POS 바이트가 저장됨
- 바이트 생성은 백엔드 `utils/escpos.js`에서 담당 (한글 CP949 인코딩)
- 프린트 에이전트는 상태less — 네트워크 끊김 시 백엔드가 재시도
