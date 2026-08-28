import prisma from '../config/prisma.js';
import logger from './logger.js';

/** `{{var}}` 치환 (값 없으면 빈 문자열) */
function render(str: string, vars: Record<string, any> = {}): string {
  return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : ''
  );
}

/**
 * 매장 활성 템플릿을 조회해 렌더한 { title, message } 반환. 없으면 null.
 * @param {number|string} storeId
 * @param {string} type   NEW_ORDER | ORDER_STATUS | LOW_STOCK | NEW_REVIEW ...
 * @param {object} vars   치환 변수
 */
export async function resolveTemplate(storeId: number | string, type: string, vars: Record<string, any> = {}): Promise<{ title: string; message: string } | null> {
  try {
    const tpl = await prisma.notification_templates.findFirst({
      where: {
        type,
        is_active: true,
        OR: [{ store_id: Number(storeId) }, { store_id: null }],
      },
      // 매장 전용(store_id 비 null)을 전역보다 우선
      orderBy: { store_id: { sort: 'desc', nulls: 'last' } },
    });
    if (!tpl) return null;
    return { title: render(tpl.title, vars), message: render(tpl.message, vars) };
  } catch (err: any) {
    logger.warn(`[notificationTemplate] ${type} 조회 실패: ${err.message}`);
    return null; // 실패 시 기본 문구로 폴백
  }
}

export const render = (str: string, vars: Record<string, any> = {}): string => {
  return String(str || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) =>
    vars[key] != null ? String(vars[key]) : ''
  );
};

export default { resolveTemplate, render };