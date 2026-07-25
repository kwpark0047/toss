/**
 * Jest 25 + Node 24 호환 resolver
 * node: 프로토콜 (node:fs, node:crypto 등)을 내장 모듈로 매핑
 */
const builtins = new Set(require('module').builtinModules);

module.exports = (request, options) => {
    // node:xxx → xxx (내장 모듈로 리다이렉트)
    if (request.startsWith('node:')) {
        const stripped = request.slice(5);
        if (builtins.has(stripped)) {
            return options.defaultResolver(stripped, options);
        }
    }
    return options.defaultResolver(request, options);
};
