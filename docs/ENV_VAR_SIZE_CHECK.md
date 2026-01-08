# Environment Variable Size Check

## Understanding the 4KB Limit

Netlify Lambda functions have a **4KB limit** for all environment variables combined. This includes:
- Variable name (key)
- Variable value
- Overhead (~2 bytes per variable)

## What Counts Towards the Limit

**Only environment variables set in Netlify Dashboard count**, not your local `.env` file.

The limit applies to variables passed to:
- Netlify Functions (in `netlify/functions/`)
- Next.js API routes (in `app/api/`) when deployed

## Variables You Can Likely Remove

Based on your setup, you can probably remove these if not using:

### Recording Features (if not using)
- All `RECORDING_*` variables (~20+ variables)
- Estimated savings: ~1-2KB

### STT Features (if not using)
- All `STT_*` variables (~10+ variables)
- Estimated savings: ~500 bytes

### Legacy React Variables (if fully migrated to Next.js)
- `REACT_APP_*` variables
- Estimated savings: ~200 bytes

### Optional/Default Variables
- `TTS_VENDOR`, `ASR_VENDOR` (if using defaults)
- `AGORA_BASE_URL` (has default)
- `OPENAI_API_URL` (has default)
- `OPENAI_TEMPERATURE` (has default)

## Essential Variables to Keep

These are required for core functionality:

### Agora Core
- `NEXT_PUBLIC_AGORA_APP_ID` (~32 bytes)
- `AGORA_APP_CERTIFICATE` (~32 bytes)
- `AGORA_CUSTOMER_ID` or `AGORA_REST_API_KEY` (~33 bytes)
- `AGORA_CUSTOMER_SECRET` or `AGORA_REST_API_SECRET` (~40 bytes)

### OpenAI (for AI Agent)
- `OPENAI_API_KEY` (~164 bytes - this is large!)
- `OPENAI_MODEL` (~15 bytes)
- `OPENAI_MAX_TOKENS` (~5 bytes)

### AI Agent Config (Optional)
- `AI_AGENT_GREETING_MESSAGE` (~0-50 bytes)
- `AI_AGENT_FAILURE_MESSAGE` (~64 bytes)
- `AI_AGENT_MAX_HISTORY` (~5 bytes)
- **Note:** `AI_AGENT_SYSTEM_MESSAGE` is now in a file, so remove it from Netlify!

### Microsoft TTS (if using)
- `MICROSOFT_TTS_API_KEY` (~40 bytes)
- `MICROSOFT_TTS_REGION` (~10 bytes)
- `MICROSOFT_TTS_VOICE` (~30 bytes)

## How to Check Your Current Size

1. Go to Netlify Dashboard → Site settings → Environment variables
2. Count all variables and estimate their sizes
3. Remove unused ones
4. Redeploy

## Quick Fix Strategy

1. **Remove `AI_AGENT_SYSTEM_MESSAGE`** (now in file) - saves ~5.25KB
2. **Remove all `RECORDING_*`** if not using recording - saves ~1-2KB
3. **Remove all `STT_*`** if not using STT - saves ~500 bytes
4. **Remove `REACT_APP_*`** if migrated to Next.js - saves ~200 bytes

This should get you well under the 4KB limit!

