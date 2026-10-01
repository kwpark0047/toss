'use strict';

const express = require('express');

/**
 * body-parser verify 훅: 파싱 전 원본 바이트를 그대로 보존한다.
 * 웹훅 서명(HMAC)은 JSON.parse 결과가 아니라 실제 전송 바이트로 계산되어야 하므로
 * 키 순서/공백까지 보존된 Buffer를 그대로 보관한다.
 */
function captureRawBody(req, _res, buf) {
  if (Buffer.isBuffer(buf)) {
    req.rawBody = Buffer.from(buf);
  } else if (typeof buf === 'string') {
    req.rawBody = Buffer.from(buf, 'utf8');
  } else if (buf && buf.length) {
    req.rawBody = Buffer.from(buf);
  } else {
    req.rawBody = Buffer.alloc(0);
  }
}

/**
 * rawBody 보존이 포함된 express.json 파서 팩토리.
 * 운영(app.mts)과 라우트(routes/payments.js)가 동일한 설정을 쓰도록 단일 진입점을 제공한다.
 */
function createRawBodyJsonParser(options = {}) {
  return express.json({
    ...options,
    verify: options.verify ?? captureRawBody,
  });
}

const rawBodyJsonParser = createRawBodyJsonParser();

module.exports = {
  captureRawBody,
  createRawBodyJsonParser,
  rawBodyJsonParser,
  rawBodyJson: rawBodyJsonParser,
};
