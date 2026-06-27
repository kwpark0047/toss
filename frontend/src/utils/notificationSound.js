// Web Audio API를 사용한 알림 소리 생성
class NotificationSound {
  constructor() {
    this.audioContext = null;
    this.enabled = true;
    this.volume = 0.5;
  }

  init() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this;
  }

  // 기본 알림음 (딩동)
  playNotification() {
    if (!this.enabled) return;
    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 첫 번째 음 (높은 음)
    this.playTone(880, now, 0.15, 'sine');
    // 두 번째 음 (더 높은 음)
    this.playTone(1100, now + 0.15, 0.2, 'sine');
  }

  // 새 주문 알림음 (더 눈에 띄는 소리)
  playNewOrder() {
    if (!this.enabled) return;
    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 3음 연속 (도-미-솔 느낌)
    this.playTone(523.25, now, 0.12, 'sine');        // C5
    this.playTone(659.25, now + 0.12, 0.12, 'sine'); // E5
    this.playTone(783.99, now + 0.24, 0.2, 'sine');  // G5

    // 약간의 지연 후 반복
    this.playTone(523.25, now + 0.5, 0.12, 'sine');
    this.playTone(659.25, now + 0.62, 0.12, 'sine');
    this.playTone(783.99, now + 0.74, 0.2, 'sine');
  }

  // 긴급 알림음 (빠른 반복)
  playUrgent() {
    if (!this.enabled) return;
    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    for (let i = 0; i < 3; i++) {
      this.playTone(1000, now + i * 0.2, 0.08, 'square');
      this.playTone(800, now + i * 0.2 + 0.08, 0.08, 'square');
    }
  }

  // 성공 알림음
  playSuccess() {
    if (!this.enabled) return;
    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    this.playTone(523.25, now, 0.1, 'sine');
    this.playTone(783.99, now + 0.1, 0.15, 'sine');
  }

  // 주문 준비 완료 알림음 (특별한 소리)
  playOrderReady() {
    if (!this.enabled) return;
    this.init();

    const ctx = this.audioContext;
    const now = ctx.currentTime;

    // 상승하는 멜로디
    this.playTone(523.25, now, 0.15, 'sine');        // C5
    this.playTone(659.25, now + 0.15, 0.15, 'sine'); // E5
    this.playTone(783.99, now + 0.3, 0.15, 'sine');  // G5
    this.playTone(1046.5, now + 0.45, 0.3, 'sine');  // C6
  }

  playTone(frequency, startTime, duration, type = 'sine') {
    const ctx = this.audioContext;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, startTime);

    gainNode.gain.setValueAtTime(0, startTime);
    gainNode.gain.linearRampToValueAtTime(this.volume, startTime + 0.01);
    gainNode.gain.linearRampToValueAtTime(this.volume * 0.7, startTime + duration * 0.5);
    gainNode.gain.linearRampToValueAtTime(0, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  // 오디오 컨텍스트 활성화 (사용자 상호작용 필요)
  resume() {
    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}

// 싱글톤 인스턴스
const notificationSound = new NotificationSound();

// 진동 유틸리티
export function vibrateNotification(pattern = [200, 100, 200]) {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
}

// 짧은 진동
export function vibrateShort() {
  vibrateNotification([100]);
}

// 긴 진동 (주문 준비 완료용)
export function vibrateOrderReady() {
  vibrateNotification([200, 100, 200, 100, 300]);
}

export default notificationSound;
