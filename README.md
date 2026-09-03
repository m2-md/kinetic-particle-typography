# Şapkasız kalan Ğ — Canvas metin rasterinden 250.000 parçacığa kinetik tipografi

"Şapkasız Kalan Ğ: Canvas Metin Rasterinden 250.000 Parçacığa Kinetik Tipografi"
makalesinin çalışan kodu.

Metin Canvas 2D'de rasterize ediliyor, **alfa kanalından** parçacık hedefleri
çıkıyor, kelime değişince kimin nereye gideceğine **Morton sırası** karar veriyor
ve morph **tek bir uniform**'la sürülüyor. Kare başına GPU'ya giden veri sıfır bayt.

Yığın: ham **WebGL2 (GLSL ES 3.00)** + **Canvas 2D** + TypeScript + Vite + vitest.
Three.js yok, R3F yok, parçacık/tween/tipografi kütüphanesi yok, **runtime bağımlılığı
yok**. Tek "hazır" bileşen tarayıcının kendi font rasterleştiricisi (`fillText`) —
bilerek: metin burada bir *veri kaynağı*, render hedefi değil.

## Hattın tamamı

| Adım | Dosya | Ne yapıyor |
| --- | --- | --- |
| Kutu | `src/raster/rasterizeText.ts` | **Bütün** kelimelerin `actualBoundingBoxAscent` maksimumundan tek kutu |
| Raster | `src/raster/rasterizeText.ts` | `fillText` → `getImageData` → yalnız alfa (4 baytta 1 okuma) |
| Eşik | `src/raster/extractTargets.ts` | Kapsama dizini; alfa **ağırlık** taşıyor, ikili bayrak değil |
| Örnekleme | `src/raster/extractTargets.ts` | Katmanlı yürüyüş, `u_k = (k + ξ)·toplam/N`, `O(N + M)` |
| Eşleştirme | `src/assign/{morton,rank,pairing}.ts` | Morton kodu (32 bit) + indeks (20 bit) → tek `Float64Array` anahtarı |
| Çizim | `src/gl/{cloud,shaders}.ts` | İki statik attribute + `uT` uniform; instanced dörtgen ya da `POINTS` |

## Kurulum

```bash
npm install
```

Runtime bağımlılığı yok; `devDependencies` yalnızca vite / vite-node / vitest /
typescript / prettier.

## Çalıştırma

```bash
npm run dev
```

`http://localhost:5173/` — **port sabit** (`vite.config.ts` → `strictPort: true`),
çünkü aşağıdaki ölçüm URL'leri birebir bu adresi gösteriyor.
**`file://` ile açmayın**, boş ekran verir.

### Demo kontrolleri

| Kontrol | Değerler | Varsayılan |
| --- | --- | --- |
| Kelime | IŞIK / GÜNEŞ / YAĞMUR / ÇİÇEK | otomatik döngü |
| **Aynı kelimeye geç** (`Tekrar`) | — | — |
| Parçacık sayısı | 25k / 100k / 250k | **25k** |
| Alfa eşiği | 1–250 | **32** |
| Kaydırma (stagger) | 0–0,9 | **0,6** |
| Yarıçap | 1–30 px | 3 px |
| Yakınlaştırma | 1,0–4,0× | 1,0× |
| Çizim yolu | Dörtgen (instanced) / Nokta (`gl_PointSize`) | Dörtgen |
| Eşleştirme | Morton / Kimlik / X'e göre / Karıştırılmış | Morton |
| Çözünürlük ölçeği | 0,35 / 0,5 / 0,75 / 1,0 | **0,5** |
| Otomatik döngü | açık/kapalı | açık |
| Dur/Devam | — | Çalışıyor |

`devicePixelRatio` 2'ye kelepçeli (`src/viewport.ts` → `MAX_DPR`), sekme gizlenince
döngü duruyor (`visibilitychange`), HUD **ÖLÇÜM / YAPISAL** diye ikiye ayrılmış.
Morph kare başına sabit adım ilerliyor (`1/72`, delta-zaman **yok**) ve bitince
`60` kare bekliyor — ölçümün deterministik olmasının şartı bu.

### `Tekrar` düğmesi bir NaN kelepçesinin kanıtı

