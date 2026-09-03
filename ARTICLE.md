# Şapkasız Kalan Ğ: Canvas Metin Rasterinden 250.000 Parçacığa Kinetik Tipografi

*Metni Canvas 2D'de rasterize edip alfa kanalından parçacık hedefleri çıkarıyoruz, iki kelime arasında kim nereye gidecek sorusunu Morton sırasıyla cevaplıyoruz ve morph'u tek bir uniform'la sürüyoruz. Kare başına GPU'ya giden veri sıfır bayt. Sonda eşik taraması, eşleştirme yollarının kat edilen yol farkı ve geçişin tam ortasında ekranda ne yazdığının ölçüsü var.*

*Tahmini okuma süresi: 19 dakika*

---

Demo üç kelimeyi sırayla yazıyordu: IŞIK, GÜNEŞ, YAĞMUR. İlk ikisi tertemiz. Üçüncüsünde ekranda "YAGMUR" yazdı.

Ğ'nin şapkası yoktu. Harfin gövdesi yerli yerinde, üstündeki kısa yay yok. Konsol sessiz, kare süresi normal, parçacık sayısı doğru.

Hatayı üç katman aşağıda buldum. Raster canvas'ının yüksekliğini bir kez, ilk kelimeye bakarak hesaplamıştım. "IŞIK"ın mürekkebi taban çizgisinin en fazla büyük harf yüksekliği kadar üstüne çıkıyor; "YAĞMUR"unki daha yukarı çıkıyor, çünkü breve büyük harf hattının da üstünde duruyor. Canvas o kadar yüksek değildi. `fillText` şikâyet etmedi, şapkayı kırptı.

Kırpılmış piksel yoksa eşiği geçen piksel yok. Eşiği geçen piksel yoksa hedef yok. Hedef yoksa oraya gidecek parçacık da yok. Zincirin en tepesindeki hata, en altta harfin kimliği olarak görünüyor.

Bu yazı o zincirin tamamı. Sırayla: alfa kanalından hedef çıkarma, sabit sayıda parçacığı o hedeflere katmanlı bir yürüyüşle dağıtma, kelime değişince kimin nereye gideceğine karar verme, geçişi tek bir uniform'la sürüp instancing ile çizme. Sonda beş ölçüm var. Kelime başına raster maliyeti, eşik taramasının hedef sayısına etkisi, dört eşleştirme yolunun kat ettirdiği yol, nokta ile dörtgen çiziminin GPU ms farkı ve geçişin tam ortasında ekranın hangi üçte birinde hangi kelimenin okunduğu.

Sürüm notu: ham WebGL2 (GLSL ES 3.00), Canvas 2D, TypeScript, Vite, vitest. Three.js yok, parçacık kütüphanesi yok, tween kütüphanesi yok.

Bu seride parçacıkları bir kez daha morph etmiştik; orada hedefler bir mesh'in yüzeyinden alan-ağırlıklı örneklemeyle çıkıyor ve iş GPU'da bir compute kernel'ında dönüyordu. Burada hedefler iki boyutlu bir piksel tarlasından çıkıyor ve hesabın tamamı CPU'da, kelime başına bir kez yapılıyor. İki yazının ortak kelimesi "morph"; ortak satırı yok.

Projedeki tek hazır bileşeni baştan söyleyeyim: tarayıcının kendi font rasterleştiricisi. Onu bilerek kullanıyoruz. Kontur çözümleme, sarım kuralı, hinting, diyakritiklerin yerleşimi, kerning; hepsi `fillText`'in içinde bedava geliyor. Bu blogda bir kez o işi elle yapmıştık; MSDF atlası yazısında konturu kenar kenar üç renge boyayıp her kanala ayrı mesafe yazmak yüzlerce satır tutmuştu. Orada metnin *render kalitesi* konuydu. Burada metin bir veri kaynağı: tek istediğimiz, hangi pikselin ne kadar dolu olduğu.

### Metni Piksele Çevirmek

Canvas 2D'de metin rasterleştirmenin tuzakları kodun ilk on satırında toplanmış durumda. Sırayla.

Birincisi taban çizgisi. `textBaseline` varsayılanı `"alphabetic"`. `fillText(text, 0, 0)` dediğinizde harflerin oturduğu çizgi canvas'ın üst kenarına geliyor ve bütün gövde yukarı, görünmez alana taşıyor. Boş bir canvas'a bakıp shader'ı suçlamanın en kısa yolu bu.

İkincisi kutu. Metnin mürekkep kutusunu `measureText` veriyor ama işe yarayan alanlar `width` değil:

```ts
// src/raster/rasterizeText.ts (parça)
export interface RasterOptions {
  readonly fontFamily: string;
  readonly fontSize: number; // px
  readonly padding: number; // px
}

export interface TextBox {
  readonly width: number;
  readonly height: number;
  readonly baseline: number;
  readonly ascent: number;
  readonly descent: number;
}

/**
 * BÜTÜN kelimeler için TEK kutu. En geniş genişlik ve en yüksek çıkıntı kazanır;
 * yoksa kutuyu ilk kelimeye göre kuran kod sonraki kelimelerin şapkasını kırpar.
 */
export function measureBox(words: readonly string[], o: RasterOptions): TextBox {
  const ctx = scratchContext();
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";

  let ink = 0;
  let ascent = 0;
  let descent = 0;

  for (const word of words) {
    const m = ctx.measureText(word);
    // actualBoundingBoxLeft sola doğru POZİTİF ölçülüyor; toplamı mürekkep genişliği.
    ink = Math.max(ink, m.actualBoundingBoxLeft + m.actualBoundingBoxRight);
    ascent = Math.max(ascent, m.actualBoundingBoxAscent);
    descent = Math.max(descent, m.actualBoundingBoxDescent);
  }

  return {
    width: Math.ceil(ink) + o.padding * 2,
    height: Math.ceil(ascent + descent) + o.padding * 2,
    baseline: Math.ceil(ascent) + o.padding,
    ascent,
    descent,
  };
}
```

`actualBoundingBoxAscent` gerçekten çizilen mürekkefin taban çizgisinden ne kadar yukarı çıktığını söylüyor ve karakter karakter değişiyor. `fontBoundingBoxAscent` ise fonta ait sabit bir sayı; her kelime için aynı. Kutuyu ikincisiyle kursaydınız açılıştaki hata olmazdı ama boşluk israfı olurdu. Ölçüm bölümünde ikisini yan yana koyuyoruz.

Üçüncüsü font yüklenmesi. `ctx.font = "180px Inter"` ataması, o font henüz inmemişse sessizce yedek fonta düşüyor. Rasteriniz çalışır, parçacıklarınız oluşur, kelimeniz yanlış fontla yazılır ve hiçbir yerde uyarı çıkmaz. Rasterleştirmeden önce `await document.fonts.ready` demek bir satır.

Dördüncüsü `getImageData`. Aynı canvas'tan tekrar tekrar piksel okuyacaksanız context'i `willReadFrequently: true` ile açın; bu bayrak tarayıcıya "bu yüzeyi GPU'da tutma, CPU'da tut" diyor ve geri okuma maliyetini belirgin biçimde düşürüyor. Ne kadar düşürdüğünü ölçtük, sayı aşağıda.

Tuzaklar bitti; kalan kısım tek bir fonksiyon:

```ts
// src/raster/alphaRaster.ts
export interface AlphaRaster {
  readonly width: number;
  readonly height: number;
  /** Uzunluk width*height. Yalnızca alfa; RGB atılıyor. */
  readonly data: Uint8Array;
}

// src/raster/rasterizeText.ts
export function rasterizeText(text: string, box: TextBox, o: RasterOptions): AlphaRaster {
  const canvas = document.createElement("canvas");
  canvas.width = box.width;
  canvas.height = box.height;

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2d context alınamadı");

  ctx.clearRect(0, 0, box.width, box.height);
  ctx.font = `${o.fontSize}px ${o.fontFamily}`;
  ctx.textBaseline = "alphabetic";
  ctx.textAlign = "center";
  ctx.fillStyle = "#fff"; // renk önemsiz: yalnızca alfayı okuyacağız
  ctx.fillText(text, box.width / 2, box.baseline);

  const rgba = ctx.getImageData(0, 0, box.width, box.height).data;
  const data = new Uint8Array(box.width * box.height);
  for (let i = 0, p = 3; i < data.length; i++, p += 4) data[i] = rgba[p];

  return { width: box.width, height: box.height, data };
}
```

