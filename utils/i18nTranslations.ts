/**
 * i18nTranslations.ts — 알림톡/영수증/알림 다국어 번역 사전 (ko/en/ja/zh)
 *
 * 사용 예:
 *   const { t } = require('./i18n');
 *   t('alimtalk.WAITING_REG', 'en', { storeName: 'Cafe', waitingNumber: 5 });
 *
 * 번역 키 구조:
 *   alimtalk.{TEMPLATE_CODE}         — 카카오 알림톡 템플릿
 *   notifications.{TYPE}              — DB 알림 (Socket/FCM)
 *   status.{statusKey}              — 주문/웨이팅 상태 라벨
 *   receipt.{key}                   — 영수증 문구
 *   common.{key}                    — 공통 문구
 */

const translations = {
  ko: {
    alimtalk: {
      WAITING_REG: {
        title: '웨이팅 등록 완료',
        message: '{{storeName}}에 웨이팅 등록되었습니다. 대기 번호 {{waitingNumber}} (앞 {{waitingCount}}팀)',
      },
      WAITING_READY: {
        title: '입장 순서 안내',
        message: '{{storeName}}에서 입장 순서가 되었습니다. (대기 번호 {{waitingNumber}})',
      },
      WAITING_CALL: {
        title: '입장 호출',
        message: '{{storeName}}에서 입장 요청이 도착했습니다. (대기 번호 {{waitingNumber}})',
      },
      WAITING_CANCEL: {
        title: '웨이팅 취소',
        message: '{{storeName}}의 웨이팅이 취소되었습니다.',
      },
      ORDER_CONFIRMED: {
        title: '주문 접수 확인',
        message: '{{storeName}}에 주문이 접수되었습니다. 주문번호 {{orderNumber}} ({{queueNumber}}번) - {{totalAmount}}원',
      },
      FOOD_READY: {
        title: '음식 준비 완료',
        message: '{{storeName}} 주문 {{orderNumber}} ({{tableName}} 테이블) 음식이 준비되었습니다.',
      },
      ORDER_CANCELLED: {
        title: '주문 취소',
        message: '{{storeName}} 주문 {{orderNumber}} 이 취소되었습니다. 사유: {{reason}}',
      },
    },
    notifications: {
      NEW_ORDER: {
        title: '🛎️ 새 주문 접수',
        message: '{{tableName}}에서 주문이 들어왔습니다. (주문번호: {{orderNumber}})',
      },
      ORDER_STATUS: {
        title: '{{icon}} 주문 {{statusLabel}}',
        message: '주문 #{{orderNumber}} 상태가 "{{statusLabel}}"(으)로 변경되었습니다.',
      },
      LOW_STOCK: {
        title: '⚠️ 재고 부족 경고',
        message: '"{{productName}}" 재고가 {{stock}}개 남았습니다. 재고를 보충해주세요.',
      },
      NEW_REVIEW: {
        title: '💬 새 리뷰 등록',
        message: '{{stars}} {{rating}}점 — "{{content}}"',
      },
      MANAGER_CALL: {
        title: '🙋 매니저 호출',
        message: '{{tableName}}님이 {{callTypeLabel}}을 요청했습니다.',
      },
      SETTLEMENT: {
        title: '💰 정산 보고서 생성',
        message: '정산 완료 — 순수익 ₩{{netAmount}}',
      },
      NEW_RESERVATION: {
        title: '📅 새 예약 신청',
        message: '{{customerName}}({{partySize}}명) — {{reservationTime}} 예약',
      },
    },
    status: {
      pending: '대기중',
      confirmed: '주문확인',
      preparing: '조리중',
      ready: '준비완료',
      completed: '완료',
      cancelled: '취소',
    },
    callType: {
      help: '도움',
      bill: '계산',
      manager: '매니저',
    },
    receipt: {
      title: '주문 영수증',
      orderNumber: '주문번호',
      date: '날짜',
      items: '상품 내역',
      subtotal: '상품 금액',
      tax: '세액',
      total: '총 금액',
      paymentMethod: '결제 수단',
      card: '신용카드',
      cash: '현금',
      thankYou: '이용해 주셔서 감사합니다.',
    },
    common: {
      cancel: '취소',
      confirm: '확인',
      ok: '확인',
    },
  },

  en: {
    alimtalk: {
      WAITING_REG: {
        title: 'Waiting Registered',
        message: 'Waiting registered at {{storeName}}. Number {{waitingNumber}} ({{waitingCount}} teams ahead)',
      },
      WAITING_READY: {
        title: 'Your Turn',
        message: 'It\'s your turn at {{storeName}}. (Waiting number {{waitingNumber}})',
      },
      WAITING_CALL: {
        title: 'Seating Call',
        message: '{{storeName}} is calling you. (Waiting number {{waitingNumber}})',
      },
      WAITING_CANCEL: {
        title: 'Waiting Cancelled',
        message: 'Your waiting at {{storeName}} has been cancelled.',
      },
      ORDER_CONFIRMED: {
        title: 'Order Confirmed',
        message: 'Order received at {{storeName}}. Order #{{orderNumber}} (Queue {{queueNumber}}) - {{totalAmount}}',
      },
      FOOD_READY: {
        title: 'Food Ready',
        message: '{{storeName}} Order {{orderNumber}} (Table {{tableName}}) is ready.',
      },
      ORDER_CANCELLED: {
        title: 'Order Cancelled',
        message: 'Order {{orderNumber}} at {{storeName}} has been cancelled. Reason: {{reason}}',
      },
    },
    notifications: {
      NEW_ORDER: {
        title: '🛎️ New Order',
        message: 'New order from {{tableName}}. (Order #{{orderNumber}})',
      },
      ORDER_STATUS: {
        title: '{{icon}} Order {{statusLabel}}',
        message: 'Order #{{orderNumber}} status changed to "{{statusLabel}}".',
      },
      LOW_STOCK: {
        title: '⚠️ Low Stock Alert',
        message: '"{{productName}}" has only {{stock}} items left. Please restock.',
      },
      NEW_REVIEW: {
        title: '💬 New Review',
        message: '{{stars}} {{rating}} — "{{content}}"',
      },
      MANAGER_CALL: {
        title: '🙋 Manager Call',
        message: '{{tableName}} requested {{callTypeLabel}}.',
      },
      SETTLEMENT: {
        title: '💰 Settlement Report',
        message: 'Settlement complete — Net profit ₩{{netAmount}}',
      },
      NEW_RESERVATION: {
        title: '📅 New Reservation',
        message: '{{customerName}} ({{partySize}} people) — {{reservationTime}}',
      },
    },
    status: {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      completed: 'Completed',
      cancelled: 'Cancelled',
    },
    callType: {
      help: 'Help',
      bill: 'Bill',
      manager: 'Manager',
    },
    receipt: {
      title: 'Order Receipt',
      orderNumber: 'Order #',
      date: 'Date',
      items: 'Items',
      subtotal: 'Subtotal',
      tax: 'Tax',
      total: 'Total',
      paymentMethod: 'Payment Method',
      card: 'Credit Card',
      cash: 'Cash',
      thankYou: 'Thank you for your visit.',
    },
    common: {
      cancel: 'Cancel',
      confirm: 'Confirm',
      ok: 'OK',
    },
  },

  ja: {
    alimtalk: {
      WAITING_REG: {
        title: 'ウェイティング登録完了',
        message: '{{storeName}}にウェイティング登録されました。番号 {{waitingNumber}} (前に{{waitingCount}}チーム)',
      },
      WAITING_READY: {
        title: '入場順通知',
        message: '{{storeName}}で入場順になりました。(番号 {{waitingNumber}})',
      },
      WAITING_CALL: {
        title: '入場呼出',
        message: '{{storeName}}から入場リクエストが届きました。(番号 {{waitingNumber}})',
      },
      WAITING_CANCEL: {
        title: 'ウェイティングキャンセル',
        message: '{{storeName}}のウェイティングがキャンセルされました。',
      },
      ORDER_CONFIRMED: {
        title: '注文確認',
        message: '{{storeName}}に注文が届きました。注文番号 {{orderNumber}} ({{queueNumber}}番) - {{totalAmount}}円',
      },
      FOOD_READY: {
        title: '料理完成',
        message: '{{storeName}} 注文 {{orderNumber}} (テーブル {{tableName}}) の料理が完成しました。',
      },
      ORDER_CANCELLED: {
        title: '注文キャンセル',
        message: '{{storeName}} 注文 {{orderNumber}} がキャンセルされました。理由: {{reason}}',
      },
    },
    notifications: {
      NEW_ORDER: {
        title: '🛎️ 新規注文',
        message: '{{tableName}}から新規注文が届きました。(注文番号: {{orderNumber}})',
      },
      ORDER_STATUS: {
        title: '{{icon}} 注文{{statusLabel}}',
        message: '注文 #{{orderNumber}} のステータスが "{{statusLabel}}" に変更されました。',
      },
      LOW_STOCK: {
        title: '⚠️ 在庫不足アラート',
        message: '"{{productName}}" の在庫が{{stock}}個 remaining。補充してください。',
      },
      NEW_REVIEW: {
        title: '💬 新規レビュー',
        message: '{{stars}} {{rating}} — "{{content}}"',
      },
      MANAGER_CALL: {
        title: '🙋 マネージャー呼出',
        message: '{{tableName}}が{{callTypeLabel}}をリクエストしました。',
      },
      SETTLEMENT: {
        title: '💰 決算レポート',
        message: '決算完了 — 純利益 ₩{{netAmount}}',
      },
      NEW_RESERVATION: {
        title: '📅 新規予約',
        message: '{{customerName}} ({{partySize}}人) — {{reservationTime}} 予約',
      },
    },
    status: {
      pending: '保留中',
      confirmed: '確認済み',
      preparing: '調理中',
      ready: '準備完了',
      completed: '完了',
      cancelled: 'キャンセル',
    },
    callType: {
      help: 'ヘルプ',
      bill: '請求書',
      manager: 'マネージャー',
    },
    receipt: {
      title: '注文レシート',
      orderNumber: '注文番号',
      date: '日付',
      items: '商品内訳',
      subtotal: '小計',
      tax: '税金',
      total: '合計',
      paymentMethod: '支払い方法',
      card: 'クレジットカード',
      cash: '現金',
      thankYou: 'ご利用いただきありがとうございます。',
    },
    common: {
      cancel: 'キャンセル',
      confirm: '確認',
      ok: 'OK',
    },
  },

  zh: {
    alimtalk: {
      WAITING_REG: {
        title: '等待注册完成',
        message: '已在{{storeName}}注册等待。号码 {{waitingNumber}} (前面{{waitingCount}}队)',
      },
      WAITING_READY: {
        title: '轮到您',
        message: '您在{{storeName}}的轮次已到。(等待号 {{waitingNumber}})',
      },
      WAITING_CALL: {
        title: '入座呼叫',
        message: '{{storeName}}呼叫您入座。(等待号 {{waitingNumber}})',
      },
      WAITING_CANCEL: {
        title: '等待取消',
        message: '{{storeName}}的等待已取消。',
      },
      ORDER_CONFIRMED: {
        title: '订单确认',
        message: '{{storeName}}收到订单。订单号 {{orderNumber}} (队列 {{queueNumber}}) - {{totalAmount}}元',
      },
      FOOD_READY: {
        title: '食物准备完成',
        message: '{{storeName}} 订单 {{orderNumber}} ({{tableName}}桌) 的食物已准备好。',
      },
      ORDER_CANCELLED: {
        title: '订单取消',
        message: '{{storeName}} 订单 {{orderNumber}} 已取消。原因: {{reason}}',
      },
    },
    notifications: {
      NEW_ORDER: {
        title: '🛎️ 新订单',
        message: '{{tableName}}来了新订单。(订单号: {{orderNumber}})',
      },
      ORDER_STATUS: {
        title: '{{icon}} 订单{{statusLabel}}',
        message: '订单 #{{orderNumber}} 状态已更改为 "{{statusLabel}}"。',
      },
      LOW_STOCK: {
        title: '⚠️ 库存不足警告',
        message: '"{{productName}}" 仅剩 {{stock}} 件。请补充库存。',
      },
      NEW_REVIEW: {
        title: '💬 新评论',
        message: '{{stars}} {{rating}} — "{{content}}"',
      },
      MANAGER_CALL: {
        title: '🙋 呼叫管理员',
        message: '{{tableName}} 请求{{callTypeLabel}}。',
      },
      SETTLEMENT: {
        title: '💰 结算报告',
        message: '结算完成 — 净利润 ₩{{netAmount}}',
      },
      NEW_RESERVATION: {
        title: '📅 新预约',
        message: '{{customerName}} ({{partySize}}人) — {{reservationTime}} 预约',
      },
    },
    status: {
      pending: '待处理',
      confirmed: '已确认',
      preparing: '准备中',
      ready: '已就绪',
      completed: '已完成',
      cancelled: '已取消',
    },
    callType: {
      help: '帮助',
      bill: '结账',
      manager: '经理',
    },
    receipt: {
      title: '订单收据',
      orderNumber: '订单号',
      date: '日期',
      items: '商品明细',
      subtotal: '小计',
      tax: '税费',
      total: '总计',
      paymentMethod: '支付方式',
      card: '信用卡',
      cash: '现金',
      thankYou: '感谢您的光临。',
    },
    common: {
      cancel: '取消',
      confirm: '确认',
      ok: '确定',
    },
  },
};

