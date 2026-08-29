(() => {
  "use strict";

  const FRAME_STEP_SECONDS = 0.08;
  const BAYER_4X4 = [
    0, 8, 2, 10,
    12, 4, 14, 6,
    3, 11, 1, 9,
    15, 7, 13, 5,
  ];

  window.SEASNAKE_GIF = {
    frameRate: 1 / FRAME_STEP_SECONDS,
    maxPixels: 518400,
    encode: encodeGif,
  };

  async function encodeGif({ canvas, duration, renderFrame, onProgress }) {
    const context = canvas.getContext("2d", { alpha: false, willReadFrequently: true });
    const writer = new GifWriter(canvas.width, canvas.height);
    const frameCount = Math.ceil(duration / FRAME_STEP_SECONDS);

    for (let index = 0; index < frameCount; index += 1) {
      const seconds = index * FRAME_STEP_SECONDS;
      const nextSeconds = Math.min(duration, seconds + FRAME_STEP_SECONDS);
      const delayCentiseconds = Math.max(2, Math.round((nextSeconds - seconds) * 100));
      renderFrame(seconds);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      writer.addFrame(indexPixels(pixels, canvas.width), delayCentiseconds);
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
        8,
      ));
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

  function indexPixels(rgba, width) {
    const indices = new Uint8Array(rgba.length / 4);
    for (let pixel = 0, source = 0; source < rgba.length; pixel += 1, source += 4) {
      const x = pixel % width;
      const y = Math.floor(pixel / width);
      const dither = (BAYER_4X4[(y & 3) * 4 + (x & 3)] - 7.5) * 1.8;
      const red = clampByte(rgba[source] + dither);
      const green = clampByte(rgba[source + 1] + dither);
      const blue = clampByte(rgba[source + 2] + dither * 1.35);
      indices[pixel] = (red & 0xe0) | ((green & 0xe0) >> 3) | (blue >> 6);
    }
    return indices;
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

  function clampByte(value) {
    return Math.max(0, Math.min(255, Math.round(value)));
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