Dört baytta bir okuyup bir bayt yazıyoruz. Demodaki gerçek kutu 769×249; bu, 766 kilobaytlık RGBA'nın taranıp 191 kilobaytlık alfa diline indirilmesi demek. Süre ölçüm tablosunda duruyor.

Konu dışı ama Türkçe yazan herkesin bir kez başına geliyor: metni kod içinde büyütecekseniz `toUpperCase()` yerine `toLocaleUpperCase("tr")` kullanın. Yoksa "iğne" size "İĞNE" değil "IĞNE" döner, baştaki noktalı İ yolda kaybolur. Demoda kelimeler zaten büyük harfle gömülü olduğu için bu satır projede yok; aynı hattı bir kullanıcı girdisiyle besleyecekseniz olacak. Neyse, rastere dönelim.

### Alfa Neden Tek Dürüst Kanal

Metni beyaz yazıp parlaklığa göre eşiklemek ilk bakışta aynı kapıya çıkıyor. Çıkmıyor.

Alfa kanalı tanımı gereği kapsama (coverage) taşıyor: o piksel harfin içinde ne kadar kalıyor. Kenar piksellerinde 0 ile 255 arasında bir rampa oluşuyor ve bu rampa kenar yumuşatmasının kendisi. RGB ise kapsama çarpı renk. `fillStyle`'ı beyaz seçtiğiniz sürece ikisi birbirine benzer; gradyan bir dolgu, koyu bir renk ya da bir doku deseni verdiğiniz anda parlaklık eşiği harfin bir kısmını yutar.

Bir ayrıntı daha var. Tarayıcı canvas'ı bellekte önceden çarpılmış (premultiplied) tutuyor, `getImageData` ise size çarpımı geri alınmış değer döndürmek zorunda. Düşük alfa değerlerinde bu geri alma bölmeyle yapılıyor ve yuvarlama hatası orada büyüyor. Beyaz metinde teoride R = G = B = 255 çıkmalı; pratikte kenarda ne çıktığını ölçüm moduna soruyoruz: 0 < a < 255 olan pikseller arasında maksimum |R − 255| değeri 0.

Karar basit. Kapsamayı isteyen alfa okur.

### Eşik: Kaç Piksel Parçacık Olur

Alfa rampası bize sürekli bir kapsama alanı veriyor, biz ise ikili bir soru soruyoruz: bu piksel parçacık doğurur mu? Cevap bir eşik.

Eşiği yükseltince silüet daralıyor, ince yapılar giderek inceliyor. Türkçe için bu soyut bir risk değil. Ğ'nin breve'i, Ş ve Ç'nin sedili, İ'nin noktası. Hepsi gövdeye göre ince ve hepsi kenar pikseli oranı yüksek yapılar. Onları en çok inceltip zayıflatan şey yüksek eşik.

Ölçmenin temiz bir yolu var: aynı fontta "YAĞMUR" ile "YAGMUR" yazıp eşiği geçen piksel sayılarının farkına bakmak. Aradaki fark tam olarak breve'in katkısı.

| Eşik | "YAĞMUR" piksel | "YAGMUR" piksel | Breve payı |
|---|---|---|---|
| 8 | 35.901 | 35.052 | 849 |
| 32 | 35.374 | 34.539 | 835 |
| 64 | 35.086 | 34.258 | 828 |
| 128 | 34.513 | 33.730 | 783 |
| 200 | 33.381 | 32.624 | 757 |

Eşik yalnızca kaç piksel kaldığını değiştirmiyor; o piksellerin *nereye dağıldığını* da değiştiriyor. Yüksek eşikte kalanlar harfin göbeğindeki dolu pikseller. Silüet keskinleşiyor, incelen kısımlarda delik açılıyor. Rakamlar da bunu doğruluyor: breve payı 8'den 200'e çıkan eşikte 849'dan 757'ye, yani onda bir kadar geriliyor — kayboluyor değil, inceliyor. Tam silinme çok daha yüksek bir eşik ister.

Peki hangi eşik? Ben 32'de karar kıldım ve gerekçem estetik: kenar piksellerini tamamen atmak parçacık bulutunun silüetini fazla sert yapıyor, çok düşük eşik ise harfin çevresine anlamsız bir sis bırakıyor. Yanılıyor da olabilirim; demoda eşik bir kaydırma çubuğu olarak duruyor, sayı da ekranda güncelleniyor.

Eşiği geçen piksellerden bir kapsama dizini kuruyoruz. İki geçiş: önce sayıyoruz, sonra dolduruyoruz. Tek geçişte büyüyen bir dizi kullanmamanın sebebi, 250 bin elemanlı bir `push` döngüsünün yeniden tahsis maliyeti.

```ts
// src/raster/extractTargets.ts
import type { AlphaRaster } from "./alphaRaster";

export interface CoverageIndex {
  /** Eşiği geçen piksellerin düz (row-major) indeksleri. */
  readonly pixels: Int32Array;
  /** prefix[k] = ilk k pikselin kapsama toplamı. Uzunluk pixels.length + 1. */
  readonly prefix: Float64Array;
  readonly total: number;
}

export function buildCoverageIndex(raster: AlphaRaster, threshold: number): CoverageIndex {
  const { data } = raster;

  let count = 0;
  for (let i = 0; i < data.length; i++) if (data[i] >= threshold) count++;

  const pixels = new Int32Array(count);
  const prefix = new Float64Array(count + 1);

  let k = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    const a = data[i];
    if (a < threshold) continue;
    pixels[k] = i;
    sum += a / 255; // yarım dolu piksel yarım oy kullanıyor
    prefix[++k] = sum;
  }

  return { pixels, prefix, total: sum };
}
```

Kapsamayı ağırlık olarak taşımanın karşılığı görsel: kenar pikselleri daha az parçacık çekiyor, silüet doğal biçimde yumuşuyor. Kenar yumuşatmasını rasterden parçacık bulutuna taşımanın bedava yolu bu.

### Sayıyı Sabitlemek: Katmanlı Yürüyüş

Şimdi asıl kısıt. Ekranda sabit sayıda parçacık var; her kelimenin kapsadığı piksel sayısı ise farklı. "IŞIK" ile "YAĞMUR" aynı sayıda piksel kaplamıyor. Morph'un çalışması için her kelimede tam olarak N hedef üretmemiz gerekiyor, N kelimeden bağımsız olmalı.

Klasik cevap kümülatif dağılımı kurup her parçacık için rastgele bir sayı çekmek ve ikili aramayla yerini bulmak. Çalışıyor ama iki kusuru var. Rastgele çekiş kümelenme üretiyor: bazı bölgeye üç parçacık düşerken komşusu boş kalıyor. İkincisi maliyet: N tane `O(log M)` arama.

Bunun yerine katmanlı örnekleme (stratified sampling) kullanıyoruz. Toplam kapsamayı N eşit dilime bölüyor, k'ıncı parçacığı k'ıncı dilimin içinden çekiyoruz:

```
u_k = (k + ξ_k) · toplam / N,   ξ_k ∈ [0,1)
```

Bu formülün iki güzel sonucu var. Birincisi düzgünlük: her parçacığa tam olarak eşit kapsama kütlesi düşüyor, kümelenme kalmıyor. İkincisi sıra: `u_k` k arttıkça kesinlikle artıyor, çünkü dilimler ayrık. Sıralı bir sorgu dizisini sıralı bir dizide aramak için ikili aramaya gerek yok; tek bir imleci ileri yürütmek yetiyor. Arama `O(N log M)`'den `O(N + M)`'ye düşüyor.

