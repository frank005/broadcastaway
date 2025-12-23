// Use .js extension for better CommonJS compatibility
import { NextResponse } from 'next/server';
import { createRequire } from 'module';
import path from 'path';

// Ensure we're using Node.js runtime (not Edge) for CommonJS require
export const runtime = 'nodejs';

// Create require function for CommonJS modules in ES module context
const require = createRequire(import.meta.url);

// Load token builder utilities
// Use relative path that webpack can statically analyze
let RtcTokenBuilder, RtcRole;

try {
  // First load AccessToken2 and services (required by RtcTokenBuilder2)
  // This must be loaded before RtcTokenBuilder2
  const AccessToken2Module = require('../../../netlify/functions/utils/AccessToken2.js');
  
  // Now load RtcTokenBuilder2 (which will use AccessToken2 from the require above)
  // Use relative path from app/api/token/route.js to netlify/functions/utils/
  // From app/api/token/ we need to go up 3 levels to root: ../../../
  const tokenBuilder = require('../../../netlify/functions/utils/RtcTokenBuilder2.js');
  // The module exports { RtcTokenBuilder, RtcRole: Role }
  RtcTokenBuilder = tokenBuilder.RtcTokenBuilder;
  RtcRole = tokenBuilder.RtcRole;
  
  if (!RtcTokenBuilder || !RtcRole) {
    console.error('❌ [TOKEN API] Token builder exports not found');
    console.error('❌ [TOKEN API] Available exports:', Object.keys(tokenBuilder));
    throw new Error('Token builder exports not found');
  }
  
  console.log('✅ [TOKEN API] AccessToken2 and services loaded');
  console.log('✅ [TOKEN API] Token builder loaded successfully');
} catch (error) {
  console.error('❌ [TOKEN API] Failed to load token builder:', error);
  console.error('❌ [TOKEN API] Error message:', error.message);
  console.error('❌ [TOKEN API] Error code:', error.code);
  console.error('❌ [TOKEN API] Error stack:', error.stack);
  // Don't throw here - let the route handle it
}

