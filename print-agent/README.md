# WeMarket Local Print Agent

이 프로그램은 iOS 사파리 등 Web Bluetooth API를 지원하지 않는 기기에서 주방 디스플레이(KDS) 영수증 출력을 지원하기 위한 로컬 에이전트입니다.

## 설치 및 실행 방법

1. Node.js를 설치합니다.
2. 매장 POS 또는 데스크탑 PC에서 터미널을 열고 다음 명령어를 실행합니다.
   \\\ash
   npm install
   node server.js
   \\\
3. \http://localhost:8081\ 에서 서버가 실행됩니다.
4. KDS 화면에서 블루투스 프린터 연결 실패 시, 자동으로 이 에이전트로 영수증 출력 명령이 전송됩니다.

## 설정
현재는 오류 방지를 위해 MockDevice(가상 프린터)로 설정되어 있습니다. 
실제 감열식 프린터를 사용하려면 \server.js\ 내부의 주석을 해제하고 USB 또는 Network IP 설정을 변경하세요.
