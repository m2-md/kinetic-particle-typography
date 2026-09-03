interface TimerExt {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

export interface GpuTimer {
  begin(): void;
  end(): void;
  /** Collects the results of the ready queries, in ms. */
  collect(out: number[]): void;
}

export function createGpuTimer(gl: WebGL2RenderingContext, poolSize = 8): GpuTimer | null {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!ext) return null;

  const free: WebGLQuery[] = [];
  const pending: WebGLQuery[] = [];
  for (let i = 0; i < poolSize; i++) {
    const q = gl.createQuery();
    if (q) free.push(q);
  }

  let active: WebGLQuery | null = null;

  return {
    begin() {
      active = free.pop() ?? null;
      if (active) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    collect(out) {
      // Results arrive a few frames late; the order is preserved.
      while (pending.length > 0) {
        const q = pending[0];
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        // Disjoint flag: if the GPU switched context the measurement is garbage.
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        }
        free.push(q);
      }
    },
  };
}
