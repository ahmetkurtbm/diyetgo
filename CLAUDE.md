# Diyetgo - Claude Code Project Instructions

## 1. Proje Tanımı

Diyetgo, diyetisyenlerin danışanlarını yönetmesini, beslenme planları oluşturmasını, öğün ve menü içeriklerini düzenlemesini, randevularını takip etmesini ve beslenme hedeflerini hesaplamasını sağlayan bir web uygulamasıdır.

Projenin amacı yalnızca çalışan bir demo oluşturmak değil; gerçek bir yazılım projesinde kullanılabilecek düzenli, sürdürülebilir, test edilebilir ve genişletilebilir bir mimari kurmaktır.

### Temel hedefler

- Modern ve kurumsal bir dashboard geliştirmek.
- Tüm temel modüller için CRUD işlemlerini tamamlamak.
- Yerel geliştirmede PostgreSQL kullanmak.
- Vercel üzerinde veritabanı gerektirmeyen bir demo sunmak.
- Aynı arayüz ve iş mantığını mümkün olduğunca iki çalışma modunda da kullanmak.
- Veritabanı değişikliklerini sürümlü migration dosyalarıyla yönetmek.
- GitHub üzerinde temiz, anlaşılır ve çalıştırılabilir bir proje sunmak.
- Gereksiz altyapı, bağımlılık ve soyutlamalardan kaçınmak.

### 1.1. İlk sürüm kapsamı ve sınırları

İlk sürüm tek bir diyetisyen için çalışır.

Kapsam dışı olanlar:

- Kimlik doğrulama, kullanıcı hesapları ve çoklu kullanıcı desteği.
- Otomatik menü optimizasyonu algoritması. Temel kalori ve makro hesaplamaları kapsamdadır.
- Bağımsız öğün şablonu modülü. Tekrar kullanım beslenme planı kopyalamayla sağlanır.
- Besin değeri snapshot mekanizması. Plan toplamları canlı hesaplanır (bkz. 4.4).
- PostgreSQL eklentileri ve `btree_gist` exclusion constraint'leri. Çakışma kontrolleri uygulama seviyesindedir.

Kimlik doğrulama olmadığı için uygulama gerçek kişisel veya sağlık verileriyle herkese açık bir ortamda kullanılmamalıdır. Bu sınırlardan birini kaldırmak yeni bir gereksinimdir; önce tasarlanmalı ve onaylanmalıdır.

## 2. Teknoloji ve Proje Yapısı

### 2.1. Teknoloji kararları

- Monorepo: npm workspaces.
- Frontend: React, TypeScript, Vite.
- Arayüz: Tailwind CSS ve gerektiğinde shadcn/ui. Animasyon: motion.
- Yerel backend: Express ve TypeScript.
- Veritabanı: PostgreSQL 18, Docker Compose ile çalıştırılır.
- ORM ve migration: Drizzle ORM ve Drizzle Kit.
- Doğrulama: Zod; şemalar web ve server arasında ortaktır.
- Demo depolaması: Tarayıcı tarafında localStorage.
- Yayınlama: Vercel (yalnızca web paketi).
- Kaynak kodu: Git ve GitHub.
- Test: Vitest; gerektiğinde API ve uçtan uca test araçları.

Bağımlılık eklemeden önce sürüm uyumluluğunu kontrol et. Bu kararlardan birini değiştirmek gerekiyorsa önce gerekçesini açıkla ve onay al.

### 2.2. Klasör yapısı

```
diyetgo/
├── package.json            # workspaces kökü ve ortak script'ler
├── docker-compose.yml      # yalnızca PostgreSQL servisi
├── .env.example            # sahte değerler
├── vercel.json
└── packages/
    ├── shared/             # @diyetgo/shared
    ├── server/             # @diyetgo/server
    │   ├── drizzle.config.ts
    │   ├── drizzle/        # sürümlü migration dosyaları
    │   └── src/            # db/, routes/, services/
    └── web/                # @diyetgo/web
        └── src/data/       # repository arayüzleri, api/ ve demo/ implementasyonları
```

### 2.3. Paket sorumlulukları

