// Node 22+ built-in globals — only polyfill if missing
if (typeof ReadableStream === 'undefined') {
  const { ReadableStream: RS } = require('stream/web');
  global.ReadableStream = RS;
}
if (typeof Blob === 'undefined') {
  const { Blob: B } = require('buffer');
  global.Blob = B;
}
if (typeof File === 'undefined') {
  const { File: F } = require('buffer');
  global.File = F;
}
if (typeof MessageChannel === 'undefined') {
  const { MessageChannel: MC, MessagePort: MP } = require('worker_threads');
  global.MessageChannel = MC;
  global.MessagePort = MP;
}

const crypto = require('crypto');
if (typeof global.crypto === 'undefined') {
  global.crypto = crypto;
}
if (typeof global.crypto.subtle === 'undefined') {
  global.crypto.subtle = crypto.webcrypto.subtle;
}

if (typeof AbortSignal === 'undefined') {
  const { AbortSignal } = require('abort-controller');
  global.AbortSignal = AbortSignal;
}

if (typeof fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  global.fetch = nodeFetch;
  global.Headers = nodeFetch.Headers;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
}

global.performance = require('perf_hooks').performance;

if (typeof Event === 'undefined') {
  class Event {
    constructor(type, options = {}) {
      this.type = type;
      this.bubbles = !!options.bubbles;
      this.cancelable = !!options.cancelable;
      this.composed = !!options.composed;
      this.defaultPrevented = false;
    }
    preventDefault() {
      this.defaultPrevented = true;
    }
    stopPropagation() {}
    stopImmediatePropagation() {}
  }
  global.Event = Event;
}

if (typeof EventTarget === 'undefined') {
  class EventTarget {
    constructor() {
      this.listeners = {};
    }
    addEventListener(type, callback) {
      if (!this.listeners[type]) this.listeners[type] = [];
      this.listeners[type].push(callback);
    }
    removeEventListener(type, callback) {
      if (!this.listeners[type]) return;
      this.listeners[type] = this.listeners[type].filter((cb) => cb !== callback);
    }
    dispatchEvent(event) {
      if (!this.listeners[event.type]) return true;
      for (const callback of this.listeners[event.type]) callback(event);
      return !event.defaultPrevented;
    }
  }
  global.EventTarget = EventTarget;
}

if (typeof DOMException === 'undefined') {
  global.DOMException = require('domexception');
}

// axios is imported by frontend menu code paths pulled in via app bootstrap
jest.mock('axios', () => ({
  create: () => ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  }),
  get: jest.fn(),
  post: jest.fn(),
  put: jest.fn(),
  delete: jest.fn(),
}));

// sanitize-html is pulled in by xssSanitizer middleware; keep its simpleTransform mock.
jest.mock('sanitize-html', () => {
  const fn = (html) => html;
  fn.simpleTransform = (tagName) => (x) => `<${tagName}>${x}</${tagName}>`;
  return fn;
});
