const prisma = require('../config/prisma');

const POSTS = [
    // ── 공지사항 ──────────────────────────────────────────────
    {
        board_type: 'notice',
        title: 'WeMarket QR 메뉴 서비스 정식 오픈 안내',
        content: `안녕하세요, WeMarket 운영팀입니다.

WeMarket QR 메뉴 플랫폼이 정식 오픈되었습니다.

■ 주요 서비스
- QR코드 기반 비대면 메뉴 주문
- 토스 페이먼츠 연동 간편 결제
- 실시간 주방 주문 알림
- 매출 통계 및 재고 관리

앞으로도 지속적인 업데이트를 통해 더 나은 서비스로 찾아뵙겠습니다.
감사합니다.`,
        is_pinned: true,
        tags: '공지,오픈,서비스안내',
        author_name: 'WeMarket 운영팀',
    },
    {
        board_type: 'notice',
        title: '정기 점검 안내 (매주 화요일 새벽 2~4시)',
        content: `안녕하세요, WeMarket 운영팀입니다.

서비스 안정성 향상을 위해 정기 점검을 실시합니다.

■ 점검 일정
- 일시: 매주 화요일 새벽 02:00 ~ 04:00
- 내용: 서버 업그레이드 및 DB 최적화

점검 중에는 서비스 이용이 일시적으로 제한될 수 있습니다.
불편을 드려 죄송합니다.`,
        is_pinned: false,
        tags: '공지,점검,시스템',
        author_name: 'WeMarket 운영팀',
    },
    {
        board_type: 'notice',
        title: '개인정보 처리방침 개정 안내 (2026년 7월 1일 시행)',
        content: `안녕하세요, WeMarket 운영팀입니다.

관련 법령 개정에 따라 개인정보 처리방침이 아래와 같이 개정됩니다.

■ 주요 변경 사항
1. 개인정보 보유 기간 명확화
2. 제3자 제공 항목 상세화
3. 이용자 권리 행사 절차 보완

■ 시행일: 2026년 7월 1일

개정된 방침은 시행일부터 적용되며, 기존 방침은 개정 방침으로 대체됩니다.`,
        is_pinned: false,
        tags: '공지,개인정보,약관',
        author_name: 'WeMarket 운영팀',
    },

    // ── 자유게시판 ────────────────────────────────────────────
    {
        board_type: 'free',
        title: 'QR 메뉴 도입 후 주문 실수가 확 줄었어요',
        content: `카페 운영한 지 3년째인데요.

기존에는 직원이 수기로 주문받다 보니 실수가 잦았는데 WeMarket 도입 후 주문 오류가 거의 사라졌습니다.

특히 피크 타임에 손님이 몰릴 때 직원이 주문에 치이지 않고 음료 제조에만 집중할 수 있어서 서비스 속도가 크게 빨라졌어요.

처음엔 고령 손님분들이 QR 사용을 어려워하실까 걱정했는데, 의외로 금방 익숙해지시더라고요. 인터페이스가 직관적이어서 그런 것 같습니다.

WeMarket 도입 고민하시는 분들께 강력 추천드립니다!`,
        tags: '후기,카페,운영팁',
        author_name: '커피한잔사장님',
    },
    {
        board_type: 'free',
        title: '홀 서빙 없이 2인 운영으로 매장 돌리는 중입니다',
        content: `안녕하세요! 이탈리안 레스토랑 운영 중인데요.

WeMarket 도입하고 나서 홀 직원 1명을 줄이고 주방 2명으로만 운영하고 있습니다.

손님이 QR로 직접 주문하고 결제까지 하니까 홀에서 따로 처리할 게 없더라고요. 주방 알림도 바로 오고, 결제도 자동이라서 정말 편해요.

인건비 절감 효과가 생각보다 커서 만족스럽습니다. 1인 매장이나 소규모 운영하시는 분들한테 특히 추천드려요.

궁금한 점 있으시면 댓글로 남겨주세요~`,
        tags: '운영팁,1인매장,인건비절감',
        author_name: '파스타집사장',
    },
    {
        board_type: 'free',
        title: 'WeMarket 6개월 사용 후기 공유합니다',
        content: `WeMarket 도입한 지 6개월 됐는데 솔직한 후기 남깁니다.

✅ 좋은 점
- 주문 처리 속도 향상
- 매출 통계가 한눈에 보임
- 메뉴 수정이 실시간으로 반영
- 재고 관리가 편해짐

⚠️ 아쉬운 점
- 초기 세팅이 좀 복잡한 편
- QR코드 인식이 가끔 느릴 때 있음

전반적으로는 매우 만족스럽고, 특히 매출 분석 기능이 마음에 듭니다. 어느 시간대에 어떤 메뉴가 잘 나가는지 파악하기 쉬워졌어요.

앞으로도 계속 쓸 예정입니다!`,
        tags: '사용후기,솔직후기,추천',
        author_name: '분식집사장',
    },

    // ── 질문/답변 ─────────────────────────────────────────────
    {
        board_type: 'qna',
        title: '결제 수단에 카드 말고 계좌이체도 추가할 수 있나요?',
        content: `안녕하세요!

현재 토스 페이먼츠로 카드 결제는 잘 되고 있는데요.

단골 손님 중에 계좌이체를 선호하시는 분들이 계셔서요. 토스 페이 계좌이체나 무통장 입금 방식을 추가할 수 있는지 궁금합니다.

대시보드 설정에서 찾아봤는데 잘 모르겠어서 여쭤봅니다. 혹시 아시는 분 계시면 도움 부탁드려요!`,
        tags: '결제,계좌이체,토스페이먼츠',
        author_name: '궁금한사장님',
    },
    {
        board_type: 'qna',
        title: 'QR코드 이미지가 손상됐을 때 재발급 방법이 있나요?',
        content: `테이블에 붙여놓은 QR코드 스티커가 손상되어서요.

새로 출력하려고 하는데 어디서 재발급할 수 있는지 모르겠습니다.

대시보드에 QR 관리 메뉴가 있는 것 같긴 한데, 혹시 재발급 시 기존 주문 데이터나 설정에 영향이 가는지도 함께 여쭤봅니다.

빠른 답변 부탁드립니다. 감사합니다!`,
        tags: 'QR코드,재발급,테이블',
        author_name: '치킨집사장',
    },
    {
        board_type: 'qna',
        title: '직원 계정 비밀번호를 잊어버렸어요, 초기화 방법이 있나요?',
        content: `안녕하세요.

새로 채용한 직원이 첫날부터 설정한 비밀번호를 잊어버렸다고 하네요 😅

관리자 권한으로 직원 계정 비밀번호를 초기화하거나 임시 비밀번호를 발급해줄 수 있는 기능이 있는지 궁금합니다.

혹시 없다면 어떻게 처리해야 하는지도 알려주시면 감사하겠습니다!`,
        tags: '직원계정,비밀번호,권한관리',
        author_name: '헬스장사장님',
    },

    // ── 도움말/FAQ ────────────────────────────────────────────
    {
        board_type: 'faq',
        title: 'QR코드는 어떻게 출력하나요?',
        content: `**QR코드 출력 방법 안내**

1. 관리자 대시보드 로그인
2. 좌측 메뉴 → 테이블 관리 선택
3. 원하는 테이블의 QR 아이콘 클릭
4. "QR코드 다운로드" 버튼 클릭 (PNG 형식)
5. 다운로드된 이미지를 인쇄

**추천 출력 사이즈**
- 테이블 스탠드용: 7cm × 7cm 이상
- 벽면 부착용: 10cm × 10cm 이상

**인쇄 팁**
- 고해상도(300dpi 이상) 프린터 사용 권장
- 코팅 처리 시 스캔 인식률이 향상됩니다
- 손상 방지를 위해 라미네이팅 처리를 권장합니다`,
        is_pinned: true,
        tags: 'QR코드,출력,테이블설정',
        author_name: 'WeMarket 운영팀',
    },
    {
        board_type: 'faq',
        title: '메뉴 카테고리는 어떻게 추가하고 관리하나요?',
        content: `**메뉴 카테고리 관리 방법**

**카테고리 추가**
1. 대시보드 → 메뉴 관리
2. 우측 상단 "카테고리 추가" 클릭
3. 카테고리명 입력 후 저장

**카테고리 순서 변경**
- 카테고리 좌측 ≡ 아이콘을 드래그하여 순서 변경 가능
- 변경사항은 고객 메뉴 화면에 즉시 반영됩니다

**카테고리 숨기기/보이기**
- 카테고리 우측 토글 스위치로 노출 여부 제어
- 재고 소진 시 임시 숨김 처리 활용 가능

**메뉴 이동**
- 기존 메뉴를 다른 카테고리로 이동: 메뉴 수정 → 카테고리 선택 변경`,
        tags: '메뉴관리,카테고리,설정',
        author_name: 'WeMarket 운영팀',
    },
    {
        board_type: 'faq',
        title: '토스 페이먼츠 연동은 어떻게 설정하나요?',
        content: `**토스 페이먼츠 연동 설정 방법**

**사전 준비**
1. 토스 페이먼츠 가맹점 가입 (payments.toss.im)
2. 심사 완료 후 API 키 발급 확인

**WeMarket 연동 방법**
1. 대시보드 → 매장 설정 → 결제 설정
2. "토스 페이먼츠 연동" 섹션에서 API 키 입력
   - 테스트 키: test_sk_로 시작하는 키
   - 실제 키: live_sk_로 시작하는 키
3. "연동 테스트" 버튼으로 정상 연결 확인
4. 저장

**지원 결제 수단**
- 신용/체크카드 (국내 전 카드사)
- 토스페이
- 계좌이체
- 가상계좌

**주의사항**
- 테스트 모드에서 충분히 검증 후 실제 키로 전환하세요
- API 키는 외부에 노출되지 않도록 주의하세요`,
        tags: '결제,토스페이먼츠,연동설정',
        author_name: 'WeMarket 운영팀',
    },
];