- `packages/shared`: Yalnızca web ve server tarafından gerçekten ortak kullanılan kodlar: tipler, Zod şemaları, saf hesaplama fonksiyonları, ortak iş kuralları (randevu çakışması, hedef dönemleri, plan günü kuralları) ve kurgusal seed verileri. React, Express, Drizzle veya tarayıcı API'lerine bağımlı olamaz. Tek tarafın kullandığı kodu buraya taşıma.
- `packages/server`: Express API, Drizzle şeması, migration'lar, servis ve veritabanı katmanı, sunucu tarafı doğrulama ve hata yönetimi. Yalnızca yerelde çalışır; Vercel'e dağıtılmaz.
- `packages/web`: Arayüz, repository arayüzleri ve web'e özgü veri sağlayıcıları (API ve localStorage implementasyonları), çalışma modu seçimi.

## 3. İki Çalışma Modu

Diyetgo iki ayrı veri sağlayıcısıyla çalışır. Mod, build zamanında `VITE_DATA_MODE` ortam değişkeniyle seçilir: `api` (yerel) veya `demo` (Vercel).

### 3.1. Yerel PostgreSQL modu

Veri akışı: arayüz → API repository → Express API → servis katmanı → Drizzle → PostgreSQL (Docker).

- Kalıcı veriler PostgreSQL'de tutulur.
- Veritabanı bağlantı bilgileri ortam değişkenlerinden okunur ve yalnızca server tarafında bulunur.
- Doğrulama ve veri bütünlüğü backend tarafında da kontrol edilir.
- Geliştirmede Vite proxy `/api` isteklerini Express'e yönlendirir.

### 3.2. Vercel demo modu

Veri akışı: arayüz → demo repository → doğrudan tarayıcıdaki localStorage.

- Backend API ve PostgreSQL gerektirmez; Vercel'e yalnızca `@diyetgo/web` derlenip dağıtılır.
- İlk açılışta `packages/shared` içindeki kurgusal seed verileriyle kullanılabilir durumdadır.
- Demo verilerini sıfırlama seçeneği sunar.
- Arayüz, verilerin yalnızca bu tarayıcıda tutulduğunu belirtir. Verilerin kalıcı, güvenli veya cihazlar arasında senkronize olduğu iddia edilmez.
- Demo repository, veritabanındaki bütünlük kurallarını (arşivleme, silme engeli, alt kayıtların silinmesi) aynı şekilde uygular.

### 3.3. Veri erişim mimarisi

Bileşenler doğrudan HTTP API veya localStorage ayrıntılarına bağımlı olmamalıdır. Veri erişimi `packages/web` içindeki repository arayüzleri üzerinden yürütülür. Örnekler: `ClientRepository`, `FoodRepository`, `MealPlanRepository`, `AppointmentRepository`.

Her arayüzün iki implementasyonu vardır: API ve demo. Hangisinin kullanılacağını basit bir factory seçer; dependency injection sistemi kurma.

Server repository arayüzlerini uygulamaz; kendi servis ve veritabanı katmanını kullanır. İki modun ortak davranışı, `packages/shared` içindeki şemalar ve kurallarla sağlanır.

## 4. Veritabanı ve Migration Kuralları

### 4.1. Docker ve PostgreSQL

- PostgreSQL 18, Docker Compose ile çalışır. Compose proje adı `diyetgo`, container adı `diyetgo-db`, host portu `5433`, container portu `5432`.
- Veriler adlandırılmış bir volume'de kalıcı tutulur.
- PostgreSQL 18 imajında volume bağlama yolu önceki sürümlerden farklıdır. Yolu kullanmadan önce resmi imaj belgeleriyle doğrula.
- İlk container başlatılmadan önce mevcut container ve volume'leri listele; isim çakışması olmadığını doğrula.
- Başka projelerin Docker kaynaklarına dokunma. `docker compose down -v`, `docker volume rm` ve `docker system prune` gibi veri silen komutları açık onay olmadan çalıştırma.

### 4.2. Migration

