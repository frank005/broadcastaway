# BroadCastaway Setup Guide

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create environment file:**
   ```bash
   cp env.example .env.local
   ```

3. **Fill in your credentials in `.env.local`:**
   ```env
   # Frontend (safe to expose)
   NEXT_PUBLIC_AGORA_APP_ID=your_32_char_hex_app_id

   # Backend ONLY (never exposed)
   AGORA_APP_CERTIFICATE=your_32_char_hex_certificate
   AGORA_CUSTOMER_ID=your_customer_id
   AGORA_CUSTOMER_SECRET=your_customer_secret
   ```

4. **Start development server:**
   ```bash
   npm run dev
   ```

5. **Open browser:**
   ```
   http://localhost:3000
   ```

## Environment Variables

### Required

- `NEXT_PUBLIC_AGORA_APP_ID` - Your Agora App ID (32 hex characters)
- `AGORA_APP_CERTIFICATE` - Your Agora Certificate (32 hex characters)
- `AGORA_CUSTOMER_ID` - For REST API calls (channel listing, media services)
- `AGORA_CUSTOMER_SECRET` - For REST API calls

### Optional

- `AGORA_BASE_URL` - Default: https://api.agora.io
- `OPENAI_API_KEY` - For AI Agent feature
- Other feature toggles (see `env.example`)

## Netlify Deployment

### Automatic Deployment

1. **Connect GitHub repo to Netlify**
2. **Set environment variables in Netlify dashboard:**
   - `NEXT_PUBLIC_AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE`
   - `AGORA_CUSTOMER_ID`
   - `AGORA_CUSTOMER_SECRET`
   - `OPENAI_API_KEY` (if using AI Agent)

3. **Deploy** - Netlify will automatically:
   - Install dependencies
   - Build Next.js app
   - Deploy using `@netlify/plugin-nextjs`

### Manual Deployment

```bash
npm run build
netlify deploy --prod
```

## Project Structure

```
castaway/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (backend)
│   │   ├── token/         # Token generation
│   │   ├── channels/      # Channel listing
│   │   ├── media-proxy/   # Media services proxy
│   │   └── agora-agents/  # AI Agent management
│   ├── browse/            # Browse channels page
│   ├── host/              # Host page
│   ├── watch/             # Watch page
│   ├── broadcast/         # Broadcast page (host view)
│   └── components/        # React components
├── src/                   # Shared services (agoraService.js)
├── netlify/
│   └── functions/
│       └── utils/         # Token builder utilities (used by API routes)
├── docs/                  # Documentation
└── .env.local            # Environment variables (not in git)
```

## Features

- ✅ Browse active channels
- ✅ Host live broadcasts
- ✅ Watch broadcasts
- ✅ Screen sharing
- ✅ Media Pull/Push/Gateway
- ✅ AI Agent integration
- ✅ Host promotion system
- ✅ RTM chat and presence

## Troubleshooting

See `docs/DIAGNOSTICS.md` for detailed troubleshooting guide.

Run diagnostic script:
```bash
node docs/check-setup.js
```

