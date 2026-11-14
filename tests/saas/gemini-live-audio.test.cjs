const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
for (const rate of [44100, 48000])
  test(`worklet converts ${rate}Hz to mono PCM16 LE 16kHz bounded frames`, () => {
    let Processor;
    const frames = [];
    vm.runInNewContext(fs.readFileSync('frontend/public/live-pcm-worklet.js', 'utf8'), {
      AudioWorkletProcessor: class {
        constructor() {
          this.port = { postMessage: (frame) => frames.push(frame) };
        }
      },
      sampleRate: rate,
      registerProcessor: (_name, C) => {
        Processor = C;
      },
      ArrayBuffer,
      DataView,
    });
    const p = new Processor();
    for (let i = 0; i < rate / 128; i++) p.process([[new Float32Array(128).fill(2)]]);
    const samples = frames.reduce((n, f) => n + f.byteLength / 2, 0);
    assert.ok(samples >= 15360 && samples <= 16000);
    for (const frame of frames) {
      assert.equal(frame.byteLength, 1280);
      assert.equal(new DataView(frame).getInt16(0, true), 32767);
    }
  });
