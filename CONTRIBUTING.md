# Contributing to hermes-webbridge

Terima kasih sudah ingin berkontribusi! Berikut panduan singkatnya.

## Cara Berkontribusi

1. **Fork** repositori ini
2. Buat **branch fitur**: `git checkout -b fitur-keren`
3. **Commit** perubahan: `git commit -m 'feat: tambah fitur keren'`
4. **Push** ke branch: `git push origin fitur-keren`
5. Buat **Pull Request** ke branch `main`

## Panduan Kode

- **CommonJS** — gunakan `require()` dan `module.exports`, jangan ES modules
- **Zero dependencies** — jangan tambahkan package npm eksternal
- Setiap command di `src/commands/` harus mengembalikan `{ success, message }`
- Gunakan error code yang informatif
- Test dengan menjalankan: `node bin/hwb.js help`

## Melaporkan Masalah

- Pastikan issue belum ada yang melaporkan sebelumnya
- Sertakan versi Node.js, OS, dan output error
- Jelaskan langkah reproduksi

## Pull Request

- Jelaskan perubahan yang dibuat
- Pastikan tidak merusak command yang sudah ada
- Ikuti gaya kode yang sudah ada (2 spasi indentasi)

## Lisensi

Dengan berkontribusi, Anda setuju bahwa kontribusi Anda akan dilisensikan di bawah [MIT License](LICENSE).
