/**
 * Varsayılan hatırlatma sesi: Web Audio ile üretilen iki notalık kısa bir çan sesi (ses dosyası yok).
 * Tarayıcılar sesi yalnızca kullanıcı sayfayla etkileşime girdikten sonra çalmaya izin verir;
 * `unlockAudio` bir tıklamada çağrılır ve sonraki hatırlatmalar sessiz kalmaz.
 */
let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  context ??= new Ctor()
  return context
}

/** Bir tıklama veya dokunma sırasında çağrılır. */
export function unlockAudio(): void {
  void audioContext()?.resume()
}

export async function playChime(): Promise<void> {
  const audio = audioContext()
  if (!audio) return
  try {
    await audio.resume()
  } catch {
    return
  }
  const start = audio.currentTime + 0.02
  for (const [frequency, offset, length] of [
    [880, 0, 0.22],
    [1174.66, 0.24, 0.5],
  ] as const) {
    const oscillator = audio.createOscillator()
    const gain = audio.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start + offset)
    gain.gain.exponentialRampToValueAtTime(0.35, start + offset + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + length)
    oscillator.connect(gain).connect(audio.destination)
    oscillator.start(start + offset)
    oscillator.stop(start + offset + length + 0.05)
  }
}