async function main() {
    console.log('샘플 게시글 생성 시작...\n');

    // 관리자 계정 찾기 (또는 첫 번째 사용자)
    const adminUser = await prisma.users.findFirst({
        where: { OR: [{ role: 'super_admin' }, { role: 'store_admin' }] },
        orderBy: { id: 'asc' }
    });

    const fallbackUser = await prisma.users.findFirst({ orderBy: { id: 'asc' } });
    const author = adminUser || fallbackUser;

    if (!author) {
        console.error('사용자가 없습니다. 먼저 계정을 생성해주세요.');
        process.exit(1);
    }

    console.log(`작성자: ${author.name} (id: ${author.id}, role: ${author.role})\n`);

    let created = 0;
    for (const p of POSTS) {
        try {
            // like_count, tags는 DB 기본값 사용 (Prisma 클라이언트 버전 호환)
            const baseData = {
                board_type: p.board_type,
                title: p.title,
                content: p.content,
                author_id: author.id,
                author_name: p.author_name || author.name,
                is_pinned: p.is_pinned || false,
                view_count: Math.floor(Math.random() * 150) + 10,
                comment_count: 0,
            };

            // 신규 필드는 Prisma 클라이언트가 아닌 raw SQL로 설정
            const post = await prisma.posts.create({ data: baseData });

            // like_count, tags raw 업데이트
            await prisma.$executeRawUnsafe(
                `UPDATE posts SET like_count = 0, tags = $1 WHERE id = $2`,
                p.tags || '',
                post.id
            );
            console.log(`✓ [${post.board_type}] ${post.title}`);
            created++;
        } catch (e) {
            console.error(`✗ 실패: ${p.title} — ${e.message}`);
        }
    }

    console.log(`\n완료: ${created}/${POSTS.length}개 게시글 생성됨`);
}

main()
    .catch(e => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
