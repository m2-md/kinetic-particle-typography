import { localTime } from "../anim/easing";
import { createProgram, uniformLocations } from "../gl/program";
import { PARITY_FRAGMENT_SRC, PARITY_VERTEX_SRC } from "../gl/shaders";

export interface ParityReport {
  readonly skipped: boolean;
  readonly maxAbsDiff: number | null;
  readonly samples: number;
}

/**
 * Shader'daki `localTime` ile TS ikizini karşılaştırır: 1×N RGBA32F hedefe
 * her fazın eased değeri yazılıyor, `readPixels` ile geri okunuyor.
 * `EXT_color_buffer_float` yoksa atlanıyor — uydurma sayı yok.
 */
export function measureShaderParity(
  gl: WebGL2RenderingContext,
  t: number,
  spread: number,
  samples = 256,
): ParityReport {
  if (!gl.getExtension("EXT_color_buffer_float")) {
    return { skipped: true, maxAbsDiff: null, samples: 0 };
  }

  const texture = gl.createTexture();
  const fbo = gl.createFramebuffer();
  const quad = gl.createBuffer();
  const vao = gl.createVertexArray();
  if (!texture || !fbo || !quad || !vao) throw new Error("parite kaynakları oluşturulamadı");

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA32F, samples, 1);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  let report: ParityReport = { skipped: true, maxAbsDiff: null, samples: 0 };

  if (status === gl.FRAMEBUFFER_COMPLETE) {
    const program = createProgram(gl, PARITY_VERTEX_SRC, PARITY_FRAGMENT_SRC);
    const u = uniformLocations(gl, program, ["uT", "uSpread", "uCount"]);

    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.useProgram(program);
    gl.uniform1f(u["uT"], t);
    gl.uniform1f(u["uSpread"], spread);
    gl.uniform1f(u["uCount"], samples);

    gl.disable(gl.BLEND);
    gl.viewport(0, 0, samples, 1);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    const pixels = new Float32Array(samples * 4);
    gl.readPixels(0, 0, samples, 1, gl.RGBA, gl.FLOAT, pixels);

    let maxAbsDiff = 0;
    for (let i = 0; i < samples; i++) {
      const phase = i / Math.max(samples - 1, 1);
      const expected = localTime(t, phase, spread);
      const diff = Math.abs(pixels[i * 4] - expected);
      if (diff > maxAbsDiff) maxAbsDiff = diff;
    }

    report = { skipped: false, maxAbsDiff, samples };
    gl.deleteProgram(program);
  }

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.bindVertexArray(null);
  gl.deleteVertexArray(vao);
  gl.deleteBuffer(quad);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(texture);

  return report;
}
