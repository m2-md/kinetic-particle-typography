export interface AlphaRaster {
  readonly width: number;
  readonly height: number;
  /** Length width*height. Alpha only; RGB is thrown away. */
  readonly data: Uint8Array;
}
