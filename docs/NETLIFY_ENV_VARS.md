# Netlify Environment Variables Setup

This document lists all environment variables that need to be configured in your Netlify dashboard for the application to work correctly.

## How to Set Environment Variables in Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add each variable listed below with its corresponding value
4. **Important**: After adding/updating variables, you may need to trigger a new deployment

## Required Environment Variables

### Agora Configuration

```bash
# Frontend (safe to expose)
NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id_here

# Backend (never exposed to frontend)
AGORA_APP_CERTIFICATE=your_agora_certificate_here
AGORA_CUSTOMER_ID=your_agora_customer_id_here
AGORA_CUSTOMER_SECRET=your_agora_customer_secret_here

# Alternative naming (both work)
AGORA_REST_API_KEY=your_agora_customer_id_here
AGORA_REST_API_SECRET=your_agora_customer_secret_here

# Optional
AGORA_BASE_URL=https://api.agora.io
NEXT_PUBLIC_AGORA_REGION=na
```

### OpenAI Configuration (Required for AI Agent)

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_API_URL=https://api.openai.com/v1/chat/completions
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=500
OPENAI_TEMPERATURE=0.7
```

### AI Agent Configuration (Optional)

```bash
# System message for the AI agent
# For multi-line messages, use \n for newlines
AI_AGENT_SYSTEM_MESSAGE=You are a helpful live shopping assistant. Help the host sell products.

# Greeting message (leave empty for no greeting)
AI_AGENT_GREETING_MESSAGE=

# Failure message when AI can't process a request
AI_AGENT_FAILURE_MESSAGE=I'm having trouble processing that. Could you please rephrase?

# Maximum conversation history to keep
AI_AGENT_MAX_HISTORY=10
```

### Microsoft TTS Configuration (Optional)

```bash
MICROSOFT_TTS_API_KEY=your_microsoft_tts_key_here
MICROSOFT_TTS_REGION=eastus
MICROSOFT_TTS_VOICE=en-US-EvelynMultilingualNeural
MICROSOFT_TTS_SAMPLE_RATE=24000
MICROSOFT_TTS_SPEED=1.3
```

## Debugging Environment Variables

If environment variables aren't working on Netlify:

1. **Check the logs**: The API route logs all environment variables (masked for security) when the AI agent starts. Look for lines starting with `🔍 [AI AGENT API] Environment Variables Check:`

2. **Verify variable names**: Make sure the variable names in Netlify match exactly (case-sensitive) with the names listed above.

3. **Check for typos**: Common mistakes:
   - `NEXT_PUBLIC_AGORA_APP_ID` (not `REACT_APP_AGORA_APP_ID`)
   - `AGORA_APP_CERTIFICATE` (not `AGORA_CERTIFICATE`)
   - `AI_AGENT_SYSTEM_MESSAGE` (not `AI_SYSTEM_MESSAGE`)

4. **Redeploy**: After adding/updating environment variables, trigger a new deployment:
   - Go to **Deploys** tab
   - Click **Trigger deploy** → **Deploy site**

5. **Check build logs**: Environment variables are available during build time. Check the build logs to see if variables are being read correctly.

## Common Issues

### Variables not available at runtime
- **Issue**: Variables set in Netlify but not accessible in API routes
- **Solution**: Make sure variables are set in **Site settings** → **Environment variables**, not just in build settings

### Variables work locally but not on Netlify
- **Issue**: `.env.local` works locally but variables aren't set in Netlify
- **Solution**: All environment variables must be manually added to Netlify dashboard. `.env.local` files are not deployed to Netlify.

### Multi-line environment variables
- **Issue**: Multi-line values in `AI_AGENT_SYSTEM_MESSAGE` don't work
- **Solution**: Use `\n` for newlines within the value, or set the variable in Netlify's UI which supports multi-line values

## Testing Environment Variables

You can test if environment variables are set correctly by:

1. Calling the `/api/env-check` endpoint (if available)
2. Checking the logs when starting an AI agent - all variables are logged
3. Looking at the Netlify function logs in the dashboard

## Security Notes

- **Never commit** `.env.local` or `.env` files to git
- Variables prefixed with `NEXT_PUBLIC_` are exposed to the frontend
- Variables without `NEXT_PUBLIC_` are server-side only
- Keep sensitive keys (certificates, API keys) secure and never expose them

