export interface AlphaRaster {
  readonly width: number;
  readonly height: number;
  /** Uzunluk width*height. Yalnızca alfa; RGB atılıyor. */
  readonly data: Uint8Array;
}
