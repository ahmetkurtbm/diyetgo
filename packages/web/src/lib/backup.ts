/**
 * Demo verilerinin yedeği. Tarayıcı kullanıcıya sormadan dosya indiremediği için yedek kendiliğinden
 * alınmaz; son yedeğin üzerinden bir hafta geçince uygulama hatırlatır.
 */
import type { DemoControls, DemoInfo } from '../data/repositories'
import { saveBlob } from './files'
import { today } from './format'

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

/** Hiç yedek alınmadıysa ilk hafta örnek verilerin yüklenmesinden sayılır. */
export function isBackupDue(info: Pick<DemoInfo, 'seededAt' | 'lastBackupAt'>, now = new Date()): boolean {
  return now.getTime() - Date.parse(info.lastBackupAt ?? info.seededAt) >= WEEK_MS
}

/** Dosya hazırlanıp indirme başlatılınca yedek zamanı işlenir; hata olursa işlenmez. */
export async function downloadBackup(demo: DemoControls): Promise<void> {
  saveBlob(new Blob([await demo.exportBackup()], { type: 'application/json' }), `diyetgo-yedek-${today()}.json`)
  await demo.recordBackup()
}
