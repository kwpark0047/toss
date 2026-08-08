import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * TTS(음성 합성) 훅
 * Web Speech API의 speechSynthesis를 사용하여 텍스트를 음성으로 변환
 */
export function useTTS() {
  const { i18n } = useTranslation();
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef(null);
  const voicesLoadedRef = useRef(false);

  // 음성 목록 로드 대기
  const ensureVoicesLoaded = useCallback(() => {
    return new Promise((resolve) => {
      if (voicesLoadedRef.current) {
        resolve();
        return;
      }
      const synth = window.speechSynthesis;
      if (synth.getVoices().length > 0) {
        voicesLoadedRef.current = true;
        resolve();
        return;
      }
      synth.onvoiceschanged = () => {
        voicesLoadedRef.current = true;
        resolve();
      };
    });
  }, []);

  /**
   * 텍스트를 음성으로 재생
   * @param {string} text - 읽을 텍스트
   * @param {Object} options - 옵션
   * @param {string} options.lang - 언어 코드 (기본: 현재 i18n 언어)
   * @param {number} options.rate - 속도 (0.1~10, 기본: 1)
   * @param {number} options.pitch - 음높이 (0~2, 기본: 1)
   * @param {number} options.volume - 볼륨 (0~1, 기본: 1)
   */
  const speak = useCallback(
    async (text, options = {}) => {
      if (!text || !window.speechSynthesis) return;

      await ensureVoicesLoaded();

      // 이전 발화 중단
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = options.lang || i18n.language || 'ko-KR';
      utterance.rate = options.rate ?? 1;
      utterance.pitch = options.pitch ?? 1;
      utterance.volume = options.volume ?? 1;

      // 한국어 음성 우선 선택
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find((v) => v.lang.startsWith('ko'));
      if (koVoice) utterance.voice = koVoice;

      utteranceRef.current = utterance;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [ensureVoicesLoaded, i18n.language]
  );

  /**
   * 현재 재생 중인 음성 중단
   */
  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  return { speak, cancel, speaking };
}

export default useTTS;