Aynı kelimeye geçmek her parçacığın **kaynağını hedefine eşitliyor**. Vertex
shader'daki yay normali `vec2(-d.y, d.x) / max(length(d), 1e-6)`; `max` olmasa
sıfır vektörde bölme NaN üretir, NaN konum sessizce kırpılır ve **bulut olduğu
gibi kaybolur**. Hata yok, uyarı yok, konsol temiz. Düğme o durumu tetikliyor:
kelepçe çalışıyorsa bulut yerinde durmalı.

Regresyonu `test/shaderSource.test.ts` `VERTEX_SRC` metni üzerinden de çiviliyor.

### Kelime değişimi ana iş parçacığını dondurur

Raster + alfa taraması + örnekleme + Morton sıralaması kelime başına bir kez, ana
iş parçacığında koşuyor. Donma gizlenmiyor: süresi HUD'daki "son kelime donması"
satırında ve `MEASURE.rebuild[]` içinde duruyor.

## Test

```bash
npm test
```

**79 test yeşil** (15 dosya). Hiçbiri `document`, `window`, `navigator` ya da
`WebGL2RenderingContext` kullanmıyor: headless vitest'te DOM da yok, canvas da,
GPU da. Raster mantığı bu yüzden **saf fonksiyonlara** ayrılmış (`AlphaRaster`
alan fonksiyonlar) ve testler `src/raster/syntheticRaster.ts`'in analitik
kenar yumuşatmalı dikdörtgen/disk rasterleriyle besleniyor.

| Dosya | Test | Neyi çiviliyor |
| --- | --- | --- |
| `morton.test.ts` | 9 | `part1By1` bit yayma; tek eksende monotonluk; yakın nokta → ortak üst bitler; köşeler `(0,0)→0`, `(1,1)→0xffffffff`; aralık dışı kelepçe; 52 bitlik paketlemenin **permütasyon** olması; sıranın koda göre azalmaması; `count > 2^20` fırlatması |
| `extractTargets.test.ts` | 8 | Eşiğin **tam sınırı** dâhil (`>=`); prefix kesin artan ve toplamla biten; alfa 128 olan pikselin 255'in **yarısı kadar** oy kullanması (20k örnekle oran testi); her zaman tam `count` hedef; her noktanın eşiği geçen bir pikselin içinde olması; boş rasterde `count*2` sıfır |
| `pairing.test.ts` | 8 | Dört sıralama da geçerli permütasyon; aynı tohum aynı permütasyon; `orderByX` çıktısı x'e göre azalmayan; Morton ve X-sıralı karıştırılmışın yarısının altında; Morton kimliği de yeniyor; **kimlik dikeyde karıştırılmışın onda birinden az, yatayda ondan aşağı değil**; Morton iki eksende birden toparlıyor |
| `easing.test.ts` | 7 | `smoothstep` sınırları ve tam ortada `0,5`; `localTime(t, phase, 0)` her `phase` için aynı; `spread = 0,6`'da `phase = 0` her `t`'de `phase = 1`'den büyük-eşit; **sıfır uzunluklu yer değiştirmede `bowedPosition` NaN üretmiyor** |
| `shaderSource.test.ts` | 7 | `withDefines` `#version` satırını bozmuyor (ilk satır hâlâ `#version 300 es`); define'lar ikinci satırdan; boş listede kaynak değişmiyor; `VERTEX_SRC` içinde `max(length(d), 1e-6)` **var**; `sin(` tabanlı hash **yok** |
| `syntheticRaster.test.ts` | 6 | `solidBox` kapsanan piksel sayısı elle sayılabilir; `syntheticWord` alfa rampası sürekli; aynı tohum aynı raster |
| `stats.test.ts` | 6 | Medyan/yüzdelik; boş dizide `NaN` (0 **değil**); p0 = min, p100 = maks; **girdi mutasyona uğramıyor** |
| `readability.test.ts` | 4 | Özdeş maskede `iou === 1`, ayrık maskede 0; bant sınırları doğru kesiyor; `splat` ızgara dışını kelepçeliyor |
| `occupancy.test.ts` | 4 | Düzgün ızgarada CV ≈ 0; tek hücreye yığılmada yüksek; boş girdide tanımlı değer |
| `viewport.test.ts` | 4 | `dpr = 3 → 2`; ölçek `[0,25; 1]`; sonuç asla 0 |
| `sampleTargetsEquivalence.test.ts` | 4 | Yürüyüş ile ikili arama **bit-birebir** aynı `Float32Array` (3 raster × 3 count) |
| `rgbProbe.test.ts` | 3 | Yalnız `0 < a < 255` pikselleri sayılıyor; sapma `max(\|R−255\|, \|G−255\|, \|B−255\|)` |
| `travel.test.ts` | 3 | Özdeş bulutta `meanTravel === 0`; sabit kaydırmada tam kaydırma; tek noktalı bulut |
| `hash.test.ts` | 3 | `hash01` çıktısı `[0,1)`; deterministik; ilk 8 indeks sabit değerlere çivili (shader ikizinin referansı) |
| `rng.test.ts` | 3 | `mulberry32` aralığı, tekrar üretilebilirliği, farklı tohum farklı dizi |

