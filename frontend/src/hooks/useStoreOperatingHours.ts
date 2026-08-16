import { useState, useEffect, useCallback } from 'react';
import { storesAPI } from '@/api';

// ── 상수 (StoreSettings와 응집된 기본값) ─────────────────────────────
export const DAYS = [
  { key: 'mon', label: '월' },
  { key: 'tue', label: '화' },
  { key: 'wed', label: '수' },
  { key: 'thu', label: '목' },
  { key: 'fri', label: '금' },
  { key: 'sat', label: '토' },
  { key: 'sun', label: '일' },
];

export const DEFAULT_HOURS = { open: '09:00', close: '22:00', closed: false };

// ── 타입 정의 ──────────────────────────────────────────────────────
export type DayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface DayHours {
  key: DayKey;
  label: string;
  isClosed: boolean;
  open: string;   // "HH:MM" 형식
  close: string;  // "HH:MM" 형식
}

export interface OperatingHoursState {
  hours: Record<DayKey, DayHours>;
  globalOpen: string;
  globalClose: string;
  usePerDay: boolean;
  isLoading: boolean;
  error?: string;
}

// ── 기본값 ──────────────────────────────────────────────────────────
const DEFAULT_OPERATING_HOURS: OperatingHoursState = {
  hours: DAYS.reduce(
    (acc, d) => ({ ...acc, [d.key]: { ...DEFAULT_HOURS, label: d.label } }),
    {} as Record<DayKey, DayHours>
  ),
  globalOpen: '09:00',
  globalClose: '22:00',
  usePerDay: false,
  isLoading: true,
};

// ── 헬퍼: 영업시간 포맷 검증 ────────────────────────────────────────
const isValidTime = (time: string): boolean => {
  const pattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return pattern.test(time);
};

const validateHour = (open: string, close: string, isClosed: boolean): { valid: boolean; reason?: string } => {
  if (isClosed) return { valid: true };

  if (!isValidTime(open)) return { valid: false, reason: '시작시간 형식이 올바르지 않습니다 (HH:MM)' };
  if (!isValidTime(close)) return { valid: false, reason: '종료시간 형식이 올바르지 않습니다 (HH:MM)' };

  const [openH, openM] = open.split(':').map(Number);
  const [closeH, closeM] = close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  if (closeMinutes <= openMinutes) {
    return { valid: false, reason: '종료시간이 시작시간보다 늦어야 합니다' };
  }

  return { valid: true };
};

