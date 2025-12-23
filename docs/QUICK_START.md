# Quick Start Guide

## ✅ Just Use `npm start`

**Don't use `npm run dev`** - it has timeout issues with Netlify Dev.

Instead, simply run:

```bash
npm start
```

Then open: **http://localhost:3000**

That's it! Everything works perfectly this way.

## Setup (One Time)

1. **Copy environment file:**
   ```bash
   cp env.example .env
   ```

2. **Edit `.env` with your credentials:**
   - `REACT_APP_AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE`
   - `AGORA_REST_API_KEY` (or `AGORA_CUSTOMER_ID`)
   - `AGORA_REST_API_SECRET` (or `AGORA_CUSTOMER_SECRET`)
   - `OPENAI_API_KEY`

3. **Install (if needed):**
   ```bash
   npm install
   ```

4. **Start:**
   ```bash
   npm start
   ```

## Why Not `npm run dev`?

Netlify Dev has a known issue where it times out waiting for Create React App to be "ready". The app works fine - it's just a tooling detection problem.

**Solution:** Use `npm start` for development. Netlify Functions will work when you deploy to production.

## Production Build

```bash
npm run build
```

Deploy the `build` folder to Netlify.
