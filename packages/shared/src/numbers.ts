/** Hesaplama girdisinin sonlu bir sayı olduğunu doğrular; `NaN` ve `±Infinity` için hata verir. */
export function assertFinite(value: number, name: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${name} sonlu bir sayı olmalı (gelen: ${value})`)
  }
}
