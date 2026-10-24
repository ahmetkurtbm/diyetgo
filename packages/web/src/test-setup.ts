import { cleanup } from '@testing-library/react'
import { MotionGlobalConfig } from 'motion/react'
import { afterEach } from 'vitest'

// Testler animasyonların son durumunu görür; sayaçlar ve çubuklar hemen son değerdedir.
MotionGlobalConfig.skipAnimations = true

afterEach(() => cleanup())
