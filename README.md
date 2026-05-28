# hermes-webbridge 🚀

![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/khrannas/hermes-webbridge?style=flat-square)
![npm version](https://img.shields.io/npm/v/hermes-webbridge?style=flat-square)

**Satu perintah untuk memulihkan koneksi Kimi WebBridge + Tailscale Serve setelah laptop Windows di-restart.**

> Dibuat untuk Hermes Agent, tapi bisa dipakai siapa saja yang butuh browser automation via Tailscale.

---

## Daftar Isi

- [Masalah](#masalah)
- [Solusi](#solusi)
- [Prasyarat](#prasyarat)
- [Instalasi](#instalasi)
- [Penggunaan](#penggunaan)
- [Referensi Perintah](#referensi-perintah)
- [Contoh Output](#contoh-output)
- [Arsitektur](#arsitektur)
- [Troubleshooting](#troubleshooting)
- [Pengembangan](#pengembangan)
- [Lisensi](#lisensi)

## Masalah

Setiap kali laptop Windows di-restart, dua service ini harus dijalankan manual:

- **Kimi WebBridge daemon** — perlu start dengan `--addr 0.0.0.0:PORT`
- **Tailscale Serve** — perlu di-enable ulang

Lupa salah satu? Koneksi browser automation putus. Ribet.

## Solusi

`hermes-webbridge` mengotomatiskan semua langkah recovery dalam satu perintah:

```bash
npx github:khrannas/hermes-webbridge recover
```

## Prasyarat

- **Node.js** ≥ 18 (sama https://nodejs.org)
- **Tailscale** terinstal dan login (https://tailscale.com/download)
- **Kimi WebBridge** daemon terinstal (https://kimi.com/features/webbridge)
- **Windows** 10/11

## Instalasi

Tidak perlu instalasi. Jalankan langsung via `npx`:

```bash
npx github:khrannas/hermes-webbridge recover
```

Atau clone untuk penggunaan offline:

```bash
git clone https://github.com/khrannas/hermes-webbridge.git
cd hermes-webbridge
node bin/hwb.js recover
```

## Penggunaan

Setelah laptop Windows di-restart, cukup jalankan:

```bash
npx github:khrannas/hermes-webbridge recover
```

Tool ini akan:

1. ✅ Mengecek apakah Kimi WebBridge terinstal
2. ✅ Menjalankan daemon Webbridge di port 10086
3. ✅ Mengaktifkan Tailscale Serve
4. ✅ Memverifikasi semua komponen berfungsi
5. ✅ Menampilkan status lengkap

## Referensi Perintah

| Perintah | Fungsi |
|----------|--------|
| `hwb check` | Mengecek status daemon Webbridge + Tailscale Serve |
| `hwb start` | Menjalankan Webbridge daemon + mengaktifkan Tailscale Serve |
| `hwb stop` | Menghentikan Webbridge daemon |
| `hwb recover` | Recovery lengkap setelah restart (start + verifikasi) |
| `hwb help` | Menampilkan panduan penggunaan |

## Contoh Output

### `hwb check` (semua berfungsi)

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Status        │
├─────────────────────────────────┤
│ ✅ Daemon        running:true   │
│    Port          10086          │
│    Uptime        123s           │
│ ✅ Extension     connected      │
│ ✅ Tailscale     serve active   │
│ 🌐 https://laptop-xxx.ts.net/   │
╰─────────────────────────────────╯
```

### `hwb check` (daemon mati)

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Status        │
├─────────────────────────────────┤
│ ❌ Daemon        not reachable  │
│ ℹ️  Jalankan: hwb start         │
╰─────────────────────────────────╯
```

### `hwb start`

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Start         │
├─────────────────────────────────┤
│ ℹ️  Webbridge binary ditemukan  │
│ ✅ Daemon started  (port 10086) │
│ ✅ Tailscale Serve aktif        │
│ ✅ Extension connected          │
│ 🌐 https://laptop-xxx.ts.net/   │
╰─────────────────────────────────╯
```

### `hwb recover`

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Recovery      │
├─────────────────────────────────┤
│ ✅ Daemon started               │
│ ✅ Tailscale Serve aktif        │
│ ✅ Verifikasi: semua OK         │
│ 🌐 https://laptop-xxx.ts.net/   │
│ 🎉 Recovery complete            │
╰─────────────────────────────────╯
```

## Arsitektur

```
┌──────────────────────┐        ┌─────────────────────────────┐
│  Hermes Container    │        │  Windows Laptop             │
│                      │        │                             │
│  hwb recover ────────┼────────┼─> tailscale serve (443)     │
│                      │ HTTPS  │    │                        │
│  curl :10086/status  │ CONNECT│    v                        │
│                      │        │  Webbridge daemon :10086    │
│  via Tailscale HTTP  │        │    │                        │
│  proxy :1081         │        │    v                        │
│                      │        │  Chrome Extension           │
└──────────────────────┘        │    │                        │
                                │    v                        │
                                │  Chrome → Browser           │
                                └─────────────────────────────┘
```

**Kenapa Tailscale Serve?** Windows punya masalah dengan `netsh portproxy` — IP Helper Service (`iphlpsvc`) sering berebut port, dan Chrome sering bind ke IPv6 doang. Tailscale Serve jadi reverse proxy di level tailscaled, bypassing semua masalah routing Windows.

## Troubleshooting

| Masalah | Penyebab | Solusi |
|---------|----------|--------|
| `Daemon not reachable` | Webbridge belum diinstal | Download dari https://kimi.com/features/webbridge |
| `Extension not connected` | Chrome extension belum dipasang | Pasang dari Chrome Web Store, pin ke toolbar |
| `PID file exists but HTTP probe failed` | Port 10086 direbut `iphlpsvc` | Pakai port berbeda: `hwb start` dengan env `WEBBRIDGE_PORT=10090` |
| `Command not found: npx` | Node.js belum terinstal | Install dari https://nodejs.org |

## Pengembangan

```bash
git clone https://github.com/khrannas/hermes-webbridge.git
cd hermes-webbridge
node bin/hwb.js help
```

### Struktur Proyek

```
hermes-webbridge/
├── bin/
│   └── hwb.js              # Entry point CLI
├── src/
│   ├── index.js            # Router perintah
│   ├── commands/
│   │   ├── check.js        # Status check
│   │   ├── start.js        # Start daemon + serve
│   │   ├── stop.js         # Stop daemon
│   │   └── recover.js      # Full recovery
│   └── utils/
│       └── powershell.js   # Eksekusi PowerShell
├── package.json
├── README.md
├── LICENSE
├── CONTRIBUTING.md
└── SECURITY.md
```

### Panduan Kontribusi

1. Fork repositori
2. Buat branch fitur: `git checkout -b fitur-keren`
3. Commit perubahan: `git commit -m 'feat: tambah fitur keren'`
4. Push ke branch: `git push origin fitur-keren`
5. Buat Pull Request

Mohon pastikan:

- Tidak menambah dependency eksternal
- Kode tetap CommonJS (require, module.exports)
- Setiap command mengembalikan `{ success, message }`
- Test dengan `node bin/hwb.js help`

## Lisensi

MIT © 2026 Khrannas. Lihat [LICENSE](LICENSE) untuk detail.
