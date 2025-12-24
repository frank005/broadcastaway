import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import Navigation from './components/Navigation'
import './globals.css'

export const metadata: Metadata = {
  title: 'BroadCastaway | Live Shopping & Broadcasting',
  description: 'High-performance live broadcasting app with AI shopping agents',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="alternate icon" href="/favicon.ico" />
        {/* Agora SDKs */}
        <script src="https://download.agora.io/sdk/release/AgoraRTC_N.js" async></script>
        <script src="https://cdn.jsdelivr.net/npm/agora-rtm-sdk@2.2.3/agora-rtm.js" async></script>
        <script src="https://agora-packages.s3.us-west-2.amazonaws.com/ext/vb-2-1-0/agora-extension-virtual-background.js" async></script>
        {/* Protobuf for STT - using files from STT demo (load in order, not async) */}
        <script src="https://cdnjs.cloudflare.com/ajax/libs/protobufjs/6.11.3/protobuf.min.js"></script>
        <script src="/proto/protobuf.min.js"></script>
        <script src="/proto/index.js"></script>
      </head>
      <body className="min-h-screen bg-agora-light">
        <Navigation />
        <main className="container mx-auto px-4 py-6">
          {children}
        </main>
        <Toaster position="top-right" />
      </body>
    </html>
  )
}

