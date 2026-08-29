(() => {
  "use strict";

  const PALETTE_ANCHORS = [
    [0, 0, 0], [7, 9, 9], [251, 251, 245], [255, 255, 255],
    [34, 198, 197], [29, 164, 171], [109, 213, 222],
    [217, 240, 26], [188, 201, 78], [226, 240, 114],
    [241, 38, 95], [196, 31, 77], [242, 96, 137],
  ];

  window.SEASNAKE_GIF = {
    encode: encodeGif,
  };

  async function encodeGif({ canvas, duration, fps, renderFrame, onProgress }) {
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    const frameRate = Math.max(1, Math.min(60, fps));
    const frameStepSeconds = 1 / frameRate;
    const frameCount = Math.ceil(duration * frameRate);
    const durationCentiseconds = Math.round(duration * 100);
    const palette = await buildSharedPalette({ context, canvas, duration, renderFrame });
    const lookup = buildPaletteLookup(palette.colors);
    const writer = new GifWriter(canvas.width, canvas.height, palette.bytes);

    for (let index = 0; index < frameCount; index += 1) {
      const seconds = index * frameStepSeconds;
      const startCentiseconds = Math.round(index * 100 / frameRate);
      const endCentiseconds = Math.min(durationCentiseconds, Math.round((index + 1) * 100 / frameRate));
      const delayCentiseconds = Math.max(1, endCentiseconds - startCentiseconds);
      renderFrame(seconds);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      writer.addFrame(indexFrame(pixels, lookup), delayCentiseconds);
      onProgress?.((index + 1) / frameCount, index + 1, frameCount);
      await nextPaint();
    }

    return writer.finish();
  }

  class GifWriter {
    constructor(width, height, palette) {
      this.width = width;
      this.height = height;
      this.parts = [];
      this.parts.push(ascii("GIF89a"));
      this.parts.push(bytes(
        width & 0xff,
        width >> 8,
        height & 0xff,
        height >> 8,
        0xf7,
        0,
        0,
      ));
      this.parts.push(palette);
      this.parts.push(bytes(0x21, 0xff, 0x0b));
      this.parts.push(ascii("NETSCAPE2.0"));
      this.parts.push(bytes(0x03, 0x01, 0x00, 0x00, 0x00));
    }

    addFrame(indices, delayCentiseconds) {
      this.parts.push(bytes(
        0x21, 0xf9, 0x04,
        0x04,
        delayCentiseconds & 0xff,
        delayCentiseconds >> 8,
        0,
        0,
      ));
      this.parts.push(bytes(
        0x2c,
        0, 0, 0, 0,
        this.width & 0xff,
        this.width >> 8,
        this.height & 0xff,
        this.height >> 8,
        0,
      ));
      this.parts.push(bytes(8));
      const compressed = lzwEncode(indices);
      for (let offset = 0; offset < compressed.length; offset += 255) {
        const block = compressed.subarray(offset, Math.min(offset + 255, compressed.length));
        this.parts.push(bytes(block.length), block);
      }
      this.parts.push(bytes(0));
    }

    finish() {
      this.parts.push(bytes(0x3b));
      return new Blob(this.parts, { type: "image/gif" });
    }
  }

  async function buildSharedPalette({ context, canvas, duration, renderFrame }) {
    const counts = new Uint32Array(32768);
    const redSums = new Uint32Array(32768);
    const greenSums = new Uint32Array(32768);
    const blueSums = new Uint32Array(32768);
    const sampleCount = duration > 4 ? 12 : 6;

    for (let sample = 0; sample < sampleCount; sample += 1) {
      const seconds = sampleCount === 1 ? 0 : duration * sample / (sampleCount - 1);
      renderFrame(seconds);
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const pixelCount = rgba.length / 4;
      const stride = Math.max(1, Math.floor(pixelCount / 90000));
      for (let pixel = sample % stride; pixel < pixelCount; pixel += stride) {
        const source = pixel * 4;
        const red = rgba[source];
        const green = rgba[source + 1];
        const blue = rgba[source + 2];
        const bin = (red >> 3) << 10 | (green >> 3) << 5 | (blue >> 3);
        counts[bin] += 1;
        redSums[bin] += red;
        greenSums[bin] += green;
        blueSums[bin] += blue;
      }
      await nextPaint();
    }

    const colors = [];
    for (let bin = 0; bin < counts.length; bin += 1) {
      const count = counts[bin];
      if (!count) continue;
      colors.push({
        bin,
        count,
        r: redSums[bin] / count,
        g: greenSums[bin] / count,
        b: blueSums[bin] / count,
      });
    }

    const targetBoxCount = 256 - PALETTE_ANCHORS.length;
    const boxes = [makeColorBox(colors)];
    while (boxes.length < targetBoxCount) {
      let splitIndex = -1;
      let splitScore = -1;
      for (let index = 0; index < boxes.length; index += 1) {
        if (boxes[index].colors.length < 2) continue;
        if (boxes[index].score > splitScore) {
          splitIndex = index;
          splitScore = boxes[index].score;
        }
      }
      if (splitIndex < 0) break;
      const [left, right] = splitColorBox(boxes[splitIndex]);
      boxes.splice(splitIndex, 1, left, right);
    }

    const paletteBytes = new Uint8Array(256 * 3);
    const paletteColors = [];
    boxes.forEach((box) => {
      let population = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      box.colors.forEach((color) => {
        population += color.count;
        red += color.r * color.count;
        green += color.g * color.count;
        blue += color.b * color.count;
      });
      paletteColors.push([
        Math.round(red / population),
        Math.round(green / population),
        Math.round(blue / population),
      ]);
    });
    paletteColors.push(...PALETTE_ANCHORS);
    while (paletteColors.length < 256) paletteColors.push(PALETTE_ANCHORS[0]);
    paletteColors.slice(0, 256).forEach((color, index) => {
      paletteBytes[index * 3] = color[0];
      paletteBytes[index * 3 + 1] = color[1];
      paletteBytes[index * 3 + 2] = color[2];
    });
    return { bytes: paletteBytes, colors: paletteColors.slice(0, 256) };
  }

  function buildPaletteLookup(palette) {
    const lookup = new Uint8Array(32768);
    for (let bin = 0; bin < lookup.length; bin += 1) {
      const red = ((bin >> 10) & 31) * 255 / 31;
      const green = ((bin >> 5) & 31) * 255 / 31;
      const blue = (bin & 31) * 255 / 31;
      let bestIndex = 0;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (let index = 0; index < palette.length; index += 1) {
        const color = palette[index];
        const redDelta = red - color[0];
        const greenDelta = green - color[1];
        const blueDelta = blue - color[2];
        const distance = redDelta * redDelta * 0.3 + greenDelta * greenDelta * 0.59 + blueDelta * blueDelta * 0.11;
        if (distance < bestDistance) {
          bestDistance = distance;
          bestIndex = index;
        }
      }
      lookup[bin] = bestIndex;
    }
    return lookup;
  }

  function indexFrame(rgba, lookup) {
    const indices = new Uint8Array(rgba.length / 4);
    for (let pixel = 0, source = 0; source < rgba.length; pixel += 1, source += 4) {
      const bin = (rgba[source] >> 3) << 10 | (rgba[source + 1] >> 3) << 5 | (rgba[source + 2] >> 3);
      indices[pixel] = lookup[bin];
    }
    return indices;
  }

  function makeColorBox(colors) {
    let minR = 255;
    let minG = 255;
    let minB = 255;
    let maxR = 0;
    let maxG = 0;
    let maxB = 0;
    let population = 0;
    colors.forEach((color) => {
      minR = Math.min(minR, color.r);
      minG = Math.min(minG, color.g);
      minB = Math.min(minB, color.b);
      maxR = Math.max(maxR, color.r);
      maxG = Math.max(maxG, color.g);
      maxB = Math.max(maxB, color.b);
      population += color.count;
    });
    const ranges = { r: maxR - minR, g: maxG - minG, b: maxB - minB };
    const channel = ranges.r >= ranges.g && ranges.r >= ranges.b ? "r" : ranges.g >= ranges.b ? "g" : "b";
    return {
      colors,
      population,
      channel,
      score: population * (ranges[channel] + 1) ** 2,
    };
  }

  function splitColorBox(box) {
    box.colors.sort((left, right) => left[box.channel] - right[box.channel]);
    const midpoint = box.population / 2;
    let cumulative = 0;
    let splitAt = 1;
    for (let index = 0; index < box.colors.length - 1; index += 1) {
      cumulative += box.colors[index].count;
      if (cumulative >= midpoint) {
        splitAt = index + 1;
        break;
      }
    }
    return [makeColorBox(box.colors.slice(0, splitAt)), makeColorBox(box.colors.slice(splitAt))];
  }

  function lzwEncode(indices) {
    const clearCode = 256;
    const endCode = 257;
    const output = [];
    let dictionary = new Map();
    let nextCode = 258;
    let codeSize = 9;
    let bitBuffer = 0;
    let bitCount = 0;

    const writeCode = (code) => {
      bitBuffer |= code << bitCount;
      bitCount += codeSize;
      while (bitCount >= 8) {
        output.push(bitBuffer & 0xff);
        bitBuffer >>>= 8;
        bitCount -= 8;
      }
    };

    const reset = () => {
      dictionary = new Map();
      nextCode = 258;
      codeSize = 9;
    };

    writeCode(clearCode);
    if (!indices.length) {
      writeCode(endCode);
      if (bitCount > 0) output.push(bitBuffer & 0xff);
      return Uint8Array.from(output);
    }

    let prefix = indices[0];
    for (let index = 1; index < indices.length; index += 1) {
      const suffix = indices[index];
      const key = prefix * 256 + suffix;
      const code = dictionary.get(key);
      if (code !== undefined) {
        prefix = code;
        continue;
      }

      writeCode(prefix);
      if (nextCode < 4096) {
        dictionary.set(key, nextCode);
        nextCode += 1;
        if (nextCode === (1 << codeSize) + 1 && codeSize < 12) codeSize += 1;
      } else {
        writeCode(clearCode);
        reset();
      }
      prefix = suffix;
    }

    writeCode(prefix);
    writeCode(endCode);
    if (bitCount > 0) output.push(bitBuffer & 0xff);
    return Uint8Array.from(output);
  }

  function ascii(value) {
    return new TextEncoder().encode(value);
  }

  function bytes(...values) {
    return Uint8Array.from(values);
  }

  function nextPaint() {
    return new Promise((resolve) => requestAnimationFrame(resolve));
  }
})();