// ── 메인 훅 ─────────────────────────────────────────────────────────
export const useStoreOperatingHours = (storeId: string) => {
  const [state, setState] = useState<OperatingHoursState>(() => ({
    ...DEFAULT_OPERATING_HOURS,
    isLoading: storeId ? true : false,
  }));

  const fetchStoreHours = useCallback(async () => {
    if (!storeId) {
      setState(prev => ({ ...prev, isLoading: false, error: '스토어 ID가 없습니다.' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: undefined }));

    try {
      const res = await storesAPI.getById(storeId);
      const s = res.data;

      // 기본 글로벌 시간
      const basicOpen = s.open_time || '09:00';
      const basicClose = s.close_time || '22:00';

      // business_hours JSON이 있으면 요일별 모드로 전환
      if (s.business_hours) {
        let parsed: Record<DayKey, { open: string; close: string; closed: boolean }>;

        try {
          parsed = typeof s.business_hours === 'string'
            ? JSON.parse(s.business_hours)
            : s.business_hours;
        } catch {
          // JSON 파싱 실패 시 기본값 사용
          parsed = DAYS.reduce(
            (acc, d) => ({ ...acc, [d.key]: { open: basicOpen, close: basicClose, closed: false } }),
            {} as Record<DayKey, { open: string; close: string; closed: boolean }>
          );
        }

        const dayHours = DAYS.reduce((acc, d) => {
          const data = parsed[d.key] || { open: basicOpen, close: basicClose, closed: false };
          const label = DAYS.find(x => x.key === d.key)?.label || d.key;
          return {
            ...acc,
            [d.key]: {
              key: d.key,
              label,
              isClosed: data.closed,
              open: data.open || basicOpen,
              close: data.close || basicClose,
            },
          };
        }, {} as Record<DayKey, DayHours>);

        setState({
          hours: dayHours,
          globalOpen: basicOpen,
          globalClose: basicClose,
          usePerDay: true,
          isLoading: false,
        });
      } else {
        // business_hours가 없으면 기본 모드
        setState({
          hours: DAYS.reduce(
            (acc, d) => ({
              ...acc,
              [d.key]: {
                key: d.key,
                label: d.label,
                isClosed: false,
                open: basicOpen,
                close: basicClose,
              },
            }),
            {} as Record<DayKey, DayHours>
          ),
          globalOpen: basicOpen,
          globalClose: basicClose,
          usePerDay: false,
          isLoading: false,
        });
      }
    } catch (error: any) {
      console.error('영업시간 로드 실패:', error);
      setState({
        ...DEFAULT_OPERATING_HOURS,
        isLoading: false,
        error: error?.response?.data?.error || '영업시간을 불러오지 못했습니다.',
      });
    }
  }, [storeId]);

  // ── 초기 로드 ────────────────────────────────────────────────────
  useEffect(() => {
    fetchStoreHours();
  }, [fetchStoreHours]);

  // ── state 업데이트 액션 ──────────────────────────────────────────
  const updateHours = useCallback((newHours: Record<DayKey, Partial<DayHours>>) => {
    setState(prev => {
      const next: Record<DayKey, DayHours> = {};

      DAYS.forEach(d => {
        const existing = prev.hours[d.key];
        const incoming = newHours[d.key] || {};

        next[d.key] = {
          key: d.key,
          label: existing.label,
          isClosed:
            incoming.isClosed !== undefined ? incoming.isClosed : existing.isClosed,
          open:
            incoming.open !== undefined ? incoming.open : existing.open,
          close:
            incoming.close !== undefined ? incoming.close : existing.close,
        };
      });

      return {
        ...prev,
        hours: next,
        isLoading: false,
      };
    });
  }, []);

  const setDayClosed = useCallback((key: DayKey, isClosed: boolean) => {
    setState(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [key]: {
          ...prev.hours[key],
          isClosed,
          ...(isClosed ? { open: '00:00', close: '00:00' } : {}),
        },
      },
    }));
  }, []);

  const setDayTime = useCallback((key: DayKey, field: 'open' | 'close', value: string) => {
    // 형식 검증
    if (field === 'open' && !isValidTime(value)) {
      console.warn(`올바르지 않은 시작시간 형식: ${value}`);
      return;
    }
    if (field === 'close' && !isValidTime(value)) {
      console.warn(`올바르지 않은 종료시간 형식: ${value}`);
      return;
    }

    setState(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [key]: {
          ...prev.hours[key],
          [field]: value,
        },
      },
    }));
  }, []);

  const setGlobalTime = useCallback((field: 'open' | 'close', value: string) => {
    if (!isValidTime(value)) {
      console.warn(`올바르지 않은 시간 형식: ${value}`);
      return;
    }

    setState(prev => ({
      ...prev,
      [field]: value,
    }));
  }, []);

  const toggleDay = useCallback((key: DayKey) => {
    setState(prev => ({
      ...prev,
      hours: {
        ...prev.hours,
        [key]: {
          ...prev.hours[key],
          isClosed: !prev.hours[key].isClosed,
          ...(prev.hours[key].isClosed
            ? { open: '00:00', close: '00:00' }
            : {}),
        },
      },
    }));
  }, []);

  const validateAllHours = useCallback(() => {
    const errors: Array<{ day: string; message: string }> = [];

    DAYS.forEach(d => {
      const hour = state.hours[d.key];
      if (!hour.isClosed) {
        const validation = validateHour(hour.open, hour.close, hour.isClosed);
        if (!validation.valid) {
          errors.push({
            day: d.label,
            message: validation.reason || '시간 형식 오류',
          });
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
    };
  }, [state.hours]);

  const getTotalOperatingMinutes = useCallback(() => {
    let total = 0;
    let openCount = 0;

    DAYS.forEach(d => {
      const hour = state.hours[d.key];
      if (!hour.isClosed) {
        const [, openM] = hour.open.split(':').map(Number);
        const [closeH, closeM] = hour.close.split(':').map(Number);
        const openMinutes = parseInt(hour.open.split(':')[0]) * 60 + parseInt(hour.open.split(':')[1]);
        const closeMinutes = closeH * 60 + closeM;
        total += closeMinutes - openMinutes;
        openCount++;
      }
    });

    return { totalMinutes: total, openDays: openCount };
  }, [state.hours]);

  const getDerivedGlobalTimes = useCallback(() => {
    // usePerDay가 true이고, 최소 한 요일 이상 영업중인 경우
    // 첫 번째 영업 요일의 시간을 global로 반환
    const activeDays = DAYS.filter(d => {
      const hour = state.hours[d.key];
      return !hour.isClosed;
    });

    if (activeDays.length > 0 && state.usePerDay) {
      const firstActiveDay = activeDays[0];
      const hour = state.hours[firstActiveDay.key];
      return { globalOpen: hour.open, globalClose: hour.close };
    }

    // usePerDay가 false이거나 활성 요일이 없는 경우 기존 global 반환
    return {
      globalOpen: state.globalOpen,
      globalClose: state.globalClose,
    };
  }, [state.globalOpen, state.globalClose, state.usePerDay, state.hours]);

  // ── 데이터가 변경되었을 때 refetch 유도 ────────────────────────────
  const refetch = useCallback(() => {
    fetchStoreHours();
  }, [fetchStoreHours]);

  return {
    // state
    ...state,

    // 액션
    updateHours,
    setDayClosed,
    setDayTime,
    setGlobalTime,
    toggleDay,
    validateAllHours,
    getTotalOperatingMinutes,
    getDerivedGlobalTimes,
    refetch,

    // 유틸리티
    isLoading: state.isLoading,
    error: state.error,
  };
};

// ── export types ────────────────────────────────────────────────────
export type { DayHours, OperatingHoursState };