export type DrawMode = "points" | "quads";

export interface Cloud {
  /** Yeni kelimeyi kaynak tamponun üstüne yazar ve rolleri takas eder. */
  push(targets: Float32Array, count: number): void;
  draw(mode: DrawMode, count: number): void;
  readonly bytesPerParticle: number;
  /** Kümülatif bufferSubData bayt sayacı: kare başına 0 olduğunun kanıtı. */
  readonly uploadedBytes: number;
  dispose(): void;
}

export function createCloud(gl: WebGL2RenderingContext, capacity: number): Cloud {
  const bufA = gl.createBuffer();
  const bufB = gl.createBuffer();
  if (!bufA || !bufB) throw new Error("buffer oluşturulamadı");

  for (const buf of [bufA, bufB]) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // vec2 * 4 bayt = 8 bayt/parçacık, tampon başına
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 8, gl.DYNAMIC_DRAW);
  }

  // Şablon dörtgen: instancing yolunda tek bir kez yükleniyor.
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Dört VAO: (kaynak A / kaynak B) × (dörtgen / nokta)
  const vao = {
    quadAB: makeQuadVao(gl, corners, bufA, bufB),
    quadBA: makeQuadVao(gl, corners, bufB, bufA),
    pointAB: makePointVao(gl, bufA, bufB),
    pointBA: makePointVao(gl, bufB, bufA),
  };

  let sourceIsA = true;
  let uploaded = 0;

  return {
    bytesPerParticle: 16,

    get uploadedBytes() {
      return uploaded;
    },

    push(targets, count) {
      // Kaynak tamponun içeriği artık ölü: bir önceki kelimenin bir öncesi.
      const dest = sourceIsA ? bufA : bufB;
      gl.bindBuffer(gl.ARRAY_BUFFER, dest);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, targets, 0, count * 2);
      uploaded += count * 8;
      sourceIsA = !sourceIsA;
    },

    draw(mode, count) {
      if (mode === "points") {
        gl.bindVertexArray(sourceIsA ? vao.pointAB : vao.pointBA);
        gl.drawArrays(gl.POINTS, 0, count);
      } else {
        gl.bindVertexArray(sourceIsA ? vao.quadAB : vao.quadBA);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
      }
      gl.bindVertexArray(null);
    },

    dispose() {
      for (const v of Object.values(vao)) gl.deleteVertexArray(v);
      gl.deleteBuffer(bufA);
      gl.deleteBuffer(bufB);
      gl.deleteBuffer(corners);
    },
  };
}

function makeQuadVao(
  gl: WebGL2RenderingContext,
  corners: WebGLBuffer,
  source: WebGLBuffer,
  target: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("VAO oluşturulamadı");
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 0); // köşe başına

  gl.bindBuffer(gl.ARRAY_BUFFER, source);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1); // örnek başına

  gl.bindBuffer(gl.ARRAY_BUFFER, target);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);
  return vao;
}

/** POINTS yolunda her köşe BİR parçacık: divisor 0, şablon dörtgen yok. */
function makePointVao(
  gl: WebGL2RenderingContext,
  source: WebGLBuffer,
  target: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("VAO oluşturulamadı");
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, source);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, target);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 0);

  gl.bindVertexArray(null);
  return vao;
}
