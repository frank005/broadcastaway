# BroadCastaway 🎥

A high-performance live broadcasting app built with Next.js, featuring AI shopping agents, media pull/push, and host-promotion system. 🎥

A high-performance live broadcasting app inspired by Whatnot, built with Agora's Real-Time Communication platform. This demo combines live video streaming, AI shopping agents, host-promotion system, and advanced media services into a single, powerful application.

## Features

### 🎬 Core Broadcasting
- **Host & Audience Roles**: Start live broadcasts as a host or join as an audience member
- **Screen Sharing**: Hosts can share their screen with the audience
- **Video & Audio Controls**: Toggle camera and microphone on/off
- **Real-time Presence**: See who's online using RTM presence

### 🤖 Conversational AI Agent
- **Live Shopping Assistant**: Toggle AI agent mode to get real-time product descriptions and tagging
- **Smart Product Recognition**: AI listens to host speech and extracts product metadata
- **Seamless Integration**: Works alongside regular broadcasting

### 👥 Host Promotion System
- **Request to Join Stage**: Audience members can request to be promoted to co-host
- **Host Approval**: Hosts see requests and can approve/deny them
- **Self-Demotion**: Promoted users can demote themselves back to audience
- **Real-time Signaling**: Uses RTM for instant promotion/demotion

### 📺 Advanced Media Services

#### Media Pull
- Pull external video streams (HLS/RTMP/MP4) into your channel
- **Full Controls**: Play, pause, volume adjustment, and seek position
- Perfect for showing product videos or external content

#### Media Push
- Push your live stream to external platforms
- Support for YouTube, Facebook, or any RTMP destination
- Raw or transcoded modes available

#### Media Gateway
- Connect OBS Studio or external encoders
- Get stream keys for professional broadcasting setups
- Bridge external tools with Agora RTC channels

### 💬 Real-time Communication
- **Group Chat**: RTM-based chat for all participants
- **Presence System**: See who's online in real-time
- **Name-based UIDs**: Users set their display name which serves as their identity

## Setup

### Prerequisites
- Node.js 18+
- Agora account with App ID and Certificate
- Agora REST API credentials (for Media Services and AI Agent)
- OpenAI API key (for Conversational AI Agent)

### Installation

1. **Clone and install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment variables:**
   Copy `env.example` to `.env.local` and fill in your credentials:
   ```bash
   cp env.example .env.local
   ```

   Required variables:
   ```env
   NEXT_PUBLIC_AGORA_APP_ID=your_agora_app_id
   AGORA_APP_CERTIFICATE=your_agora_certificate
   AGORA_CUSTOMER_ID=your_agora_customer_id
   AGORA_CUSTOMER_SECRET=your_agora_customer_secret
   OPENAI_API_KEY=your_openai_key
   ```

3. **Run development server:**
   ```bash
   npm run dev
   ```
   This starts Next.js development server at `http://localhost:3000`

4. **Build for production:**
   ```bash
   npm run build
   ```

## Deployment

### Netlify Deployment

1. **Connect your repository** to Netlify
2. **Set environment variables** in Netlify dashboard:
   - Go to Site settings → Environment variables
   - Add all variables from your `.env` file
3. **Deploy**: Netlify will automatically build and deploy

The `netlify.toml` file is already configured with:
- Build command: `npm run build`
- Publish directory: `.next`
- Next.js plugin: `@netlify/plugin-nextjs` (handles routing automatically)

## Architecture

### Frontend (Next.js App Router)
- **Pages**: `app/browse/`, `app/host/`, `app/watch/`, `app/broadcast/[channelName]/`
- **Components**: Reusable React components in `app/components/`
- **Services**: `src/services/agoraService.js` - Unified service for RTC/RTM operations

### Backend (Next.js API Routes)
- **`app/api/token/`**: Generates secure RTC/RTM tokens
- **`app/api/channels/`**: Fetches active Agora channels
- **`app/api/media-proxy/`**: Proxies Agora REST API calls (keeps credentials secure)
- **`app/api/agora-agents/`**: Manages Conversational AI Agent lifecycle

### Key Technologies
- **Agora RTC SDK**: Real-time video/audio communication
- **Agora RTM SDK 2.x**: Real-time messaging and presence
- **Agora Media Services**: Pull, Push, and Gateway
- **Agora Conversational AI**: Live shopping assistant
- **React + Tailwind CSS**: Modern, responsive UI

## Usage

### Starting a Broadcast (Host)

1. Enter your name and room name on the lobby page
2. Click "Start Hosting"
3. Allow camera/microphone permissions
4. Your broadcast is now live!

**Host Controls:**
- Toggle AI Agent on/off
- Share screen
- Promote audience members to co-host
- Use Media Pull to inject external videos
- Use Media Push to stream to YouTube/Facebook
- Use Media Gateway to connect OBS

### Joining as Audience

1. Enter your name and room name
2. Click "Join Room"
3. Watch the broadcast and interact via chat
4. Request to join stage if you want to co-host

**Audience Features:**
- Real-time chat
- Request promotion to stage
- View host video and screen shares
- Picture-in-picture support

## Media Services Guide

### Media Pull
1. Go to Media tab → Pull
2. Enter video URL (supports RTMP, HLS, MP4)
3. Click "Start Media Pull"
4. Use controls to play/pause, adjust volume, or seek

### Media Push
1. Go to Media tab → Push
2. Enter RTMP URL (from YouTube/Facebook/other)
3. Click "Start Push"
4. Your stream is now broadcasting to the external platform

### Media Gateway
1. Go to Media tab → Gateway
2. Click "Create Gateway Stream"
3. Copy the stream key and server URL
4. Use in OBS or other external encoder

## Troubleshooting

### Build Errors
- Ensure all dependencies are installed: `npm install`
- Check that environment variables are set correctly
- Verify Node.js version is 18+

### Connection Issues
- Verify Agora App ID and Certificate are correct
- Check network connectivity
- Ensure browser permissions for camera/microphone

### Media Services Not Working
- Verify REST API credentials are set
- Check that your Agora project has Media Services enabled
- Ensure proper permissions for Media Services API

## License

MIT

## Credits

Built with [Agora.io](https://www.agora.io/) Real-Time Communication Platform

