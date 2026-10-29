import pako from 'pako/dist/pako.js';

export default pako;
export const inflate = pako.inflate;
export const deflate = pako.deflate;
export const inflateRaw = pako.inflateRaw;
export const deflateRaw = pako.deflateRaw;
