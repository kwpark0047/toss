import { createRequire } from 'node:module';
import path from 'node:path';

// 정본은 config/prisma.js 다. tsx 는 TS 파일 기준 './prisma.js' 를 다시 이 .ts 로 해석하므로
// JS 파일 경로를 기준점으로 require 해야 CJS 코드와 같은 PrismaClient(단일 커넥션 풀)를 공유한다.
// 예전처럼 이 파일이 클라이언트를 따로 만들면 기동 시 쿼리 엔진이 2~3개 뜨고, index.mts 의
// 사전 연결은 health 전용 풀만 데워서 첫 메뉴 조회가 연결 수립 비용을 그대로 떠안았다.
const requireFromJs = createRequire(path.join(__dirname, 'prisma.js'));
const prisma = requireFromJs('./prisma.js');

export default prisma;
