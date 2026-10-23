import { createContext, useContext, useEffect, useRef, useState, type DependencyList } from 'react'
import type { Repositories } from './repositories'

export const RepositoryContext = createContext<Repositories | null>(null)

export function useRepositories(): Repositories {
  const repositories = useContext(RepositoryContext)
  if (!repositories) throw new Error('useRepositories, RepositoryContext içinde kullanılmalı')
  return repositories
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'error'; data?: T; error: unknown }
  | { status: 'success'; data: T; error?: undefined }

/**
 * Repository'den veri yükler ve veri her değiştiğinde (bu veya başka sekmede) yeniden yükler.
 * Yeniden yükleme sırasında önceki veri gösterilmeye devam eder.
 */
export function useRepositoryQuery<T>(load: (repositories: Repositories) => Promise<T>, deps: DependencyList): QueryState<T> {
  const repositories = useRepositories()
  const [state, setState] = useState<QueryState<T>>({ status: 'loading' })
  const [version, setVersion] = useState(0)
  // `load` her render'da yeniden oluşur; en güncelini ref'te tutup yeniden yüklemeyi `deps` ve veri sürümüne bağlarız.
  const loadRef = useRef(load)
  const depsKey = JSON.stringify(deps)

  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => repositories.subscribe(() => setVersion((v) => v + 1)), [repositories])

  useEffect(() => {
    let active = true
    loadRef.current(repositories).then(
      (data) => active && setState({ status: 'success', data }),
      (error: unknown) => active && setState((previous) => ({ status: 'error', data: previous.data, error })),
    )
    return () => {
      active = false
    }
  }, [repositories, version, depsKey])

  return state
}
