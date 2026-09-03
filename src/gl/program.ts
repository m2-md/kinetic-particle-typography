export function withDefines(src: string, defines: readonly string[]): string {
  if (defines.length === 0) return src;
  // #version ilk satır olmak ZORUNDA; define'lar ikinci satırdan giriyor.
  const nl = src.indexOf("\n");
  return src.slice(0, nl + 1) + defines.map((d) => `#define ${d}\n`).join("") + src.slice(nl + 1);
}

export function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("shader oluşturulamadı");
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? "";
    gl.deleteShader(shader);
    throw new Error(`shader derlenmedi: ${log}`);
  }
  return shader;
}

export function link(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
): WebGLProgram {
  const program = gl.createProgram();
  if (!program) throw new Error("program oluşturulamadı");

  const vs = compile(gl, gl.VERTEX_SHADER, vertexSrc);
  const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentSrc);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program) ?? "";
    gl.deleteProgram(program);
    throw new Error(`program linklenmedi: ${log}`);
  }
  return program;
}

export function createProgram(
  gl: WebGL2RenderingContext,
  vertexSrc: string,
  fragmentSrc: string,
  defines: readonly string[] = [],
): WebGLProgram {
  return link(gl, withDefines(vertexSrc, defines), withDefines(fragmentSrc, defines));
}

export type Uniforms = Record<string, WebGLUniformLocation | null>;

/** Kullanılmayan uniform'lar sürücü tarafından atılıyor; null dönmesi normal. */
export function uniformLocations(
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  names: readonly string[],
): Uniforms {
  const out: Uniforms = {};
  for (const name of names) out[name] = gl.getUniformLocation(program, name);
  return out;
}
