/**
 * Ortak animasyon bileşenleri. Hepsi `prefers-reduced-motion` ayarına uyar:
 * `AppProviders` içindeki `MotionConfig reducedMotion="user"` hareketi kapatır, sayaç ise doğrudan
 * son değeri gösterir. Testlerde `MotionGlobalConfig.skipAnimations` ile animasyonlar atlanır.
 */
import { animate, motion, MotionGlobalConfig, useReducedMotion, type Variants } from 'motion/react'
import { useLayoutEffect, useRef, type ReactNode } from 'react'

const ease = [0.22, 1, 0.36, 1] as const

const container: Variants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } }
const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease } },
}

/** Çocuklarını sırayla, aşağıdan yukarı belirerek gösterir. Çocuklar `StaggerItem` olmalıdır. */
export function Stagger({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} variants={container} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function StaggerItem({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <motion.div className={className} variants={item}>
      {children}
    </motion.div>
  )
}

/** Sayfa içeriğinin girişi; sayfa her değiştiğinde yeniden oynar (`AppShell` anahtarı yol adıdır). */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease }}>
      {children}
    </motion.div>
  )
}

/**
 * Sayıyı önceki değerinden yenisine sayarak gösterir. Metin React yerine doğrudan yazılır; böylece
 * animasyon sırasında React'in metin düğümüyle çakışmaz. İlk değer boyamadan önce yazılır.
 */
export function AnimatedNumber({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const previous = useRef(0)
  const reduce = useReducedMotion()

  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const from = previous.current
    previous.current = value
    if (reduce || MotionGlobalConfig.skipAnimations || from === value) {
      node.textContent = String(value)
      return
    }
    node.textContent = String(from)
    const controls = animate(from, value, {
      duration: 0.8,
      ease,
      onUpdate: (v) => {
        node.textContent = String(Math.round(v))
      },
    })
    // Animasyon kareleri çalışmıyorsa (ör. arka plan sekmesi) sayı başlangıç değerinde takılı kalmaz.
    const fallback = setTimeout(() => {
      controls.stop()
      node.textContent = String(value)
    }, 1200)
    return () => {
      clearTimeout(fallback)
      controls.stop()
      // Yarıda kesilen sayım (değer değişti veya StrictMode yeniden çalıştırdı) göründüğü yerden sürer.
      previous.current = Number(node.textContent) || 0
    }
  }, [value, reduce])

  return <span ref={ref} />
}

/** Genişliği sıfırdan hedef orana doğru dolan çubuk (yalnızca görsel; erişilebilir değer çağıranda). */
export function AnimatedBar({ percent, className }: { percent: number; className: string }) {
  // `reducedMotion="user"` yalnızca dönüşümleri kapatır; genişlik animasyonu burada ayrıca kapatılır.
  const reduce = useReducedMotion()
  return (
    <motion.span
      className={`block h-full rounded-full ${className}`}
      initial={reduce ? false : { width: 0 }}
      animate={{ width: `${Math.max(0, Math.min(100, percent))}%` }}
      transition={{ duration: 0.8, ease }}
    />
  )
}
