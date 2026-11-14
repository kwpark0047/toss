export class LiveAudio {
  constructor() {
    this.sources = new Set();
    this.nextTime = 0;
    this.generation = 0;
  }
  async start(send) {
    const generation = ++this.generation;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    if (generation !== this.generation) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    this.stream = stream;
    const Context = window.AudioContext || window.webkitAudioContext;
    this.context = new Context();
    await this.context.resume();
    await this.context.audioWorklet.addModule('/live-pcm-worklet.js');
    if (generation !== this.generation) return;
    this.node = new AudioWorkletNode(this.context, 'live-pcm', { channelCount: 1 });
    this.node.port.onmessage = (event) => {
      if (generation !== this.generation) return;
      const bytes = new Uint8Array(event.data);
      send(btoa(String.fromCharCode(...bytes)));
    };
    this.input = this.context.createMediaStreamSource(stream);
    this.silent = this.context.createGain();
    this.silent.gain.value = 0;
    this.input.connect(this.node);
    this.node.connect(this.silent);
    this.silent.connect(this.context.destination);
  }
  play(data) {
    if (this.muted) return;
    if (!this.context || this.context.state === 'closed') return;
    const bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    if (bytes.length % 2 || this.sources.size > 64) throw Error('Live audio queue limit');
    const pcm = new DataView(bytes.buffer),
      buffer = this.context.createBuffer(1, bytes.length / 2, 24000);
    const values = buffer.getChannelData(0);
    for (let i = 0; i < values.length; i++) values[i] = pcm.getInt16(i * 2, true) / 32768;
    if (this.nextTime - this.context.currentTime > 3) throw Error('Live playback backpressure');
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.context.destination);
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
    };
    this.nextTime = Math.max(this.context.currentTime, this.nextTime);
    source.start(this.nextTime);
    this.nextTime += buffer.duration;
  }
  interrupt() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
      source.disconnect();
    }
    this.sources.clear();
    this.nextTime = 0;
  }
  setMuted(muted) {
    this.muted = muted;
    this.stream?.getAudioTracks().forEach((track) => {
      track.enabled = !muted;
    });
    if (muted) this.interrupt();
  }
  stop() {
    this.generation++;
    this.interrupt();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.node?.disconnect();
    this.input?.disconnect();
    this.silent?.disconnect();
    this.node?.port.close();
    const context = this.context;
    this.context = null;
    void context?.close().catch(() => {});
  }
}
