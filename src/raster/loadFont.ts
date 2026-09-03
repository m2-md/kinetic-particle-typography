export interface LoadedFont {
  /** `ctx.font` içine yazılacak aile adı. */
  readonly family: string;
  /** Paketli font yüklenemediyse true; ölçüm raporuna ve README'ye giriyor. */
  readonly fallback: boolean;
}

const FALLBACK: LoadedFont = { family: "system-ui, sans-serif", fallback: true };

/**
 * Fontu `FontFace` ile yükleyip `document.fonts.ready`'yi bekler.
 * Bu satır olmadan `ctx.font` ataması sessizce yedek fonta düşer: raster çalışır,
 * parçacıklar oluşur, kelime yanlış fontla yazılır ve hiçbir yerde uyarı çıkmaz.
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
    console.warn(`font yüklenemedi (${url}), yedeğe düşülüyor`, error);
    return FALLBACK;
  }
}
