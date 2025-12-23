# Quick Setup: .env.local File

## Step 1: Create the file

In your **project root directory** (same folder as `package.json`), run:

```bash
cp env.example .env.local
```

## Step 2: Edit .env.local

Open `.env.local` in your editor and fill in your actual credentials:

```env
# Replace these with your actual values:
NEXT_PUBLIC_AGORA_APP_ID=your_actual_app_id_here
AGORA_APP_CERTIFICATE=your_actual_certificate_here
AGORA_CUSTOMER_ID=your_actual_customer_id_here
AGORA_CUSTOMER_SECRET=your_actual_secret_here
```

**Important:**
- Remove the `your_*_here` placeholders
- Don't add quotes around values
- No spaces around the `=` sign
- One variable per line

## Step 3: Verify file location

The file should be here:
```
castaway/
├── .env.local          ← HERE
├── package.json
├── next.config.js
└── ...
```

## Step 4: Restart dev server

**CRITICAL:** Next.js only loads environment variables when the server starts.

```bash
# Stop current server (Ctrl+C if running)
npm run dev
```

## Step 5: Test

1. Start server: `npm run dev`
2. Visit: `http://localhost:3000/api/env-check`
3. You should see your variables listed (values will be partially hidden for security)

## Troubleshooting

### File not found?
```bash
# Check current directory
pwd
# Should show: /path/to/castaway

# List files
ls -la .env*
```

### Variables still missing?
1. **Restart the server** - This is the #1 cause!
2. Check for typos in variable names
3. Make sure no extra spaces: `KEY=value` not `KEY = value`
4. Check file is in root directory, not in a subfolder

### Still not working?
Run this test script:
```bash
node test-env.js
```

This will show you exactly what's wrong.

