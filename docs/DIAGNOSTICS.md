# Diagnostics & Troubleshooting Guide

## Environment Variables Check

### Required Variables

**Frontend (NEXT_PUBLIC_* - Safe to expose):**
- `NEXT_PUBLIC_AGORA_APP_ID` - Your Agora App ID (32 hex characters)

**Backend Only (Never exposed to frontend):**
- `AGORA_APP_CERTIFICATE` - Your Agora Certificate (32 hex characters)
- `AGORA_CUSTOMER_ID` or `AGORA_REST_API_KEY` - For REST API calls
- `AGORA_CUSTOMER_SECRET` or `AGORA_REST_API_SECRET` - For REST API calls
- `AGORA_BASE_URL` - Default: https://api.agora.io

### Check Your .env File

1. **Create `.env.local` file** (Next.js uses `.env.local` for local development):
   ```bash
   cp env.example .env.local
   ```

2. **Fill in your credentials:**
   ```env
   NEXT_PUBLIC_AGORA_APP_ID=your_32_char_hex_app_id
   AGORA_APP_CERTIFICATE=your_32_char_hex_certificate
   AGORA_CUSTOMER_ID=your_customer_id
   AGORA_CUSTOMER_SECRET=your_customer_secret
   ```

3. **Restart the dev server** after changing `.env.local`:
   ```bash
   # Stop the server (Ctrl+C)
   npm run dev
   ```

## Common Issues

### 1. Token Generation Fails

**Symptoms:**
- Error: "Token builder utilities not available"
- Error: "AGORA_APP_ID or AGORA_APP_CERTIFICATE not set"

**Solutions:**
- Check `.env.local` exists and has correct variable names
- Verify `AGORA_APP_CERTIFICATE` is exactly 32 hex characters
- Verify `NEXT_PUBLIC_AGORA_APP_ID` is exactly 32 hex characters
- Restart dev server after changing `.env.local`
- Check terminal logs for detailed error messages

### 2. Channel List Empty

**Symptoms:**
- Browse page shows "No channels found"
- Error: "Missing Agora credentials"

**Solutions:**
- Check `AGORA_CUSTOMER_ID` and `AGORA_CUSTOMER_SECRET` are set
- Verify REST API credentials are correct
- Check terminal logs for API errors
- Ensure channels are actually active (have users)

### 3. Module Not Found Errors

**Symptoms:**
- Error: "Cannot find module"
- Error: "require is not defined"

**Solutions:**
- Run `npm install` to install dependencies
- Check `node_modules` exists
- Verify token builder files exist: `netlify/functions/utils/AccessToken2.js`
- Check `netlify/functions/utils/RtcTokenBuilder2.js` exists

### 4. API Routes Not Working

**Symptoms:**
- 404 errors on `/api/token` or `/api/channels`
- Error: "Route not found"

**Solutions:**
- Verify files exist:
  - `app/api/token/route.js`
  - `app/api/channels/route.ts`
- Check Next.js is running: `npm run dev`
- Verify you're accessing `http://localhost:3000` (not 8888)
- Check terminal for compilation errors

## Debugging Steps

### 1. Check Environment Variables

```bash
# In your terminal, check if variables are loaded
node -e "console.log('App ID:', process.env.NEXT_PUBLIC_AGORA_APP_ID ? 'SET' : 'MISSING');"
```

**Note:** Next.js only loads `.env.local` at build/start time. Restart the server after changes.

### 2. Check Terminal Logs

When you make API calls, check the **terminal** (not browser console) for:
- `🔐 [TOKEN API]` - Token generation logs
- `📊 [CHANNELS API]` - Channel list logs
- `❌` - Error messages with details

### 3. Test API Routes Directly

```bash
# Test token API
curl -X POST http://localhost:3000/api/token \
  -H "Content-Type: application/json" \
  -d '{"channelName":"test","uid":123,"role":"host"}'

# Test channels API
curl http://localhost:3000/api/channels
```

### 4. Verify File Structure

```bash
# Check token builder files exist
ls -la netlify/functions/utils/

# Should show:
# - AccessToken2.js
# - RtcTokenBuilder2.js
```

### 5. Check Node Version

```bash
node --version
# Should be 18 or higher
```

## Next.js Specific Issues

### Runtime Configuration

- API routes use **Node.js runtime** (not Edge) for CommonJS compatibility
- Token builder utilities use `require()` which only works in Node.js runtime
- `Buffer` is available in Node.js runtime (used in channels API)

### Environment Variables

- **Frontend:** Use `NEXT_PUBLIC_*` prefix (exposed to browser)
- **Backend:** No prefix (server-only, never exposed)
- Next.js loads `.env.local` automatically in development
- Production: Set variables in Netlify dashboard

## Still Having Issues?

1. **Check terminal output** - All API logs appear there
2. **Verify .env.local** - Must be in project root
3. **Restart dev server** - After any .env changes
4. **Check file paths** - Token builders must be in `netlify/functions/utils/`
5. **Verify credentials** - App ID and Certificate must be 32 hex chars

