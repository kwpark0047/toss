const prisma = require('../config/prisma');
const CustomerPreference = require('../repositories/CustomerPreference');
const { phoneSearchCandidates } = require('../utils/phoneEncryption');
const logger = require('../utils/logger');

/**
 * 추천 컨텍스트 서비스 — 고객 세그먼트(RFM)/티어 분석을 AI 추천에 연결
 *
 * - store_customers 의 방문/누적금액/등급을 기반으로 RFM 세그먼트를 분류
 * - customer_preferences 의 선호 카테고리/맛/맵기/가격민감도를 컨텍스트로 구성
 * - 최종적으로 AI 프롬프트에 주입 가능한 문자열 컨텍스트를 반환
 */
class RecommendationContextService {
  /**
   * 누적 금액/방문수 기반 RFM 세그먼트 분류
   * @returns {Object} { segment_type, segment_label, description }
   */
  classifySegment(storeCustomer) {
    if (!storeCustomer) {
      return {
        segment_type: 'NEW_VISITOR',
        segment_label: '첫 방문',
        description:
          '이 매장을 처음 방문하는 고객. 첫인상을 결정하는 중요한 순간으로, 인기 메뉴와 대표 메뉴를 우선 추천하는 것이 좋다.',
      };
    }

    const { visit_count = 0, total_spent = 0 } = storeCustomer;

    if (visit_count >= 10 && total_spent >= 150000) {
      return {
        segment_type: 'VIP',
        segment_label: 'VIP 고객',
        description: `누적 ${total_spent.toLocaleString()}원을 지출한 최고 단골 고객. 지난 주문 기반 정밀 개인화와 고가 메뉴도 부담 없이 추천할 수 있다.`,
      };
    }
    if (visit_count >= 5 && total_spent >= 50000) {
      return {
        segment_type: 'FREQUENT',
        segment_label: '단골 고객',
        description: `반복 방문(${visit_count}회)하는 충성 고객. 평소 자주 주문하는 메뉴와 함께 새로운 메뉴를 자연스레 소개하기 좋다.`,
      };
    }
    if (visit_count <= 2) {
      return {
        segment_type: 'NEW_CUSTOMER',
        segment_label: '신규 고객',
        description: `최근 방문(${visit_count}회)이 얼마 없는 고객. 잘 팔리는 인기 메뉴와 대표 메뉴를 중심으로 추천하는 것이 좋다.`,
      };
    }
    return {
      segment_type: 'REGULAR',
      segment_label: '재방문 고객',
      description:
        '꾸준히 방문하는 안정적인 고객. 기존 선호를 유지하면서 다양한 메뉴를 소개해도 좋다.',
    };
  }

  /**
   * 고객별 추천 컨텍스트 구성 (세그먼트 + 선호도 + 티어)
   * @param {number} storeId
   * @param {string} phone
   * @returns {Promise<Object>}
   */
  async buildContext(storeId, phone) {
    const result = {
      segment: null,
      preferences: null,
      tier: null,
    };

    if (!phone) return result;

    try {
      // 1. 매장 고객 기록 (암호화 후보군으로 조회)
      const candidates = phoneSearchCandidates(phone);
      const storeCustomer = await prisma.store_customers.findFirst({
        where: { store_id: parseInt(storeId), customer_phone: { in: candidates } },
      });

      if (storeCustomer) {
        result.segment = this.classifySegment(storeCustomer);
        result.tier = {
          tier_name: storeCustomer.tier || 'GENERAL',
          visit_count: storeCustomer.visit_count,
          total_spent: storeCustomer.total_spent,
        };
      } else {
        result.segment = this.classifySegment(null);
      }

      // 2. 고객 선호도 프로파일 (없으면 자동 생성)
      const profile = await CustomerPreference.findOrCreate(parseInt(storeId), phone).catch(
        () => null
      );
      if (profile) {
        result.preferences = {
          preferred_categories: profile.preferred_categories || [],
          preferred_tastes: profile.preferred_tastes || [],
          spicy_tolerance: profile.spicy_tolerance ?? profile.spiciness_tolerance ?? 1,
          price_sensitivity: profile.price_sensitivity || 'MEDIUM',
          dietary_restrictions: profile.dietary_restrictions || [],
          favorite_items: profile.favorite_items || [],
          order_patterns: profile.order_patterns || {},
        };
      }
    } catch (error) {
      logger.warn({ error: error.message, storeId }, 'Failed to build recommendation context');
    }

    return result;
  }

  /**
   * AI 프롬프트에 주입 가능한 한글 컨텍스트 문자열 생성
   */
  formatContext(ctx) {
    const lines = [];

    if (ctx.segment?.description) {
      lines.push(`고객 세그먼트: ${ctx.segment.segment_label} — ${ctx.segment.description}`);
    }

    if (ctx.preferences) {
      const p = ctx.preferences;
      if (p.preferred_categories?.length) {
        lines.push(`선호 카테고리: ${p.preferred_categories.join(', ')}`);
      }
      if (p.preferred_tastes?.length) {
        lines.push(`선호 맛: ${p.preferred_tastes.join(', ')}`);
      }
      if (p.favorite_items?.length) {
        lines.push(`즐겨찾기 메뉴 ID: ${p.favorite_items.join(', ')}`);
      }
      const priceLabel = {
        LOW: '가격에 민감',
        MEDIUM: '가격 적정 수준 선호',
        HIGH: '가격보다 품질 중시',
      };
      lines.push(`가격 민감도: ${priceLabel[p.price_sensitivity] || p.price_sensitivity}`);
      if (p.dietary_restrictions?.length) {
        lines.push(`알레르기/식이제한: ${p.dietary_restrictions.join(', ')}`);
      }
      const patterns = p.order_patterns || {};
      if (patterns.preferred_hours?.length) {
        lines.push(`주로 방문하는 시간대: ${patterns.preferred_hours.join(', ')}시`);
      }
      if (patterns.avg_order_value) {
        lines.push(`평균 주문 금액: ${patterns.avg_order_value.toLocaleString()}원`);
      }
    }

    if (ctx.tier) {
      lines.push(
        `고객 등급: ${ctx.tier.tier_name} (방문 ${ctx.tier.visit_count}회, 누적 ${ctx.tier.total_spent.toLocaleString()}원)`
      );
    }

    if (lines.length === 0) return '';

    return lines.join(', ');
  }
}

module.exports = new RecommendationContextService();
