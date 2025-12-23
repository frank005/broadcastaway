# Migration to Next.js - Complete Guide

## ✅ What's Been Done

1. **Next.js Project Structure Created**
   - `next.config.js` - Next.js configuration
   - `tsconfig.json` - TypeScript configuration
   - `app/` directory - Next.js App Router structure
   - `app/layout.tsx` - Root layout with Agora SDKs
   - `app/globals.css` - Global styles with Tailwind
   - `app/page.tsx` - Home/Lobby page (converted from LobbyPage.jsx)

2. **API Routes Created**
   - `app/api/token/route.ts` - Backend token generation (secure)
   - Uses existing token builder utilities from `netlify/functions/utils/`

3. **Package.json Updated**
   - Removed React Scripts
   - Added Next.js 14
   - Updated scripts for Next.js

4. **Netlify Configuration**
   - Updated `netlify.toml` for Next.js deployment
   - Uses `@netlify/plugin-nextjs`

5. **Environment Variables**
   - Changed `REACT_APP_AGORA_APP_ID` to `NEXT_PUBLIC_AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE` remains backend-only (no prefix)

## 🔄 What Still Needs to Be Done

### 1. Convert Remaining Pages

**BroadcastPage.jsx → `app/broadcast/[channelName]/page.tsx`**
- Convert React Router hooks to Next.js:
  - `useParams()` → `params` prop
  - `useSearchParams()` → `searchParams` prop
  - `useNavigate()` → `useRouter()` from `next/navigation`
- Update imports to use Next.js client components

**AudiencePage.jsx → `app/watch/[channelName]/page.tsx`**
- Same conversions as BroadcastPage

### 2. Update AgoraService

The service is mostly compatible, but:
- Update `process.env.REACT_APP_AGORA_APP_ID` to `process.env.NEXT_PUBLIC_AGORA_APP_ID`
- Token fetching already updated to use `/api/token`

### 3. Move Components

- `src/components/VideoPlayer.jsx` → `app/components/VideoPlayer.tsx`
- Update imports in pages

### 4. Install Dependencies

```bash
npm install
```

This will install Next.js and all dependencies.

### 5. Update Environment File

Copy `env.example` to `.env.local` and update with your credentials:
- `NEXT_PUBLIC_AGORA_APP_ID` (frontend - safe to expose)
- `AGORA_APP_CERTIFICATE` (backend only - never exposed)

## 🚀 Running the App

### Development
```bash
npm run dev
```
Access at: http://localhost:3000

### Production Build
```bash
npm run build
npm start
```

## 📦 Deployment to Netlify

1. **Install Netlify CLI** (if not already):
   ```bash
   npm install -g netlify-cli
   ```

2. **Deploy**:
   ```bash
   netlify deploy --prod
   ```

   Or connect your GitHub repo to Netlify - it will auto-deploy.

3. **Environment Variables**:
   - Set `NEXT_PUBLIC_AGORA_APP_ID` in Netlify dashboard
   - Set `AGORA_APP_CERTIFICATE` in Netlify dashboard (backend only)

## 🔐 Security Improvements

✅ **Token Generation is Now Backend-Only**
- Certificate never exposed to frontend
- All token generation happens in Next.js API routes
- Logs appear in terminal (backend), not browser console

## 📝 Next Steps

1. Convert `BroadcastPage.jsx` to Next.js page
2. Convert `AudiencePage.jsx` to Next.js page
3. Move `VideoPlayer` component
4. Test token generation
5. Test all features
6. Deploy to Netlify

## 🐛 Troubleshooting

### "Module not found" errors
- Run `npm install` to install all dependencies
- Make sure you're using Node 18+

### Token generation fails
- Check `.env.local` has `AGORA_APP_CERTIFICATE`
- Check terminal logs (not browser console)
- Verify API route is accessible at `/api/token`

### Build errors
- Check TypeScript errors: `npm run lint`
- Make sure all imports are correct
- Verify all pages are in `app/` directory

