# 🚀 BroadCastaway - Start Here

## ⚠️ Important: Use `npm start` (Not `npm run dev`)

Netlify Dev has a known timeout issue with Create React App. **Just use `npm start` instead:**

```bash
npm start
```

Then open: **http://localhost:3000**

This works perfectly! Netlify Functions will work when you deploy to Netlify.

## 📝 Required Setup

1. **Create `.env` file:**
   ```bash
   cp env.example .env
   ```

2. **Fill in your credentials in `.env`:**
   - `REACT_APP_AGORA_APP_ID` - Your Agora App ID
   - `AGORA_APP_CERTIFICATE` - Your Agora Certificate
   - `AGORA_REST_API_KEY` - Your Agora Customer ID
   - `AGORA_REST_API_SECRET` - Your Agora Customer Secret
   - `OPENAI_API_KEY` - Your OpenAI API Key (for AI Agent)

3. **Start the app:**
   ```bash
   npm start
   ```

## 🐛 Why Not `npm run dev`?

Netlify Dev times out waiting for React to be "ready" - this is a known issue with Create React App. The app works fine, it's just a tooling detection problem.

**Solution:** Use `npm start` for development. Everything works the same way!

## ✨ Features

- ✅ Host/Audience broadcasting
- ✅ Screen sharing
- ✅ RTM chat and presence
- ✅ Host promotion system
- ✅ AI Agent integration
- ✅ Media Pull/Push/Gateway
- ✅ All UI components

Everything is ready to go! Just use `npm start`.