## Tip kontrolü ve derleme

```bash
npx tsc --noEmit   # 0 hata
npm run build      # tsc && vite build → dist/
```

`vite build`'in geçmesi shader'ın **çalıştığını** kanıtlamıyor: GLSL çalışma anında
derleniyor. Tarayıcı doğrulaması zorunlu.

## `npm run bench` — tarayıcısız algoritma ölçümleri

```bash
npm run bench
```

Konsola **tek satır** `BENCH {json}`. Gerçek font yok; `syntheticWord(1024, 256, seed)`
ile üretilmiş iki sentetik raster kullanılıyor. Karşılaştırılan şey **algoritma**,
mutlak sayı değil. Her zamanlama 3 koşu, medyan raporlanıyor, ham koşular `runs`
alanında duruyor.

Bu makinede (Node v22.22.2), 1024×256 raster, eşik 32, kapsanan 58.901 / 60.285 piksel:

| Ölçüm | Değer |
| --- | --- |
| Örnekleme 25k — yürüyüş / ikili arama | 2,53 / 3,23 ms |
| Örnekleme 100k — yürüyüş / ikili arama | 2,92 / 6,26 ms |
| Örnekleme 250k — yürüyüş / ikili arama | 7,14 / 13,84 ms |
| `equivalence.walkEqualsBinary` | **`true`** (bit-birebir) |
| Doluluk CV — rastgele / katmanlı / katmanlı+jitter | 0,4414 / 0,4308 / 0,4314 |
| Ortalama yol — karıştırılmış / kimlik / X / Morton | %34,17 / %35,12 / %5,37 / %6,17 |
| Sıralama maliyeti — karıştırma / X / Morton (100k) | 1,51 / 10,02 / 10,89 ms |
| Morton 250k — anahtar / `sort()` / `reorder` | 6,06 / 9,32 / 12,89 ms |

### `pairing.axis` — kimliğin kazancı nerede

Toplam mesafeye bakınca kaybolan ayrım, eksen ayrıştırmasında görünüyor
(birim: kutu genişliğinin yüzdesi):

| Eşleştirme | Yatay | Dikey |
| --- | --- | --- |
| Karıştırılmış | 32,96 | 5,33 |
| Kimlik | **35,11** | **0,19** |
| X'e göre | **0,55** | 5,20 |
| Morton | 5,87 | 1,15 |

Kimlik eşleştirmesinin bedava kazandığı şey **yalnızca dikey uyum** — katmanlı
yürüyüş kapsama dizinini satır satır tarıyor. Yatayda hiçbir garantisi yok; bu
sentetik çiftte yatay yolu rastgeleden **daha kötü** çıkıyor, dolayısıyla toplam
mesafede rastgeleyi yenemiyor. `orderByX` bunun aynadaki görüntüsü: yatayda
kusursuz, dikeyde rastgele kadar kötü. Morton iki ekseni birden toparlayan tek yol.

