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

