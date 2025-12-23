# Token Generation Debugging

## Error: "CAN_NOT_GET_GATEWAY_SERVER: dynamic use static key"

This error typically means:
1. **Invalid or missing token** - The token format is wrong or empty
2. **Wrong App ID** - The App ID doesn't match your Agora project
3. **Wrong Certificate** - The certificate doesn't match your App ID
4. **Token not generated** - Token generation failed silently

## How to Debug

### 1. Check Environment Variables

Make sure your `.env` file has:
```env
REACT_APP_AGORA_APP_ID=your_app_id_here
REACT_APP_AGORA_APP_CERTIFICATE=your_certificate_here
```

**Important:** 
- Certificate must be exactly 32 characters (hex string)
- App ID must be exactly 32 characters (hex string)
- Restart dev server after changing `.env`

### 2. Check Browser Console

Look for these log messages:
- `🔐 [TOKEN] Starting token generation...`
- `🔐 [TOKEN] App ID: ...`
- `🔐 [TOKEN] Certificate: ...`
- `✅ [TOKEN] Token generated successfully`

If you see "MISSING" for App ID or Certificate, the env vars aren't loaded.

### 3. Verify Token Format

A valid token should:
- Start with `007` (version)
- Be a long base64 string
- Not be empty or null

### 4. Test Token Generation

Open browser console and run:
```javascript
// Check if token builder is loaded
console.log('RtcTokenBuilder:', window.RtcTokenBuilder);
console.log('RtcRole:', window.RtcRole);

// Check env vars
console.log('App ID:', process.env.REACT_APP_AGORA_APP_ID);
console.log('Certificate:', process.env.REACT_APP_AGORA_APP_CERTIFICATE);
```

### 5. Common Issues

**Issue:** Certificate shows as "MISSING"
- **Fix:** Make sure `.env` file exists and has `REACT_APP_AGORA_APP_CERTIFICATE`
- **Fix:** Restart dev server: `npm start`
- **Fix:** Check that variable name is exactly `REACT_APP_AGORA_APP_CERTIFICATE`

**Issue:** Token is null
- **Fix:** Check certificate length (must be 32 hex characters)
- **Fix:** Verify App ID matches your Agora project
- **Fix:** Check browser console for token generation errors

**Issue:** "dynamic use static key" error
- **Fix:** This means token is invalid - check App ID and Certificate match
- **Fix:** Try tokenless mode first (set certificate to empty to test)
- **Fix:** Verify you're using the correct App ID for your project

## Tokenless Mode

If tokens aren't working, you can use tokenless mode by:
1. Not setting `REACT_APP_AGORA_APP_CERTIFICATE` in `.env`
2. The app will automatically use `null` tokens
3. This works for testing but not recommended for production

## Production Notes

For production deployment:
- Set environment variables in Netlify dashboard
- Certificate will be embedded in the build
- Make sure to use the same App ID and Certificate

