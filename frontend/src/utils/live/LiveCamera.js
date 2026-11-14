export class LiveCamera {
  constructor({ media = navigator.mediaDevices, clock = () => performance.now() } = {}) {
    this.media = media;
    this.clock = clock;
    this.generation = 0;
    this.sent = 0;
    this.last = -Infinity;
  }
  async start(video, consent) {
    if (consent !== true) throw Error('카메라 전송 동의가 필요합니다.');
    this.stop();
    const generation = this.generation;
    const stream = await this.media.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: 'environment' },
        width: { ideal: 640 },
        height: { ideal: 480 },
      },
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    this.video = video;
    video.srcObject = stream;
    for (const track of stream.getTracks()) track.onended = () => this.stop();
    await video.play();
    if (generation !== this.generation) return;
    return true;
  }
  capture() {
    if (!this.stream || !this.video?.videoWidth) throw Error('카메라가 준비되지 않았습니다.');
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    const ctx = canvas.getContext('2d');
    const scale = Math.min(320 / this.video.videoWidth, 240 / this.video.videoHeight),
      w = Math.round(this.video.videoWidth * scale),
      h = Math.round(this.video.videoHeight * scale);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, 320, 240);
    ctx.drawImage(this.video, (320 - w) / 2, (240 - h) / 2, w, h);
    const data = canvas.toDataURL('image/jpeg', 0.45).split(',')[1];
    if (atob(data).length > 16384)
      throw Error('사진이 큽니다. 메뉴에 가까이 대고 다시 촬영해 주세요.');
    this.frame = data;
    return data;
  }
  send(send) {
    if (!this.stream || !this.frame) throw Error('전송할 사진을 먼저 확인해 주세요.');
    const now = this.clock();
    if (now - this.last < 1000 || this.sent >= 30)
      throw Error('전송 제한: 초당 1장, 대화당 30장입니다.');
    if (send(this.frame) !== true) throw Error('연결을 확인해 주세요.');
    this.last = now;
    this.sent++;
    this.frame = null;
    return true;
  }
  stop() {
    this.generation++;
    this.frame = null;
    const stream = this.stream;
    this.stream = null;
    stream?.getTracks().forEach((t) => {
      t.onended = null;
      t.stop();
    });
    if (this.video) {
      this.video.pause?.();
      this.video.srcObject = null;
    }
    this.video = null;
  }
}
