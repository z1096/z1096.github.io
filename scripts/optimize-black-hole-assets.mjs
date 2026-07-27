import { readFile, writeFile } from "node:fs/promises";

const assets = new URL("../vendor/ebruneton-black-hole/", import.meta.url);

function readFloat32(buffer) {
  return new Float32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / Float32Array.BYTES_PER_ELEMENT);
}

function samplePosition(index, sourceSize, targetSize) {
  const position = (index + 0.5) * sourceSize / targetSize - 0.5;
  const low = Math.max(0, Math.floor(position));
  const high = Math.min(sourceSize - 1, low + 1);
  return [low, high, Math.max(0, position - low)];
}

function resample2D(source, sourceWidth, sourceHeight, targetWidth, targetHeight, channels) {
  const output = new Float32Array(targetWidth * targetHeight * channels);
  for (let y = 0; y < targetHeight; y += 1) {
    const [y0, y1, ty] = samplePosition(y, sourceHeight, targetHeight);
    for (let x = 0; x < targetWidth; x += 1) {
      const [x0, x1, tx] = samplePosition(x, sourceWidth, targetWidth);
      for (let channel = 0; channel < channels; channel += 1) {
        const topLeft = source[(y0 * sourceWidth + x0) * channels + channel];
        const topRight = source[(y0 * sourceWidth + x1) * channels + channel];
        const bottomLeft = source[(y1 * sourceWidth + x0) * channels + channel];
        const bottomRight = source[(y1 * sourceWidth + x1) * channels + channel];
        const top = topLeft + (topRight - topLeft) * tx;
        const bottom = bottomLeft + (bottomRight - bottomLeft) * tx;
        output[(y * targetWidth + x) * channels + channel] = top + (bottom - top) * ty;
      }
    }
  }
  return output;
}

function resample3D(source, sourceDimensions, targetDimensions, channels) {
  const [sourceWidth, sourceHeight, sourceDepth] = sourceDimensions;
  const [targetWidth, targetHeight, targetDepth] = targetDimensions;
  const output = new Float32Array(targetWidth * targetHeight * targetDepth * channels);
  const sourceIndex = (x, y, z, channel) => (((z * sourceHeight + y) * sourceWidth + x) * channels) + channel;
  const targetIndex = (x, y, z, channel) => (((z * targetHeight + y) * targetWidth + x) * channels) + channel;

  for (let z = 0; z < targetDepth; z += 1) {
    const [z0, z1, tz] = samplePosition(z, sourceDepth, targetDepth);
    for (let y = 0; y < targetHeight; y += 1) {
      const [y0, y1, ty] = samplePosition(y, sourceHeight, targetHeight);
      for (let x = 0; x < targetWidth; x += 1) {
        const [x0, x1, tx] = samplePosition(x, sourceWidth, targetWidth);
        for (let channel = 0; channel < channels; channel += 1) {
          const interpolateX = (left, right) => left + (right - left) * tx;
          const interpolateY = (top, bottom) => top + (bottom - top) * ty;
          const front = interpolateY(
            interpolateX(source[sourceIndex(x0, y0, z0, channel)], source[sourceIndex(x1, y0, z0, channel)]),
            interpolateX(source[sourceIndex(x0, y1, z0, channel)], source[sourceIndex(x1, y1, z0, channel)]),
          );
          const back = interpolateY(
            interpolateX(source[sourceIndex(x0, y0, z1, channel)], source[sourceIndex(x1, y0, z1, channel)]),
            interpolateX(source[sourceIndex(x0, y1, z1, channel)], source[sourceIndex(x1, y1, z1, channel)]),
          );
          output[targetIndex(x, y, z, channel)] = front + (back - front) * tz;
        }
      }
    }
  }
  return output;
}

async function writeFloats(name, header, pixels) {
  const output = new Float32Array(header.length + pixels.length);
  output.set(header);
  output.set(pixels, header.length);
  await writeFile(new URL(name, assets), new Uint8Array(output.buffer));
}

const deflectionInput = readFloat32(await readFile(new URL("deflection.dat", assets)));
const deflectionDimensions = Array.from(deflectionInput.subarray(0, 2));
const deflection = resample2D(deflectionInput.subarray(2), ...deflectionDimensions, 256, 256, 2);
await writeFloats("deflection-256.dat", [256, 256], deflection);

const dopplerInput = readFloat32(await readFile(new URL("doppler.dat", assets)));
const doppler = resample3D(dopplerInput, [64, 32, 64], [32, 16, 32], 3);
await writeFloats("doppler-32.dat", [32, 16, 32], doppler);

console.log("Generated optimized black-hole lookup data");
