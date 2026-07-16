/**
 * useMotionSafe — 저사양 기기 및 모션 감소 설정 감지
 *
 * 반환값:
 *   isReducedMotion — OS 수준 애니메이션 감소 설정 (prefers-reduced-motion)
 *   isLowSpec       — 저사양 기기 신호 감지 (CPU코어 ≤2 또는 RAM ≤2GB 또는 연결 2g/3g)
 *   isAnimationSafe — 애니메이션을 안전하게 실행해도 되는 경우 true
 *   motionIntensity — 'full'|'reduced'|'none'
 */
import { useState, useEffect } from 'react';

const detectLowSpec = () => {
    if (typeof navigator === 'undefined') return false;

    const cores  = navigator.hardwareConcurrency ?? 4;
    const memory = navigator.deviceMemory;                        // GB, Chrome only
    const conn   = navigator.connection?.effectiveType;           // '2g'|'3g'|'4g'
    const saveData = navigator.connection?.saveData;              // 데이터 절약 모드

    const isSlowCPU    = cores  <= 2;
    const isLowMemory  = memory !== undefined && memory <= 2;
    const isSlowNet    = conn === '2g' || conn === 'slow-2g';
    const isSaveData   = saveData === true;

    return isSlowCPU || isLowMemory || isSlowNet || isSaveData;
};

export const useMotionSafe = () => {
    const [reducedMotion, setReducedMotion] = useState(() => {
        if (typeof window === 'undefined') return false;
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    });
    const [lowSpec, _setLowSpec] = useState(detectLowSpec);

    useEffect(() => {

        const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
        const handler = (e) => setReducedMotion(e.matches);
        mq.addEventListener('change', handler);
        return () => mq.removeEventListener('change', handler);
    }, []);

    const isAnimationSafe = !reducedMotion && !lowSpec;

    const motionIntensity = reducedMotion
        ? 'none'
        : lowSpec
            ? 'reduced'
            : 'full';

    return { isReducedMotion: reducedMotion, isLowSpec: lowSpec, isAnimationSafe, motionIntensity };
};