- Şema `packages/server/src/db/` içinde tanımlanır. Yapılandırma `packages/server/drizzle.config.ts`, migration dosyaları `packages/server/drizzle/` dizinindedir.
- Migration'lar `drizzle-kit generate` ile, anlamlı bir adla üretilir. Üretilen SQL dosyaları ve `meta/` dizini Git'e eklenir.
- `drizzle-kit push` kullanılmaz; şema değişiklikleri yalnızca migration dosyalarıyla yapılır.
- Uygulanmış migration dosyaları değiştirilmez. Düzeltme yeni bir migration ile yapılır.
- Migration'lar yalnızca açık bir komutla uygulanır; uygulama açılışında otomatik çalıştırılmaz.
- Migration uygulanmadan önce üretilen SQL incelenir ve hedef veritabanı (host, port, veritabanı adı) doğrulanır.
- Yıkıcı değişikliklerde (tablo veya kolon silme, tip daraltma, mevcut veriye NOT NULL ekleme) etkiler açıklanır ve açık onay alınır.
- Başlangıç verileri migration'lardan ayrı bir seed komutuyla yüklenir. Seed yalnızca kurgusal veri içerir ve tekrar çalıştırıldığında kayıtları çoğaltmaz.
- Migration, seed ve test veritabanı komutları README'de belgelenir.

### 4.3. Test veritabanı

- Testler ayrı `diyetgo_test` veritabanını kullanır. Bu veritabanı aynı PostgreSQL container'ında bulunur.
- Geliştirme bağlantısı `DATABASE_URL`, test bağlantısı `TEST_DATABASE_URL` değişkeninden okunur. Test yapılandırması `DATABASE_URL`'i hiçbir koşulda kullanmaz.
- Test kurulumu bağlanmadan önce veritabanı adının `_test` ile bittiğini doğrular. Doğrulama başarısızsa testler başlamadan durur.
- Tablo temizleme ve sıfırlama işlemleri yalnızca bu doğrulamadan sonra çalışır.
- Test veritabanına migration'lar test kurulumunda uygulanabilir. Bu, uygulama açılışında otomatik migration yasağının istisnası değildir; yalnızca test veritabanı için geçerlidir.
- Testlerde gerçek kişisel veya sağlık verisi kullanılmaz.

### 4.4. Veri modeli kararları

- Kimlikler uuid'dir. Demo modunda da aynı biçimde üretilir.
- Arşivleme `archived_at` alanıyla yapılır. Arşivlenen kayıtlar varsayılan listelerde gizlenir ve geri alınabilir.
- İlk tablolar:
  - `clients`
  - `measurements`
  - `foods`
  - `meal_types`
  - `meal_plans`
  - `plan_meals`
  - `plan_meal_items`
  - `appointments`
  - `client_goals`
- Plan günleri görelidir: `plan_meals.day_number` 1'den başlar. Planın başlangıç tarihi `meal_plans.start_date` alanında ayrı tutulur. Bir günün takvim tarihi `start_date + (day_number − 1)` olarak bulunur. Bitiş tarihi varsa gün numarası plan süresini aşamaz.
- Ayrı bir plan günü tablosu yoktur. Menü yapısı plan → öğün (`plan_meals`) → öğün içeriği (`plan_meal_items`) şeklindedir. Aynı gün aynı öğün türü bir kez bulunur.
- Miktarlar besinin temel biriminde (g veya ml) saklanır. Besin değerleri 100 g veya 100 ml başınadır. Porsiyon bilgisi besin üzerinde tutulur ve arayüzde temel birime çevrilir.
- Besin değerleri canlı hesaplanır. Bir besin güncellendiğinde, o besini kullanan planların hesaplanan toplamları da değişir. Bu davranış README'de ve besin düzenleme ekranında açıkça belirtilir.
- Silme politikası:
  - Danışan, besin ve öğün türü varsayılan olarak arşivlenir. İlişkili kayıtları varken bu kayıtların silinmesi veritabanında `RESTRICT` ile engellenir.
  - Plan silindiğinde öğünleri ve öğün içerikleri de silinir (`CASCADE`). Öğün silindiğinde içerikleri silinir.
  - Ölçüm, hedef ve randevu gibi alt kaydı olmayan kayıtlar silinebilir. Randevu için varsayılan işlem iptal etmektir (durum değişikliği).
  - Arşivlenmiş danışana yeni plan veya randevu eklenemez. Arşivlenmiş besin yeni öğünlere eklenemez ama mevcut planlarda görünmeye devam eder.
