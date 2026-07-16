/* eslint-disable react-refresh/only-export-components */
import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Wing, Spark, speak } from './WizardTinkerbell';
import { getBtypeLabel } from './BusinessTypePicker';

const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

export function getStep1Guide(focus, form, customBtype) {
  const nameDone  = form.name.trim().length > 0;
  const btypeDone = form.business_type && (form.business_type !== '__custom__' || customBtype.trim().length > 0);
  const btypeLabel = getBtypeLabel(form.business_type, customBtype);

  switch (focus) {
    case 'name':
      return nameDone
        ? { msg: pickRandom([
            `"${form.name}" 멋진 이름이에요! ✨ 이제 업종을 선택해주세요.`,
            `좋아요! "${form.name}" 완성! 업종도 골라볼까요?`,
            `"${form.name}"은 고객 마음에 쏙 들 것 같아요! 다음은 업종 선택이에요.`,
          ]), happy: true }
        : { msg: pickRandom([
            '고객들에게 보일 매장 이름을 입력해주세요! ✏️',
            '기억하기 쉬운 매장 이름을 지어보세요!',
            '사장님만의 특별한 매장 이름을 알려주세요!',
          ]), happy: false };
    case 'business_type':
      return btypeDone
        ? { msg: pickRandom([
            `${btypeLabel} 업종 완료! 이제 영업 시간을 설정해주세요.`,
            `${btypeLabel}이군요! AI가 딱 맞는 메뉴를 추천해드릴게요. 영업 시간도 입력해볼까요?`,
            `좋은 선택이에요! ${btypeLabel}에 최적화된 서비스로 도와드릴게요.`,
          ]), happy: true }
        : { msg: pickRandom([
            '어떤 업종의 사장님이신가요? 검색하거나 목록에서 골라보세요! 😊',
            '업종을 선택하면 AI가 딱 맞는 메뉴를 추천해드려요!',
            '카페? 식당? 미용실? 어떤 업종을 운영하시나요?',
          ]), happy: false };
    case 'time':
      return { msg: pickRandom([
        '영업 시간을 설정해주세요. 오픈·마감 시간을 모두 입력해주세요!',
        '몇 시에 문을 열고 닫으시나요? 고객이 영업 여부를 확인할 수 있어요.',
        '영업 시간을 입력하면 손님들이 헛걸음 안 해도 돼요!',
      ]), happy: false };
    case 'phone':
      return { msg: pickRandom([
        '연락처를 입력하면 고객이 전화로 문의할 수 있어요. (선택사항)',
        '고객 문의 전화번호를 입력해주세요! 없으면 건너뛰셔도 됩니다.',
        '전화 주문도 받으신다면 번호를 꼭 입력해두세요!',
      ]), happy: false };
    case 'address':
      return { msg: pickRandom([
        '매장 주소를 입력하면 지도에서 찾을 수 있어요! (선택사항)',
        '주소를 입력하면 손님들이 더 쉽게 찾아올 수 있어요.',
        '매장 위치를 알려주면 지역 검색에서 노출될 수 있어요!',
      ]), happy: false };
    case 'description':
      return { msg: pickRandom([
        '매장을 한 줄로 소개해보세요! 첫인상이 중요하답니다. ✨ (선택사항)',
        '어떤 매장인지 한 줄로 설명해보세요. 예: "직접 볶은 원두로 내린 스페셜티 커피"',
        '매력적인 소개 문구 하나가 단골 손님을 만들어요!',
      ]), happy: false };
    default:
      if (!nameDone)  return { msg: pickRandom([
        '먼저 매장 이름을 입력해주세요! 아래 이름 칸을 클릭해보세요 😊',
        '매장 이름 칸을 눌러주세요! 첫 번째 단계예요.',
      ]), happy: false };
      if (!btypeDone) return { msg: pickRandom([
        '업종을 선택해주세요! 업종별 AI 메뉴 추천이 달라져요.',
        '어떤 종류의 매장인지 골라주세요! AI가 최적의 도움을 드릴게요.',
      ]), happy: false };
      return { msg: pickRandom([
        `"${form.name}" 정보 준비 완료! 저장 버튼을 눌러주세요! 🎉`,
        `완벽해요! 이제 저장만 하면 메뉴 등록으로 넘어가요!`,
        `멋진 매장 정보네요! 저장 버튼을 눌러볼까요?`,
      ]), happy: true };
  }
}

