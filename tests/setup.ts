import '@testing-library/jest-dom/vitest'
import 'fake-indexeddb/auto'
import { configure } from '@testing-library/react'
// Telas com muitos passos ficam lentas quando a suíte inteira roda em paralelo.
configure({ asyncUtilTimeout: 5000 })
