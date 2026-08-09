/**
 * Web Vitals Monitoring
 * Measures and reports Core Web Vitals (LCP, INP, CLS, FCP, TTFB)
 * Can be extended to send to analytics endpoint
 */

import { onCLS, onINP, onLCP, onFCP, onTTFB } from 'web-vitals';

/**
 * Initialize Web Vitals monitoring
 * @param {Object} options - Configuration options
 * @param {Function} [options.onMetric] - Custom handler for each metric
 * @param {string} [options.reportTo] - Analytics endpoint URL for beacon sending
 */
export function initWebVitals(options = {}) {
  const {
    onMetric,
    reportTo
  } = options;
  const handleMetric = metric => {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.log(`[Web Vitals] ${metric.name}:`, metric.value, metric.rating);
    }

    // Call custom handler
    if (onMetric) {
      onMetric(metric);
    }

    // Send to analytics endpoint
    if (reportTo && navigator.sendBeacon) {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        url: window.location.href,
        timestamp: Date.now(),
        userAgent: navigator.userAgent
      });
      navigator.sendBeacon(reportTo, body);
    }
  };

  // Register all Core Web Vitals (FID replaced by INP in web-vitals v4+)
  try {
    onCLS(handleMetric);
    onINP(handleMetric);
    onLCP(handleMetric);
    onFCP(handleMetric);
    onTTFB(handleMetric);
  } catch (error) {
    console.warn('[Web Vitals] Failed to initialize:', error);
  }
}

/**
 * Web Vitals rating thresholds
 * @readonly
 */
export const VITAL_THRESHOLDS = {
  LCP: {
    good: 2500,
    poor: 4000
  },
  INP: {
    good: 200,
    poor: 500
  },
  CLS: {
    good: 0.1,
    poor: 0.25
  },
  FCP: {
    good: 1800,
    poor: 3000
  },
  TTFB: {
    good: 800,
    poor: 1800
  }
};

/**
 * Get rating for a metric value
 * @param {string} metricName - Name of the metric
 * @param {number} value - Metric value
 * @returns {'good'|'needs-improvement'|'poor'} Performance rating
 */
export function getRating(metricName, value) {
  const thresholds = VITAL_THRESHOLDS[metricName];
  if (!thresholds) return 'good';
  if (value <= thresholds.good) return 'good';
  if (value >= thresholds.poor) return 'poor';
  return 'needs-improvement';
}

/**
 * Report a custom metric
 * @param {string} name - Metric name
 * @param {number} value - Metric value
 * @param {Object} [options] - Options
 * @param {number} [options.good] - Good threshold
 * @param {number} [options.poor] - Poor threshold
 * @param {string} [options.url] - Page URL
 * @returns {Object} Custom metric object
 */
export function reportCustomMetric(name, value, _options = {}) {
  const rating = getRating(name, value);
  const metric = {
    name,
    value,
    rating,
    delta: value,
    entries: [],
    id: crypto.randomUUID()
  };
  if (import.meta.env.DEV) {
    console.log(`[Custom Metric] ${name}:`, value, rating);
  }
  return metric;
}

/**
 * Initialize performance observer for custom metrics
 * @param {PerformanceEntry[]} [entries] - Initial entries
 * @returns {PerformanceObserver|null} Observer instance or null if not supported
 */
export function observePerformance(_entries = []) {
  if (!window.PerformanceObserver) return null;
  const observer = new PerformanceObserver(list => {
    for (const entry of list.getEntries()) {
      // Log long tasks
      if (entry.entryType === 'longtask' && entry.duration > 50) {
        console.warn('[Performance] Long task detected:', entry.duration, 'ms', entry);
      }

      // Log layout shifts
      if (entry.entryType === 'layout-shift' && !entry.hadRecentInput) {
        console.log('[Performance] Layout shift:', entry.value);
      }
    }
  });
  try {
    observer.observe({
      type: 'longtask',
      buffered: true
    });
    observer.observe({
      type: 'layout-shift',
      buffered: true
    });
    observer.observe({
      type: 'first-input',
      buffered: true
    });
    observer.observe({
      type: 'navigation',
      buffered: true
    });
    observer.observe({
      type: 'resource',
      buffered: true
    });
  } catch (_e) {
    // Some observers might not be supported
  }
  return observer;
}
export default {
  initWebVitals,
  getRating,
  reportCustomMetric,
  observePerformance,
  VITAL_THRESHOLDS
};
