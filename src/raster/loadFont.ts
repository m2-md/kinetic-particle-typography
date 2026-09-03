export interface LoadedFont {
  /** Family name to write into `ctx.font`. */
  readonly family: string;
  /** True if the bundled font failed to load; goes into the report and the README. */
  readonly fallback: boolean;
}

const FALLBACK: LoadedFont = { family: "system-ui, sans-serif", fallback: true };

/**
 * Loads the font with `FontFace` and awaits `document.fonts.ready`.
 * Without that line the `ctx.font` assignment silently falls back: the raster runs,
 * the particles form, the word is drawn in the wrong font, and nothing warns anywhere.
 */
export async function loadFont(url: string, family: string): Promise<LoadedFont> {
  if (typeof FontFace === "undefined") return FALLBACK;

  try {
    const face = new FontFace(family, `url(${url})`);
    await face.load();
    document.fonts.add(face);
    await document.fonts.ready;
    if (!document.fonts.check(`180px ${family}`)) return FALLBACK;
    return { family, fallback: false };
  } catch (error) {
    console.warn(`font failed to load (${url}), falling back`, error);
    return FALLBACK;
  }
}
