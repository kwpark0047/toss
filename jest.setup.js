const { ReadableStream } = require("stream/web");
const { Blob, File } = require("buffer");
const { MessageChannel, MessagePort } = require("worker_threads");

global.ReadableStream = ReadableStream;
global.Blob = Blob;
if (typeof File !== "undefined") {
  global.File = File;
} else {
  global.File = class File extends Blob {
    constructor(chunks, name, options = {}) {
      super(chunks, options);
      this.name = name;
      this.lastModified = options.lastModified || Date.now();
    }
  };
}

const crypto = require("crypto");
if (typeof global.crypto === "undefined") {
  global.crypto = crypto;
}
if (typeof global.crypto.subtle === "undefined") {
  global.crypto.subtle = crypto.webcrypto.subtle;
}

if (typeof AbortSignal === "undefined") {
  const { AbortSignal } = require("abort-controller");
  global.AbortSignal = AbortSignal;
}

if (typeof fetch === "undefined") {
  const nodeFetch = require("node-fetch");
  global.fetch = nodeFetch;
  global.Headers = nodeFetch.Headers;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
}

global.MessageChannel = MessageChannel;
global.MessagePort = MessagePort;
global.performance = require("perf_hooks").performance;

class Event {
  constructor(type, options = {}) {
    this.type = type;
    this.bubbles = !!options.bubbles;
    this.cancelable = !!options.cancelable;
    this.composed = !!options.composed;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() {}
  stopImmediatePropagation() {}
}
global.Event = Event;

class EventTarget {
  constructor() { this.listeners = {}; }
  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }
  removeEventListener(type, callback) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(cb => cb !== callback);
  }
  dispatchEvent(event) {
    if (!this.listeners[event.type]) return true;
    for (const callback of this.listeners[event.type]) callback(event);
    return !event.defaultPrevented;
  }
}
global.EventTarget = EventTarget;

if (typeof DOMException === "undefined") {
  global.DOMException = require("domexception");
}

// axios is imported by frontend menu code paths pulled in via app bootstrap
jest.mock("axios", () => ({
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

// xss-clean (v2) tries to reassign req.query, which is a read-only getter in
// Express 5 / modern Node and throws "Cannot set property query ... only a getter".
// The module is used as `const xss = require('xss-clean'); xss()` so the mock
// factory returns a function; calling it returns a pass-through middleware.
jest.mock("xss-clean", () => {
  const factory = () => (req, res, next) => next();
  factory.default = factory;
  factory.xss = factory;
  return factory;
});

// sanitize-html is pulled in by xssSanitizer middleware; keep its simpleTransform mock.
jest.mock("sanitize-html", () => {
  const fn = (html) => html;
  fn.simpleTransform = (tagName) => (x) => `<${tagName}>${x}</${tagName}>`;
  return fn;
});
