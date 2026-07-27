import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const assets = new URL("../vendor/ebruneton-black-hole/", import.meta.url);

const EXPECTED = [
  { name: "deflection-256.dat", dimensions: [256, 256], headerFloats: 2, channels: 2, bytes: 524296 },
  { name: "doppler-32.dat", dimensions: [32, 16, 32], headerFloats: 3, channels: 3, bytes: 196620 },
];

let totalBytes = 0;
for (const expected of EXPECTED) {
  const url = new URL(expected.name, assets);
  const info = await stat(url);
  if (info.size !== expected.bytes) {
    throw new Error(`${expected.name}: expected ${expected.bytes} bytes, got ${info.size}`);
  }

  const bytes = await readFile(url);
  const data = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / Float32Array.BYTES_PER_ELEMENT);
  const actualDimensions = Array.from(data.subarray(0, expected.headerFloats));
  if (actualDimensions.some((value, index) => value !== expected.dimensions[index])) {
    throw new Error(`${expected.name}: expected dimensions ${expected.dimensions}, got ${actualDimensions}`);
  }

  const texelFloats = expected.dimensions.reduce((product, value) => product * value, expected.channels);
  if (data.length !== expected.headerFloats + texelFloats) {
    throw new Error(`${expected.name}: invalid float count ${data.length}`);
  }
  totalBytes += info.size;
}

const fixedLookupBytes = (await stat(new URL("inverse_radius.dat", assets))).size +
  (await stat(new URL("black_body.dat", assets))).size;
if (totalBytes + fixedLookupBytes >= 800000) {
  throw new Error(`Optimized lookup data exceeds 800000 bytes in ${root}`);
}

console.log(`Verified optimized lookup data: ${totalBytes + fixedLookupBytes} bytes`);
