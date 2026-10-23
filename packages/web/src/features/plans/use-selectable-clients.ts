import { useRepositoryQuery } from '../../data/context'

/**
 * Plan için seçilebilen danışanlar: arşivde olmayanlar; düzenlenen planın mevcut danışanı arşivde olsa da listede kalır.
 * Seçenekler `<select>`'i render eden bileşende yüklenmelidir; aksi hâlde seçenekler geldiğinde seçili değer yansımaz.
 */
export function useSelectableClients(includeId?: string) {
  const clients = useRepositoryQuery((r) => r.clients.list({ includeArchived: true }), [])
  return (clients.data ?? []).filter((c) => c.archivedAt === null || c.id === includeId)
}