export const translations = {
  ko,
  en,
  ja,
  zh,
};

/**
 * 번역 함수
 * @param {string} key  - 점(.)으로 구분된 키 (예: "alimtalk.WAITING_REG")
 * @param {string} lang - 언어 코드 (ko/en/ja/zh)
 * @param {object} vars - {{var}} 치환 변수
 * @returns {string} 번역된 문자열 (폴백: 키 그대로)
 */
export function t(key: string, lang: string = 'ko', vars: Record<string, any> = {}): string {
  const langDict = translations[lang as keyof typeof translations] || translations.ko;
  const parts = key.split('.');
  let value: any = langDict;

  for (const part of parts) {
    if (value && typeof value === 'object' && part in value) {
      value = value[part];
    } else {
      return key; // 키를 찾지 못하면 키 그대로 반환
    }
  }

  if (typeof value !== 'string') return key;

  // {{var}} 치환
  return value.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : ''
  );
}

/**
 * 알림톡 템플릿 번역 조회
 * @param {string} templateCode - 템플릿 코드 (예: "WAITING_REG")
 * @param {string} lang - 언어 코드
 * @param {object} vars - 치환 변수
 * @returns {{title: string, message: string}}
 */
export function getAlimtalkTemplate(templateCode: string, lang: string = 'ko', vars: Record<string, any> = {}): { title: string; message: string } {
  const baseKey = `alimtalk.${templateCode}`;
  return {
    title: t(`${baseKey}.title`, lang, vars),
    message: t(`${baseKey}.message`, lang, vars),
  };
}

/**
 * DB 알림 번역 조회
 * @param {string} type - 알림 타입 (예: "NEW_ORDER")
 * @param {string} lang - 언어 코드
 * @param {object} vars - 치환 변수
 * @returns {{title: string, message: string}}
 */
export function getNotificationTemplate(type: string, lang: string = 'ko', vars: Record<string, any> = {}): { title: string; message: string } {
  const baseKey = `notifications.${type}`;
  return {
    title: t(`${baseKey}.title`, lang, vars),
    message: t(`${baseKey}.message`, lang, vars),
  };
}

export const translations: typeof translations;