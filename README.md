# Solana Wallet Tracker

A Telegram bot that monitors Solana wallets in real-time and sends clean, trading-terminal-style alerts for swaps, transfers, and other activity.

## Features

- **Real-time monitoring** — Helius WebSocket for instant transaction detection
- **Smart parsing** — Identifies swaps (Jupiter, Raydium, PumpSwap), token transfers, and SOL transfers
- **USD values** — Automatic price lookups via DexScreener
- **Token resolution** — Resolves mint addresses to human-readable names and symbols
- **Multiple wallets** — Track as many wallets as you want, with custom labels
- **Persistent storage** — Wallet list survives restarts (SQLite)
- **Auto-reconnect** — WebSocket reconnects automatically if disconnected

## Alert Examples

```
🔄 SWAP  ·  Smart Money #1
━━━━━━━━━━━━━━━━━━━
2.50 SOL  →  1.20M BONK
💰 Value: ~$412.50
📍 Jupiter

View Tx  ·  Wallet  ·  2m ago
```

```
📤 SENT  ·  Dev Wallet
━━━━━━━━━━━━━━━━━━━
10.00 SOL → 7vK...mN3
💰 Value: ~$1,650.00

View Tx  ·  Wallet  ·  3m ago
```

## Commands

| Command | Description |
|---------|-------------|
| `/watch <address> [label]` | Start tracking a wallet |
| `/unwatch <address>` | Stop tracking |
| `/wallets` | List all tracked wallets |
| `/ping` | Health check |

## Setup

### 1. Get API Keys

- **Telegram Bot** — Create via [@BotFather](https://t.me/BotFather)
- **Helius** — Free tier at [dev.helius.xyz](https://dev.helius.xyz)

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your bot token and Helius API key
```

Edit `config.yaml` with your Telegram user ID.

### 3. Install & Run

```bash
npm install
npm run build
npm start
```

### 4. Run with PM2 (recommended)

```bash
pm2 start dist/index.js --name wallet-tracker
pm2 save
```

## Tech Stack

- TypeScript + Node.js
- [Telegraf](https://telegraf.js.org/) — Telegram bot framework
- [Helius](https://helius.xyz/) — Solana WebSocket & enriched transactions
- [DexScreener](https://dexscreener.com/) — Token prices
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — Wallet persistence

## License

MIT
