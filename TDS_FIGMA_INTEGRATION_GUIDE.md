# WeMarket × TDS (Toss Design System) Figma 연동 가이드

> **목적**: WeMarket 프로젝트에서 토스 디자인 시스템(TDS) Figma 라이브러리를 팀 공용으로 연동하고, 디자인→개발 핸드오프 워크플로우를 표준화한다.

---

## 1. 라이브러리 다운로드 및 설치

### 1.1 파일 다운로드
- **파일명**: `TDS_Mobile_for_Apps_in_Toss_(2602-3-2).fig`
- **다운로드 경로**: [토스 개발자 센터 > 디자인 도구 > 피그마](https://developers-apps-in-toss.toss.im/design/prepare/design.md)
- **버전**: 2602-3-2 (2026년 기준 최신)

### 1.2 Figma에 임포트
```
1. 피그마 실행 → 상단 메뉴 [File] → [Import] 클릭
2. 다운로드한 `.fig` 파일 선택 또는 드래그&드롭
3. Drafts 폴더 또는 지정 프로젝트에 파일 생성 확인
```

### 1.3 라이브러리 퍼블리시 (팀 공용)
```
1. 임포트된 파일 열기 → 왼쪽 패널 [Assets] 탭
2. 우측 상단 📚 아이콘 클릭 → [Manage libraries] 창 열기
3. 파일 옆 [Publish] 버튼 클릭
4. "이 파일을 라이브러리로 사용" 설정 → [Publish] 완료
```

> ⚠️ **Publish 전**: 다운로드 파일 내부에서만 사용 가능  
> ✅ **Publish 후**: 팀 내 모든 피그마 디자인 파일에서 Assets 패널 통해 사용 가능

### 1.4 팀 라이브러리 연결
```
1. 작업할 디자인 파일 열기 → [Assets] 탭
2. 라이브러리 목록에서 `TDS Mobile for Apps in Toss` 찾기
3. 비활성화 상태라면 [Add to file] 클릭하여 활성화
4. Assets 탭에서 버튼, 아이콘, 색상, 타이포그래피 등 컴포넌트 드래그 사용
```

---

## 2. WeMarket 전용 설정

### 2.1 브랜드 스타일 적용 (앱빌더 연동 시)
```
앱빌더 프로젝트 생성 시:
- 서비스명: WeMarket
- 버튼 색상(Primary): #f97316 (WeMarket 브랜드 오렌지)
- 자동 접근성 보정: WCAG AA 대비 만족하도록 자동 조정됨
```

### 2.2 WeMarket 전용 프리셋 매핑
| WeMarket 프리셋 | TDS 컴포넌트 매핑 | 비고 |
|----------------|-------------------|------|
| `classic-orange` (기본) | TDS Primary Color → `#f97316` | 브랜드 컬러 직접 매핑 |
| `warm-cocoa` | TDS Color Token 커스텀 | 카페 컨셉 |
| `forest-green` | TDS Color Token 커스텀 | 친환경/자연 |
| `royal-purple` | TDS Color Token 커스텀 | 고급 레스토랑 |
| `ocean-breeze` | TDS Color Token 커스텀 | 시원한 바다 |
| `sunset-rose` | TDS Color Token 커스텀 | 로맨틱/카페 |

> 💡 **코드 연동**: `frontend/src/lib/themePresets.js`의 `THEME_PRESETS` 배열과 1:1 대응

---

## 3. 핵심 컴포넌트 매핑표 (디자인→코드)

| 화면/영역 | TDS 컴포넌트 | WeMarket 코드 컴포넌트 | 상태 |
|-----------|-------------|------------------------|------|
| **고객 메뉴판** | | | |
| 메뉴 리스트 행 | `🔵 Mobile_ListRow` (L padding) | `MenuItemCard` | ✅ 완료 |
| 카테고리 탭 | `Tab` / `Segment` | `CategoryTabs` | 🔄 예정 |
| 장바구니 모달 | `BottomSheet` + `ListRow` | `CartModal` | 🔄 예정 |
| 헤더 | `Navigation` + `Top` | `MenuHeader` | 🔄 예정 |
| **관리자** | | | |
| 레이아웃 | `Navigation` + `Sidebar` + `Screen` | `AdminLayout` | 🔄 예정 |
| 테마 설정 | `Panel` + `Select` + `ColorPicker` | `BusinessSettingsWithTheme` | 🔄 예정 |
| 메뉴 빌더 | `Panel` + `ListRow` + `Input` | `MenuBuilder` | 🔄 예정 |
| 대시보드 | `Screen` + `Card` + `Table` | `AnalyticsDashboard` | 🔄 예정 |
| **공통** | | | |
| 버튼 | `Button` (Primary/Secondary/Ghost) | `Button` | 🔄 예정 |
| 인풋/셀렉트 | `Input` / `Select` / `Combobox` | 다양한 폼 | 🔄 예정 |
| 다이얼로그/시트 | `Dialog` / `Sheet` / `Drawer` | 모달류 | 🔄 예정 |
| 토스트/알림 | `Toast` / `Alert` | `Sonner` 기반 | 🔄 예정 |
| 배지 | `Badge` | `.tds-badge-*` | ✅ CSS 완료 |
| 아바타 | `Avatar` | `Avatar` | 🔄 예정 |
| 스켈레톤 | `Skeleton` | `.skeleton` | ✅ CSS 완료 |

---

## 4. 디자인 워크플로우 규칙 (TDS 준수)

### 4.1 캔버스 설정
- **가로 375px 고정** (iPhone 13 mini 기준)
- 다른 크기 작업 시 `❖ Keypad` 등 반응형 미지원 컴포넌트에서 문제 발생 가능

### 4.2 속성 조작 원칙
- **오른쪽 패널에서만 속성 변경** (색상, 텍스트, 간격, 레이아웃)
- 캔버스에서 직접 수정 시 → 코드에 없는 속성 생성 → 개발 구현 불가/지연

### 4.3 레이아웃 구성 원칙
```
모든 화면 최상단: ❖ Navigation (필수)
  └ 바로 아래: 🌈 Screen 래퍼 사용 권장 (Navigation 포함)

주요 콘텐츠: ❖ ListRow (S/M/L/XL 패딩 옵션)
  ├ 기본 패딩 내장 → gap 없이 붙여도 자연스러움
  └ 추가 간격 필요 시 → 오토레이아웃 gap만 사용
```

### 4.4 타이포그래피 (TDS 2단계)
| 텍스트 종류 | TDS 명칭 | WeMarket 클래스 | 용도 |
|------------|----------|----------------|------|
| 본문/메뉴명/가격 | **포스트형** (Bold 15px) | `.menu-name`, `.menu-price` | 제목·강조 |
| 설명/보조 | **일반형** (Regular 12px) | `.menu-desc` | 설명·캡션 |
| 배지/메타 | **스몰** (11px) | `.menu-badge`, `.tds-small` | NEW/인기/타임스탬프 |

### 4.5 아이콘 사용
- **토스 제공 그래픽만 사용** (리소스 패널에서 선택)
- 외부 아이콘(lucide-react 등) 사용 금지
- WeMarket 코드: `Icon` 래퍼 컴포넌트 사용 (`size="sm|md|lg"`, `color="primary|muted|destructive"`)

### 4.6 간격 시스템 (Stack Layout)
- **임의 margin/padding 금지**
- **오토레이아웃 gap/padding만 사용**
- TDS 스케일: 4/8/12/16/24/32/48/64px

---

## 5. 핸드오프 체크리스트 (디자이너 → 개발자)

### 5.1 디자인 완료 시 필수 확인
- [ ] 모든 화면 375px 가로 기준
- [ ] Navigation + Screen 구조 준수
- [ ] 오른쪽 패널 속성만으로 스타일링 (캔버스 직접 수정 없음)
- [ ] ListRow 패딩(S/M/L/XL) 명시
- [ ] 타이포그래피: 포스트형/일반형만 사용
- [ ] 아이콘: TDS 제공 그래픽만 사용
- [ ] 간격: 오토레이아웃 gap/padding만 사용
- [ ] 컴포넌트 상태: default/hover/active/focus/disabled 모두 정의

### 5.2 개발자 전달 자료
- [ ] Figma 파일 링크 (라이브러리 연결된 상태)
- [ ] 프로토타입 링크 (플레이 버튼 → 공유)
- [ ] 화면별 컴포넌트 매핑표 (위 표 참고)
- [ ] 커스텀 색상/토큰 값 (CSS 변수명 매핑)

---

## 6. 버전 관리 및 업데이트

### 6.1 라이브러리 업데이트 시
```
1. 토스 개발자 센터 공지 확인
2. 새 버전 `.fig` 파일 다운로드
3. 기존 파일 덮어쓰기 임포트 (또는 새 파일 임포트 후 교체)
4. 라이브러리 재퍼블리시
5. 팀 전체 알림 → 디자인 파일에서 라이브러리 업데이트 수락
```

### 6.2 자동 업데이트 불가 주의
> ⚠️ **자동 업데이트는 지원되지 않음**  
> 새 버전 출시 시 수동으로 파일 다운로드 → 재퍼블리시 필요  
> 새 버전 출시 시 공지 채널 통해 안내 예정

---

## 7. 참고 링크

| 구분 | 링크 |
|------|------|
| TDS 공식 가이드 | https://developers-apps-in-toss.toss.im/design/prepare/design.md |
| 피그마 UI 라이선스 | https://developers-apps-in-toss.toss.im/design/prepare/figma-ui-license.html |
| 개발자 커뮤니티 | https://techchat-apps-in-toss.toss.im/ |
| 앱빌더 콘솔 | https://developers-apps-in-toss.toss.im/prepare/console-workspace.html |

---

## 8. 문의 채널

| 구분 | 채널 |
|------|------|
| 컴포넌트 동작 문의 | [개발자 커뮤니티](https://techchat-apps-in-toss.toss.im/) |
| 컴포넌트 요청/제안 | 채널톡 (토스 개발자 센터 내) |
| 라이선스/법적 문의 | 개발자 센터 문의하기 |

---

*최종 업데이트: 2026-08-20*  
*작성: WeMarket Design System Team*  
*버전: 1.0 (TDS 2602-3-2 기준)*