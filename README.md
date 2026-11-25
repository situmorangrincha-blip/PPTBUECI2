# PANDA SUKSESS: presentasi web interaktif + editor

**P**eningkatan ku**A**litas coverage de**N**gan pertumbuhan s**A**les **D**an produktivita**S** c**U**stomer a**K**tif serta peningkatan di**S**tribusi t**E**rfokus pada **MSS**

Review Tim Bima & Yudistira, SP Kebayoran. Before = rata² Jan-Feb 2026, After = rata² Apr-Okt 2026, Oktober disorot sebagai bulan terbaru.

Web ini punya dua mode:
- **Presentasi**: slide dengan motion, panda interaktif, ornamen bergerak, dan breakdown saat objek diklik.
- **Edit** (tombol pensil atau tekan `E`, pakai PIN): edit seperti Canva. Ubah teks, geser, ubah ukuran, tambah slide, tambah grafik, import dan export PowerPoint.

Isi slide disimpan sebagai `content/deck.json`. PPT hanya dipakai untuk import dan export.

## 1. Deploy ke Vercel

1. Buat repo GitHub baru, lalu upload semua isi folder ini.
2. Di Vercel: **Add New › Project › Import** repo tersebut.
3. Framework Preset: **Other**. Kosongkan Build Command dan Output Directory, lalu klik **Deploy**.

## 2. Supaya hasil edit tersimpan untuk semua orang (Supabase, gratis)

Tanpa langkah ini web tetap jalan, tapi hasil edit hanya tersimpan di browser yang dipakai mengedit. PIN default-nya `2026` (diatur di `js/config.js`).

1. Buat project di [supabase.com](https://supabase.com).
2. Buka **SQL Editor**, tempel isi `supabase.sql`, ganti `GANTI-PIN-INI` dengan PIN pilihanmu, lalu klik **Run**.
3. Buka **Project Settings › API**, salin **Project URL** dan **anon public key**.
4. Isi keduanya di `js/config.js`, lalu commit. Vercel akan deploy ulang otomatis.

Setelah itu, siapa pun yang membuka web melihat versi terakhir yang disimpan. Hanya yang tahu PIN yang bisa menyimpan. Supabase juga menyimpan 30 versi terakhir di **File › Riwayat versi**.

Untuk mengganti PIN, jalankan ulang baris terakhir `supabase.sql` dengan PIN baru.

## 3. Cara edit

| Aksi | Cara |
|---|---|
| Pilih objek | klik. Shift+klik atau tarik area untuk memilih banyak objek. Klik lagi objek yang sudah terpilih untuk memilih objek di bawahnya |
| Ketik teks | klik 2x, lalu `Esc` untuk selesai. Pilih sebagian kata untuk menebalkan atau mewarnai bagian itu saja |
| Geser / ubah ukuran / putar | tarik objek, kotak di sudut, atau bulatan di atas. Tahan `Alt` untuk mematikan snapping, `Shift` untuk menjaga rasio |
| Edit data grafik | pilih grafik, lalu ketik di tabel panel kanan. Bisa *Tempel dari Excel* atau *Isi grafik dari data* (CA, CA Prod, EC, CA MSS, Kontribusi, Omset) |
| Tabel | klik 2x untuk mengetik di sel. Tambah atau hapus baris dan kolom dari panel kanan |
| Animasi muncul per klik | panel kanan › *Muncul saat klik ke-* |
| Breakdown saat diklik | panel kanan › *Klik membuka breakdown* |
| Ornamen bergerak | panel kanan › *Gerak ornamen* (bergoyang, melayang, berdenyut, berputar, bergetar, mengintip, hujan daun) |
| Slide | panel kiri: klik untuk pindah, tarik untuk urutkan ulang, ⧉ duplikat, ◉ sembunyikan, 🗑 hapus |
| Pintasan | `Ctrl+Z` / `Ctrl+Y` undo-redo, `Ctrl+C` / `V` / `D`, `Delete`, panah untuk geser, `Ctrl+S` simpan |
| Gambar | tombol Gambar, atau tempel langsung dengan `Ctrl+V` |
| PowerPoint | menu **File › Export ke PowerPoint** (lengkap dengan animasi per klik) atau **Import PPT** (ganti semua slide atau tambahkan di akhir) |

Kalau belum pakai Supabase dan ingin membagikan hasil edit, pakai **File › Unduh deck.json**, lalu ganti `content/deck.json` di GitHub.

## 4. Data Excel (breakdown)

`content/data.xlsx` dibaca untuk panel breakdown. Sheet yang dipakai web:
`SETTING`, `MASTER_RUTE`, `DATA_OUTLET`, `DATA_SKU`, `DATA_CR`, `DATA_EC`, `DATA_ONC`, `DATA_PARETO`, `DATA_ITG`, `DATA_TARGET`, `DATA_9SUPER`.
Jangan ganti nama sheet dan header kolom. Periode before/after dan bulan update diatur di `SETTING`.

Ada dua cara mengganti Excel:
- dari mode edit (**File › Ganti Excel data**): ikut tersimpan untuk semua orang;
- dari tombol upload di mode presentasi: hanya berlaku di browser itu.

## 5. Kontrol presentasi

| Aksi | Tombol |
|---|---|
| Lanjut / mundur (termasuk muncul per poin) | klik slide, `→` `←`, spasi, swipe |
| Semua slide | `O` |
| Catatan pembicara | `N` |
| Panda pemandu (klik panda untuk poin penjelasan) | `P` |
| Mode edit | `E` |
| Layar penuh | `F` |

Panda di cover mengikuti kursor dengan matanya, berkedip, menggoyangkan telinga saat disorot, dan melambai sambil melompat saat diklik. Ornamen bergoyang, bergerak mengikuti kursor (parallax), memantul saat disorot, dan mengeluarkan daun atau kilau saat diklik. Daun yang jatuh juga menghindar dari kursor.

## Struktur

```
index.html
content/deck.json      isi slide (master)
content/media/         gambar slide
content/data.xlsx      data breakdown
content/deck.pptx      PPT bawaan (unduhan)
js/config.js           Supabase + PIN lokal
js/render.js           render slide dari deck.json
js/editor.js           editor ala Canva
js/store.js            simpan ke Supabase / browser
js/export.js           export PowerPoint
js/pptx-parse.js       import PowerPoint
js/panda.js, fx.js     panda interaktif & ornamen bergerak
js/drill.js, data.js   panel breakdown dari Excel
js/app.js              mode presentasi
supabase.sql           setup database
```

## Definisi indikator

- **CA**: outlet dengan omset > 0 dalam sebulan.
- **CA Prod**: outlet dengan omset min. Rp200 rb (retail) atau Rp1 jt (grosir) sebulan.
- **EC**: effective call rata² per hari (STD retail 27, grosir 18). EC tim = rata² 5 rute.
- **CA MSS**: outlet yang membeli minimal 1 SKU MSS dalam sebulan.
- **Kontribusi MSS**: omset MSS ÷ omset total (dibaca dalam poin).
- Satu outlet-bulan dihitung ke satu rute, yaitu rute dengan omset terbesar di outlet itu pada bulan tersebut.
