export function meanTravel(a: Float32Array, b: Float32Array): number {
  const n = a.length / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const dx = b[i * 2] - a[i * 2];
    const dy = b[i * 2 + 1] - a[i * 2 + 1];
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum / n;
}
