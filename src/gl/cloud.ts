export type DrawMode = "points" | "quads";

export interface Cloud {
  /** Writes the new word over the source buffer and swaps the roles. */
  push(targets: Float32Array, count: number): void;
  draw(mode: DrawMode, count: number): void;
  readonly bytesPerParticle: number;
  /** Cumulative bufferSubData byte counter: the proof that it is 0 per frame. */
  readonly uploadedBytes: number;
  dispose(): void;
}

export function createCloud(gl: WebGL2RenderingContext, capacity: number): Cloud {
  const bufA = gl.createBuffer();
  const bufB = gl.createBuffer();
  if (!bufA || !bufB) throw new Error("could not create buffer");

  for (const buf of [bufA, bufB]) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // vec2 * 4 bytes = 8 bytes/particle, per buffer
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 8, gl.DYNAMIC_DRAW);
  }

  // Template quad: uploaded exactly once on the instancing path.
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Four VAOs: (source A / source B) × (quad / point)
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
      // The source buffer's contents are dead by now: the word before the previous one.
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
  if (!vao) throw new Error("could not create VAO");
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 0); // per corner

  gl.bindBuffer(gl.ARRAY_BUFFER, source);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1); // per instance

  gl.bindBuffer(gl.ARRAY_BUFFER, target);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);
  return vao;
}

/** On the POINTS path every vertex is ONE particle: divisor 0, no template quad. */
function makePointVao(
  gl: WebGL2RenderingContext,
  source: WebGLBuffer,
  target: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("could not create VAO");
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
