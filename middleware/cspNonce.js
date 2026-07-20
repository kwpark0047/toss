/**
 * CSP Nonce Middleware
 * Generates unique CSP nonces for inline scripts/styles to strengthen Content Security Policy
 * Helps prevent XSS attacks by allowing only scripts/styles with valid nonces to execute
 */

const crypto = require('crypto');

/**
 * Generate a cryptographically secure random nonce
 * @returns {string} Base64-encoded nonce
 */
const generateNonce = () => {
  return crypto.randomBytes(16).toString('base64');
};

/**
 * CSP Nonce Middleware
 * Generates a unique nonce per request and makes it available via res.locals.cspNonce
 * Also sets the CSP header with the nonce for inline scripts/styles
 * 
 * @param {Object} options - Configuration options
 * @param {boolean} options.useReportOnly - If true, uses CSP Report-Only header
 * @param {string[]} options.additionalScriptSrc - Additional script-src directives
 * @param {string[]} options.additionalStyleSrc - Additional style-src directives
 * @returns {Function} Express middleware
 */
const cspNonceMiddleware = (options = {}) => {
  const {
    useReportOnly = false,
    additionalScriptSrc = [],
    additionalStyleSrc = []
  } = options;

  return (req, res, next) => {
    // Generate unique nonce for this request
    const nonce = generateNonce();
    
    // Store nonce in res.locals for use in views/templates
    res.locals.cspNonce = nonce;
    
    // Build CSP directives with nonce
    const scriptSrc = [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "https://www.gstatic.com",
      "https://cdn.jsdelivr.net",
      ...additionalScriptSrc
    ].join(' ');

    const styleSrc = [
      "'self'",
      `'nonce-${nonce}'`,
      "'unsafe-inline'", // Required for Tailwind and dynamic styles
      "https://fonts.googleapis.com",
      "https://www.gstatic.com",
      ...additionalStyleSrc
    ].join(' ');

    // Build CSP header value
    const cspDirectives = [
      "default-src 'self'",
      `script-src ${scriptSrc}`,
      `style-src ${styleSrc}`,
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: https: blob:",
      "connect-src 'self' https://wemarket.onrender.com wss://wemarket.onrender.com https://api.tosspayments.com https://www.googleapis.com https://firebaseinstallations.googleapis.com https://fcmregistrations.googleapis.com",
      "frame-src 'self' https://js.tosspayments.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "upgrade-insecure-requests"
    ].join('; ');

    const headerName = useReportOnly ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy';
    
    // Set CSP header (will be overridden by helmet's CSP if helmet runs after this)
    // We set it here to ensure nonce is included, helmet's CSP will override if configured differently
    res.setHeader(headerName, cspDirectives);

    // Also set CSP via res.locals for manual use in templates
    res.locals.cspHeader = cspDirectives;
    res.locals.cspNonce = nonce;

    next();
  };
};

/**
 * Get CSP nonce for use in templates
 * @param {Object} res - Express response object
 * @returns {string} CSP nonce
 */
const getCspNonce = (res) => {
  return res.locals.cspNonce || '';
};

/**
 * Helper to create script tag with nonce
 * @param {Object} res - Express response object
 * @param {string} src - Script source URL (optional)
 * @param {string} content - Inline script content (optional)
 * @returns {string} HTML script tag with nonce
 */
const createScriptTag = (res, { src, content } = {}) => {
  const nonce = getCspNonce(res);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  
  if (src) {
    return `<script src="${src}"${nonceAttr}></script>`;
  }
  if (content) {
    return `<script${nonceAttr}>${content}</script>`;
  }
  return '';
};

/**
 * Helper to create style tag with nonce
 * @param {Object} res - Express response object
 * @param {string} href - Stylesheet href (optional)
 * @param {string} content - Inline style content (optional)
 * @returns {string} HTML style/link tag with nonce
 */
const createStyleTag = (res, { href, content } = {}) => {
  const nonce = getCspNonce(res);
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  
  if (href) {
    return `<link rel="stylesheet" href="${href}"${nonceAttr}>`;
  }
  if (content) {
    return `<style${nonceAttr}>${content}</style>`;
  }
  return '';
};

module.exports = {
  cspNonceMiddleware,
  generateNonce,
  getCspNonce,
  createScriptTag,
  createStyleTag
};