```ts
// src/raster/extractTargets.ts (devam)
export function sampleTargets(
  raster: AlphaRaster,
  index: CoverageIndex,
  count: number,
  rng: () => number,
): Float32Array {
  const { pixels, prefix, total } = index;
  if (pixels.length === 0) return new Float32Array(count * 2);

  const out = new Float32Array(count * 2);
  const step = total / count;
  const invW = 1 / raster.width;
  const invH = 1 / raster.height;

  let j = 0; // yürüyen imleç: hiç geri gitmiyor
  for (let k = 0; k < count; k++) {
    // Katman jitter'ı: k'ıncı parçacık [k, k+1) diliminin içinden çıkıyor.
    const u = (k + rng()) * step;
    while (j < pixels.length - 1 && prefix[j + 1] < u) j++;

    const p = pixels[j];
    const px = p % raster.width;
    const py = (p / raster.width) | 0;

    // Piksel içi jitter: aynı piksele düşen parçacıklar üst üste binmiyor.
    out[k * 2] = (px + rng()) * invW;
    out[k * 2 + 1] = (py + rng()) * invH;
  }

  return out;
}
```

İki jitter (rastgele kaydırma) var ve ikisi farklı işe yarıyor. Katman jitter'ı hangi pikselin seçileceğini bozuyor; piksel içi jitter seçilen pikselin neresine oturulacağını bozuyor. İkincisini çıkarırsanız parçacıklar piksel merkezlerine hizalanıyor ve N kapsanan piksel sayısını aştığında düpedüz üst üste biniyorlar.

Kümelenmeyi bir sayıya bağlamak için ızgara doluluğunun değişim katsayısını kullanıyoruz: rasteri 8×8 hücrelere bölüp her hücreye düşen parçacık sayısının standart sapmasını ortalamaya bölüyoruz. Düşük değer düzgün dağılım demek.

| Yöntem | Doluluk değişim katsayısı |
|---|---|
| Saf rastgele çekiş (kontrol grubu) | 0,5675 |
| Katmanlı, jitter'sız | 0,5606 |
| Katmanlı + piksel içi jitter | 0,5610 |

Sayılar birbirine bu kadar yakın çıkması beni tedirgin etti: üç yöntem de 0,56–0,57 bandında toplanıyor, aralarındaki fark üçüncü ondalıkta kayboluyor. Sebebi hücre başına düşen yoğunlukta: 8 piksellik hücrede, yüz bin parçacıkla, hücre başına ortalama ~100 parçacık düşüyor ve bu yoğunlukta Poisson gürültüsünün kendisi örnekleme yönteminin ürettiği farktan daha büyük. Dürüst olmak gerekirse bu tabloda kümelenmeyi *ölçemedim*. Katmanlı örneklemenin kümelenmeyi gerçekten kaldırdığının kanıtı aşağıdaki okunabilirlik (IoU) ölçümünde; kapsama CV'si burada yalnızca hiçbir yöntemin patlak vermediğini gösteriyor.

Sıralı yürüyüşün ikili aramaya göre kazancı da ayrı bir satır; ikisini de projede tutuyorum, ikincisi yalnızca ölçüm ve test için var.

### Kim Nereye Gider

Buraya kadar her kelime için N hedef üretmeyi çözdük. Kinetik tipografinin asıl sorusu şimdi başlıyor: kelime değişince parçacık i, A kelimesindeki hangi noktadan B kelimesindeki hangi noktaya gidecek?

Bir tribün koreografisi düşünün. Yüz bin seyirci, herkesin elinde bir kart. Birinci figürden ikinci figüre geçiliyor. Herkese rastgele bir yeni koltuk verirseniz sahada izdiham çıkar; kartlar havada birbirine karışır, on saniye boyunca hiçbir şey okunmaz. Oysa doğru dağıtımda çoğu seyirci iki adım atıp yerine oturur ve figür gözünüzün önünde dönüşür.

Eşleştirme, easing eğrisinden önce gelen karar.

Matematiksel olarak doğru cevabın adı var: iki nokta bulutu arasında toplam mesafeyi en aza indiren atama. Optimal transport, ya da ayrık hâliyle Macar algoritması. Karmaşıklığı `O(n³)`. Yüz bin parçacık için düşünülecek bir şey değil; hesap bitene kadar kelime değişmiş olur. Yaklaşık bir cevap arıyoruz.

Dört yol denedim:

- **Karıştırılmış**: hedefleri rastgele permüte et. İzdihamın kendisi, alt sınır olarak duruyor.
- **Kimlik**: örnekleme hangi sırayla ürettiyse o sırayla eşleştir.
- **X'e göre sıralı**: iki bulutu da yatay konuma göre sırala.
- **Morton sırası**: iki bulutu da Z-eğrisi koduna göre sırala.

Ölçüt basit: ortalama kat edilen yol, kutu genişliğine göre normalize edilmiş piksel cinsinden.

```ts
// src/assign/travel.ts
export function meanTravel(a: Float32Array, b: Float32Array): number {
  const n = a.length / 2;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const dx = b[i * 2] - a[i * 2];
    const dy = b[i * 2 + 1] - a[i * 2 + 1];
    sum += Math.sqrt(dx * dx + dy * dy);
  }
  return sum / n;
}
```

Sonuçları görünce şaşırdığım yer kimlik eşleştirmesi oldu — ama şaşırma payı düşündüğümden küçük çıktı. Karıştırılmışa göre kimlik yalnızca yüzde üç kadar kısa yol kat ettiriyor (%28,53'e karşı %29,50); kabaca aynı sayı. Fark tamamen dikey eksenden geliyor: kimlikte dikey yol %0,54, karıştırılmışta %6,13. Yatayda ise kimlik karıştırılmıştan daha kötü (%28,50'ye karşı %27,92) — beklenen de bu, çünkü tarama sırası hiçbir yatay bilgi taşımıyor. Sebebini eşleştirmede değil örneklemede buldum: katmanlı yürüyüş kapsama dizinini baştan sona tarıyor, kapsama dizini de rasteri satır satır geziyor. Yani hedefler zaten yukarıdan aşağıya sıralı çıkıyor; kimlik eşleştirmesi bu sırayı bedavaya devralıp dikey uyum kazanıyor, yatayda hiçbir şey garanti etmiyor.

Toplam yolda asıl kısa olan x'e göre sıralama: %8,22, Morton'un %9,25'inin bile altında. Ama kazancı tek eksende: yatayda %4,20 gibi düşük bir sayı tutturuyor, dikeyde ise %6,24'e kadar savruluyor — hiçbir dikey kontrolü olmadığı için. Morton'un farkı iki ekseni birden dizginlemesi: yatayda x-sıralamasından daha kötü (%8,84) ama dikeyde ona kıyasla çok daha sıkı (%1,81'e karşı %6,24). Z-eğrisi iki boyutu birden tek bir sıraya indirdiği için kodu yakın olan iki nokta düzlemde de yakın oluyor; toplam mesafede x-sıralamasını geçemiyor ama iki boyutu birden tutan tek yöntem o. Demoda varsayılanı yine de Morton'da tuttum: tek eksenli kısalık değil iki eksenli tutarlılık arıyorum.

### Morton Sırası ve 52 Bitlik Anahtar

Morton kodu bit serpiştirmesi. x ve y'yi tam sayıya çevirip bitlerini bir x bir y olacak şekilde iç içe geçiriyorsunuz. Ortaya çıkan tek sayıya göre sıralamak, düzlemi Z harfi çizerek dolaşmak demek.