export async function POST(request) {
  try {
    // Ensure token builder is loaded
    if (!RtcTokenBuilder || !RtcRole) {
      // Try to load it again using static relative path
      try {
        // Load AccessToken2 first (required dependency)
        require('../../../netlify/functions/utils/AccessToken2.js');
        // Then load RtcTokenBuilder2
        const tokenBuilder = require('../../../netlify/functions/utils/RtcTokenBuilder2.js');
        RtcTokenBuilder = tokenBuilder.RtcTokenBuilder;
        RtcRole = tokenBuilder.RtcRole;
      } catch (loadError) {
        console.error('❌ [TOKEN API] Failed to load token builder:', loadError);
        console.error('❌ [TOKEN API] Load error details:', {
          message: loadError.message,
          code: loadError.code,
          path: loadError.path
        });
        return NextResponse.json(
          { error: 'Token builder utilities not available: ' + loadError.message },
          { status: 500 }
        );
      }
    }

    const body = await request.json();
    const { channelName, uid, role, rtmUserId, tokenType } = body;
    
    // Backend-only credentials (NOT exposed to frontend)
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    console.log('🔐 [TOKEN API] ============================================');
    console.log('🔐 [TOKEN API] Request received');
    console.log('🔐 [TOKEN API] Full Request Body:', JSON.stringify(body, null, 2));
    console.log('🔐 [TOKEN API] Request params:', { 
      channelName, 
      uid, 
      role, 
      rtmUserId: rtmUserId ? 'provided' : 'not provided',
      tokenType: tokenType || 'rtc'
    });
    console.log('🔐 [TOKEN API] Environment check:');
    console.log('🔐 [TOKEN API] Process CWD:', process.cwd());
    console.log('🔐 [TOKEN API] NODE_ENV:', process.env.NODE_ENV);
    
    // Check if .env.local exists
    const fs = require('fs');
    const envLocalPath = require('path').join(process.cwd(), '.env.local');
    const envPath = require('path').join(process.cwd(), '.env');
    console.log('🔐 [TOKEN API] .env.local exists:', fs.existsSync(envLocalPath));
    console.log('🔐 [TOKEN API] .env exists:', fs.existsSync(envPath));
    
    console.log('🔐 [TOKEN API] NEXT_PUBLIC_AGORA_APP_ID:', appId ? `${appId.substring(0, 8)}... (length: ${appId.length})` : 'MISSING');
    console.log('🔐 [TOKEN API] AGORA_APP_CERTIFICATE:', appCertificate ? `${appCertificate.substring(0, 8)}... (length: ${appCertificate?.length})` : 'MISSING');
    console.log('🔐 [TOKEN API] Token builder loaded:', !!RtcTokenBuilder, !!RtcRole);
    
    // List all AGORA-related env vars (for debugging)
    const agoraEnvVars = Object.keys(process.env).filter(k => k.includes('AGORA'));
    console.log('🔐 [TOKEN API] All AGORA env vars found:', agoraEnvVars);

    if (!appId || !appCertificate) {
      console.error('❌ [TOKEN API] Missing credentials');
      console.error('❌ [TOKEN API] Required env vars: NEXT_PUBLIC_AGORA_APP_ID, AGORA_APP_CERTIFICATE');
      console.error('❌ [TOKEN API] All env vars:', Object.keys(process.env).filter(k => k.includes('AGORA')));
      return NextResponse.json(
        { error: 'AGORA_APP_ID or AGORA_APP_CERTIFICATE not set' },
        { status: 500 }
      );
    }

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    let token;

    // Generate RTM-only token for login
    if (tokenType === 'rtm') {
      if (!rtmUserId) {
        return NextResponse.json(
          { error: 'rtmUserId is required for RTM token' },
          { status: 400 }
        );
      }
      console.log('🔐 [TOKEN API] Generating RTM-only token...');
      console.log('🔐 [TOKEN API] RTM token params:', {
        appId: appId ? `${appId.substring(0, 8)}... (full: ${appId})` : 'MISSING',
        appIdLength: appId ? appId.length : 0,
        appCertificate: appCertificate ? `present (${appCertificate.length} chars)` : 'MISSING',
        rtmUserId: rtmUserId,
        rtmUserIdLength: rtmUserId ? rtmUserId.length : 0,
        channelName: 'rtm-login'
      });
      
      // Verify app ID and certificate are set
      if (!appId) {
        console.error('❌ [TOKEN API] App ID is missing!');
        return NextResponse.json(
          { error: 'App ID is required for RTM token' },
          { status: 500 }
        );
      }
      if (!appCertificate) {
        console.error('❌ [TOKEN API] App Certificate is missing!');
        return NextResponse.json(
          { error: 'App Certificate is required for RTM token' },
          { status: 500 }
        );
      }
      
      // Validate certificate length (should be 32 hex characters for Agora)
      if (appCertificate.length !== 32) {
        console.warn('⚠️ [TOKEN API] App Certificate length is unusual:', appCertificate.length, '(expected 32)');
        console.warn('⚠️ [TOKEN API] Certificate preview:', appCertificate.substring(0, 8) + '...');
      }
      
      // Validate app ID format (should be 32 hex characters)
      if (appId.length !== 32) {
        console.warn('⚠️ [TOKEN API] App ID length is unusual:', appId.length, '(expected 32)');
      }
      token = await RtcTokenBuilder.buildTokenWithRtm(
        appId,
        appCertificate,
        'rtm-login', // dummy channel for RTM login
        rtmUserId,
        RtcRole.SUBSCRIBER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
      console.log('✅ [TOKEN API] RTM token generated:', token ? `present (${token.length} chars)` : 'EMPTY');
      if (token) {
        console.log('✅ [TOKEN API] Token preview:', token.substring(0, 50) + '...');
      }
    }
    // Generate combined RTC+RTM token
    else if (tokenType === 'combined' && rtmUserId) {
      if (!channelName) {
        return NextResponse.json(
          { error: 'channelName is required for combined token' },
          { status: 400 }
        );
      }
      const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      console.log('🔐 [TOKEN API] Generating combined RTC+RTM token...');
      console.log('🔐 [TOKEN API] RTC params:', {
        channelName,
        uid: uid || 0,
        role: rtcRole === RtcRole.PUBLISHER ? 'PUBLISHER' : 'SUBSCRIBER'
      });
      console.log('🔐 [TOKEN API] RTM params:', { rtmUserId });
      
      token = await RtcTokenBuilder.buildTokenWithRtm2(
        appId,
        appCertificate,
        channelName,
        (uid || 0).toString(), // RTC account (string)
        rtcRole,
        privilegeExpiredTs,
        privilegeExpiredTs, // joinChannelPrivilegeExpire
        privilegeExpiredTs, // pubAudioPrivilegeExpire
        privilegeExpiredTs, // pubVideoPrivilegeExpire
        privilegeExpiredTs, // pubDataStreamPrivilegeExpire
        rtmUserId, // RTM user ID
        privilegeExpiredTs // RTM token expire
      );
      console.log('✅ [TOKEN API] Combined token generated:', token || 'EMPTY');
      if (token) {
        console.log('✅ [TOKEN API] Full combined token:', token);
      }
    }
    // Generate RTC-only token (default)
    else {
      if (!channelName) {
        return NextResponse.json(
          { error: 'channelName is required for RTC token' },
          { status: 400 }
        );
      }
      const rtcRole = role === 'host' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
      console.log('🔐 [TOKEN API] Generating RTC-only token...');
      console.log('🔐 [TOKEN API] Building token with params:', {
        appId: appId.substring(0, 8) + '...',
        channelName,
        uid: uid || 0,
        role: rtcRole === RtcRole.PUBLISHER ? 'PUBLISHER' : 'SUBSCRIBER',
        tokenExpire: privilegeExpiredTs,
        privilegeExpire: privilegeExpiredTs
      });

      token = await RtcTokenBuilder.buildTokenWithUid(
        appId,
        appCertificate,
        channelName,
        uid || 0,
        rtcRole,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
      console.log('✅ [TOKEN API] RTC token generated:', token || 'EMPTY');
      if (token) {
        console.log('✅ [TOKEN API] Full RTC token:', token);
      }
    }

    console.log('✅ [TOKEN API] Token length:', token ? token.length : 0);
    if (token) {
      console.log('✅ [TOKEN API] Full token (for verification):', token);
    }
    console.log('🔐 [TOKEN API] ============================================');

    return NextResponse.json({ token });
  } catch (error) {
    console.error('❌ [TOKEN API] ============================================');
    console.error('❌ [TOKEN API] Token generation error:', error);
    console.error('❌ [TOKEN API] Error details:', {
      message: error.message,
      stack: error.stack
    });
    console.error('❌ [TOKEN API] ============================================');
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

