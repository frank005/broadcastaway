# Environment Variables Troubleshooting

## Quick Check

Visit this URL while your dev server is running:
```
http://localhost:3000/api/env-check
```

This will show you:
- Which `.env` files exist
- Which environment variables are loaded
- Current working directory

## File Location

`.env.local` **MUST** be in the **root directory** of your project:

```
castaway/
├── .env.local          ← HERE (root directory)
├── package.json
├── next.config.js
├── app/
├── src/
└── ...
```

## Next.js Environment Variable Loading

Next.js automatically loads environment variables from these files (in order):
1. `.env.local` (highest priority, ignored by git)
2. `.env.development` or `.env.production` (based on NODE_ENV)
3. `.env`

**Important:** `.env.local` is loaded automatically - no configuration needed!

## Common Issues

### Issue 1: File Not Found

**Symptom:** All variables show as "MISSING"

**Solution:**
1. Check file exists: `ls -la .env.local`
2. Verify you're in project root: `pwd`
3. Create file: `cp env.example .env.local`

### Issue 2: Variables Not Loading After Changes

**Symptom:** Changed `.env.local` but variables still show old values

**Solution:**
1. **Restart the dev server** (Next.js only loads env vars at startup)
   ```bash
   # Stop server (Ctrl+C)
   npm run dev
   ```

2. Check for typos in variable names
3. Ensure no extra spaces around `=`

### Issue 3: Wrong Variable Names

**Symptom:** Variables exist but show as "MISSING"

**Check variable names:**
- ✅ `NEXT_PUBLIC_AGORA_APP_ID` (frontend)
- ✅ `AGORA_APP_CERTIFICATE` (backend, NO prefix)
- ✅ `AGORA_CUSTOMER_ID` (backend)
- ✅ `AGORA_CUSTOMER_SECRET` (backend)

**Common mistakes:**
- ❌ `REACT_APP_AGORA_APP_ID` (old React naming)
- ❌ `NEXT_PUBLIC_AGORA_APP_CERTIFICATE` (certificate should NOT have prefix)

### Issue 4: File in Wrong Location

**Symptom:** File exists but variables not loading

**Check:**
```bash
# Should show .env.local
ls -la .env.local

# Should be in project root
pwd
# Should output: /path/to/castaway
```

### Issue 5: Syntax Errors in .env.local

**Symptom:** Some variables load, others don't

**Check for:**
- No quotes needed (unless value has spaces)
- No trailing spaces
- One variable per line
- No empty lines with `=`

**Correct format:**
```env
NEXT_PUBLIC_AGORA_APP_ID=b82bc2839fec4413bd6f2d4c4b60d70a
AGORA_APP_CERTIFICATE=abc123def4567890123456789012345678
```

**Wrong format:**
```env
NEXT_PUBLIC_AGORA_APP_ID = "b82bc283..."  # ❌ Spaces and quotes
AGORA_APP_CERTIFICATE=abc123...  # trailing space
```

## Verification Steps

1. **Check file exists:**
   ```bash
   ls -la .env.local
   ```

2. **Check file location:**
   ```bash
   pwd
   # Should be: /path/to/castaway
   ```

3. **Check file contents (first few lines):**
   ```bash
   head -5 .env.local
   ```

4. **Restart dev server:**
   ```bash
   npm run dev
   ```

5. **Visit diagnostic endpoint:**
   ```
   http://localhost:3000/api/env-check
   ```

6. **Check terminal logs:**
   When you make API calls, check terminal for:
   ```
   🔐 [TOKEN API] NEXT_PUBLIC_AGORA_APP_ID: b82bc283... (length: 32)
   🔐 [TOKEN API] AGORA_APP_CERTIFICATE: abc12345... (length: 32)
   ```

## Still Not Working?

1. **Delete `.next` folder and restart:**
   ```bash
   rm -rf .next
   npm run dev
   ```

2. **Check for multiple .env files:**
   ```bash
   ls -la .env*
   ```
   Next.js loads `.env.local` first, so if you have both `.env` and `.env.local`, `.env.local` takes priority.

3. **Verify Node.js version:**
   ```bash
   node --version
   # Should be 18+
   ```

4. **Check Next.js is running:**
   ```bash
   # Should show process
   ps aux | grep "next dev"
   ```

## Example .env.local

```env
# Frontend (safe to expose)
NEXT_PUBLIC_AGORA_APP_ID=b82bc2839fec4413bd6f2d4c4b60d70a

# Backend ONLY (never exposed)
AGORA_APP_CERTIFICATE=abc123def4567890123456789012345678
AGORA_CUSTOMER_ID=your_customer_id_here
AGORA_CUSTOMER_SECRET=your_customer_secret_here
AGORA_BASE_URL=https://api.agora.io

# Optional
OPENAI_API_KEY=sk-your-openai-key-here
```

## Need More Help?

Check the terminal logs when making API calls - they show exactly which variables are loaded and which are missing.