```ts
// src/assign/morton.ts

/** 16 bitlik bir sayının bitlerini araya birer sıfır koyarak yayar. */
export function part1By1(n: number): number {
  let x = n & 0xffff;
  x = (x | (x << 8)) & 0x00ff00ff;
  x = (x | (x << 4)) & 0x0f0f0f0f;
  x = (x | (x << 2)) & 0x33333333;
  x = (x | (x << 1)) & 0x55555555;
  return x >>> 0;
}

/** x, y ∈ [0,1] → 32 bitlik Morton (Z-eğrisi) kodu. */
export function morton2D(x: number, y: number): number {
  const qx = Math.min(0xffff, Math.max(0, Math.round(x * 0xffff)));
  const qy = Math.min(0xffff, Math.max(0, Math.round(y * 0xffff)));
  return ((part1By1(qy) << 1) | part1By1(qx)) >>> 0;
}
```

Sıralama kısmında bir tercih var. 250 bin elemanı `Array.prototype.sort` ile comparator vererek sıralamak, her karşılaştırmada JavaScript'e geri dönmek demek. Tipli dizilerin `sort`'u ise comparator'sız çağrıldığında sayısal sıralama yapıyor ve motorun kendi kodunda kalıyor.

Sorun şu: sıralamak istediğimiz şey kod değil, kodun taşıdığı indeks. İkisini tek bir sayıya paketleyebilirsek comparator'a gerek kalmıyor. Bit bütçesi tutuyor: Morton kodu 32 bit, indeks için 20 bit ayırırsak (1.048.576 parçacığa kadar) toplam 52 bit ediyor ve bu `2^53`'ün altında kalıyor; `Float64Array` içinde tam olarak temsil ediliyor.

```ts
// src/assign/rank.ts
import { morton2D } from "./morton";

const INDEX_BITS = 20; // 1.048.576 parçacığa kadar
const INDEX_SCALE = 2 ** INDEX_BITS;

/**
 * Morton kodu (32 bit) ile indeksi (20 bit) tek bir float64'e paketliyoruz:
 * 52 bit, 2^53'ün altında, kayıpsız. Sıralamayı comparator'sız
 * Float64Array.prototype.sort yapıyor.
 */
export function mortonOrder(points: Float32Array, count: number): Uint32Array {
  if (count > INDEX_SCALE) throw new Error("indeks 20 bite sığmıyor");

  const keys = new Float64Array(count);
  for (let i = 0; i < count; i++) {
    const code = morton2D(points[i * 2], points[i * 2 + 1]);
    keys[i] = code * INDEX_SCALE + i;
  }
  keys.sort();

  const order = new Uint32Array(count);
  for (let i = 0; i < count; i++) order[i] = keys[i] % INDEX_SCALE;
  return order;
}

/** Sıralamayı uygulayıp yeni bir hedef dizisi üretir. */
export function reorder(points: Float32Array, order: Uint32Array): Float32Array {
  const out = new Float32Array(order.length * 2);
  for (let i = 0; i < order.length; i++) {
    const s = order[i] * 2;
    out[i * 2] = points[s];
    out[i * 2 + 1] = points[s + 1];
  }
  return out;
}
```

Bu sıralama her kelime için bir kez koşuyor ve sonuç kalıcı: parçacık i, her kelimede Morton sırasındaki i'inci noktaya gidiyor. Koreografi metaforunun tam karşılığı bu. Seyircinin sıra numarası değişmiyor; değişen, o sıra numarasının hangi figürde hangi koltuğa denk geldiği.

Dört yolun ölçümü aşağıdaki tabloda. Sıralama maliyeti de ayrı bir satır, çünkü kelime değişiminde ana iş parçacığı o kadar duruyor.

### İki Hedef, Tek Uniform

Şimdi GPU tarafı. Yapacak neredeyse bir şey yok.

Her parçacığın iki sabit verisi var — nereden geliyor ve nereye gidiyor. İkisi de kelime başına bir kez hesaplanıyor, kare boyunca değişmiyor. Geçişin tamamı bu ikisi arasında bir `mix` ve karışım katsayısı tek bir uniform. Kare başına GPU'ya giden veri sıfır bayt.

Bunu iki tampon ve dört VAO ile kuruyoruz. Tamponların her biri bir kelimenin hedeflerini tutuyor; A'dan B'ye geçerken A kaynak, B hedef. Yeni kelime gelince onu *kaynak* tamponun üstüne yazıyoruz, çünkü artık ona ihtiyaç yok, ve rolleri takas ediyoruz.

```ts
// src/gl/cloud.ts (parça)
export interface Cloud {
  /** Yeni kelimeyi kaynak tamponun üstüne yazar ve rolleri takas eder. */
  push(targets: Float32Array, count: number): void;
  draw(mode: DrawMode, count: number): void;
  readonly bytesPerParticle: number;
}

export function createCloud(gl: WebGL2RenderingContext, capacity: number): Cloud {
  const bufA = gl.createBuffer();
  const bufB = gl.createBuffer();
  if (!bufA || !bufB) throw new Error("buffer oluşturulamadı");

  for (const buf of [bufA, bufB]) {
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // vec2 * 4 bayt = 8 bayt/parçacık, tampon başına
    gl.bufferData(gl.ARRAY_BUFFER, capacity * 8, gl.DYNAMIC_DRAW);
  }

  // Şablon dörtgen: instancing yolunda tek bir kez yükleniyor.
  const corners = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  // Dört VAO: (kaynak A / kaynak B) × (dörtgen / nokta)
  const vao = {
    quadAB: makeQuadVao(gl, corners, bufA, bufB),
    quadBA: makeQuadVao(gl, corners, bufB, bufA),
    pointAB: makePointVao(gl, bufA, bufB),
    pointBA: makePointVao(gl, bufB, bufA),
  };

  let sourceIsA = true;
  // ...
}
```

VAO kurulumundaki tek dikkat noktası divisor. Şablon dörtgenin köşeleri her örnekte tekrar okunmalı (divisor 0), kaynak ve hedef ise örnek başına bir kez ilerlemeli (divisor 1):

```ts
// src/gl/cloud.ts (parça)
function makeQuadVao(
  gl: WebGL2RenderingContext,
  corners: WebGLBuffer,
  source: WebGLBuffer,
  target: WebGLBuffer,
): WebGLVertexArrayObject {
  const vao = gl.createVertexArray();
  if (!vao) throw new Error("VAO oluşturulamadı");
  gl.bindVertexArray(vao);

  gl.bindBuffer(gl.ARRAY_BUFFER, corners);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(0, 0); // köşe başına

  gl.bindBuffer(gl.ARRAY_BUFFER, source);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(1, 1); // örnek başına

  gl.bindBuffer(gl.ARRAY_BUFFER, target);
  gl.enableVertexAttribArray(2);
  gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
  gl.vertexAttribDivisor(2, 1);

  gl.bindVertexArray(null);
  return vao;
}
```

Instancing'in mekaniğini bu blogda bir kez ayrıntılı anlatmıştım; `vertexAttribDivisor`'ın neyi neye bağladığını tekrar açmayacağım, doğrudan üstüne kuruyorum.

Parçacık başına toplam bellek 16 bayt: iki tamponda ikişer float. Yüz bin parçacık 1,6 MB. Kelime değişiminde yukarı akan veri bunun yarısı: tek tamponluk. Kare başına akan veri sıfır.

### Soldan Sağa Yazmak

Bütün parçacıklar aynı anda hareket ederse geçiş bir sıçramaya benziyor. Kaydırma (stagger) bunu düzeltiyor: herkes kendi zamanında yola çıkıyor. Tribünde de kimse aynı anda ayağa kalkmıyor; dalga bir uçtan başlıyor.

Kaydırmayı neye göre yapacağınız tipografik bir karar. Rastgele bir faz verirseniz kelime her yerinden aynı anda çözülüp toplanır; hoş ama okunaksız. Hedefin yatay konumuna göre verirseniz yeni kelime soldan sağa doğru yazılır. Latin alfabesinin okuma yönü bu ve göz o yönü zaten takip ediyor.

Her parçacığın kendi zamanı, global zamanın içine oturtulmuş bir pencere: `[phase·spread, phase·spread + (1 − spread)]`.