- Hedef geçmişi korunur. Her hedefin `valid_from` ve isteğe bağlı `valid_to` tarihi vardır. Aktif hedef, bugünü kapsayan dönemdir. Yeni hedef eklendiğinde önceki açık hedef aynı işlem içinde kapatılır. Aynı danışanın hedef dönemleri çakışamaz.
- Çakışma kontrolleri `packages/shared` içindeki kurallarla iki modda da yapılır: iptal edilmemiş randevular çakışamaz, hedef dönemleri çakışamaz. Danışan başına tek açık hedef, kısmi unique index ile veritabanında da korunur.
- Randevu zamanları veritabanında `timestamptz`, API ve demo modunda UTC ISO 8601 metni olarak tutulur. Arayüz zamanları `Europe/Istanbul` saat diliminde gösterir ve girdileri bu dilime göre yorumlar. Takvim günü alanları (`birth_date`, `measured_on`, `start_date`, `valid_from`, `valid_to`) saat bilgisi içermeyen `date` tipindedir. "Bugün", gün aralığı ve UTC ile yerel saat arasındaki dönüşümler yalnızca `packages/shared` içindeki ortak fonksiyonlarla yapılır; bileşenlerde veya servislerde ayrıca saat dilimi hesabı yapılmaz.

Claude Code veritabanına bağlanıp migration üretip uygulayabilir; ancak önce bağlantıyı ve hedef veritabanını doğrulamalıdır. Yanlış veritabanına bağlanma, veri silme veya geri döndürülemez değişiklik riski varsa işlemi durdur ve onay iste.

## 5. Modüller ve İşlevler

Aşağıdaki modüller ilk sürüm kapsamındadır. Kapsam dışı konular için bkz. 1.1.

### 5.1. Dashboard

- Genel özet kartları.
- Toplam danışan sayısı.
- Günlük ve yaklaşan randevular.
- Aktif beslenme planları.
- Son işlemler ve ilgili durumlar.
- Gerçek veri bulunmadığında anlamlı boş durum ekranları.

### 5.2. Danışan yönetimi

- Danışan ekleme.
- Danışanları listeleme ve arama.
- Danışan bilgilerini görüntüleme.
- Danışan bilgilerini düzenleme.
- Danışanı arşivleme; ilişkili kaydı olmayan danışanı silme.
- Temel kişisel bilgiler, hedefler ve notlar.

### 5.3. Ölçüm ve gelişim takibi

- Boy, kilo ve vücut ölçümlerini kaydetme.
- Ölçüm geçmişini görüntüleme.
- Zaman içindeki değişimi grafiklerle gösterme.
- Eksik veya geçersiz ölçüm değerlerini doğrulama.

### 5.4. Besin ve ürün yönetimi

- Besin veya ürün ekleme.
- Besinleri listeleme ve arama.
- Besin değerlerini düzenleme.
- Besinleri arşivleme; hiçbir planda kullanılmayan besini silme.
- Kalori, protein, karbonhidrat ve yağ değerlerini saklama.
- Porsiyon ve ölçü birimlerini tutarlı yönetme.
- Başlangıç için örnek besin verileri sağlama.

Besin değerleri doğrulanmış kaynaklara dayanmalıdır. Örnek verileri gerçek ve doğrulanmış besin değerleri gibi sunma.

### 5.5. Öğün yönetimi

- Öğün türlerini tanımlama (kahvaltı, ara öğün vb.).
- Plan içindeki öğünleri listeleme ve düzenleme.
- Öğün içeriklerini besinlerle ilişkilendirme.
- Porsiyon ve miktar yönetimi.
- Öğün bazında besin değerlerini hesaplama.

### 5.6. Beslenme planları ve menüler

