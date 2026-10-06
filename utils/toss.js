// CommonJS callers consume the single TypeScript implementation through tsx.
module.exports = require('./toss.ts').default;
module.exports.default = module.exports;