```glsl
float localTime(float t, float phase, float spread) {
  float start = phase * spread;
  return smoothstep(start, start + (1.0 - spread), t);
}
```

`spread = 0` verirseniz herkesin penceresi `[0,1]`; hepsi birlikte, `smoothstep` yumuşatmasıyla hareket ediyor. `spread = 0,6` verirseniz pencereler 0 ile 0,6 arasında başlıyor ve her biri 0,4 uzunluğunda. Kelime kendini soldan sağa yazıyor. `smoothstep` hem kelepçelemeyi hem easing'i tek çağrıda yaptığı için ayrıca `clamp` yazmıyoruz.

Kaynak x'i mi hedef x'i mi? İkisi iki ayrı efekt. Kaynağa bağlarsanız eski kelime soldan sağa dağılıyor; hedefe bağlarsanız yeni kelime soldan sağa kuruluyor. İkincisini seçtim, çünkü göz yeni bilgiyi arıyor.

Vertex shader'ın tamamı:

```glsl
#version 300 es
precision highp float;

layout(location = 0) in vec2 aCorner; // şablon dörtgen; POINTS yolunda yok
layout(location = 1) in vec2 aSource; // [0,1] raster uzayı
layout(location = 2) in vec2 aTarget;

uniform vec2 uAspect;     // raster oranını clip alanına taşıyan ölçek
uniform vec2 uViewportPx;
uniform float uRadiusPx;
uniform float uT;         // 0 → 1
uniform float uSpread;    // 0 ≤ spread < 1
uniform float uBow;

out vec2 vLocal;
out float vGlow;

const float PI = 3.14159265359;

float localTime(float t, float phase, float spread) {
  float start = phase * spread;
  return smoothstep(start, start + (1.0 - spread), t);
}

/**
 * Tamsayı hash. sin() tabanlı hash sürücüden sürücüye farklı sonuç veriyor;
 * tamsayı işlemleri her yerde birebir aynı.
 */
float hash01(uint i) {
  uint h = i * 2654435761u;
  h ^= h >> 15;
  h *= 2246822519u;
  h ^= h >> 13;
  return float(h >> 8) * (1.0 / 16777216.0);
}

void main() {
  float tl = localTime(uT, aTarget.x, uSpread);

  vec2 d = aTarget - aSource;
  // Sıfır uzunlukta normalize NaN üretir; bölen kelepçeli.
  vec2 normal = vec2(-d.y, d.x) / max(length(d), 1e-6);

#ifdef POINTS
  uint id = uint(gl_VertexID);
#else
  uint id = uint(gl_InstanceID);
#endif

  float r = hash01(id);
  float side = r < 0.5 ? -1.0 : 1.0;
  float bow = sin(tl * PI) * uBow * (0.35 + r) * side;

  vec2 p = mix(aSource, aTarget, tl) + normal * bow;

  // Raster uzayı (y aşağı) → clip alanı (y yukarı)
  vec2 clip = (p * 2.0 - 1.0) * vec2(1.0, -1.0) * uAspect;

  vGlow = 0.35 + 0.65 * (1.0 - abs(tl * 2.0 - 1.0));

#ifdef POINTS
  gl_Position = vec4(clip, 0.0, 1.0);
  gl_PointSize = uRadiusPx * 2.0;
  vLocal = vec2(0.0);
#else
  vec2 offset = aCorner * uRadiusPx / uViewportPx * 2.0;
  gl_Position = vec4(clip + offset, 0.0, 1.0);
  vLocal = aCorner;
#endif
}
```

Üç satır ayrıca konuşmayı hak ediyor.

`normal` hesabındaki `max(length(d), 1e-6)` bir savunma değil, zorunluluk. Demoda aynı kelimeye tekrar geçme düğmesi var; o durumda her parçacığın kaynağı ile hedefi birebir aynı oluyor ve `d` sıfır vektörü. `normalize(vec2(0.0))` sıfıra bölme demek, sonuç NaN, NaN konum kırpılıyor ve bulut olduğu gibi kayboluyor. Hata mesajı yok. Kelepçeyi kaldırıp düğmeye basınca ekran kararıyor.

`hash01` fonksiyonu klasik `fract(sin(dot(...)) * 43758.5453)` yerine tamsayı karıştırması kullanıyor. Sebep taşınabilirlik: `sin`'in büyük argümanlardaki hassasiyeti donanıma göre değişiyor ve aynı sahne iki makinede farklı yay yönleri üretebiliyor. GLSL ES 3.00 tamsayı ve bit işlemlerini destekliyor; onlar her yerde birebir aynı.

`#ifdef POINTS` satırları tek kaynaktan iki program üretiyor. `#version` direktifi dosyanın ilk satırı olmak zorunda olduğu için define'ları ikinci satırdan enjekte ediyoruz:

```ts
// src/gl/program.ts (parça)
export function withDefines(src: string, defines: readonly string[]): string {
  if (defines.length === 0) return src;
  // #version ilk satır olmak ZORUNDA; define'lar ikinci satırdan giriyor.
  const nl = src.indexOf("\n");
  return src.slice(0, nl + 1) + defines.map((d) => `#define ${d}\n`).join("") + src.slice(nl + 1);
}
```

CPU tarafında aynı matematiğin ikizi duruyor, çünkü okunabilirlik ölçümü için parçacık konumlarını tarayıcı çizmeden hesaplamamız gerekiyor:

```ts
// src/anim/easing.ts
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Parçacığın kendi zamanı. spread < 1 olmalı, yoksa pencere sıfır genişlikte. */
export function localTime(t: number, phase: number, spread: number): number {
  const start = phase * spread;
  return smoothstep(start, start + (1 - spread), t);
}
```

Aynı üç satır iki dilde duruyor ve elle senkron tutuluyor. Bunu sevmiyorum. Ölçüm modunda küçük bir parite kontrolü var: shader eased değeri renk olarak bir float render target'a yazıyor, `readPixels` ile geri okuyoruz ve TS ikiziyle karşılaştırıyoruz. Maksimum mutlak fark 0,0000002. Kontrol `EXT_color_buffer_float` yoksa atlanıyor.

### Nokta mı, Dörtgen mi

Parçacık çizmenin iki yolu var ve ikisi de aynı veriyle çalışıyor: `POINTS` ile tek köşe, ya da instanced dörtgen ile dört köşe.

Nokta yolu daha ucuz görünüyor: köşe sayısı dörtte bir, indeks yok, şablon yok. Buna karşılık iki gerçek sınırı var.

Birincisi boyut tavanı. `gl_PointSize` sürücünün izin verdiği aralıkla sınırlı ve bu aralığı sormak zorundasınız:

```ts
// src/gl/context.ts (parça)
const range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE) as Float32Array;
// [min, max] — max makineye göre değişiyor, garantisi yok
```

Bu makinede ölçtüğümüz değer [1, 511]. Tavanın üstünde bir değer yazarsanız hata almıyorsunuz; boyut sessizce kelepçeleniyor ve parçacıklarınız büyümüyor.

İkincisi kırpma. Nokta ilkeli merkezine göre kırpılıyor. Yarıçapı 30 piksel olan bir nokta, merkezi görüntü alanının bir piksel dışına çıktığı anda tamamen kayboluyor; oysa 29 pikseli hâlâ ekranın içinde. Kenara doğru sürüklediğinizde bulutun kırpılma çizgisinde birden kesilmesi bundan. Instanced dörtgende böyle bir şey yok, çünkü kırpma dört köşenin kendisine bakıyor.

Fragment shader ikisinde de aynı işi yapıyor, yalnızca yerel koordinatı farklı yerden alıyor:

```glsl
#version 300 es
precision highp float;

in vec2 vLocal;
in float vGlow;

uniform vec3 uColor;
out vec4 fragColor;