> **Not:** `BENCH` çıktısı makaledeki hiçbir tabloyu doldurmaz; **çapraz kontrol**
> içindir. Makalenin tabloları gerçek fontla alınan `MEASURE` koşusundan gelir.
> Sentetik rasterlerde kimlik/karıştırılmış sıralaması kutu oranına duyarlı
> (1024×256'da terse dönüyor); gerçek fontta ne çıktığına `MEASURE.pairing` ve
> `MEASURE.pairing.axis` karar verir.

## Deterministik ölçüm modu — ÖLÇÜM URL'LERİ

```bash
npm run dev
```

| URL | Ne ölçer |
| --- | --- |
| `http://localhost:5173/?measure=1` | Ana koşu, konsola tek satır `MEASURE {json}` |
| `http://localhost:5173/?measure=1&load=8` | Aynı koşu, bulut kare başına **8 kez** çiziliyor (vsync tavanının üstüne çıkmak için) |
| `http://localhost:5173/?measure=1&warmup=1&frames=2` | **Yalnızca duman testi.** Hattın bütün alanları doluyor mu diye bakar; zamanlama sayıları çöptür |

`warmup` / `frames` override'ı makaleye giren sayı için **kullanılmaz**. Kullanılan
değerler raporun `warmup` ve `frames` alanlarına yazıldığı için kısaltılmış koşu
kendini ele verir: makaledeki tablo `"warmup": 60, "frames": 180` olan bir satırdan
gelmek zorunda.

`?measure=1` açıldığında: kontrol paneli ve rAF döngüsü kapanır, kareler elle
sürülür, arka tampon **960×540**'a kilitlenir (`devicePixelRatio` ve ölçek yok
sayılır), tohum kelime başına sabittir (`seed = kelimeIndex + 1`), kelime döngüsü
durur ve `uT` elle set edilir. Her zamanlama bloğu **60 ısınma + 180 ölçülen** kare.
Sonunda konsola **tek satır** `MEASURE {json}` düşer; başka `console.log` yok
(uyarılar `console.warn`'a gider).

Koşu programı sırayla: (1) font + kutu metrikleri · (2) kenar piksellerinde RGB
sapması · (3) `willReadFrequently` açık/kapalı `getImageData` · (4) eşik taraması
`t ∈ {8, 32, 64, 128, 200}`, "YAĞMUR" vs "YAGMUR" · (5) kelime başına çıkarma
faturası (100k, eşik 32) · (6) örnekleme yolu 25k/100k/250k · (7) doluluk CV ·
(8) eşleştirme (dört yol + eksen ayrıştırması) · (9) çizim: `{nokta, dörtgen} ×
{25k, 100k, 250k}`, `uT = 0,5` · (10) morph maliyeti `uT ∈ {0; 0,5; 1}` ·
(11) kelime değişim donması · (12) shader/CPU easing paritesi · (13) okunabilirlik
IoU'su (`spread ∈ {0,6; 0}`) · (14) `ALIASED_POINT_SIZE_RANGE`.

### `MEASURE` şeması

```json
{
  "font": "180px KptRoboto",
  "fontFallback": false,
  "fontSize": 180,
  "gpu": "…",
  "backing": { "width": 960, "height": 540 },
  "warmup": 60,
  "frames": 180,
  "load": 1,
  "gpuTimer": true,
  "pointSizeRange": [1, 511],
  "colorBufferFloat": true,

  "box": {
    "width": 0, "height": 0, "baseline": 0, "fontAscent": 0,
    "words": [{ "word": "IŞIK", "ascent": 0, "descent": 0, "inkWidth": 0 }]
  },

  "rgb": { "maxDeviation": 0, "edgePixels": 0 },
  "readFrequently": { "onMs": 0, "offMs": 0 },
  "threshold": [{ "t": 8, "withBreve": 0, "withoutBreve": 0, "delta": 0 }],
  "extract": [{ "word": "IŞIK", "getImageDataMs": 0, "scanMs": 0, "sampleMs": 0,
                "sortMs": 0, "totalMs": 0, "covered": 0 }],
  "sampling": [{ "count": 25000, "walkMs": 0, "binaryMs": 0 }],
  "occupancy": { "cell": 8, "random": 0, "stratified": 0, "stratifiedJitter": 0 },

  "pairing": {
    "unit": "kutu genişliği %",
    "shuffled": 0, "identity": 0, "byX": 0, "morton": 0,
    "axis": { "shuffled": { "x": 0, "y": 0 }, "identity": { "x": 0, "y": 0 },
              "byX": { "x": 0, "y": 0 }, "morton": { "x": 0, "y": 0 } },
    "shuffleMs": 0, "sortXMs": 0, "sortMortonMs": 0
  },

  "draw": [{ "mode": "points", "count": 25000,
             "gpuMs": { "median": 0, "p95": 0 },
             "frameMs": { "median": 0, "p95": 0 } }],
  "morph": { "t0": 0, "t05": 0, "t1": 0 },
  "memory": [{ "count": 25000, "vramBytes": 0, "perWordBytes": 0, "perFrameBytes": 0 }],
  "rebuild": [{ "count": 25000, "totalMs": 0, "secondRunMs": 0 }],
  "parity": { "maxAbsDiff": 0, "skipped": false },

  "readability": {
    "cell": 4,
    "spread06": { "leftNew": 0, "midNew": 0, "rightOld": 0, "rightNew": 0 },
    "spread0": { "leftNew": 0, "rightOld": 0, "mean": 0 }
  }
}
```

Kurallar:

- **GPU zamanı yoksa uydurulmuyor.** `EXT_disjoint_timer_query_webgl2` yoksa
  `gpuTimer: false` gelir, `draw[].gpuMs` ve `morph.*` alanları `null` kalır,
  yalnız kare süresi okunur.
- GPU zaman damgaları **kuantize olabilir**: aynı medyanın tekrar etmesi sayacın
  çözünürlüğünü gösterir, kararlılığı değil. Ham medyan raporlanıyor.
- `GPU_DISJOINT_EXT` bayrağı okunuyor; sürücü bağlam değiştirdiği karelerin
  ölçümü atılıyor (`src/measure/gpuTimer.ts`).
- `EXT_color_buffer_float` yoksa `parity.skipped: true` olur ve parite kontrolü
  atlanır — sayı uydurulmaz.
- **`memory[].perFrameBytes` 0 olmak ZORUNDA.** 0'dan farklı çıkarsa kod hatalı:
  kare döngüsüne `bufferSubData` sızmış demektir. Sayaç `Cloud.uploadedBytes`
  üzerinden gerçek yükleme bayt sayısını topluyor, hesaplanmış bir sabit değil.
- `frameMs.median` ekran yenileme hızına kilitlenir. Doygunluğu `gpuMs`'ten ya da
  `?load=8` koşusundan okuyun, kare süresinden değil.
- Ölçüm **gizli sekmede alınmaz**: `requestAnimationFrame` kısılır, sayılar bozulur.
- İki ardışık koşuda `extract[].covered`, `threshold[]`, `pairing[]` ve `occupancy`
  değerleri **birebir aynı** çıkmalı; deterministik olmayan tek şey zamanlamalar.

### Ham ölçüm kaydı

Seri konvansiyonu: konsola düşen `MEASURE {json}` satırları
`measurements-YYYY-MM-DD.jsonl` dosyasına, satır başına bir koşu olacak şekilde
yazılır (`id` alanı URL etiketiyle, soğuk koşular `note` ile işaretli).
Makaledeki tablolar bu dosyaya dayanır.

## Font

`public/fonts/Roboto-Regular.ttf` (Apache-2.0, lisans metni
`public/fonts/LICENSE-Roboto.txt`) `FontFace` API'siyle `KptRoboto` adıyla
yükleniyor ve rasterleştirmeden önce `await document.fonts.ready` bekleniyor.
Bu satır olmadan `ctx.font` ataması **sessizce** yedek fonta düşer: raster çalışır,
parçacıklar oluşur, kelime yanlış fontla yazılır, hiçbir yerde uyarı çıkmaz.

Yükleme başarısız olursa `system-ui, sans-serif` ile devam edilir ve
`MEASURE.fontFallback` **`true`** gelir. O durumda ölçümler makineye özgüdür;
makaledeki kutu/ascent sayıları paketli fontla alınmış olanlarla karşılaştırılamaz.

Demo kelimeleri sabit: `IŞIK`, `GÜNEŞ`, `YAĞMUR`, `ÇİÇEK`. Ekranda gösterilmeyen
kontrol kelimesi `YAGMUR` yalnız breve'in eşik altındaki payını ölçmek için var
ve **kutuyu kurarken de hesaba katılıyor** — makalenin açılış hatası bu projede
oluşmasın diye.

## Bilinen kapsam sınırları

- Hedefler kelime başına **bir kez** hesaplanıyor; kare içinde yeniden örnekleme yok.
- Parçacık konumu GPU'da saklanmıyor; morph iki statik attribute arasında `mix`.
  Compute shader / transform feedback / FBO ping-pong yok.
- Optimal atama (Macar algoritması / optimal transport) uygulanmıyor: `O(n³)`.
- Metin tek satır ve tek kelime; satır sarma, kerning müdahalesi, RTL yok.
- 1.000.000 parçacık seçeneği **yok** (seri demo ağırlık kuralı). Sınır bellek
  değil — 250k'da bile iki tampon toplam 4 MB — kelime değişimindeki CPU donması
  ve doldurma maliyeti.
- Fizik yok: parçacıklar arası kuvvet, çarpışma, akış alanı yok. Yol = `mix` + yay.

## Lisans

MIT — bkz. `LICENSE`. Paketli font ayrı lisansla gelir:
`public/fonts/LICENSE-Roboto.txt` (Apache-2.0).
