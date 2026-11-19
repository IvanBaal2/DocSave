import { fromByteArray, toByteArray } from 'base64-js';

export const b64 = {
  encode: (bytes: Uint8Array): string => fromByteArray(bytes),
  decode: (s: string): Uint8Array => toByteArray(s),
};
