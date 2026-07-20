/**
 * XSS Sanitization Middleware
 * Protects against Cross-Site Scripting attacks by sanitizing request bodies
 * Uses sanitize-html for HTML sanitization and xss-clean for general input sanitization
 */

const xss = require('xss-clean');
const sanitizeHtml = require('sanitize-html');

// Custom sanitize options for rich text fields (if needed)
const richTextSanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li', 'a'],
  allowedAttributes: {
    'a': ['href', 'target', 'rel']
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href'],
  allowedSchemesByTag: {},
  selfClosing: ['br'],
  allowedClasses: {
    '*': ['text-*', 'font-*', 'bg-*', 'border-*', 'rounded-*', 'p-*', 'm-*', 'flex', 'grid', 'w-*', 'h-*']
  },
  transformTags: {
    'script': sanitizeHtml.simpleTransform('p'),
    'iframe': sanitizeHtml.simpleTransform('p'),
    'object': sanitizeHtml.simpleTransform('p'),
    'embed': sanitizeHtml.simpleTransform('p'),
    'form': sanitizeHtml.simpleTransform('p'),
    'input': sanitizeHtml.simpleTransform('p'),
    'button': sanitizeHtml.simpleTransform('p')
  }
};

/**
 * Basic XSS protection middleware - applies xss-clean to all request bodies
 * This should be applied early in the middleware chain, before route handlers
 */
const basicXssProtection = xss();

/**
 * Advanced HTML sanitization for rich text fields
 * Use this middleware on routes that accept HTML content (e.g., product descriptions, reviews)
 * @param {string[]} fields - Array of field names to sanitize (default: ['description', 'content', 'html'])
 */
const htmlSanitizer = (fields = ['description', 'content', 'html', 'body', 'description_html']) => {
  return (req, res, next) => {
    if (!req.body || typeof req.body !== 'object') {
      return next();
    }

    const sanitize = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const sanitized = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize specified fields if they contain HTML
        if (fields.includes(key) && typeof value === 'string' && value.length > 0) {
          // Check if value contains HTML-like content
          if (/<[^>]*>/.test(value)) {
            sanitized[key] = sanitizeHtml(value, richTextSanitizeOptions);
          } else {
            sanitized[key] = value;
          }
        } else if (typeof value === 'object' && value !== null) {
          sanitized[key] = sanitize(value);
        } else {
          sanitized[key] = value;
        }
      }
      return sanitized;
    };

    req.body = sanitize(req.body);
    next();
  };
};

/**
 * Strict sanitization for all string inputs (applied globally)
 * Removes script tags, event handlers, javascript: urls, etc.
 */
const strictSanitizer = (req, res, next) => {
  const sanitizeValue = (val) => {
    if (typeof val !== 'string') return val;
    
    // Remove script tags and their content
    val = val.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    
    // Remove event handlers (onclick, onload, etc.)
    val = val.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
    
    // Remove javascript: urls
    val = val.replace(/javascript:/gi, '');
    
    // Remove data: urls (potential XSS vector)
    val = val.replace(/data:/gi, '');
    
    // Remove vbscript: urls
    val = val.replace(/vbscript:/gi, '');
    
    // Remove expression() (IE CSS expression)
    val = val.replace(/expression\s*\(/gi, '');
    
    // Remove @import (CSS injection)
    val = val.replace(/@import/gi, '');
    
    return val;
  };

  const sanitizeObject = (obj) => {
    if (!obj || typeof obj !== 'object') return obj;
    
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeValue(value);
      } else if (typeof value === 'object' && value !== null) {
        sanitized[key] = sanitizeObject(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  };

  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }

  next();
};

module.exports = {
  basicXssProtection,
  htmlSanitizer,
  strictSanitizer,
  richTextSanitizeOptions,
  sanitizeHtml
};