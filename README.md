# hermes-webbridge

CLI to set up and manage **Kimi WebBridge** + **Tailscale Serve** on Windows laptops.

Run via `npx hermes-webbridge <command>` on any Windows machine.

## Usage

```
npx hermes-webbridge <command>
```

Or install globally:

```
npm install -g hermes-webbridge
hwb <command>
```

## Commands

| Command   | Description                                      |
|-----------|--------------------------------------------------|
| `check`   | Check Webbridge daemon + Tailscale Serve status  |
| `start`   | Start Webbridge daemon + enable Tailscale Serve  |
| `stop`    | Stop Webbridge daemon                            |
| `recover` | Full post-restart recovery (start + verify)      |

## Requirements

- **Node.js** >= 18
- **Tailscale** installed and authenticated
- **Kimi WebBridge** daemon installed at `%USERPROFILE%\.kimi-webbridge\bin\kimi-webbridge.exe`
- **Windows** (uses PowerShell)

## Example

```
$ npx hermes-webbridge check

🔍 Checking WebBridge status...

╭─────────────────────────────────────────────────╮
│  Hermes WebBridge Status                        │
├─────────────────────────────────────────────────┤
│ ✅ Daemon        running:true                   │
│    Port          10086                          │
│    Uptime        1234s                          │
│ ✅ Extension     connected:true                 │
│ ✅ Tailscale     serve active                   │
│ 🌐 https://your-machine.tailabc123.ts.net/      │
╰─────────────────────────────────────────────────╯
```

## License

MIT
