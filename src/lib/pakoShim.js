import '../../node_modules/pako/dist/pako.min.js';

const pakoInstance =
  typeof window !== 'undefined' && window.pako
    ? window.pako
    : typeof self !== 'undefined' && self.pako
    ? self.pako
    : typeof globalThis !== 'undefined' && globalThis.pako
    ? globalThis.pako
    : {};

export default pakoInstance;
export const inflate = (...args) => (pakoInstance.inflate ? pakoInstance.inflate(...args) : new Uint8Array());
export const deflate = (...args) => (pakoInstance.deflate ? pakoInstance.deflate(...args) : new Uint8Array());