void main() {
#ifdef POINTS
  // gl_PointCoord'un başlangıcı SOL ÜST (y aşağı). Radyal düşüş simetrik
  // olduğu için burada fark etmiyor; dokulu sprite'ta eder.
  vec2 local = gl_PointCoord * 2.0 - 1.0;
#else
  vec2 local = vLocal;
#endif

  float d = dot(local, local); // merkeze uzaklığın karesi
  if (d > 1.0) discard;

  float falloff = 1.0 - d;
  fragColor = vec4(uColor * vGlow * falloff * falloff, 1.0);
}
```

Toplamalı karıştırma açık: `gl.blendFunc(gl.ONE, gl.ONE)`. Üst üste binen parçacıklar harflerin gövdesinde birikip doğal bir parlaklık farkı üretiyor; silüetin kenarı sönük, göbeği parlak kalıyor.

İki yolun GPU maliyeti ölçüm tablosunda yan yana duruyor. Peşinen söyleyeyim: fark beklediğimden küçük çıktı ve bu mantıklı, çünkü bu sahnede darboğaz köşe işleme değil, üst üste binen parçacıkların doldurma maliyeti.

### Serinin Üç Korkuluğu

Bu seride her demoda aynı üç korkuluk var: `devicePixelRatio` kelepçesi, çözünürlük ölçekleyicisi ve bir "Dur/Devam" düğmesi.

```ts
// src/viewport.ts
export const MAX_DPR = 2;

export function backingSize(cssW: number, cssH: number, dpr: number, scale: number) {
  const clampedDpr = Math.min(Math.max(dpr, 1), MAX_DPR);
  const clampedScale = Math.min(Math.max(scale, 0.25), 1);
  return {
    width: Math.max(1, Math.round(cssW * clampedDpr * clampedScale)),
    height: Math.max(1, Math.round(cssH * clampedDpr * clampedScale)),
  };
}
```

```ts
// src/main.ts (parça)
function setRunning(next: boolean): void {
  if (next === running) return;
  running = next;
  toggleButton.textContent = running ? "Dur" : "Devam";
  if (running) frameId = requestAnimationFrame(loop);
  else cancelAnimationFrame(frameId);
}

toggleButton.addEventListener("click", () => setRunning(!running));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) setRunning(false);
});
```

Varsayılan parçacık sayısı 25.000. Düğmeler 25k / 100k / 250k. Üst sınırı 250 binde tutmamın sebebi bellek değil: o sayıda bile iki tampon toplam 4,0 MB yer kaplıyor. Sebep kelime değişimindeki CPU donması ve doldurma maliyeti; ikisi de aşağıdaki tablolarda.

Bir detay daha: kelime değişimi ana iş parçacığında raster, tarama, örnekleme ve sıralamayı arka arkaya koşuyor. Bu süre boyunca sayfa duruyor. Demo kelimeleri otomatik döndürürken bu donma her turda tekrarlanıyor, o yüzden ölçtük ve tabloya koyduk.

### Sabit Tohum, Sabit Kadraj

Demoyu `?measure=1` ile açtığınızda arayüz kapanıyor, arka tampon 960×540'a kilitleniyor, kelime döngüsü ve rastgele tohum sabitleniyor. Sonunda konsola tek satır `MEASURE {json}` düşüyor.

GPU zamanını `EXT_disjoint_timer_query_webgl2` ile alıyoruz. Uzantı her tarayıcıda yok; yoksa GPU sütunları boş kalıyor ve yalnızca kare süresi raporlanıyor.

```ts
// src/measure/gpuTimer.ts
interface TimerExt {
  readonly TIME_ELAPSED_EXT: number;
  readonly GPU_DISJOINT_EXT: number;
}

export interface GpuTimer {
  begin(): void;
  end(): void;
  /** Hazır olan sorguların sonuçlarını ms cinsinden toplar. */
  collect(out: number[]): void;
}

export function createGpuTimer(gl: WebGL2RenderingContext, poolSize = 8): GpuTimer | null {
  const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExt | null;
  if (!ext) return null;

  const free: WebGLQuery[] = [];
  const pending: WebGLQuery[] = [];
  for (let i = 0; i < poolSize; i++) {
    const q = gl.createQuery();
    if (q) free.push(q);
  }

  let active: WebGLQuery | null = null;

  return {
    begin() {
      active = free.pop() ?? null;
      if (active) gl.beginQuery(ext.TIME_ELAPSED_EXT, active);
    },
    end() {
      if (!active) return;
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      pending.push(active);
      active = null;
    },
    collect(out) {
      // Sonuçlar birkaç kare geç geliyor; sıra korunuyor.
      while (pending.length > 0) {
        const q = pending[0];
        if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
        pending.shift();
        // Disjoint bayrağı: GPU bağlam değiştirdiyse ölçüm çöp.
        if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) {
          out.push(gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6);
        }
        free.push(q);
      }
    },
  };
}
```

Aynı anda yalnızca bir `TIME_ELAPSED` sorgusu etkin olabiliyor, o yüzden havuz var ve sorgular sırayla toplanıyor. `GPU_DISJOINT_EXT` kontrolünü atlarsanız sürücünün bağlam değiştirdiği karelerde saçma sayılar tabloya giriyor.

Bir de vsync meselesi var. Kare süresi tavana yapışıyor — 60 Hz'de 16,6 ms, bu makinede 8,30 ms — ve tavanın altında kalan bütün yapılandırmalar birbirinin tıpatıp aynısı görünüyor. Aşağıdaki çizim tablosunda kare sütununun altı satırda da 8,30 yazması bundan; o sütun GPU'yu değil ekranın beklediği süreyi ölçüyor. Tablodaki koşuların hepsi tek kat çizimle alındı.

Tavanı kendi gözünüzle delmek isterseniz demoda yük çarpanı var: `?load=8` bulutu kare başına sekiz kez çiziyor. Yapay bir yük, gerçek bir sahnenin faturası değil; amacı sıralamayı görünür kılmak. Benim `?measure=1&load=8` ile aldığım tek koşumda tavanı delen tek satır 250.000 parçacık + dörtgen oldu: GPU 10,38 ms, kare medyanı 10,9 ms, p95 14,9. Aynı koşuda nokta yolu hâlâ tavanın altındaydı, GPU 6,99 ms'ye karşı kare 8,30. Tek koşu; tablo değil.

`npm run bench` ise Node tarafında koşuyor ve gerçek fontu değil, prosedürel üretilmiş sentetik bir rasteri kullanıyor. Karşılaştırdığı şey algoritma: yürüyüş mü ikili arama mı, hangi eşleştirme ne kadar yol kat ettiriyor, Morton sıralaması ne kadar sürüyor. Tarayıcı gerektirmeyen her sayı orada.

### Kelime Başına Fatura

Önce raster tarafı. Kelime başına, ana iş parçacığında:

| Kelime | `getImageData` (ms) | Alfa taraması (ms) | Örnekleme (ms) | Morton sıralama (ms) | Toplam (ms) | Kapsanan piksel |
|---|---|---|---|---|---|---|
| IŞIK | 0,20 | 0,90 | 5,70 | 6,80 | 14,1 | 16.204 |
| GÜNEŞ | 0,30 | 1,50 | 3,00 | 4,90 | 10,7 | 29.463 |
| YAĞMUR | 0,20 | 0,70 | 4,00 | 5,60 | 10,9 | 35.374 |
| ÇİÇEK | 0,50 | 0,70 | 4,20 | 5,80 | 11,5 | 24.320 |

Tablo 100.000 parçacık için. `willReadFrequently` bayrağının payı ayrı bir ölçüm: bayrak açıkken `getImageData` 0,20 ms, kapalıyken 0,60 ms.

Kutu metrikleri. Açılıştaki hatanın sayısal karşılığı ilk iki sütun:

| Kelime | `actualBoundingBoxAscent` | `fontBoundingBoxAscent` | Mürekkep genişliği |
|---|---|---|---|
| IŞIK | 129,7 | 189 | 301,6 |
| GÜNEŞ | 157,1 | 189 | 559,2 |
| YAĞMUR | 161,6 | 189 | 720,1 |
| ÇİÇEK | 157,9 | 189 | 488,1 |

"IŞIK"a göre kurulmuş bir kutu "YAĞMUR"un mürekkefini 31,9 piksel kırpıyor. Breve'in dikey kalınlığı bu fontta o mertebede; şapkanın tamamen kaybolması bu yüzden.

Eşleştirme tablosu. Aynı iki kelime, aynı hedef bulutları, dört farklı sıralama. Ortalama kat edilen yol, kutu genişliğinin yüzdesi olarak:

| Eşleştirme | Ortalama yol (%) | Sıralama maliyeti (ms, 100k) |
|---|---|---|
| Karıştırılmış | 29,50 | 1,70 |
| Kimlik (tarama sırası) | 28,53 | 0 |
| X'e göre sıralı | 8,22 | 5,40 |
| Morton sırası | 9,25 | 5,20 |

Örnekleme yolunun maliyeti, sıralı yürüyüş ile ikili arama arasında:

| Parçacık | Yürüyüş (ms) | İkili arama (ms) |
|---|---|---|
| 25.000 | 0,90 | 2,80 |
| 100.000 | 2,90 | 8,20 |
| 250.000 | 6,90 | 12,9 |

Çizim tarafı. Aynı sahne, aynı veri, iki yol:

| Parçacık | Yol | GPU (ms, medyan) | Kare (ms, medyan) | Kare (ms, p95) |
|---|---|---|---|---|
| 25.000 | Nokta | 0,25 | 8,30 | 10,0 |
| 25.000 | Dörtgen | 0,39 | 8,30 | 10,0 |
| 100.000 | Nokta | 1,04 | 8,30 | 9,90 |
| 100.000 | Dörtgen | 1,63 | 8,30 | 10,0 |
| 250.000 | Nokta | 2,63 | 8,30 | 9,81 |
| 250.000 | Dörtgen | 2,76 | 8,30 | 9,81 |

Geçişin kendisi ayrı bir satır. Morph'un tamamı bir `mix` ve bir `smoothstep` olduğu için sahne durağanken de geçiş ortasındayken de aynı komutlar koşuyor; tek fark, geçişte parçacıkların ekrana yayılıp daha az üst üste binmesi:

| Durum | GPU (ms, 100k, dörtgen) |
|---|---|
| Durağan (t = 0) | 1,70 |
| Geçiş ortası (t = 0,5) | 1,61 |
| Hedefte (t = 1) | 1,56 |

Veri hareketi:

| Parçacık | Toplam VRAM (MB) | Kelime değişiminde yüklenen (KB) | Kare başına yüklenen (bayt) |
|---|---|---|---|
| 25.000 | 0,4 | 200 | 0 |
| 100.000 | 1,6 | 800 | 0 |
| 250.000 | 4,0 | 2.000 | 0 |

Son sütun üç satırda da sıfır; yazının bütün derdi orası. Kelime değişimindeki toplam ana iş parçacığı donması ise üç parçacık sayısı için sırasıyla 6,20 ms, 17,8 ms ve 22,8 ms.

### Canvas Olmadan Test Etmek

Bu hattın büyük kısmı DOM'a dokunmuyor. Kapsama dizini, örnekleyici, Morton kodu, sıralama paketlemesi, easing ve okunabilirlik ölçütü saf TypeScript; hepsi vitest altında, sentetik rasterlerle koşuyor.

Sentetik raster canvas gerektirmiyor: alfa değerlerini analitik olarak hesapladığımız dikdörtgen ve disk şekilleri.

```ts
// test/extractTargets.test.ts (parça)
import { describe, expect, it } from "vitest";
import { buildCoverageIndex, sampleTargets } from "../src/raster/extractTargets";
import { solidBox } from "../src/raster/syntheticRaster";
import { mulberry32 } from "../src/rng";

