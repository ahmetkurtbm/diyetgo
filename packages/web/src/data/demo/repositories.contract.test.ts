import { describeRepositoryContract } from '../repository-contract'
import { MemoryStorage } from './memory-storage'
import { createDemoRepositories } from './repositories'
import { openDemoStore } from './store'

describeRepositoryContract('demo (localStorage)', async () => {
  const opened = openDemoStore({ storage: new MemoryStorage() })
  if (!opened.ok) throw new Error(opened.error.message)
  return createDemoRepositories(opened.store)
})
