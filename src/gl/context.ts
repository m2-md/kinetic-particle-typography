export interface GlContext {
  readonly gl: WebGL2RenderingContext;
  /** [min, max] — max varies from machine to machine, no guarantee. */
  readonly pointSizeRange: readonly [number, number];
  readonly rendererName: string;
  readonly colorBufferFloat: boolean;
}

export function createContext(canvas: HTMLCanvasElement): GlContext {
  const gl = canvas.getContext("webgl2", {
    alpha: false,
    antialias: false,
    depth: false,
    powerPreference: "high-performance",
  });
  if (!gl) throw new Error("could not obtain a WebGL2 context");

  const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
  // [min, max] — max varies from machine to machine, no guarantee

  const debug = gl.getExtension("WEBGL_debug_renderer_info");
  const rendererName = debug
    ? String(
        gl.getParameter((debug as { UNMASKED_RENDERER_WEBGL: number }).UNMASKED_RENDERER_WEBGL),
      )
    : String(gl.getParameter(gl.RENDERER));

  return {
    gl,
    pointSizeRange: [range[0], range[1]],
    rendererName,
    colorBufferFloat: gl.getExtension("EXT_color_buffer_float") !== null,
  };
}