describe("kapsama dizini", () => {
  it("eşiğin altındaki pikselleri hiç almıyor", () => {
    // 8x8, ortadaki 4x4 alan 200, gerisi 20.
    const raster = solidBox(8, 8, 2, 2, 4, 4, 200, 20);
    const index = buildCoverageIndex(raster, 128);
    expect(index.pixels.length).toBe(16);
  });

  it("prefix kesinlikle artıyor ve toplamla bitiyor", () => {
    const raster = solidBox(16, 16, 3, 3, 8, 8, 255, 0);
    const index = buildCoverageIndex(raster, 1);
    for (let i = 1; i < index.prefix.length; i++) {
      expect(index.prefix[i]).toBeGreaterThan(index.prefix[i - 1]);
    }
    expect(index.prefix[index.prefix.length - 1]).toBeCloseTo(index.total, 10);
  });
});

describe("katmanlı örnekleme", () => {
  it("her zaman tam olarak count hedef üretiyor", () => {
    const raster = solidBox(32, 32, 8, 8, 4, 4, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    for (const n of [1, 7, 1000]) {
      expect(sampleTargets(raster, index, n, mulberry32(1)).length).toBe(n * 2);
    }
  });

  it("üretilen her nokta eşiği geçen bir pikselin içinde", () => {
    const raster = solidBox(32, 32, 8, 8, 6, 6, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const pts = sampleTargets(raster, index, 500, mulberry32(3));

    for (let i = 0; i < 500; i++) {
      const px = Math.floor(pts[i * 2] * 32);
      const py = Math.floor(pts[i * 2 + 1] * 32);
      expect(px).toBeGreaterThanOrEqual(8);
      expect(px).toBeLessThan(14);
      expect(py).toBeGreaterThanOrEqual(8);
      expect(py).toBeLessThan(14);
    }
  });

  it("aynı tohum bit-birebir aynı bulutu veriyor", () => {
    const raster = solidBox(32, 32, 4, 4, 10, 10, 255, 0);
    const index = buildCoverageIndex(raster, 128);
    const a = sampleTargets(raster, index, 2000, mulberry32(9));
    const b = sampleTargets(raster, index, 2000, mulberry32(9));
    expect(a).toEqual(b);
  });
});
```

Yürüyüşün ikili aramayla aynı sonucu verdiği ayrı bir testte çiviliyoruz; iki uygulama aynı tohumla aynı diziyi üretmek zorunda. Bu, örnekleyiciyi hızlandırırken davranışı değiştirmediğimizin garantisi.

Morton tarafında test edilecek net özellikler var:

```ts
// test/morton.test.ts (parça)
import { describe, expect, it } from "vitest";
import { morton2D, part1By1 } from "../src/assign/morton";
import { mortonOrder } from "../src/assign/rank";
import { mulberry32 } from "../src/rng";

describe("morton kodu", () => {
  it("bitleri araya sıfır koyarak yayıyor", () => {
    expect(part1By1(0b1111)).toBe(0b01010101);
    expect(part1By1(0)).toBe(0);
    expect(part1By1(0xffff)).toBe(0x55555555);
  });

  it("tek eksende monoton", () => {
    // y sabitken x arttıkça kod artmak zorunda.
    let previous = -1;
    for (let i = 0; i <= 100; i++) {
      const code = morton2D(i / 100, 0.5);
      expect(code).toBeGreaterThan(previous);
      previous = code;
    }
  });

  it("yakın noktalar yakın kod alıyor (aynı çeyrekte üst bitler ortak)", () => {
    const a = morton2D(0.2501, 0.2501);
    const b = morton2D(0.2502, 0.2502);
    expect(a >>> 20).toBe(b >>> 20);
  });
});

describe("52 bitlik anahtar", () => {
  it("kod ve indeks paketlemesi kayıpsız", () => {
    const count = 1000;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(5);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    // Sıralama bir permütasyon olmak ZORUNDA: her indeks tam bir kez.
    const seen = new Uint8Array(count);
    for (const i of order) seen[i]++;
    expect(Array.from(seen).every((c) => c === 1)).toBe(true);
  });

  it("sonuç Morton koduna göre azalmayan sırada", () => {
    const count = 500;
    const points = new Float32Array(count * 2);
    const rng = mulberry32(11);
    for (let i = 0; i < count * 2; i++) points[i] = rng();

    const order = mortonOrder(points, count);
    let previous = -1;
    for (const i of order) {
      const code = morton2D(points[i * 2], points[i * 2 + 1]);
      expect(code).toBeGreaterThanOrEqual(previous);
      previous = code;
    }
  });
});
```

Permütasyon testi bu dosyanın en değerli testi. Paketlemede bit bütçesini kaçırırsanız — parçacık sayısını 20 bitin üstüne çıkarır ya da kodu 32 bitten geniş yaparsanız — bazı indeksler birbirinin üstüne biner ve sıralama sessizce iki parçacığı aynı hedefe gönderir. Ekranda görüntüsü küçük bir boşluk, o kadar.

Eşleştirme tarafında test kurgusu daha keyifli: iki bulut inşa edip beklenen ilişkiyi çiviliyoruz. Morton'un ortalama yolu hem kimliğin hem karıştırılmışın altında kalmak zorunda. Kimlik içinse sayının kendisini değil kazancın nerede olduğunu test ediyoruz: dikey yolu karıştırılmışın onda birinden küçük, yatayda ise böyle bir kazanç yok.

Yatay yarısını testte bilerek gevşek yazdım: iddia `idAxis.x > shAxis.x * 0.75`, yani kimliğin yatay yolu karıştırılmışınkinin dörtte üçünün altına inmesin. Ölçüm bundan güçlüsünü söylüyor — kimliğin yatay yolu karıştırılmışınkinden gerçekten uzun, 28,50'ye karşı 27,92 — ama test o kadarını çivilemiyor, %25'lik bir pay bırakıyor. Bedava gelen şey dikey uyum; yatayda garanti yok. Mesafeyi ölçerken y eksenini kutu oranıyla ölçeklemek de şart, yoksa 1024×256'lık bir kutuda dikey bir piksel yatay bir pikselin dört katı ağırlık kazanıyor ve sıralamayı ölçütün kendisi belirliyor.

Bunların yanında `smoothstep` sınırları (0'ın altı 0, 1'in üstü 1, tam ortada 0,5), `localTime`'ın `spread = 0`'da klasik `smoothstep(0, 1, t)`'ye eşit çıkması, sıfır uzunluklu yer değiştirmede yay hesabının NaN üretmemesi, `backingSize` kelepçeleri ve okunabilirlik ölçütünün özdeş maskede tam 1 vermesi var.

Hiçbir test dosyası `document`, `window`, `navigator` ya da `WebGL2RenderingContext` referansı içermiyor. Doğal olarak hiçbiri ekranda kelimenin okunduğunu da kanıtlamıyor; onun için `npm run dev`.

### Özetle:

1. Raster kutusunu bütün kelimelerin `actualBoundingBoxAscent` maksimumundan kurun. Tek kelimeye göre kurulmuş kutu, sonraki kelimelerin diyakritiklerini sessizce kırpar.
2. `textBaseline` varsayılanı `"alphabetic"`. `fillText(text, 0, 0)` metni canvas'ın dışına yazar.
3. Fontu rasterleştirmeden önce `await document.fonts.ready` deyin; yüklenmemiş font sessizce yedeğe düşer.
4. Tekrar tekrar okunacak canvas'ı `willReadFrequently: true` ile açın.
5. Kapsamayı alfa kanalından okuyun. RGB kapsama çarpı renktir; dolgu rengini değiştirdiğiniz an parlaklık eşiği yanlış cevap verir.
6. Alfa değerini ikili bir bayrak değil ağırlık olarak kullanın: kenar pikselleri daha az parçacık çeker, kenar yumuşatması bulut silüetine bedava taşınır.
7. Eşik yalnızca piksel sayısını değil, hangi yapıların hayatta kalacağını belirliyor. İnce diyakritikler ilk kaybolan şeyler; eşik taraması yapmadan sayı seçmeyin.
8. Sabit parçacık sayısı için katmanlı örnekleme kullanın: `u_k = (k + ξ)·toplam/N`. Kümelenmeyi kaldırıyor ve sorgular sıralı olduğu için ikili aramaya gerek bırakmıyor — `O(N log M)` yerine `O(N + M)`.
9. İki ayrı jitter var: katman jitter'ı hangi pikselin seçileceğini, piksel içi jitter aynı piksele düşenlerin üst üste binmesini çözüyor.
10. Morph'un kalitesini easing değil eşleştirme belirliyor. Optimal atama `O(n³)`; Morton sırasıyla iki bulutu da tek bir uzaysal sıraya sokmak pratikte yeterli yaklaşımı veriyor.
11. Morton kodu (32 bit) ile indeksi (20 bit) tek bir `Float64Array` elemanına paketleyip comparator'sız `sort()` çağırın. 52 bit `2^53`'ün altında, sıralama motorun kendi kodunda kalıyor.
12. Kaynak ve hedef iki ayrı statik attribute ise morph tek bir uniform'a iner. Kare başına GPU'ya giden veri sıfır bayt; yalnızca kelime değişiminde tek tamponluk yükleme var.
13. Kaydırmayı hedefin yatay konumuna bağlayın: kelime okuma yönünde kendini yazar. Pencereyi `smoothstep(start, start + (1 - spread), t)` ile kurarsanız kelepçe ve easing tek çağrıda gelir.
14. `normalize` sıfır vektörde NaN üretiyor ve NaN konum sessizce kırpılıyor. Aynı kelimeye tekrar geçmek bu durumu tetikliyor; böleni `max(length(d), 1e-6)` ile kelepçeleyin.
15. Shader'da `sin` tabanlı hash yerine tamsayı hash kullanın; tamsayı işlemleri donanımdan bağımsız birebir aynı sonucu veriyor.
16. `gl_PointSize`'ın tavanı sürücüye bağlı ve aşıldığında sessizce kelepçeleniyor. Nokta ilkeli merkezine göre kırpılıyor; büyük noktalar ekran kenarında topluca kayboluyor. Instanced dörtgende ikisi de yok.
17. `#version` dosyanın ilk satırı olmak zorunda. `#define` enjekte edeceksiniz ikinci satırdan girin.
18. `EXT_disjoint_timer_query_webgl2` sonuçları birkaç kare geç geliyor ve `GPU_DISJOINT_EXT` bayrağı okunmazsa çöp değerler tabloya sızıyor.

Proje iki komutla yaşıyor: `npm run dev` demoyu açıyor, `npm run bench` tarayıcı gerektirmeyen algoritma ölçümlerini alıyor. Adrese `?measure=1` eklerseniz sabit tohumlu ölçüm koşusu yapılıyor.

Geçişin ortasında ekranda ne yazdığını uzun süre gözle tartıştım. "Okunuyor" ile "okunmuyor" arasında bir yerde duruyordu ve kaydırma miktarını değiştirdikçe fikrim değişiyordu.

Sonunda gözü devreden çıkardım. Parçacıkların `t = 0,5` anındaki konumlarını CPU'da hesaplayıp aynı ızgaraya geri damgaladım, sonra iki maskeyle — eski kelimenin ve yeni kelimenin rasteriyle — kesişim/birleşim oranını aldım. Ekranı da dikey üçe böldüm, çünkü kaydırmanın vaadi tam olarak buydu.

Kaydırma açıkken (`spread = 0,6`) sol üçte bir yeni kelimeyle 0,77 örtüşüyor, sağ üçte bir eski kelimeyle 0,82. Kaydırmayı kapatınca ikisi de 0,29 değerine düşüyor: ortada iki kelime birden var ve hiçbiri kendisi değil. Tribün kalkmış, henüz oturmamış.

Kinetik tipografide asıl iş, kelimenin kelime olmadığı o yarım saniyede oluyor. 🔡
