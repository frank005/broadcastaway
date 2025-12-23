// Load token builder utilities
require('./utils/AccessToken2');
const { RtcTokenBuilder, RtcRole } = require('./utils/RtcTokenBuilder2');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  try {
    console.log('🔐 [TOKEN API] ============================================');
    console.log('🔐 [TOKEN API] Request received');
    console.log('🔐 [TOKEN API] Method:', event.httpMethod);
    console.log('🔐 [TOKEN API] Body:', event.body);
    
    const { channelName, uid, role, rtmUserId, tokenType } = JSON.parse(event.body || '{}');
    
    // Backend-only credentials (NOT exposed to frontend)
    // Netlify Functions automatically load .env file
    const appId = process.env.REACT_APP_AGORA_APP_ID;
    const appCertificate = process.env.AGORA_APP_CERTIFICATE;
    
    console.log('🔐 [TOKEN API] Environment check:');
    console.log('🔐 [TOKEN API] REACT_APP_AGORA_APP_ID:', appId ? `${appId.substring(0, 8)}... (length: ${appId.length})` : 'MISSING');
    console.log('🔐 [TOKEN API] AGORA_APP_CERTIFICATE:', appCertificate ? `${appCertificate.substring(0, 8)}... (length: ${appCertificate?.length})` : 'MISSING');

    console.log('🔐 [TOKEN API] Request params:', { 
      channelName, 
      uid, 
      role, 
      rtmUserId: rtmUserId ? 'provided' : 'not provided',
      tokenType: tokenType || 'rtc'
    });
    console.log('🔐 [TOKEN API] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');
    console.log('🔐 [TOKEN API] Certificate:', appCertificate ? `${appCertificate.substring(0, 8)}... (length: ${appCertificate.length})` : 'MISSING');

    if (!appId || !appCertificate) {
      console.error('❌ [TOKEN API] Missing credentials');
      console.error('❌ [TOKEN API] Required env vars: REACT_APP_AGORA_APP_ID, AGORA_APP_CERTIFICATE');
      throw new Error('AGORA_APP_ID or AGORA_APP_CERTIFICATE not set');
    }

    const expirationTimeInSeconds = 3600;
    const currentTimestamp = Math.floor(Date.now() / 1000);
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

    let token;

    // Generate RTM-only token for login
    if (tokenType === 'rtm') {
      if (!rtmUserId) {
        throw new Error('rtmUserId is required for RTM token');
      }
      console.log('🔐 [TOKEN API] Generating RTM-only token...');
      token = await RtcTokenBuilder.buildTokenWithRtm(
        appId,
        appCertificate,
        'rtm-login', // dummy channel for RTM login
        rtmUserId,
        RtcRole.SUBSCRIBER,
        privilegeExpiredTs,
        privilegeExpiredTs
      );
      console.log('✅ [TOKEN API] RTM token generated:', token ? `${token.substring(0, 20)}...` : 'EMPTY');
    }
    // Generate combined RTC+RTM token
    else if (tokenType === 'combined' && rtmUserId) {
      if (!channelName) {
        throw new Error('channelName is required for combined token');
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
      console.log('✅ [TOKEN API] Combined token generated:', token ? `${token.substring(0, 20)}...` : 'EMPTY');
    }
    // Generate RTC-only token (default)
    else {
      if (!channelName) {
        throw new Error('channelName is required for RTC token');
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
      console.log('✅ [TOKEN API] RTC token generated:', token ? `${token.substring(0, 20)}...` : 'EMPTY');
    }

    console.log('✅ [TOKEN API] Token length:', token ? token.length : 0);
    console.log('🔐 [TOKEN API] ============================================');

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token }),
    };
  } catch (error) {
    console.error('❌ [TOKEN API] ============================================');
    console.error('❌ [TOKEN API] Token generation error:', error);
    console.error('❌ [TOKEN API] Error details:', {
      message: error.message,
      stack: error.stack
    });
    console.error('❌ [TOKEN API] ============================================');
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