- Plan oluşturma ve düzenleme.
- Danışanla planı ilişkilendirme.
- Planın başlangıç ve bitiş tarihlerini yönetme.
- Göreli gün numarası ve öğün bazında menü oluşturma.
- Öğünlere besin ekleme ve çıkarma.
- Porsiyon miktarlarını değiştirme.
- Planları kopyalama (aynı veya başka danışan için), arşivleme ve silme.
- Günlük ve öğün bazında kalori ve makro toplamlarını canlı hesaplama.

### 5.7. Randevular

- Randevu oluşturma.
- Randevuları listeleme ve filtreleme.
- Randevu tarihini ve durumunu düzenleme.
- Randevuyu iptal etme.
- Danışanla randevuyu ilişkilendirme.
- Geçersiz tarihleri ve çakışmaları uygulama seviyesinde ele alma.

### 5.8. Hedefler ve hesaplamalar

- Günlük enerji hedefi.
- Protein, karbonhidrat ve yağ hedefleri.
- Danışan bazında, geçmişi korunan, dönemli hedefler.
- Hesaplama yöntemlerinin açıkça belgelenmesi.
- Formül ve birimlerin testlerle doğrulanması.

Beslenme hesaplamalarını teşhis veya tedavi önerisi olarak sunma. Sağlıkla ilgili hesaplamaların sınırlamalarını açıkça belirt.

### 5.9. Ayarlar

- Birim ve görüntüleme tercihleri.
- Demo verilerini sıfırlama.

Yeni modül eklemeden önce mevcut kapsamda karşılanmayan somut ihtiyacı belirle.

## 6. CRUD Standartları

Her modülde ilgili olduğu ölçüde şu işlemler desteklenmelidir:

- Create: kayıt oluşturma.
- Read: listeleme ve detay görüntüleme.
- Update: kayıt güncelleme.
- Delete: 4.4'teki silme politikasına göre arşivleme veya güvenli silme.

Her CRUD akışında:

- Girdi doğrulaması yapılmalıdır.
- Kullanıcıya başarılı ve başarısız işlem geri bildirimi verilmelidir.
- Yükleniyor ve boş durumlar ele alınmalıdır.
- İlişkili kayıtların bütünlüğü korunmalıdır.
- Listeleme ekranlarında gerekli arama ve filtreleme bulunmalıdır.
- Silme işlemlerinde veri kaybı riski değerlendirilmelidir.
- Demo modu ile PostgreSQL modu aynı temel davranışları göstermelidir.

Tüm modüllere düşünmeden aynı CRUD kalıbını uygulama. Örneğin randevu iptali, danışan arşivleme ve beslenme planını silme farklı iş kurallarına sahip olabilir.

## 7. Arayüz ve Tasarım

Arayüz modern, kurumsal ve profesyonel bir SaaS dashboard görünümünde olmalıdır.

Temel tasarım ilkeleri:

- Tutarlı boşluklar ve tipografi.
- Okunaklı ve sade navigasyon.
- Düzenli kartlar, tablolar, formlar ve grafikler.
- Masaüstü ve mobil ekranlara uyumluluk.
- Tutarlı renk sistemi ve tasarım bileşenleri.
- Formlarda anlaşılır doğrulama mesajları.
- İşlem geri bildirimleri ve uygun boş durum ekranları.
- Erişilebilir etiketler, klavye navigasyonu ve yeterli kontrast.
- Animasyonlar ölçülü ve amaca yöneliktir (sayfa ve kart girişi, sayaç, ilerleme, geri bildirim); `motion` veya CSS ile yapılır ve `prefers-reduced-motion` açıkken kapanır. Görsel kalabalıktan kaçınma.

Her sayfada farklı tasarım dili oluşturma. Ortak bileşenleri ve tasarım token'larını tutarlı kullan.

İşlevsel gereksinimleri karşılamadan yalnızca görsel görünümü iyileştirmeye odaklanma.

## 8. Kodlama Standartları

