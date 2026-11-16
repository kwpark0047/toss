// Mono PCM16 little endian, 16kHz, bounded 40ms frames. No network or persistence.
class LivePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = [];
    this.position = 0;
    this.pending = [];
    this.step = sampleRate / 16000;
  }
  process(inputs) {
    const input = inputs[0]?.[0];
    if (!input) return true;
    this.buffer.push(...input);
    while (this.position + 1 < this.buffer.length) {
      const i = Math.floor(this.position),
        fraction = this.position - i;
      const value = Math.max(
        -1,
        Math.min(1, this.buffer[i] * (1 - fraction) + this.buffer[i + 1] * fraction)
      );
      this.pending.push(Math.round(value * (value < 0 ? 32768 : 32767)));
      this.position += this.step;
    }
    const consumed = Math.min(Math.floor(this.position), this.buffer.length);
    this.buffer.splice(0, consumed);
    this.position -= consumed;
    while (this.pending.length >= 640) {
      const frame = new ArrayBuffer(1280),
        view = new DataView(frame);
      for (let i = 0; i < 640; i++) view.setInt16(i * 2, this.pending[i], true);
      this.pending.splice(0, 640);
      this.port.postMessage(frame, [frame]);
    }
    return true;
  }
}
registerProcessor('live-pcm', LivePcmProcessor);
