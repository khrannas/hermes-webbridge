# hermes-webbridge 🚀

![Node Version](https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-blue?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen?style=flat-square)
![GitHub stars](https://img.shields.io/github/stars/khrannas/hermes-webbridge?style=flat-square)
![npm version](https://img.shields.io/npm/v/hermes-webbridge?style=flat-square)

**One command to restore Kimi WebBridge + Tailscale Serve connection after a Windows laptop restart.**

> Built for Hermes Agent, but usable by anyone who needs browser automation via Tailscale.

---

## Table of Contents

- [Problem](#problem)
- [Solution](#solution)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Command Reference](#command-reference)
- [Example Output](#example-output)
- [Architecture](#architecture)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Problem

Every time the Windows laptop restarts, these two services must be started manually:

- **Kimi WebBridge daemon** — needs to be started with `--addr 0.0.0.0:PORT`
- **Tailscale Serve** — needs to be re-enabled

Forget one? Browser automation connection breaks. Annoying.

## Solution

`hermes-webbridge` automates all recovery steps in one command:

```bash
npx github:khrannas/hermes-webbridge recover
```

## Prerequisites

- **Node.js** ≥ 18 (see https://nodejs.org)
- **Tailscale** installed and logged in (https://tailscale.com/download)
- **Kimi WebBridge** daemon installed (https://kimi.com/features/webbridge)
- **Windows** 10/11

## Installation

No installation required. Run directly via `npx`:

```bash
npx github:khrannas/hermes-webbridge recover
```

Or clone for offline use:

```bash
git clone https://github.com/khrannas/hermes-webbridge.git
cd hermes-webbridge
node bin/hwb.js recover
```

## Usage

After a Windows laptop restart, simply run:

```bash
npx github:khrannas/hermes-webbridge recover
```

This tool will:

1. ✅ Check if Kimi WebBridge is installed
2. ✅ Start the Webbridge daemon on port 10086
3. ✅ Enable Tailscale Serve
4. ✅ Verify all components are working
5. ✅ Display full status

## Command Reference

| Command | Function |
|---------|----------|
| `hwb check` | Check status of Webbridge daemon + Tailscale Serve |
| `hwb start` | Start Webbridge daemon + enable Tailscale Serve |
| `hwb stop` | Stop Webbridge daemon |
| `hwb recover` | Full recovery after restart (start + verification) |
| `hwb help` | Show usage guide |

## Example Output

### `hwb check` (all working)

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

### `hwb check` (daemon down)

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Status        │
├─────────────────────────────────┤
│ ❌ Daemon        not reachable  │
│ ℹ️  Run: hwb start               │
╰─────────────────────────────────╯
```

### `hwb start`

```text
╭─────────────────────────────────╮
│  Hermes WebBridge Start         │
├─────────────────────────────────┤
│ ℹ️  Webbridge binary found      │
│ ✅ Daemon started  (port 10086) │
│ ✅ Tailscale Serve active       │
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
│ ✅ Tailscale Serve active       │
│ ✅ Verification: all OK         │
│ 🌐 https://laptop-xxx.ts.net/   │
│ 🎉 Recovery complete            │
╰─────────────────────────────────╯
```

## Architecture

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

**Why Tailscale Serve?** Windows has issues with `netsh portproxy` — IP Helper Service (`iphlpsvc`) often fights for ports, and Chrome often binds to IPv6 only. Tailscale Serve acts as a reverse proxy at the tailscaled level, bypassing all Windows routing issues.

## Troubleshooting

| Problem | Cause | Solution |
|---------|-------|----------|
| `Daemon not reachable` | Webbridge not installed | Download from https://kimi.com/features/webbridge |
| `Extension not connected` | Chrome extension not installed | Install from Chrome Web Store, pin to toolbar |
| `PID file exists but HTTP probe failed` | Port 10086 taken by `iphlpsvc` | Use a different port: `hwb start` with env `WEBBRIDGE_PORT=10090` |
| `Command not found: npx` | Node.js not installed | Install from https://nodejs.org |

## Development

```bash
git clone https://github.com/khrannas/hermes-webbridge.git
cd hermes-webbridge
node bin/hwb.js help
```

### Project Structure

```
hermes-webbridge/
├── bin/
│   └── hwb.js              # CLI entry point
├── src/
│   ├── index.js            # Command router
│   ├── commands/
│   │   ├── check.js        # Status check
│   │   ├── start.js        # Start daemon + serve
│   │   ├── stop.js         # Stop daemon
│   │   └── recover.js      # Full recovery
│   └── utils/
│       └── powershell.js   # PowerShell execution
├── package.json
├── README.md
├── LICENSE
├── CONTRIBUTING.md
└── SECURITY.md
```

### Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b cool-feature`
3. Commit your changes: `git commit -m 'feat: add cool feature'`
4. Push to branch: `git push origin cool-feature`
5. Create a Pull Request

Please ensure:

- No additional external dependencies
- Code stays CommonJS (require, module.exports)
- Each command returns `{ success, message }`
- Test with `node bin/hwb.js help`

## License

MIT © 2026 Khrannas. See [LICENSE](LICENSE) for details.