- TypeScript kullan; mümkün olduğunca katı tip denetimini koru.
- Gereksiz `any` kullanımından kaçın.
- Mevcut projede kullanılan adlandırma ve dosya düzenine uy.
- Bileşenleri sorumluluklarına göre ayır.
- Aynı iş mantığını birden fazla yerde kopyalama; iki modda gereken kuralı `packages/shared` içine koy.
- Gereksiz soyutlama, tasarım kalıbı ve yardımcı dosya üretme.
- Bir satırlık işlemler için sırf düzen amacıyla aşırı sayıda fonksiyon oluşturma.
- Kullanılmayan importları, değişkenleri ve bağımlılıkları temizle.
- Hata yönetimini açık ve tutarlı uygula.
- Kullanıcı girdilerini güvenilir kabul etme.
- Veritabanı sorgularında parametreli sorgular veya ORM'nin güvenli sorgu mekanizmalarını kullan.
- Gizli bilgileri kaynak koduna yazma.

Mevcut kodu anlamadan büyük çaplı refactor yapma. İstenen değişikliğin kapsamını gereksiz yere genişletme.

## 9. Güvenlik ve Veri Koruma

- Veritabanı parolalarını, token'ları ve gizli anahtarları Git'e gönderme.
- `.env` dosyaları `.gitignore` içinde bulunmalıdır.
- `.env.example` yalnızca örnek değişken adlarını ve sahte değerleri içermelidir.
- Veritabanı erişim bilgileri yalnızca server tarafında bulunmalıdır; `VITE_` önekli değişkenlere gizli bilgi koyma.
- Demo, seed ve testlerde gerçek kişisel veya sağlık verileri kullanma.
- Kimlik doğrulama olmadığı için (bkz. 1.1) yerel API'yi dış ağa açma. Yetkilendirme gerektiren özellikleri güvenliymiş gibi sunma.
- Herkese açık demoda kullanıcılara gerçek kişisel veya sağlık verisi girmemeleri gerektiğini belirt.
- Üretim ortamında hata mesajlarıyla gizli bilgileri açığa çıkarma.
- Silme, sıfırlama ve migration işlemlerinde veri kaybı riskini gözet.

## 10. Test ve Kalite Kontrolü

Testler geliştirme sürecinin bir parçasıdır. Veritabanı testleri yalnızca 4.3'teki test veritabanıyla çalışır.

Öncelikli test alanları:

- Beslenme hesaplamaları.
- Ortak kurallar: randevu çakışması, hedef dönemleri, plan günleri.
- Saat dilimi sınırları: İstanbul'da gece yarısına yakın saatlerdeki randevuların UTC'de önceki veya sonraki güne düşmesi, "bugünkü randevular" filtresinin gün sınırları ve UTC ile yerel saat arasında gidiş-dönüş dönüşümleri. Testler makinenin saat dilimine bağımlı olmamalıdır.
- Repository davranışları; aynı senaryolar API ve demo implementasyonlarına karşı çalıştırılır.
- CRUD işlemleri.
- Girdi doğrulaması.
- İlişkili kayıtların korunması ve silme politikası.
- Migration uygulanması.
- Hata durumları.

Her değişiklikten sonra kapsamla orantılı kontrolleri çalıştır.

Bir komut çalıştırılmadıysa testlerin başarılı olduğunu iddia etme. Test başarısızsa sonucu ve nedenini açıkça bildir.

## 11. Claude Code Çalışma Kuralları

Claude Code aşağıdaki çalışma biçimini izlemelidir:

1. Görevden önce ilgili dosyaları ve mevcut mimariyi incele.
2. Görevin kapsamını ve etkilenecek alanları belirle.
3. Birden fazla dosyayı etkileyen veya mimari karar gerektiren işlerde önce kısa bir plan sun.
4. Basit ve açık görevlerde gereksiz planlama yapmadan ilerle.
5. Onay gerektiren kararları ve riskli işlemleri önceden belirt.
6. Mevcut çalışan davranışları koru.
7. İlgisiz dosyalarda değişiklik yapma.
8. Değişiklikleri küçük ve kontrol edilebilir adımlarla gerçekleştir.
9. Uygun testleri çalıştır.
10. Tamamlandığında değiştirilen dosyaları, yapılan işlemleri ve test sonuçlarını özetle.

Her küçük işlem için kullanıcıdan onay isteme. Ancak veri kaybı, geri döndürülemez değişiklik, güvenlik riski veya önemli mimari tercih söz konusu olduğunda açık onay al.

