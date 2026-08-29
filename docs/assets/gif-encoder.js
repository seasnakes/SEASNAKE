(() => {
  "use strict";

  window.SEASNAKE_GIF = {
    encode: encodeGif,
  };

  async function encodeGif({ canvas, duration, fps, renderFrame, onProgress }) {
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    const writer = new GifWriter(canvas.width, canvas.height);
    const frameRate = Math.max(1, Math.min(60, fps));
    const frameStepSeconds = 1 / frameRate;
    const frameCount = Math.ceil(duration * frameRate);
    const durationCentiseconds = Math.round(duration * 100);

    for (let index = 0; index < frameCount; index += 1) {
      const seconds = index * frameStepSeconds;
      const startCentiseconds = Math.round(index * 100 / frameRate);
      const endCentiseconds = Math.min(durationCentiseconds, Math.round((index + 1) * 100 / frameRate));
      const delayCentiseconds = Math.max(1, endCentiseconds - startCentiseconds);
      renderFrame(seconds);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      writer.addFrame(quantizeFrame(pixels), delayCentiseconds);
      onProgress?.((index + 1) / frameCount, index + 1, frameCount);
      await nextPaint();
    }

    return writer.finish();
  }

  class GifWriter {
    constructor(width, height) {
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
      this.parts.push(buildPalette());
      this.parts.push(bytes(0x21, 0xff, 0x0b));
      this.parts.push(ascii("NETSCAPE2.0"));
      this.parts.push(bytes(0x03, 0x01, 0x00, 0x00, 0x00));
    }

    addFrame(frame, delayCentiseconds) {
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
        0x87,
      ));
      this.parts.push(frame.palette);
      this.parts.push(bytes(8));
      const compressed = lzwEncode(frame.indices);
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

  function quantizeFrame(rgba) {
    const pixelCount = rgba.length / 4;
    const bins = new Uint16Array(pixelCount);
    const counts = new Uint32Array(32768);
    const redSums = new Uint32Array(32768);
    const greenSums = new Uint32Array(32768);
    const blueSums = new Uint32Array(32768);

    for (let pixel = 0, source = 0; source < rgba.length; pixel += 1, source += 4) {
      const red = rgba[source];
      const green = rgba[source + 1];
      const blue = rgba[source + 2];
      const bin = (red >> 3) << 10 | (green >> 3) << 5 | (blue >> 3);
      bins[pixel] = bin;
      counts[bin] += 1;
      redSums[bin] += red;
      greenSums[bin] += green;
      blueSums[bin] += blue;
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

    const boxes = [makeColorBox(colors)];
    while (boxes.length < 256) {
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

    const palette = new Uint8Array(256 * 3);
    const lookup = new Uint8Array(32768);
    boxes.forEach((box, paletteIndex) => {
      let population = 0;
      let red = 0;
      let green = 0;
      let blue = 0;
      box.colors.forEach((color) => {
        population += color.count;
        red += color.r * color.count;
        green += color.g * color.count;
        blue += color.b * color.count;
        lookup[color.bin] = paletteIndex;
      });
      palette[paletteIndex * 3] = Math.round(red / population);
      palette[paletteIndex * 3 + 1] = Math.round(green / population);
      palette[paletteIndex * 3 + 2] = Math.round(blue / population);
    });

    const indices = new Uint8Array(pixelCount);
    for (let pixel = 0; pixel < pixelCount; pixel += 1) indices[pixel] = lookup[bins[pixel]];
    return { indices, palette };
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

  function buildPalette() {
    const palette = new Uint8Array(256 * 3);
    for (let index = 0; index < 256; index += 1) {
      palette[index * 3] = Math.round(((index >> 5) & 7) * 255 / 7);
      palette[index * 3 + 1] = Math.round(((index >> 2) & 7) * 255 / 7);
      palette[index * 3 + 2] = (index & 3) * 85;
    }
    return palette;
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
