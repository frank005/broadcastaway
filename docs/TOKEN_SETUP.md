# Token Generation Setup

## ⚠️ Important: Netlify Functions Required

Token generation happens on the **backend** (Netlify Functions) for security. The certificate is **never exposed** to the frontend.

## Running the App

### Option 1: Use Netlify Dev (Recommended for Full Features)

This runs both React and Netlify Functions:

```bash
npm run dev
```

Then access at: **http://localhost:8888**

**Note:** If Netlify Dev times out, see [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)

### Option 2: Use React Only (Frontend Only)

This runs only React (Functions won't work):

```bash
npm start
```

Then access at: **http://localhost:3000**

**Note:** Token generation won't work with this method. Use `npm run dev` for full functionality.

## Environment Variables

The backend reads from `.env` file automatically. Make sure you have:

```env
# Frontend (safe to expose)
REACT_APP_AGORA_APP_ID=your_agora_app_id_here

# Backend ONLY (never exposed to frontend)
AGORA_APP_CERTIFICATE=your_agora_certificate_here
```

**Important:**
- `AGORA_APP_CERTIFICATE` should **NOT** have `REACT_APP_` prefix
- The certificate is only used by Netlify Functions (backend)
- Netlify Functions automatically load `.env` file

## Verifying Backend Can Read Certificate

When you make a token request, check the **terminal** (not browser console) for:

```
🔐 [TOKEN API] Environment check:
🔐 [TOKEN API] REACT_APP_AGORA_APP_ID: b82bc283... (length: 32)
🔐 [TOKEN API] AGORA_APP_CERTIFICATE: abc12345... (length: 32)
```

If the certificate shows as "MISSING", check:
1. `.env` file exists in project root
2. Variable name is exactly `AGORA_APP_CERTIFICATE` (no `REACT_APP_` prefix)
3. You restarted Netlify Dev after changing `.env`

## Token Generation Logs

All token generation logs appear in the **TERMINAL** (backend), not browser console:

```
🔐 [TOKEN API] ============================================
🔐 [TOKEN API] Request received
🔐 [TOKEN API] Generating combined RTC+RTM token...
✅ [TOKEN API] Combined token generated: 006b82bc283...
```

## Troubleshooting

### "Unexpected token '<', "<!DOCTYPE "... is not valid JSON"

This means Netlify Functions aren't available. You're probably using `npm start` instead of `npm run dev`.

**Solution:** Use `npm run dev` to run Netlify Dev (which includes Functions).

### Certificate Missing in Backend Logs

1. Check `.env` file exists
2. Verify variable name is `AGORA_APP_CERTIFICATE` (not `REACT_APP_AGORA_APP_CERTIFICATE`)
3. Restart Netlify Dev after changing `.env`
4. Check terminal logs show the certificate is loaded

### Token Generation Returns "null (tokenless)"

This means the backend couldn't generate a token. Check terminal logs for:
- Certificate is loaded
- App ID is loaded
- No errors in token generation