Kullanıcının istemediği özellikleri kendiliğinden kapsam içine ekleme.

## 12. Skills, Hooks, Scripts ve Ajanlar

Başlangıçta gereksiz yapılandırma üretme.

- Skills: Tekrarlanan ve tanımlı bir iş akışı ortaya çıktığında oluştur.
- Hooks: Belirli olaylarda otomatik ve güvenilir işlem çalıştırma ihtiyacı doğduğunda ekle.
- Scripts: Tekrarlanabilir komut veya otomasyon gerektiğinde oluştur.
- Subagents: Büyük, bağımsız ve paralel yürütülebilen görevlerde kullan.
- MCP: Dış araçlara veya sistemlere bağlantı gerektiğinde değerlendir.

Aynı talimatı farklı dosyalarda gereksiz yere tekrarlama.

`CLAUDE.md` proje genelindeki kuralları ve kararları içermelidir. Ayrıntılı ve tekrarlanabilir prosedürleri gerektiğinde ilgili skill'e taşı.

## 13. Git ve Yayınlama

- Anlamlı commit mesajları kullan.
- Gizli bilgileri ve yerel veritabanı dosyalarını Git'e gönderme.
- README şunları açıklamalıdır: kurulum, Docker ile PostgreSQL, ortam değişkenleri, migration, seed, test veritabanı, çalıştırma adımları, canlı besin değeri hesaplaması ve demo modunun sınırları.
- README, Vercel demosunun backend veya PostgreSQL gerektirmediğini belirtmelidir.
- Yayınlama öncesinde üretim derlemesini ve gerekli testleri çalıştır.
- Vercel'de yalnızca `@diyetgo/web` derlenir ve `VITE_DATA_MODE=demo` ayarlanır. Vercel'de veritabanı bağlantı bilgisi tanımlanmaz.

## 14. Geliştirme Sırası

1. Ortamı doğrula: Docker durumu ve mevcut container ile volume'ler. `git init` çalıştırmadan önce proje dizininde ve üst dizinlerde bir Git deposu olup olmadığını kontrol et (`git rev-parse --show-toplevel`). Mevcut bir depo veya kaydedilmemiş kullanıcı değişiklikleri varsa koru. Yeni depo oluşturma kararını gerekçesiyle ayrıca belirt ve onay al.
2. npm workspaces yapısını kur; mevcut Vite uygulamasını `packages/web` içine taşı ve çalıştığını doğrula.
3. `packages/shared` iskeletini kur: ilk Zod şemaları ve hesaplama fonksiyonları, testleriyle.
4. Docker Compose ve `.env.example` dosyalarını hazırla; PostgreSQL'i başlat ve bağlantıyı doğrula.
5. Drizzle şemasını yaz; ilk migration'ı üret, incele ve uygula. Ardından seed ve test veritabanını hazırla.
6. Express iskeletini ve hata yönetimini kur; ilk API uçlarını ekle.
7. Web'de repository arayüzlerini, API ve demo implementasyonlarını ve mod seçimini oluştur.
8. Modülleri sırayla geliştir: danışanlar, besinler, ölçümler, hedefler ve hesaplamalar, planlar ve menüler (kopyalama dahil), randevular, dashboard, ayarlar.
9. Testleri ve hata yönetimini her modülle birlikte tamamla.
10. Kurumsal dashboard ve responsive tasarımı bütünleştir.
11. README, GitHub ve Vercel dağıtımını tamamla.

Geliştirme sırası teknik bağımlılıklara göre güncellenebilir. Tamamlanmamış işleri açıkça belirt.

## 15. Öncelik Kuralı

Bu dosya proje genelindeki başlangıç talimatıdır. Gerçek kod, mevcut yapılandırma ve açık kullanıcı gereksinimleriyle çelişen bir durum ortaya çıkarsa çelişkiyi gizleme. Önce durumu analiz et ve gerekli kararı açıkla.

Temel öncelik:

**Doğru çalışan, güvenli, anlaşılır ve sürdürülebilir bir Diyetgo geliştirmek. Gereksiz karmaşıklık üretmeden gerçek ihtiyaçları karşılamak.**
