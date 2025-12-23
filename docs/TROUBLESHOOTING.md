# Troubleshooting Guide

## If Netlify Dev Keeps Crashing

### Option 1: Run React Directly (Recommended for Development)

This bypasses Netlify Dev and runs React directly:

```bash
npm start
```

Then access at: **http://localhost:3000**

**Note:** Netlify Functions won't work this way, but you can test the frontend.

### Option 2: Fix Netlify Dev

The issue is Netlify Dev timing out waiting for React. Try:

1. **Kill all processes:**
   ```bash
   pkill -9 -f "react-scripts"
   pkill -9 -f "netlify"
   ```

2. **Clear ports:**
   ```bash
   lsof -ti:3000 | xargs kill -9 2>/dev/null
   lsof -ti:8888 | xargs kill -9 2>/dev/null
   ```

3. **Start with more verbose output:**
   ```bash
   DEBUG=* npm run dev
   ```

4. **Or use the live flag:**
   ```bash
   netlify dev --live
   ```

### Option 3: Use Two Terminals

1. **Terminal 1 - Start React:**
   ```bash
   npm start
   ```
   Wait until you see "Compiled successfully!"

2. **Terminal 2 - Start Netlify Dev:**
   ```bash
   netlify dev --live --port 8888
   ```

### Common Issues

#### Port Already in Use
```bash
# Find what's using the port
lsof -i:3000
lsof -i:8888

# Kill it
kill -9 <PID>
```

#### Missing .env File
```bash
cp env.example .env
# Edit .env with your credentials
```

#### Node Modules Issues
```bash
rm -rf node_modules package-lock.json
npm install
```

#### Build Errors
```bash
# Check for syntax errors
npm run build

# Check for linting errors
npm run start
```

## Quick Test

To verify everything works:

1. **Test React build:**
   ```bash
   npm run build
   ```
   Should complete without errors.

2. **Test React dev server:**
   ```bash
   npm start
   ```
   Should open http://localhost:3000

3. **Test Netlify Functions:**
   ```bash
   # In another terminal, test a function
   curl -X POST http://localhost:8888/.netlify/functions/token \
     -H "Content-Type: application/json" \
     -d '{"channelName":"test","uid":123,"role":"host"}'
   ```

## Still Having Issues?

1. Check Node version: `node --version` (should be 18+)
2. Check npm version: `npm --version`
3. Check for error logs in terminal
4. Try a clean install:
   ```bash
   rm -rf node_modules package-lock.json .netlify
   npm install
   npm run dev
   ```

