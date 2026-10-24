/**
 * Danışanın ilaçları, hastalıkları ve diyetisyen önerileri. Uygulama bu bilgilerden teşhis, ilaç
 * etkileşimi veya tedavi önerisi üretmez; kayıtlar diyetisyenin notudur.
 */
import type { ClientCondition, ClientConditionInput, ClientMedication, ClientMedicationInput, ClientRecommendation, ClientRecommendationInput } from '@diyetgo/shared'
import { HeartPulse, MessageSquareText, Pill } from 'lucide-react'
import { formatDate, today } from '../../lib/format'
import { ClientRecordsCard, type RecordConfig } from './ClientRecordsCard'

const HEALTH_NOTE = 'Kayıt amaçlıdır; uygulama ilaç etkileşimi veya tedavi önerisi üretmez.'

const medications: RecordConfig<ClientMedication, ClientMedicationInput> = {
  title: 'İlaçlar ve takviyeler',
  description: HEALTH_NOTE,
  noun: 'ilaç kaydı',
  addLabel: 'İlaç ekle',
  emptyTitle: 'Kayıtlı ilaç yok',
  emptyDescription: 'Danışanın düzenli kullandığı ilaç ve takviyeleri ekleyin.',
  icon: Pill,
  repository: (r) => r.medications,
  fields: [
    { key: 'name', label: 'İlaç veya takviye adı', kind: 'text', required: true, full: true },
    { key: 'dose', label: 'Doz', kind: 'text', placeholder: 'Ör. 500 mg' },
    { key: 'frequency', label: 'Kullanım sıklığı', kind: 'text', placeholder: 'Ör. Günde 2 kez, yemekten sonra' },
    { key: 'startedOn', label: 'Başlangıç tarihi', kind: 'date' },
    { key: 'endedOn', label: 'Bitiş tarihi', kind: 'date' },
    { key: 'notes', label: 'Notlar', kind: 'textarea' },
  ],
  summary: (m) => ({
    title: [m.name, m.dose].filter(Boolean).join(' · '),
    meta: [
      m.frequency,
      m.endedOn ? `${m.startedOn ? `${formatDate(m.startedOn)} – ` : ''}${formatDate(m.endedOn)} (bitti)` : m.startedOn ? `${formatDate(m.startedOn)} tarihinden beri` : 'Devam ediyor',
    ]
      .filter(Boolean)
      .join(' · '),
    body: m.notes,
  }),
}

const conditions: RecordConfig<ClientCondition, ClientConditionInput> = {
  title: 'Hastalıklar ve sağlık durumu',
  description: HEALTH_NOTE,
  noun: 'hastalık kaydı',
  addLabel: 'Hastalık ekle',
  emptyTitle: 'Kayıtlı hastalık yok',
  emptyDescription: 'Danışanın bildirdiği hastalık, alerji veya sağlık durumlarını ekleyin.',
  icon: HeartPulse,
  repository: (r) => r.conditions,
  fields: [
    { key: 'name', label: 'Hastalık veya durum', kind: 'text', required: true, placeholder: 'Ör. Tip 2 diyabet, çölyak' },
    { key: 'diagnosedOn', label: 'Tanı tarihi', kind: 'date' },
    { key: 'notes', label: 'Notlar', kind: 'textarea' },
  ],
  summary: (c) => ({ title: c.name, meta: c.diagnosedOn ? `Tanı: ${formatDate(c.diagnosedOn)}` : undefined, body: c.notes }),
}

const recommendations: RecordConfig<ClientRecommendation, ClientRecommendationInput> = {
  title: 'Diyetisyen önerileri',
  description: 'Danışana özel öneriler; en yenisi en üstte.',
  noun: 'öneri',
  addLabel: 'Öneri yaz',
  emptyTitle: 'Henüz öneri yok',
  emptyDescription: 'Danışanın durumuna göre beslenme ve yaşam önerilerinizi yazın.',
  icon: MessageSquareText,
  repository: (r) => r.recommendations,
  fields: [
    { key: 'givenOn', label: 'Tarih', kind: 'date', required: true },
    { key: 'text', label: 'Öneri', kind: 'textarea', required: true, placeholder: 'Ör. Akşam öğününü yatmadan en az 2 saat önce tamamlayın.' },
  ],
  defaults: () => ({ givenOn: today() }),
  summary: (r) => ({ title: formatDate(r.givenOn), body: r.text }),
}

export const MedicationsCard = ({ clientId }: { clientId: string }) => <ClientRecordsCard clientId={clientId} config={medications} />
export const ConditionsCard = ({ clientId }: { clientId: string }) => <ClientRecordsCard clientId={clientId} config={conditions} />
export const RecommendationsCard = ({ clientId }: { clientId: string }) => <ClientRecordsCard clientId={clientId} config={recommendations} />