export default function Step1InlineGuide({ focus, form, customBtype, voiceEnabled }) {
  const { msg, happy } = getStep1Guide(focus, form, customBtype);
  const [typed, setTyped]   = useState('');
  const [sparks, setSparks] = useState([]);
  const typingRef  = useRef(null);
  const sparkId    = useRef(0);
  const prevFocus  = useRef(null);

  // 타이핑 애니메이션
  useEffect(() => {
    clearInterval(typingRef.current);
    setTyped('');
    let i = 0;
    typingRef.current = setInterval(() => {
      i++;
      setTyped(msg.slice(0, i));
      if (i >= msg.length) clearInterval(typingRef.current);
    }, 26);
    return () => clearInterval(typingRef.current);
  }, [msg]);

  // 음성: focus 전환 시만
  useEffect(() => {
    if (focus !== prevFocus.current) {
      prevFocus.current = focus;
      const g = getStep1Guide(focus, form, customBtype);
      speak(g.msg, voiceEnabled);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus, voiceEnabled]);

  // 해피 sparks
  useEffect(() => {
    if (!happy) return;
    const s = Array.from({ length: 7 }, () => ({
      id: sparkId.current++,
      x: 4 + Math.random() * 44, y: -4 + Math.random() * 44,
      size: 6 + Math.random() * 6, angle: Math.random() * 360,
    }));
    setSparks(s);
    const t = setTimeout(() => setSparks([]), 1100);
    return () => clearTimeout(t);
  }, [happy, focus]);

  return (
    <div className="flex items-center gap-3 mb-5 px-3 py-3 bg-gradient-to-r from-amber-500/[0.08] to-orange-500/[0.05] rounded-2xl border border-amber-500/20">
      {/* 소형 팅커벨 요정 */}
      <div className="relative flex-shrink-0 w-[54px] h-[54px]">
        {sparks.map(s => <Spark key={s.id} {...s} />)}
        <motion.div className="relative w-[54px] h-[54px]"
          animate={happy
            ? { y:[0,-14,2,-7,0], scale:[1,1.13,0.93,1.05,1] }
            : { y:[-3,5,-3], rotate:[-2.5,2.5,-2.5] }}
          transition={happy
            ? { duration:0.6, ease:'easeInOut' }
            : { duration:3.2, repeat:Infinity, ease:'easeInOut' }}>
          <motion.div className="absolute inset-0 -m-2 rounded-full"
            style={{ background:'radial-gradient(circle, rgba(245,159,11,.55) 0%, rgba(245,159,11,.18) 50%, transparent 72%)' }}
            animate={{ scale:[1,1.2,1], opacity:[0.55,0.95,0.55] }}
            transition={{ duration:2.3, repeat:Infinity, ease:'easeInOut' }} />
          <Wing side="left" /><Wing side="right" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[34px] h-[34px] rounded-full flex items-center justify-center"
            style={{ background:'radial-gradient(circle at 34% 28%, #FFF8E7, #F59E0B 62%, #D97706)', boxShadow:'0 3px 14px rgba(245,159,11,.6), 0 0 0 1.5px rgba(255,255,255,.2)' }}>
            <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
              <path d="M12 2l1.8 6.6c.2.7.8 1.3 1.5 1.5L22 12l-6.7 1.9c-.7.2-1.3.8-1.5 1.5L12 22l-1.8-6.6c-.2-.7-.8-1.3-1.5-1.5L2 12l6.7-1.9c.7-.2 1.3-.8 1.5-1.5L12 2z" />
            </svg>
          </div>
        </motion.div>
      </div>
      {/* 말풍선 텍스트 */}
      <div className="flex-1 min-h-[36px] flex items-center">
        <AnimatePresence mode="wait">
          <motion.p key={msg.slice(0, 14)} initial={{ opacity:0, y:4 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0 }}
            className="text-[13px] font-bold text-white leading-relaxed">
            {typed}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  );
}
