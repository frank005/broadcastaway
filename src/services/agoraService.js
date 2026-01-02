import axios from 'axios';

// RTC and RTM SDKs are loaded via CDN and available globally
const waitForAgoraRTC = () => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50;
    let attempts = 0;
    const checkRTC = () => {
      attempts++;
      if (window.AgoraRTC) {
        resolve(window.AgoraRTC);
      } else if (attempts >= maxAttempts) {
        reject(new Error('AgoraRTC failed to load'));
      } else {
        setTimeout(checkRTC, 200);
      }
    };
    checkRTC();
  });
};

const waitForAgoraRTM = () => {
  return new Promise((resolve, reject) => {
    const maxAttempts = 50;
    let attempts = 0;
    const checkRTM = () => {
      attempts++;
      if (window.AgoraRTM) {
        resolve(window.AgoraRTM);
      } else if (attempts >= maxAttempts) {
        reject(new Error('AgoraRTM failed to load'));
      } else {
        setTimeout(checkRTM, 200);
      }
    };
    checkRTM();
  });
};

class AgoraService {
  constructor() {
    this.rtcClient = null;
    this.rtmClient = null;
    this.rtmChannel = null;
    this.localAudioTrack = null;
    this.localVideoTrack = null;
    this.localScreenTrack = null;
    this.screenShareClient = null;
    this.remoteUsers = new Map(); // RTC users by numeric UID
    this.userIdMap = new Map(); // Map RTC numeric UID -> RTM string user ID (unique)
    this.displayNameMap = new Map(); // Map RTC numeric UID -> display name (for UI)
    this.rtmUserIdToDisplayNameMap = new Map(); // Map RTM user ID -> display name (for participants list)
    this.isJoining = false;
    this.isJoined = false;
    this.rtmLoggedIn = false;
    this.rtmLoggingIn = false; // Prevent duplicate RTM login attempts
    this.appId = null;
    this.channelName = null;
    this.currentChannelName = null; // Store channel name for endStream (critical for kicking users)
    this.isJoining = false; // Prevent duplicate joins
    this.isJoined = false; // Track join state
    this.rtmLoggedIn = false; // Track RTM login state
    this.isBroadcasting = false; // Track if host has started broadcasting
    this.currentUser = {
      userId: null, // Original display name (for UI)
      rtmUserId: null, // Unique RTM user ID (for RTM login, prevents conflicts)
      role: 'audience', // 'host', 'audience', 'promoted'
    };
    this.onPresenceUpdate = null;
    this.onUserJoined = null; // Callback for when a user joins (for system messages)
    this.onUserLeft = null; // Callback for when a user leaves (for system messages)
    this.onMessageReceived = null;
    this.onPromotionRequest = null;
    this.onPromoted = null;
    this.onDemoted = null;
    this.onTrackPublished = null;
    this.onTrackUnpublished = null;
    this.onScreenShareStarted = null;
    this.onScreenShareStopped = null;
    this.mediaPullPlayerId = null;
    this.mediaPullUpdateSequence = 0;
    this.participants = new Set(); // Track RTM participants (string user IDs)
    this.subscribedMetadataUsers = new Set(); // Track which users we've subscribed to metadata for
    this.onParticipantsUpdate = null; // Callback for participants list updates
    this.obsWebSocket = null; // OBS WebSocket connection
    this.obsPendingRequests = new Map(); // Pending OBS requests
    this.obsPreviewInterval = null; // OBS preview update interval
    this.obsPIPInterval = null; // OBS PIP preview update interval
    this.onOBSPreviewUpdate = null; // Callback for OBS preview updates
    this.onOBSPIPUpdate = null; // Callback for OBS PIP updates
    this.onHostLeft = null; // Callback when host leaves
    this.activeMediaPushConverters = new Map(); // Track active Media Push converters: converterId -> { rtmpUrl, pushId }
    this.onMediaPushLayoutUpdate = null; // Callback to notify when layout needs updating
    this.onOBSConnected = null; // Callback when OBS is identified (op: 2)
    this.onOBSConnectionOpened = null; // Callback when ConnectionOpened event received
    this.onOBSConnectionClosed = null; // Callback when connection closes
    this.onOBSStreamStateChanged = null; // Callback when stream state changes
    this.onKicked = null; // Callback when user is kicked/banned from channel
    this.videoQuality = '720p'; // Video quality setting: '480p', '720p', '1080p'
    this.audioQuality = '48kHz'; // Audio quality setting: '16kHz', '24kHz', '48kHz'
    // STT (Speech-to-Text) state
    this.sttAgentId = null; // Current STT agent ID
    this.sttConfig = null; // Current STT configuration
    this.onTranscriptionReceived = null; // Callback: (uid, text, language) => void
    this.onTranslationReceived = null; // Callback: (uid, text, sourceLang, targetLang) => void
    this.sttSubscribedLanguages = new Map(); // uid -> { transcription: string[], translation: Map<sourceLang, targetLang[]> }
  }

  // Hash username to numeric UID for RTC (RTM can use string, RTC needs number)
  hashUserIdToNumber(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    // Ensure positive number and within safe range
    return Math.abs(hash) || Math.floor(Math.random() * 1000000) + 1;
  }

  async init(appId, userId) {
    console.log('🔧 [INIT] Initializing Agora Service...');
    // Support both React and Next.js env vars
    const finalAppId = appId || process.env.NEXT_PUBLIC_AGORA_APP_ID || process.env.REACT_APP_AGORA_APP_ID;
    console.log('🔧 [INIT] App ID (finalAppId):', finalAppId);
    console.log('🔧 [INIT] App ID (from param):', appId);
    console.log('🔧 [INIT] App ID match:', finalAppId === appId ? '✅ MATCH' : '⚠️ DIFFERENT');
    console.log('🔧 [INIT] Original User ID:', userId);
    
    // Generate unique RTM user ID to prevent conflicts when multiple users have the same name
    // Format: originalName_uniqueSuffix (e.g., "John_abc123xyz" or "John_1703347200000")
    // RTM user IDs must be 1-64 characters, alphanumeric, underscore, or hyphen only
    // This ensures RTM login doesn't kick out the first user
    // IMPORTANT: Only generate a new unique ID if the userId (display name) changed
    // If userId is the same, reuse the existing rtmUserId to avoid creating new clients
    let uniqueRtmUserId;
    const cleanUserId = userId ? userId.replace(/[^a-zA-Z0-9_-]/g, '_') : 'user';
    
    // Check if userId changed - if same, reuse existing rtmUserId
    // Normalize empty strings and null/undefined to handle cases where userName might not be set yet
    const normalizedUserId = userId || '';
    const normalizedExistingUserId = this.currentUser.userId || '';
    
    // If we already have an RTM user ID and it's logged in, and userId is changing from empty to a value,
    // reuse the existing RTM user ID. This handles the case where init() is called with empty userName first,
    // then called again with the actual userName.
    const isUpgradingFromEmpty = !normalizedExistingUserId && normalizedUserId && this.currentUser.rtmUserId && this.rtmLoggedIn;
    const isSameUser = normalizedExistingUserId === normalizedUserId && this.currentUser.rtmUserId;
    
    if (isSameUser || isUpgradingFromEmpty) {
      // Same user (or both empty), or upgrading from empty to actual name - reuse existing RTM user ID
      uniqueRtmUserId = this.currentUser.rtmUserId;
      console.log('🔧 [INIT] Reusing existing RTM User ID:', uniqueRtmUserId);
      if (isUpgradingFromEmpty) {
        console.log('🔧 [INIT] Upgrading from empty userName to:', normalizedUserId);
      } else {
        console.log('🔧 [INIT] Same user, reusing ID');
      }
    } else {
      // New user or userId changed, generate new unique ID
      const randomPart = Math.random().toString(36).substring(2, 8); // 6 chars
      const timestampPart = Date.now().toString(36); // timestamp in base36
      const uniqueSuffix = `${randomPart}_${timestampPart}`;
      
      // Ensure total length is within RTM limit (64 chars)
      const maxLength = 64;
      if (cleanUserId.length + uniqueSuffix.length + 1 > maxLength) {
        // Truncate the original userId part if needed, keeping the suffix
        const maxUserIdLength = maxLength - uniqueSuffix.length - 1; // -1 for underscore
        const truncatedUserId = cleanUserId.substring(0, Math.max(1, maxUserIdLength));
        uniqueRtmUserId = `${truncatedUserId}_${uniqueSuffix}`;
      } else {
        uniqueRtmUserId = `${cleanUserId}_${uniqueSuffix}`;
      }
      console.log('🔧 [INIT] Generated new RTM User ID:', uniqueRtmUserId);
    }
    
    console.log('🔧 [INIT] Unique RTM User ID:', uniqueRtmUserId);
    console.log('🔧 [INIT] Display Name (original):', userId);
    
    this.appId = finalAppId;
    this.currentUser.userId = userId; // Store original for display
    this.currentUser.rtmUserId = uniqueRtmUserId; // Store unique ID for RTM

    console.log('⏳ [INIT] Waiting for Agora SDKs to load...');
    const [AgoraRTC, AgoraRTM] = await Promise.all([
      waitForAgoraRTC(),
      waitForAgoraRTM()
    ]);

    console.log('✅ [INIT] AgoraRTC loaded:', typeof AgoraRTC);
    console.log('✅ [INIT] AgoraRTM loaded:', typeof AgoraRTM);

    this.AgoraRTC = AgoraRTC;
    this.AgoraRTM = AgoraRTM;

    AgoraRTC.setParameter("EXPERIMENTS", {"netqSensitivityMode": 1});
    console.log('🎥 [RTC] Creating RTC client (mode: live, codec: vp9)...');
    this.rtcClient = AgoraRTC.createClient({ mode: 'live', codec: 'vp9' });
    console.log('✅ [RTC] RTC client created');
    
    // RTM 2.x Initialization
    // Use unique RTM user ID to prevent conflicts
    // Only create a new RTM client if:
    // 1. No client exists, OR
    // 2. The user ID changed (we'll handle logout above)
    const needsNewClient = !this.rtmClient || (this.currentUser.rtmUserId && this.currentUser.rtmUserId !== uniqueRtmUserId);
    
    if (needsNewClient) {
      console.log('📡 [RTM] Creating RTM client...');
      console.log('📡 [RTM] Using unique RTM User ID:', uniqueRtmUserId);
      console.log('📡 [RTM] Using App ID:', finalAppId);
      // Use finalAppId (from env if needed) to ensure consistency
      this.rtmClient = new AgoraRTM.RTM(finalAppId, uniqueRtmUserId, {
        logUpload: false,
        logLevel: 'INFO',
        presenceTimeout: 30 // Set presence timeout to 30 seconds (default is 5 minutes)
      });
      console.log('✅ [RTM] RTM client created with unique user ID');
    } else {
      console.log('📡 [RTM] RTM client already exists with same user ID, reusing it');
      console.log('📡 [RTM] Existing RTM User ID:', this.currentUser.rtmUserId);
    }

    this.setupRTCEvents();
    this.setupRTMEvents();

    // RTM login - must complete before join() can be called
    // Prevent duplicate login attempts (React Strict Mode causes double-rendering)
    if (this.rtmLoggingIn) {
      console.warn('⚠️ [RTM] Already logging in, waiting for completion...');
      // Wait for the existing login to complete instead of returning
      while (this.rtmLoggingIn) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      console.log('✅ [RTM] Previous login attempt completed, rtmLoggedIn:', this.rtmLoggedIn);
      return; // Return after waiting, don't try to login again
    }
    
    // If already logged in, check if user ID changed
    // If it did, we need to logout and re-login with the new user ID
    if (this.rtmLoggedIn && this.rtmClient) {
      const oldRtmUserId = this.currentUser.rtmUserId;
      if (oldRtmUserId && oldRtmUserId !== uniqueRtmUserId) {
        console.warn('⚠️ [RTM] User ID changed, logging out old session...');
        console.warn('⚠️ [RTM] Old RTM User ID:', oldRtmUserId);
        console.warn('⚠️ [RTM] New RTM User ID:', uniqueRtmUserId);
        try {
          await this.rtmClient.logout();
          console.log('✅ [RTM] Old session logged out');
        } catch (err) {
          console.warn('⚠️ [RTM] Error logging out old session:', err);
        }
        this.rtmLoggedIn = false;
        // Continue to login with new user ID below
      } else {
        console.warn('⚠️ [RTM] Already logged in with same user ID, skipping duplicate call');
        return;
      }
    }
    
    this.rtmLoggingIn = true;
    try {
      console.log('📡 [RTM] ============================================');
      console.log('📡 [RTM] Starting RTM login process...');
      console.log('📡 [RTM] Display Name (original):', userId);
      console.log('📡 [RTM] RTM User ID (unique):', uniqueRtmUserId);
      console.log('📡 [RTM] RTM User ID length:', uniqueRtmUserId.length);
      console.log('📡 [RTM] App ID (final):', finalAppId);
      console.log('📡 [RTM] RTM client state before login:', this.rtmClient?.connectionState);
      
      console.log('📡 [RTM] Requesting RTM token from backend...');
      console.log('📡 [RTM] Token request params:', {
        rtmUserId: uniqueRtmUserId,
        rtmUserIdLength: uniqueRtmUserId.length,
        tokenType: 'rtm'
      });
      // Request RTM token from backend using unique RTM user ID
      // This prevents conflicts when multiple users have the same display name
      const rtmToken = await this.fetchTokenFromBackend(null, null, null, uniqueRtmUserId, 'rtm');
      console.log('📡 [RTM] Token received:', rtmToken ? `present (length: ${rtmToken.length})` : 'EMPTY');
      // Full token is logged in terminal (backend), not browser console
      
      if (!rtmToken) {
        throw new Error('RTM token is empty or null');
      }
      
      if (rtmToken.length < 50) {
        console.warn('⚠️ [RTM] Token seems too short, might be invalid');
      }
      
      console.log('📡 [RTM] Logging in to RTM with token...');
      console.log('📡 [RTM] RTM client:', this.rtmClient ? 'exists' : 'MISSING');
      console.log('📡 [RTM] RTM client connectionState:', this.rtmClient?.connectionState);
      console.log('📡 [RTM] Expected App ID (finalAppId):', finalAppId);
      console.log('📡 [RTM] Expected RTM user ID (from token):', uniqueRtmUserId);
      console.log('📡 [RTM] Current user rtmUserId stored:', this.currentUser.rtmUserId);
      console.log('📡 [RTM] User ID match check:', uniqueRtmUserId === this.currentUser.rtmUserId ? '✅ MATCH' : '❌ MISMATCH');
      console.log('📡 [RTM] Token length:', rtmToken.length);
      console.log('📡 [RTM] Token preview (first 100 chars):', rtmToken.substring(0, 100));
      
      // Verify the RTM client was created with the same user ID we're using for the token
      // This can happen if init() is called multiple times with different user IDs (e.g., empty string then actual name)
      if (this.currentUser.rtmUserId !== uniqueRtmUserId) {
        console.warn('⚠️ [RTM] RTM user ID mismatch detected');
        console.warn('⚠️ [RTM] Client was created with:', this.currentUser.rtmUserId);
        console.warn('⚠️ [RTM] Token was generated for:', uniqueRtmUserId);
        console.warn('⚠️ [RTM] This can happen if init() was called with empty userName first, then with actual name');
        console.warn('⚠️ [RTM] Updating stored rtmUserId to match token and recreating RTM client...');
        
        // Update the stored ID to match what we're using for the token
        this.currentUser.rtmUserId = uniqueRtmUserId;
        
        // Recreate the RTM client with the correct user ID
        if (this.rtmClient) {
          try {
            // Try to logout the old client if it's logged in
            if (this.rtmLoggedIn) {
              await this.rtmClient.logout();
              this.rtmLoggedIn = false;
            }
          } catch (err) {
            console.warn('⚠️ [RTM] Error logging out old client:', err);
          }
        }
        
        // Create new RTM client with correct user ID
        this.rtmClient = new AgoraRTM.RTM(finalAppId, uniqueRtmUserId, {
          logUpload: false,
          logLevel: 'INFO',
          presenceTimeout: 30 // Set presence timeout to 30 seconds (default is 5 minutes)
        });
        console.log('✅ [RTM] Recreated RTM client with correct user ID:', uniqueRtmUserId);
      }
      
      try {
        console.log('📡 [RTM] Attempting login with token...');
        await this.rtmClient.login({ token: rtmToken });
        console.log('✅ [RTM] Login successful');
        console.log('📡 [RTM] RTM client state after login:', this.rtmClient.connectionState);
        this.rtmLoggedIn = true;
        console.log('✅ [RTM] rtmLoggedIn flag set to:', this.rtmLoggedIn);
        console.log('✅ [RTM] ============================================');
      } catch (loginErr) {
        console.error('❌ [RTM] RTM login() call failed:', loginErr);
        console.error('❌ [RTM] Login error details:', {
          message: loginErr.message,
          code: loginErr.code,
          name: loginErr.name,
          stack: loginErr.stack
        });
        throw loginErr; // Re-throw to be caught by outer catch
      }
    } catch (err) {
      console.error('❌ [RTM] ============================================');
      console.error('❌ [RTM] RTM login process failed:', err);
      console.error('❌ [RTM] Error details:', {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack
      });
      this.rtmLoggedIn = false;
      console.error('❌ [RTM] rtmLoggedIn flag set to:', this.rtmLoggedIn);
      console.error('❌ [RTM] ============================================');
      
      // Don't try tokenless login - if token fails, RTM won't work
      // But don't throw - RTC can still work without RTM
      console.warn('⚠️ [RTM] RTM login failed, continuing without RTM (RTC will still work)');
      console.warn('⚠️ [RTM] Chat functionality will NOT be available');
    } finally {
      this.rtmLoggingIn = false;
      console.log('📡 [RTM] rtmLoggingIn flag reset to false');
    }
    
    console.log('✅ [INIT] Agora Service initialized');
  }

  setupRTCEvents() {
    this.rtcClient.on('user-published', async (user, mediaType) => {
      console.log('👤 [RTC] User published event:', {
        uid: user.uid,
        mediaType,
        hasVideo: !!user.hasVideo,
        hasAudio: !!user.hasAudio
      });
      
      // Don't subscribe to Media Gateway user (UID 888) when host is streaming OBS
      // The host has preview capability, so they don't need to subscribe
      if (user.uid === 888 && this.currentUser.role === 'host' && this.obsWebSocket && this.obsWebSocket.readyState === WebSocket.OPEN) {
        console.log('⏭️ [RTC] Skipping subscription to Media Gateway user (888) - host has OBS preview');
        // Still map the UID to host's name for display purposes
        if (this.currentUser.userId) {
          this.userIdMap.set(888, this.currentUser.userId);
        }
        return;
      }
      
      try {
        await this.rtcClient.subscribe(user, mediaType);
        console.log('✅ [RTC] Subscribed to user:', {
          uid: user.uid,
          mediaType,
          hasVideo: !!user.videoTrack,
          hasAudio: !!user.audioTrack,
          videoTrackId: user.videoTrack?.getTrackId?.()
        });
        
        // Store user with RTM user ID if available
        // Try to find RTM user ID for this RTC UID
        let rtmUserId = this.userIdMap.get(user.uid) || user.rtmUserId;
        
        // If we don't have the mapping yet, try to get it from RTM metadata
        if (!rtmUserId || rtmUserId === `User-${user.uid}`) {
          if (this.rtmClient && this.rtmLoggedIn && this.channelName) {
            try {
              // Get all participants and check their metadata
              const participants = Array.from(this.participants);
              for (const participantId of participants) {
                try {
                  const metadata = await this.rtmClient.storage.getUserMetadata({ userId: participantId });
                  if (metadata?.metadata?.rtcUid?.value) {
                    const rtcUid = parseInt(metadata.metadata.rtcUid.value);
                    if (rtcUid === user.uid) {
                      rtmUserId = participantId;
                      this.userIdMap.set(user.uid, rtmUserId);
                      console.log('✅ [RTC] Found RTM user ID from metadata:', user.uid, '->', rtmUserId);
                      break;
                    }
                  }
                } catch (err) {
                  // Continue checking other participants
                }
              }
            } catch (err) {
              console.warn('⚠️ [RTC] Failed to fetch metadata for user:', user.uid, err);
            }
          }
        }
        
        // Fallback to User-UID if we still don't have it
        if (!rtmUserId || rtmUserId === `User-${user.uid}`) {
          // If this is Media Gateway user (UID 888), use host's name
          if (user.uid === 888 && this.currentUser.userId) {
            rtmUserId = this.currentUser.userId;
            console.log('✅ [RTC] Media Gateway user mapped to host name:', rtmUserId);
          } else {
            rtmUserId = `User-${user.uid}`;
          }
        }
        
        user.rtmUserId = rtmUserId; // Add unique RTM user ID to user object
        // Ensure the mapping is set
        if (!this.userIdMap.has(user.uid) && rtmUserId && rtmUserId !== `User-${user.uid}`) {
          this.userIdMap.set(user.uid, rtmUserId);
          console.log('✅ [RTC] Mapped RTC UID', user.uid, 'to RTM user ID', rtmUserId);
        }
        
        // Get display name from displayNameMap if available
        if (this.displayNameMap.has(user.uid)) {
          user.displayName = this.displayNameMap.get(user.uid);
        } else if (rtmUserId && this.rtmClient && this.rtmLoggedIn) {
          // Try to get display name from metadata
          try {
            const metadata = await this.rtmClient.storage.getUserMetadata({ userId: rtmUserId });
            // Prefer displayName, fallback to username, then rtmUserId
            const displayName = metadata?.metadata?.displayName?.value || 
                              metadata?.metadata?.username?.value;
            if (displayName) {
              user.displayName = displayName;
              this.displayNameMap.set(user.uid, user.displayName);
            } else {
              user.displayName = rtmUserId; // Fallback to RTM user ID
            }
          } catch (err) {
            user.displayName = rtmUserId; // Fallback to RTM user ID
          }
        } else {
          user.displayName = rtmUserId || `User-${user.uid}`; // Fallback
        }
        
        if (mediaType === 'video') {
          this.remoteUsers.set(user.uid, user);
          console.log('📹 [RTC] Video track available for user:', user.uid, 'Track:', user.videoTrack ? 'present' : 'missing');
          if (this.onTrackPublished) this.onTrackPublished(user, 'video');
          
          // Update Media Push layouts when new user joins
          this.updateAllMediaPushLayouts();
        }
        if (mediaType === 'audio') {
          if (user.audioTrack) {
            try {
              const playPromise = user.audioTrack.play();
              // play() may return a promise or undefined
              if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(err => {
                  console.error('❌ [RTC] Failed to play audio track:', err);
                });
              }
            } catch (err) {
              console.error('❌ [RTC] Error calling play() on audio track:', err);
            }
          }
          if (this.onTrackPublished) this.onTrackPublished(user, 'audio');
        }
      } catch (err) {
        console.error('❌ [RTC] Failed to subscribe to user:', err);
        // Don't throw - subscription errors can happen for various reasons (Media Gateway, network issues, etc.)
        // These are often non-fatal and the user can still continue
      }
    });

    this.rtcClient.on('user-unpublished', (user, mediaType) => {
      console.log('👤 [RTC] Unpublished user:', {
        uid: user.uid,
        mediaType,
        rtmUserId: user.rtmUserId
      });
      if (mediaType === 'video') {
        this.remoteUsers.delete(user.uid);
        
        // Update Media Push layouts when user leaves
        this.updateAllMediaPushLayouts();
      }
      if (this.onTrackUnpublished) this.onTrackUnpublished(user, mediaType);
    });
    
    // Track when users join/leave to map RTC UIDs to RTM user IDs
    this.rtcClient.on('user-joined', (user) => {
      console.log('👤 [RTC] User joined:', {
        uid: user.uid,
        hasVideo: !!user.hasVideo,
        hasAudio: !!user.hasAudio
      });
    });
    
    this.rtcClient.on('user-left', (user) => {
      console.log('👤 [RTC] User left:', user.uid);
      this.remoteUsers.delete(user.uid);
      this.userIdMap.delete(user.uid);
    });

    // Listen for connection state changes (detect when kicked/banned)
    this.rtcClient.on('connection-state-change', (curState, revState, reason) => {
      console.log('🔌 [RTC] Connection state changed:', {
        current: curState,
        previous: revState,
        reason: reason
      });
      
      // Primary check: If disconnected, notify listeners (this is the main case)
      if (curState === 'DISCONNECTED') {
        console.log('🚫 [RTC] User disconnected from channel');
        
        // Check for UID-BANNED in reason string (worst case scenario)
        const reasonStr = String(reason || '');
        if (reasonStr.includes('UID-BANNED') || reasonStr.includes('BANNED')) {
          console.log('🚫 [RTC] User is banned (UID-BANNED detected in reason)');
          if (this.onKicked) {
            this.onKicked('You have been banned from this channel');
          }
          return;
        }
        
        // If disconnected due to being kicked/banned, notify listeners
        if (reason === 'KICKED_BY_SERVER' || reason === 'BANNED_BY_SERVER' || reason === 'SERVER_ERROR') {
          console.log('🚫 [RTC] User was kicked/banned from channel');
          if (this.onKicked) {
            this.onKicked('You have been removed from the channel');
          }
        } else {
          // Even if reason is not explicitly kick/ban, if disconnected, treat as kicked
          // (worst case: UID-BANNED might not be in reason but user is still banned)
          console.log('🚫 [RTC] User disconnected - treating as kicked/banned');
          if (this.onKicked) {
            this.onKicked('You have been removed from the channel');
          }
        }
      }
    });

    // Listen for stream messages (STT transcription/translation)
    this.rtcClient.on('stream-message', async (uid, data) => {
      try {
        // Check if protobuf is available - use $protobufRoot from STT demo
        // Wait a bit if protobuf isn't loaded yet (scripts might still be loading)
        if (!window.protobuf) {
          console.warn('⚠️ [STT] Protobuf library not loaded, cannot decode STT messages');
          return;
        }
        
        if (!window.$protobufRoot && !window.protobufRoot) {
          console.warn('⚠️ [STT] Protobuf root not loaded, cannot decode STT messages');
          console.warn('⚠️ [STT] Available:', { 
            hasProtobuf: !!window.protobuf, 
            hasDollarRoot: !!window.$protobufRoot, 
            hasRoot: !!window.protobufRoot 
          });
          return;
        }

        // Use $protobufRoot from STT demo (compatibility with both)
        const protobufRoot = window.$protobufRoot || window.protobufRoot;
        if (!protobufRoot) {
          console.warn('⚠️ [STT] Protobuf root is null');
          return;
        }
        
        const Text = protobufRoot.lookup('agora.audio2text.Text');
        if (!Text) {
          console.warn('⚠️ [STT] Protobuf Text type not found');
          console.warn('⚠️ [STT] Available types:', protobufRoot ? Object.keys(protobufRoot.nested || {}) : 'no root');
          return;
        }

        const msg = Text.decode(data);
        // IMPORTANT: The 'uid' parameter is the STT bot's UID (sender), but msg.uid is the actual user's UID
        const actualUserUid = msg.uid || uid;
        console.log('🎤 [STT] Stream message received from bot UID:', uid, 'Actual user UID:', actualUserUid, 'Type:', msg.data_type);

        if (msg.data_type === 'transcribe' && msg.words && msg.words.length) {
          const text = msg.words.map(word => word.text || '').join('');
          
          // Get the language from user's subscription (use actualUserUid, not bot UID)
          const userSubs = this.sttSubscribedLanguages.get(actualUserUid);
          let language = null;
          
          if (userSubs && userSubs.transcription.length > 0) {
            // Use the subscribed transcription language
            language = userSubs.transcription[0];
          } else {
            // If no subscription, try to infer from available subscriptions
            const allSubs = Array.from(this.sttSubscribedLanguages.values());
            if (allSubs.length > 0 && allSubs[0].transcription.length > 0) {
              language = allSubs[0].transcription[0];
            }
          }
          
          // If still no language, try to get from any active STT configuration
          // This handles the case where transcriptions are coming but subscription isn't set up yet
          if (!language) {
            // Check if we have any subscriptions at all (for any user)
            const allSubs = Array.from(this.sttSubscribedLanguages.values());
            if (allSubs.length > 0) {
              for (const sub of allSubs) {
                if (sub.transcription.length > 0) {
                  language = sub.transcription[0];
                  console.log('⚠️ [STT] No subscription for UID:', actualUserUid, 'Using inferred language:', language);
                  break;
                }
              }
            }
          }
          
          // If still no language, send with 'unknown' and let the UI handle it
          // This allows the UI to auto-detect and set up the language
          if (!language) {
            language = 'unknown';
            console.log('⚠️ [STT] No language subscription found for UID:', actualUserUid, 'Sending with unknown language for auto-detection');
          }
          
          console.log('🎤 [STT] Transcription:', text, 'Language:', language, 'User UID:', actualUserUid, 'Has subscription:', !!userSubs);
          
          // Always send transcription if user has a subscription (or no subscription means show all)
          // Also send if language matches or if no subscription exists (show all)
          if (!userSubs || userSubs.transcription.length === 0 || userSubs.transcription.includes(language)) {
            if (this.onTranscriptionReceived) {
              console.log('🎤 [STT] Calling onTranscriptionReceived for User UID:', actualUserUid);
              this.onTranscriptionReceived(actualUserUid, text, language);
            } else {
              console.warn('⚠️ [STT] onTranscriptionReceived callback not set');
            }
          } else {
            console.log('⚠️ [STT] Transcription filtered - User UID:', actualUserUid, 'Language:', language, 'Subscribed languages:', userSubs.transcription);
          }
        } else if (msg.data_type === 'translate' && msg.trans && msg.trans.length) {
          // Only send translations that match the user's subscription
          const userSubs = this.sttSubscribedLanguages.get(actualUserUid);
          const sourceLang = userSubs && userSubs.transcription.length > 0 
            ? userSubs.transcription[0] 
            : 'unknown';
          
          // Get subscribed translation languages for this user
          const subscribedTargetLangs = userSubs && userSubs.translation 
            ? Array.from(userSubs.translation.values()).flat()
            : [];
          
          // Only send translations that match the user's subscription
          for (const trans of msg.trans) {
            const targetLang = trans.lang;
            
            // Only send if user is subscribed to this target language
            if (subscribedTargetLangs.length === 0 || subscribedTargetLangs.includes(targetLang)) {
              const text = trans.texts.join(''); // Join all texts to get complete translation
              console.log('🌐 [STT] Translation:', text, 'Source:', sourceLang, 'Target:', targetLang, 'User UID:', actualUserUid);
              
              if (this.onTranslationReceived) {
                this.onTranslationReceived(actualUserUid, text, sourceLang, targetLang);
              }
            } else {
              console.log('🌐 [STT] Translation filtered - not subscribed to:', targetLang, 'Subscribed to:', subscribedTargetLangs);
            }
          }
        }
      } catch (error) {
        console.error('❌ [STT] Error handling stream message:', error);
      }
    });
  }

  setupRTMEvents() {
    this.rtmClient.addEventListener('message', (event) => {
      console.log('📨 [RTM] Message received:', {
        message: event.message,
        publisher: event.publisher,
        channel: event.channel
      });
      try {
        const data = JSON.parse(event.message);
        console.log('📨 [RTM] Parsed message data:', data);
        this.handleRTMMessage(data, event.publisher);
      } catch (e) {
        console.log('📨 [RTM] Non-JSON message, treating as plain text');
        if (this.onMessageReceived) this.onMessageReceived(event.message, event.publisher);
      }
    });

    this.rtmClient.addEventListener('presence', async (event) => {
      console.log('👥 [RTM] Presence event:', {
        eventType: event.eventType,
        publisher: event.publisher,
        channelName: event.channelName,
        snapshot: event.snapshot ? `${event.snapshot.length} users` : 'none'
      });
      
      // Handle presence events like rtc-signaling demo
      const { eventType, publisher, channelName, snapshot } = event;
      
      // Handle snapshot event (initial list of users in channel)
      if (eventType === 'SNAPSHOT' && snapshot && channelName === this.channelName) {
        console.log('👥 [RTM] Snapshot received:', snapshot.length, 'users in channel');
        this.participants.clear(); // Clear first to prevent duplicates
        for (const user of snapshot) {
          const userIdString = String(user.userId);
          // Compare with unique RTM user ID, not display name
          if (userIdString && userIdString !== this.currentUser.rtmUserId) {
            // Only add if not already in the set (Set prevents duplicates, but be explicit)
            if (!this.participants.has(userIdString)) {
              this.participants.add(userIdString);
            }
            // Subscribe to user metadata for each participant
            try {
              await this.rtmClient.storage.subscribeUserMetadata(userIdString);
              this.subscribedMetadataUsers.add(userIdString); // Track successful subscription
              const metadata = await this.rtmClient.storage.getUserMetadata({ userId: userIdString });
              console.log('👥 [RTM] Got metadata for user:', userIdString, metadata);
              
              // Map RTC UID if available in metadata
              if (metadata?.metadata?.rtcUid?.value) {
                const rtcUid = parseInt(metadata.metadata.rtcUid.value);
                this.userIdMap.set(rtcUid, userIdString); // Store unique RTM user ID
                // Get display name from metadata (prefer displayName, fallback to username, then userIdString)
                const displayName = metadata?.metadata?.displayName?.value || 
                                  metadata?.metadata?.username?.value || 
                                  userIdString;
                this.displayNameMap.set(rtcUid, displayName);
                // Also map RTM user ID to display name for participants list
                this.rtmUserIdToDisplayNameMap.set(userIdString, displayName);
                console.log('✅ [RTM] Mapped RTC UID', rtcUid, 'to RTM user ID', userIdString, 'display name:', displayName);
              } else {
                // Even without RTC UID, store display name if available
                const displayName = metadata?.metadata?.displayName?.value || 
                                  metadata?.metadata?.username?.value;
                if (displayName) {
                  this.rtmUserIdToDisplayNameMap.set(userIdString, displayName);
                }
              }
            } catch (err) {
              console.error('❌ [RTM] Failed to get metadata for user:', userIdString, err);
            }
          }
        }
        if (this.onParticipantsUpdate) {
          this.onParticipantsUpdate(Array.from(this.participants));
        }
      }
      
      // Handle join events
      if ((eventType === 'JOIN' || eventType === 'REMOTE_JOIN') && channelName === this.channelName) {
        const publisherString = String(publisher);
        // Compare with unique RTM user ID, not display name
        if (publisherString && publisherString !== this.currentUser.rtmUserId) {
          // Check if this is a new participant BEFORE adding
          const wasNewParticipant = !this.participants.has(publisherString);
          
          // Only add if not already in the set (prevent duplicates)
          if (wasNewParticipant) {
            console.log('👥 [RTM] User joined:', publisherString);
            this.participants.add(publisherString);
          } else {
            console.log('⚠️ [RTM] User already in participants list, skipping duplicate:', publisherString);
            // Don't return - still process metadata in case it's updated
          }
          
          // Subscribe to user metadata (only process if not already in map)
          if (!this.rtmUserIdToDisplayNameMap.has(publisherString)) {
            try {
              await this.rtmClient.storage.subscribeUserMetadata(publisherString);
              this.subscribedMetadataUsers.add(publisherString); // Track successful subscription
              const metadata = await this.rtmClient.storage.getUserMetadata({ userId: publisherString });
              if (metadata?.metadata?.rtcUid?.value) {
                const rtcUid = parseInt(metadata.metadata.rtcUid.value);
                this.userIdMap.set(rtcUid, publisherString); // Store unique RTM user ID
                // Get display name from metadata (prefer displayName, fallback to username, then publisherString)
                const displayName = metadata?.metadata?.displayName?.value || 
                                  metadata?.metadata?.username?.value || 
                                  publisherString;
                this.displayNameMap.set(rtcUid, displayName);
                // Also map RTM user ID to display name for participants list
                this.rtmUserIdToDisplayNameMap.set(publisherString, displayName);
                console.log('✅ [RTM] Mapped RTC UID', rtcUid, 'to RTM user ID', publisherString, 'display name:', displayName);
              } else {
                // Even without RTC UID, store display name if available
                const displayName = metadata?.metadata?.displayName?.value || 
                                  metadata?.metadata?.username?.value;
                if (displayName) {
                  this.rtmUserIdToDisplayNameMap.set(publisherString, displayName);
                }
              }
            } catch (err) {
              console.error('❌ [RTM] Failed to get metadata for new user:', publisherString, err);
            }
          }
          
          // Only trigger callbacks if this is a new participant (check was done before adding)
          if (wasNewParticipant) {
            if (this.onParticipantsUpdate) {
              this.onParticipantsUpdate(Array.from(this.participants));
            }
            // Notify that a user joined (for system messages)
            if (this.onUserJoined) {
              this.onUserJoined(publisherString);
            }
          }
        }
      }
      
      // Handle leave events
      if ((eventType === 'LEAVE' || eventType === 'REMOTE_LEAVE' || eventType === 'REMOTE_TIMEOUT') && channelName === this.channelName) {
        const publisherString = String(publisher);
        console.log('👥 [RTM] User left:', publisherString);
        this.participants.delete(publisherString);
        // Remove from userIdMap
        for (const [rtcUid, rtmUserId] of this.userIdMap.entries()) {
          if (rtmUserId === publisherString) {
            this.userIdMap.delete(rtcUid);
            console.log('✅ [RTM] Removed mapping for RTC UID', rtcUid);
          }
        }
        // Unsubscribe from user metadata (only if we actually subscribed)
        if (this.subscribedMetadataUsers.has(publisherString)) {
          try {
            await this.rtmClient.storage.unsubscribeUserMetadata(publisherString);
            this.subscribedMetadataUsers.delete(publisherString); // Remove from tracking set
          } catch (err) {
            // Only log if it's not the "not subscribed" error (-12015)
            if (err.code !== -12015) {
              console.error('❌ [RTM] Failed to unsubscribe from metadata:', publisherString, err);
            } else {
              // Silently handle "not subscribed" error - just remove from tracking
              this.subscribedMetadataUsers.delete(publisherString);
            }
          }
        }
        if (this.onParticipantsUpdate) {
          this.onParticipantsUpdate(Array.from(this.participants));
        }
        // Notify that a user left (for system messages)
        if (this.onUserLeft) {
          this.onUserLeft(publisherString);
        }
      }
      
      if (this.onPresenceUpdate) this.onPresenceUpdate(event);
    });
    
    // Track RTM channel subscription state
    this.rtmClient.addEventListener('connection-state-change', (event) => {
      console.log('📡 [RTM] Connection state changed:', event.state);
    });
    
    // Listen for user metadata updates
    this.rtmClient.addEventListener('storage-event', async (event) => {
      if (event.eventType === 'SNAPSHOT' || event.eventType === 'SET' || event.eventType === 'UPDATE') {
        try {
          const userId = event.targetUserId || event.userId;
          // Compare with unique RTM user ID, not display name
          if (userId && userId !== this.currentUser.rtmUserId) {
            const metadata = await this.rtmClient.storage.getUserMetadata({ userId });
            if (metadata?.metadata?.rtcUid?.value) {
              const rtcUid = parseInt(metadata.metadata.rtcUid.value);
              this.userIdMap.set(rtcUid, userId); // Store unique RTM user ID
              // Get display name from metadata (prefer displayName, fallback to username, then userId)
              const displayName = metadata?.metadata?.displayName?.value || 
                                metadata?.metadata?.username?.value || 
                                userId;
              this.displayNameMap.set(rtcUid, displayName);
              // Also map RTM user ID to display name for participants list
              this.rtmUserIdToDisplayNameMap.set(userId, displayName);
              console.log('✅ [RTM] Metadata updated - mapped RTC UID', rtcUid, 'to RTM user ID', userId, 'display name:', displayName);
              
              // Update any existing remote users with this UID
              if (this.remoteUsers.has(rtcUid)) {
                const user = this.remoteUsers.get(rtcUid);
                user.rtmUserId = userId; // Store unique RTM user ID
                // Store display name for UI
                user.displayName = displayName;
                console.log('✅ [RTM] Updated existing user object with RTM user ID:', rtcUid, '->', userId);
              }
            } else {
              // Even without RTC UID, store display name if available
              const displayName = metadata?.metadata?.displayName?.value || 
                                metadata?.metadata?.username?.value;
              if (displayName) {
                this.rtmUserIdToDisplayNameMap.set(userId, displayName);
              }
            }
          }
        } catch (err) {
          console.warn('⚠️ [RTM] Failed to process metadata update:', err);
        }
      }
    });
  }

  handleRTMMessage(data, publisher) {
    switch (data.type) {
      case 'PROMOTION_REQUEST':
        if (this.onPromotionRequest) this.onPromotionRequest(publisher);
        break;
      case 'PROMOTE':
        // Compare with unique RTM user ID, not display name
        if (data.targetUserId === this.currentUser.rtmUserId || data.targetUserId === this.currentUser.userId) {
          this.handlePromotion();
        }
        break;
      case 'DEMOTE':
        // Compare with unique RTM user ID, not display name
        if (data.targetUserId === this.currentUser.rtmUserId || data.targetUserId === this.currentUser.userId) {
          this.handleDemotion();
        }
        break;
      case 'CHAT':
        // Filter out messages sent by the current user
        // publisher is the RTM user ID, so compare with rtmUserId, not userId (display name)
        if (publisher !== this.currentUser.rtmUserId && publisher !== this.currentUser.userId && this.onMessageReceived) {
          this.onMessageReceived(data.content, publisher);
        }
        break;
      case 'RECORDING_STATE':
      case 'STT_CONFIG':
      case 'STT_STOP':
        // Pass through system messages to onMessageReceived callback
        if (this.onMessageReceived) {
          this.onMessageReceived(JSON.stringify(data), publisher);
        }
        break;
      case 'HOST_LEFT':
        // Host has left - notify listeners to leave
        if (this.onHostLeft) {
          this.onHostLeft(data.message || 'The host has ended the stream');
        }
        break;
      default:
        console.log('Unknown message type:', data.type);
    }
  }

  async join(channelName, role = 'audience') {
    // Store the channel name for later use (critical for endStream)
    this.currentChannelName = channelName;
    
    // Prevent duplicate joins
    if (this.isJoining) {
      console.warn('⚠️ [JOIN] Already joining, skipping duplicate call');
      return;
    }
    
    if (this.isJoined) {
      console.warn('⚠️ [JOIN] Already joined, skipping duplicate call');
      return;
    }
    
    this.isJoining = true;
    
    console.log('🚪 [JOIN] Starting join process...');
    console.log('🚪 [JOIN] Channel:', channelName);
    console.log('🚪 [JOIN] Role:', role);
    console.log('🚪 [JOIN] User ID:', this.currentUser.userId);
    console.log('🚪 [JOIN] App ID:', this.appId);
    
    this.channelName = channelName;
    this.currentUser.role = role;

    // Join RTM channel (only if logged in)
    if (this.rtmClient && this.rtmLoggedIn) {
      try {
        console.log('📡 [RTM] Subscribing to RTM channel:', channelName);
        // Subscribe with presence and metadata enabled (like rtc-signaling demo)
        await this.rtmClient.subscribe(channelName, {
          withPresence: true,
          withMetadata: true,
          withMessage: true
        });
        console.log(`✅ [RTM] Subscribed to RTM channel: ${channelName} (with presence and metadata)`);
        
        // Map our own RTC UID to RTM user ID
        // Use unique RTM user ID for RTC UID hashing to ensure uniqueness (prevents conflicts when multiple users have same display name)
        const numericUid = this.hashUserIdToNumber(this.currentUser.rtmUserId);
        this.userIdMap.set(numericUid, this.currentUser.rtmUserId); // Store unique RTM user ID
        this.displayNameMap.set(numericUid, this.currentUser.userId); // Store display name for UI
        console.log('✅ [RTM] Mapped RTC UID', numericUid, 'to RTM user ID', this.currentUser.rtmUserId, '(display name:', this.currentUser.userId + ')');
        
        // Set RTM presence to announce our presence
        // Store both the unique RTM user ID (username) and the original display name
        try {
          await this.rtmClient.storage.setUserMetadata([
            { key: 'rtcUid', value: numericUid.toString() },
            { key: 'username', value: this.currentUser.rtmUserId }, // Unique RTM ID (long form)
            { key: 'rtmUserId', value: this.currentUser.rtmUserId }, // Keep for backward compatibility
            { key: 'displayName', value: this.currentUser.userId }, // Original display name for UI (short form)
            { key: 'role', value: role }
          ]);
          console.log('✅ [RTM] Set presence metadata:', {
            username: this.currentUser.rtmUserId,
            displayName: this.currentUser.userId
          });
        } catch (presenceErr) {
          console.warn('⚠️ [RTM] Failed to set presence metadata:', presenceErr);
        }
      } catch (err) {
        console.error('❌ [RTM] Subscribe failed:', err);
        console.error('❌ [RTM] Error details:', {
          message: err.message,
          code: err.code,
          stack: err.stack
        });
        // Don't throw - RTC can still work without RTM
        console.warn('⚠️ [RTM] Continuing without RTM subscription...');
      }
    } else {
      console.warn('⚠️ [RTM] Skipping RTM subscription - not logged in');
      if (!this.rtmClient) {
        console.warn('⚠️ [RTM] RTM client not initialized');
      }
      if (!this.rtmLoggedIn) {
        console.warn('⚠️ [RTM] RTM not logged in');
      }
    }

    // Join RTC channel
    console.log('🎥 [RTC] Requesting token from backend...');
    
    // Convert userId to number for RTC (Agora RTC requires numeric UID)
    // Use a hash of the unique RTM user ID to get a unique numeric UID
    // This ensures users with the same display name get different RTC UIDs
    const numericUid = this.hashUserIdToNumber(this.currentUser.rtmUserId);
    console.log('🎥 [RTC] Display Name:', this.currentUser.userId);
    console.log('🎥 [RTC] RTM User ID:', this.currentUser.rtmUserId);
    console.log('🎥 [RTC] Numeric UID:', numericUid);
    
    // Request combined RTC+RTM token from backend (secure - certificate not exposed)
    // Use unique RTM user ID for token generation (not display name)
    // This ensures the token matches the RTM client login
    const token = await this.fetchTokenFromBackend(channelName, numericUid, role, this.currentUser.rtmUserId, 'combined');
    
    console.log('🎥 [RTC] Joining RTC channel with params:', {
      appId: this.appId,
      channelName,
      token: token ? `${token.substring(0, 20)}...` : 'null (tokenless)',
      uid: numericUid,
      uidType: typeof numericUid
    });
    
    try {
      // Check if already connected before joining
      const connectionState = this.rtcClient.connectionState;
      console.log('🔍 [RTC] Current connection state:', connectionState);
      if (connectionState === 'CONNECTING' || connectionState === 'CONNECTED') {
        console.warn('⚠️ [RTC] Client already in state:', connectionState);
        this.isJoining = false;
        this.isJoined = true;
        return;
      }
      
      console.log('🔄 [RTC] Attempting to join channel...');
      console.log('🔄 [RTC] Join parameters:', {
        appId: this.appId,
        channelName,
        token: token ? `present (${token.length} chars)` : 'null',
        uid: numericUid,
        uidType: typeof numericUid
      });
      
      await this.rtcClient.join(this.appId, channelName, token, numericUid);
      console.log('✅ [RTC] Successfully joined RTC channel');
      this.isJoined = true;
    } catch (err) {
      this.isJoining = false;
      this.isJoined = false;
      console.error('❌ [RTC] Join failed:', err);
      console.error('❌ [RTC] Error details:', {
        message: err.message,
        code: err.code,
        name: err.name,
        stack: err.stack
      });
      
      // Check if user is banned (UID-BANNED error)
      if (err.message && (err.message.includes('UID-BANNED') || err.message.includes('BANNED'))) {
        console.log('🚫 [RTC] User is banned from channel (UID-BANNED)');
        if (this.onKicked) {
          this.onKicked('You have been banned from this channel');
        }
        // Don't throw - let the callback handle the redirect
        return;
      }
      
      console.error('❌ [RTC] Join context:', {
        appId: this.appId,
        channelName,
        hasToken: !!token,
        tokenLength: token ? token.length : 0,
        uid: numericUid,
        connectionState: this.rtcClient?.connectionState
      });
      throw err;
    } finally {
      this.isJoining = false;
    }
    
    if (role === 'host') {
      console.log('👑 [RTC] Setting client role to host...');
      await this.rtcClient.setClientRole('host');
      console.log('✅ [RTC] Client role set to host');
      // Don't publish tracks automatically - host must call startBroadcast()
      console.log('⏸️ [RTC] Host joined but not broadcasting yet. Call startBroadcast() to go live.');
      this.isBroadcasting = false;
    } else {
      console.log('👥 [RTC] Setting client role to audience...');
      await this.rtcClient.setClientRole('audience');
      console.log('✅ [RTC] Client role set to audience');
    }
  }

  async fetchTokenFromBackend(channelName, uid, role, rtmUserId = null, tokenType = 'rtc') {
    // Request token from backend (secure - certificate never exposed to frontend)
    // Frontend logs removed - check terminal for token generation logs
    
    try {
      const response = await fetch('/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName,
          uid,
          role,
          rtmUserId,
          tokenType
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Token API returned ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.token) {
        console.warn('⚠️ [TOKEN] Backend returned empty token, using tokenless mode');
        return null;
      }

      return data.token;
    } catch (err) {
      console.error('❌ [TOKEN] Failed to fetch token from backend:', err);
      console.error('❌ [TOKEN] Error details:', {
        message: err.message,
        stack: err.stack
      });
      // Don't fall back to tokenless - throw the error so join fails properly
      // Tokenless mode often doesn't work with dynamic keys enabled
      throw new Error(`Token generation failed: ${err.message}`);
    }
  }

  async startBroadcast() {
    // Start broadcasting - publish tracks so audience can see
    if (this.currentUser.role !== 'host') {
      throw new Error('Only hosts can start broadcasting');
    }
    
    if (this.isBroadcasting) {
      console.warn('⚠️ [BROADCAST] Already broadcasting');
      return;
    }
    
    console.log('🎬 [BROADCAST] Starting broadcast...');
    await this.publishTracks();
    this.isBroadcasting = true;
    console.log('✅ [BROADCAST] Broadcast started - audience can now see host');
  }

  async endShow() {
    // End show - stop broadcasting but stay as host
    if (this.currentUser.role !== 'host') {
      throw new Error('Only hosts can end the show');
    }
    
    if (!this.isBroadcasting) {
      console.warn('⚠️ [END SHOW] Not currently broadcasting');
      return;
    }
    
    console.log('🎬 [END SHOW] Ending show (stopping broadcast)...');
    
    // Stop screen share if active
    if (this.screenShareClient || this.localScreenTrack) {
      try {
        console.log('🖥️ [END SHOW] Stopping screen share...');
        await this.stopScreenShare();
      } catch (err) {
        console.error('❌ [END SHOW] Error stopping screen share:', err);
      }
    }
    
    // Demote all promoted users
    const promotedUsers = Array.from(this.remoteUsers.values()).filter(
      user => user.rtmUserId && user.rtmUserId !== this.currentUser.rtmUserId
    );
    
    for (const user of promotedUsers) {
      if (user.rtmUserId) {
        try {
          console.log('👋 [END SHOW] Demoting user:', user.rtmUserId);
          await this.demoteUser(user.rtmUserId);
        } catch (err) {
          console.error('❌ [END SHOW] Error demoting user:', user.rtmUserId, err);
        }
      }
    }
    
    await this.unpublishTracks();
    this.isBroadcasting = false;
    console.log('✅ [END SHOW] Show ended - host remains in channel but not broadcasting');
  }

  // Set video and audio quality settings
  setQualitySettings(videoQuality, audioQuality) {
    this.videoQuality = videoQuality || '720p';
    this.audioQuality = audioQuality || '48kHz';
    console.log('⚙️ [SETTINGS] Quality settings updated:', {
      videoQuality: this.videoQuality,
      audioQuality: this.audioQuality
    });
  }

  // Get video encoder configuration based on quality setting
  // All quality options use 30fps (no FPS selection needed)
  getVideoEncoderConfig() {
    const configs = {
      '480p': { width: 640, height: 480, frameRate: 30, bitrate: 400 },
      '720p': { width: 1280, height: 720, frameRate: 30, bitrate: 1130 }, // Default: 1280x720 @ 30fps
      '1080p': { width: 1920, height: 1080, frameRate: 30, bitrate: 2000 }
    };
    // Default to 720p (1280x720 @ 30fps) if quality not specified
    return configs[this.videoQuality] || configs['720p'];
  }

  // Get audio encoder configuration based on quality setting
  getAudioEncoderConfig() {
    const configs = {
      '16kHz': { sampleRate: 16000, stereo: false, bitrate: 48 },
      '24kHz': { sampleRate: 24000, stereo: false, bitrate: 64 },
      '48kHz': { sampleRate: 48000, stereo: true, bitrate: 128 }
    };
    return configs[this.audioQuality] || configs['48kHz'];
  }

  async publishTracks() {
    console.log('🎤 [PUBLISH] Starting to publish tracks...');
    console.log('⚙️ [PUBLISH] Quality settings:', {
      videoQuality: this.videoQuality,
      audioQuality: this.audioQuality
    });
    
    try {
      // Check permissions first
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
        console.log('✅ [PUBLISH] Permissions granted, stopping test stream');
        stream.getTracks().forEach(track => track.stop());
      } catch (permErr) {
        console.error('❌ [PUBLISH] Permission check failed:', permErr);
        console.error('❌ [PUBLISH] Error name:', permErr.name);
        console.error('❌ [PUBLISH] Error message:', permErr.message);
        throw new Error(`Camera/microphone permission denied: ${permErr.message}. Please allow camera and microphone access in your browser settings.`);
      }
      
      if (!this.localAudioTrack) {
        console.log('🎤 [PUBLISH] Creating microphone track...');
        try {
          const audioConfig = this.getAudioEncoderConfig();
          console.log('⚙️ [PUBLISH] Audio config:', audioConfig);
          
          this.localAudioTrack = await this.AgoraRTC.createMicrophoneAudioTrack({
            encoderConfig: {
              sampleRate: audioConfig.sampleRate,
              stereo: audioConfig.stereo,
              bitrate: audioConfig.bitrate
            }
          });
          
          console.log('✅ [PUBLISH] Microphone track created:', {
            trackId: this.localAudioTrack.getTrackId?.(),
            enabled: this.localAudioTrack.enabled !== undefined ? this.localAudioTrack.enabled : 'unknown',
            muted: this.localAudioTrack.muted !== undefined ? this.localAudioTrack.muted : 'unknown',
            sampleRate: audioConfig.sampleRate,
            bitrate: audioConfig.bitrate
          });
        } catch (audioErr) {
          console.error('❌ [PUBLISH] Failed to create audio track:', audioErr);
          console.warn('⚠️ [PUBLISH] Continuing without audio track');
          // Continue without audio if permission denied
          if (audioErr.name === 'NotAllowedError' || audioErr.name === 'PermissionDeniedError') {
            throw new Error('Microphone permission denied. Please allow microphone access in your browser settings.');
          }
          throw audioErr;
        }
      } else {
        console.log('🎤 [PUBLISH] Microphone track already exists');
      }
      
      if (!this.localVideoTrack) {
        console.log('🎥 [PUBLISH] Creating camera track...');
        try {
          const videoConfig = this.getVideoEncoderConfig();
          console.log('⚙️ [PUBLISH] Video config:', videoConfig);
          console.log('⚙️ [PUBLISH] Resolution:', `${videoConfig.width}x${videoConfig.height}`, '@', videoConfig.frameRate, 'fps');
          
          // Create camera track with encoder configuration
          // All quality options use 30fps (frameRate: 30)
          this.localVideoTrack = await this.AgoraRTC.createCameraVideoTrack({
            encoderConfig: {
              width: videoConfig.width,
              height: videoConfig.height,
              frameRate: videoConfig.frameRate, // Always 30fps for all quality options
              bitrateMax: videoConfig.bitrate * 1000, // Convert kbps to bps
              bitrateMin: Math.floor(videoConfig.bitrate * 0.5 * 1000) // Min bitrate is 50% of max
            }
          });
          
          console.log('✅ [PUBLISH] Camera track created:', {
            trackId: this.localVideoTrack.getTrackId?.(),
            enabled: this.localVideoTrack.enabled !== undefined ? this.localVideoTrack.enabled : 'unknown',
            muted: this.localVideoTrack.muted !== undefined ? this.localVideoTrack.muted : 'unknown',
            trackType: typeof this.localVideoTrack,
            resolution: `${videoConfig.width}x${videoConfig.height}`,
            frameRate: videoConfig.frameRate,
            bitrate: videoConfig.bitrate
          });
        } catch (videoErr) {
          console.error('❌ [PUBLISH] Failed to create video track:', videoErr);
          console.error('❌ [PUBLISH] Video error name:', videoErr.name);
          console.error('❌ [PUBLISH] Video error message:', videoErr.message);
          // Continue without video if permission denied, but log it
          if (videoErr.name === 'NotAllowedError' || videoErr.name === 'PermissionDeniedError') {
            throw new Error('Camera permission denied. Please allow camera access in your browser settings.');
          }
          throw videoErr;
        }
      } else {
        console.log('🎥 [PUBLISH] Camera track already exists');
      }
      
      console.log('📤 [PUBLISH] Publishing tracks to RTC...');
      console.log('📤 [PUBLISH] Tracks to publish:', {
        audio: !!this.localAudioTrack,
        video: !!this.localVideoTrack,
        audioTrackId: this.localAudioTrack?.getTrackId?.(),
        videoTrackId: this.localVideoTrack?.getTrackId?.()
      });
      
      await this.rtcClient.publish([this.localAudioTrack, this.localVideoTrack]);
      console.log('✅ [PUBLISH] Tracks published successfully');
      console.log('✅ [PUBLISH] Final track state:', {
        localVideoTrack: !!this.localVideoTrack,
        localAudioTrack: !!this.localAudioTrack
      });
    } catch (err) {
      console.error('❌ [PUBLISH] Failed to publish tracks:', err);
      console.error('❌ [PUBLISH] Error details:', {
        message: err.message,
        name: err.name,
        stack: err.stack
      });
      throw err;
    }
  }

  async unpublishTracks() {
    if (this.localAudioTrack) {
      await this.rtcClient.unpublish(this.localAudioTrack);
      this.localAudioTrack.stop();
      this.localAudioTrack.close();
      this.localAudioTrack = null;
    }
    if (this.localVideoTrack) {
      await this.rtcClient.unpublish(this.localVideoTrack);
      this.localVideoTrack.stop();
      this.localVideoTrack.close();
      this.localVideoTrack = null;
    }
  }

  // Screen Share
  async startScreenShare() {
    if (!this.rtcClient || this.currentUser.role === 'audience') {
      throw new Error('Only hosts can share screen');
    }

    if (this.screenShareClient) {
      console.warn('⚠️ [SCREEN SHARE] Screen share already active');
      return true;
    }

    try {
      console.log('🖥️ [SCREEN SHARE] Starting screen share...');
      
      // Create screen share track
      this.localScreenTrack = await this.AgoraRTC.createScreenVideoTrack({}, 'disable');
      console.log('✅ [SCREEN SHARE] Screen track created');
      
      // Create separate client for screen share
      // Use numeric UID for screen share client (hash the screen user ID with unique RTM ID)
      const screenShareUserId = `${this.currentUser.rtmUserId}-screen`;
      const screenShareNumericUid = this.hashUserIdToNumber(screenShareUserId);
      console.log('🖥️ [SCREEN SHARE] Screen share UID:', screenShareUserId, '-> Numeric:', screenShareNumericUid);
      
      this.screenShareClient = this.AgoraRTC.createClient({ mode: 'live', codec: 'vp8' });
      
      // Store screen share UID for later reference (uid is read-only, so we store it separately)
      this.screenShareClient._screenShareUid = screenShareNumericUid;
      this.screenShareClient._rtmUserId = screenShareUserId;
      
      // Get token for screen share client (use numeric UID)
      const token = await this.fetchTokenFromBackend(
        this.channelName, 
        screenShareNumericUid, 
        'host', 
        screenShareUserId, 
        'combined'
      );
      console.log('🖥️ [SCREEN SHARE] Token obtained for screen share client');
      
      await this.screenShareClient.join(this.appId, this.channelName, token, screenShareNumericUid);
      console.log('✅ [SCREEN SHARE] Screen share client joined channel');
      console.log('✅ [SCREEN SHARE] Screen share client UID:', screenShareNumericUid);
      
      await this.screenShareClient.setClientRole('host');
      console.log('✅ [SCREEN SHARE] Screen share client role set to host');
      
      await this.screenShareClient.publish([this.localScreenTrack]);
      console.log('✅ [SCREEN SHARE] Screen track published');
      console.log('✅ [SCREEN SHARE] Local screen track available:', !!this.localScreenTrack);
      
      // Update RTM metadata (only if logged in)
      if (this.rtmClient && this.rtmLoggedIn) {
        try {
          // RTM metadata format: array of metadata items
          await this.rtmClient.storage.setUserMetadata([
            { key: 'screenShare', value: 'true' }
          ]);
          console.log('✅ [SCREEN SHARE] RTM metadata updated');
        } catch (metaErr) {
          console.warn('⚠️ [SCREEN SHARE] Failed to update RTM metadata:', metaErr);
          // Don't fail screen share if metadata update fails
        }
      } else {
        console.warn('⚠️ [SCREEN SHARE] Skipping RTM metadata update - RTM not logged in');
      }
      
      // Map screen share client UID to RTM user ID (screenShareUserId already defined above)
      this.userIdMap.set(screenShareNumericUid, screenShareUserId);
      // Set display name for screen share (base username + "-screen")
      const screenShareDisplayName = `${this.currentUser.userId}-screen`;
      this.displayNameMap.set(screenShareNumericUid, screenShareDisplayName);
      console.log('✅ [SCREEN SHARE] Mapped screen share RTC UID', screenShareNumericUid, 'to RTM user ID', screenShareUserId);
      console.log('✅ [SCREEN SHARE] Set display name for screen share:', screenShareDisplayName);
      
      // Set up event handlers for screen share client to ensure proper user tracking
      this.screenShareClient.on('user-published', async (user, mediaType) => {
        console.log('🖥️ [SCREEN SHARE] User published on screen share client:', {
          uid: user.uid,
          mediaType,
          screenShareUid: screenShareNumericUid
        });
        
        // Only map the screen share client's own UID to the screen share RTM user ID
        // Other users (like promoted users) should keep their original RTM user ID mapping
        if (user.uid === screenShareNumericUid) {
          // This is the screen share client itself
          user.rtmUserId = screenShareUserId;
          this.userIdMap.set(user.uid, screenShareUserId);
          console.log('✅ [SCREEN SHARE] Mapped screen share client UID', user.uid, 'to RTM user ID', screenShareUserId);
        } else {
          // This is another user publishing on the screen share client
          // Don't overwrite their RTM user ID - it should already be mapped correctly
          // The main RTC client will handle the mapping for other users
          console.log('🖥️ [SCREEN SHARE] Other user published (not screen share client):', user.uid, '- keeping existing RTM mapping');
        }
      });
      
      // Also subscribe to the screen share track from the main RTC client so we can see it locally
      // The screen share client publishes to the same channel, so the main client should receive it
      // But we can also play the local track directly
      console.log('✅ [SCREEN SHARE] Screen share started successfully');
      
      // Trigger callback - localScreenTrack should be available now
      if (this.onScreenShareStarted) {
        this.onScreenShareStarted();
      }
      return true;
    } catch (err) {
      console.error('❌ [SCREEN SHARE] Screen share error:', err);
      console.error('❌ [SCREEN SHARE] Error details:', {
        message: err.message,
        stack: err.stack
      });
      // Clean up on error
      if (this.localScreenTrack) {
        this.localScreenTrack.close();
        this.localScreenTrack = null;
      }
      if (this.screenShareClient) {
        this.screenShareClient = null;
      }
      throw err;
    }
  }

  async stopScreenShare() {
    console.log('🖥️ [SCREEN SHARE] Stopping screen share...');
    
    if (this.localScreenTrack) {
      try {
        this.localScreenTrack.stop();
        this.localScreenTrack.close();
        console.log('✅ [SCREEN SHARE] Screen track closed');
      } catch (err) {
        console.error('❌ [SCREEN SHARE] Error closing screen track:', err);
      }
      this.localScreenTrack = null;
    }
    
    if (this.screenShareClient) {
      try {
        await this.screenShareClient.unpublish();
        await this.screenShareClient.leave();
        console.log('✅ [SCREEN SHARE] Screen share client left channel');
      } catch (err) {
        console.error('❌ [SCREEN SHARE] Error leaving screen share client:', err);
      }
      this.screenShareClient = null;
    }
    
    // Update RTM metadata (only if logged in)
    if (this.rtmClient && this.rtmLoggedIn) {
      try {
        // RTM metadata format: array of metadata items
        await this.rtmClient.storage.setUserMetadata([
          { key: 'screenShare', value: 'false' }
        ]);
        console.log('✅ [SCREEN SHARE] RTM metadata updated (stopped)');
      } catch (err) {
        console.warn('⚠️ [SCREEN SHARE] Error updating RTM metadata:', err);
        // Don't fail if metadata update fails
      }
    } else {
      console.warn('⚠️ [SCREEN SHARE] Skipping RTM metadata update - RTM not logged in');
    }
    
    if (this.onScreenShareStopped) this.onScreenShareStopped();
    console.log('✅ [SCREEN SHARE] Screen share stopped');
  }

  // Promotion / Demotion Logic
  async applyToHost() {
    if (!this.rtmClient || !this.rtmLoggedIn) {
      throw new Error('RTM not logged in - cannot send promotion request');
    }
    const message = JSON.stringify({ type: 'PROMOTION_REQUEST' });
    console.log('📤 [RTM] Sending promotion request to channel:', this.channelName);
    try {
      await this.rtmClient.publish(this.channelName, message);
      console.log('✅ [RTM] Promotion request sent successfully');
    } catch (err) {
      console.error('❌ [RTM] Failed to send promotion request:', err);
      throw err;
    }
  }

  async promoteUser(targetUserId) {
    if (!this.rtmClient || !this.rtmLoggedIn) {
      throw new Error('RTM not logged in - cannot promote user');
    }
    const message = JSON.stringify({ type: 'PROMOTE', targetUserId });
    console.log('📤 [RTM] Sending promote message:', { targetUserId, channel: this.channelName });
    try {
      await this.rtmClient.publish(this.channelName, message);
      console.log('✅ [RTM] Promote message sent successfully');
    } catch (err) {
      console.error('❌ [RTM] Failed to send promote message:', err);
      throw err;
    }
  }

  async demoteUser(targetUserId) {
    if (!this.rtmClient || !this.rtmLoggedIn) {
      throw new Error('RTM not logged in - cannot demote user');
    }
    const message = JSON.stringify({ type: 'DEMOTE', targetUserId });
    console.log('📤 [RTM] Sending demote message:', { targetUserId, channel: this.channelName });
    try {
      await this.rtmClient.publish(this.channelName, message);
      console.log('✅ [RTM] Demote message sent successfully');
    } catch (err) {
      console.error('❌ [RTM] Failed to send demote message:', err);
      throw err;
    }
  }

  async handlePromotion() {
    this.currentUser.role = 'promoted';
    await this.rtcClient.setClientRole('host');
    await this.publishTracks();
    if (this.onPromoted) this.onPromoted();
  }

  async handleDemotion() {
    this.currentUser.role = 'audience';
    await this.unpublishTracks();
    await this.rtcClient.setClientRole('audience');
    // Reset promotion request flag so user can request again
    if (this.onDemoted) this.onDemoted();
  }

  async demoteSelf() {
    await this.handleDemotion();
    const message = JSON.stringify({ type: 'DEMOTED_SELF', userId: this.currentUser.userId });
    await this.rtmClient.publish(this.channelName, message);
  }

  // Chat Logic
  async sendChatMessage(content) {
    if (!this.rtmClient || !this.rtmLoggedIn) {
      throw new Error('RTM not logged in - cannot send chat message');
    }
    const message = JSON.stringify({ type: 'CHAT', content, senderId: this.currentUser.userId });
    console.log('📤 [RTM] Sending chat message:', { content, channel: this.channelName, senderId: this.currentUser.userId });
    try {
      await this.rtmClient.publish(this.channelName, message);
      console.log('✅ [RTM] Chat message sent successfully');
    } catch (err) {
      console.error('❌ [RTM] Failed to send chat message:', err);
      throw err;
    }
  }

  // Media Services (Proxy) - Using Next.js API routes
  async startMediaPull(pullUrl, repeatTime = 1) {
    // Media Pull uses: /v1/projects/{appid}/cloud-player/players
    // Generate token for Media Pull with specific UID
    const mediaPullUid = 999; // Media Pull uses a fixed UID
    const token = await this.fetchTokenFromBackend(this.channelName, mediaPullUid, 'host', `${this.currentUser.userId}-mediapull`, 'rtc');
    
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/cloud-player/players`;
    const body = {
      player: {
        streamUrl: pullUrl,
        channelName: this.channelName,
        token: token, // Token for Media Pull
        uid: mediaPullUid,
        idleTimeout: 300,
        name: `MediaPull_${Date.now()}`,
        repeatTime: repeatTime // Number of times to play (1 = once, -1 = loop, N = N times)
      }
    };
    
    // Frontend logs removed - check terminal for REST API logs
    
    try {
      const response = await axios.post(url, body);
      
      if (response.data && response.data.player && response.data.player.id) {
        this.mediaPullPlayerId = response.data.player.id;
        this.mediaPullUpdateSequence = 0;
      }
      return response;
    } catch (err) {
      // Frontend logs removed - check terminal for REST API error logs
      throw err;
    }
  }

  async updateMediaPull(options = {}) {
    if (!this.mediaPullPlayerId) {
      throw new Error('No active Media Pull player');
    }

    // Media Pull update uses: /v1/projects/{appid}/cloud-player/players/{id}?sequence={seq}
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/cloud-player/players/${this.mediaPullPlayerId}&sequence=${this.mediaPullUpdateSequence}`;
    const body = { player: {} };
    
    if (options.streamUrl) body.player.streamUrl = options.streamUrl;
    if (options.volume !== undefined) {
      body.player.audioOptions = { volume: Math.max(0, Math.min(200, options.volume)) };
    }
    if (options.isPause !== undefined) body.player.isPause = options.isPause;
    if (options.seekPosition !== undefined) body.player.seekPosition = options.seekPosition;
    
    console.log('📥 [MEDIA PULL UPDATE] Full Request Body:', JSON.stringify(body, null, 2));
    console.log('📥 [MEDIA PULL UPDATE] URL:', url);
    
    const response = await axios.patch(url, body);
    this.mediaPullUpdateSequence++;
    return response;
  }

  async deleteMediaPull() {
    if (!this.mediaPullPlayerId) return;
    
    // Media Pull delete uses: /v1/projects/{appid}/cloud-player/players/{id}
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/cloud-player/players/${this.mediaPullPlayerId}`;
    // Frontend logs removed - check terminal for REST API logs
    
    try {
      const response = await axios.delete(url);
      this.mediaPullPlayerId = null;
      this.mediaPullUpdateSequence = 0;
      return response;
    } catch (err) {
      // Frontend logs removed - check terminal for REST API error logs
      throw err;
    }
  }

  // Calculate grid layout for multiple users
  // If first user is screen share, prioritize it with larger view and smaller tiles around it
  // This ensures regions don't overlap by calculating proper grid positions
  calculateMediaPushLayout(userCount, canvasWidth = 640, canvasHeight = 360, users = []) {
    if (userCount === 0) {
      console.log('📐 [MEDIA PUSH LAYOUT] No users, returning empty layout');
      return [];
    }
    
    // Check if first user is screen share
    const hasScreenShare = users.length > 0 && users[0]?.isScreenShare;
    
    if (userCount === 1) {
      // Single user: full canvas
      console.log('📐 [MEDIA PUSH LAYOUT] Single user layout: full canvas');
      return [{
        rtcStreamUid: 0, // Will be replaced with actual UID
        region: {
          xPos: 0,
          yPos: 0,
          zIndex: 1,
          width: canvasWidth,
          height: canvasHeight
        }
      }];
    }
    
    let layout = [];
    
    if (hasScreenShare && userCount > 1) {
      // Screen share prioritized layout: screen share takes most of the canvas, others are smaller tiles
      console.log('📐 [MEDIA PUSH LAYOUT] Screen share prioritized layout');
      console.log('📐 [MEDIA PUSH LAYOUT]   User count:', userCount);
      console.log('📐 [MEDIA PUSH LAYOUT]   Canvas size:', canvasWidth, 'x', canvasHeight);
      
      // Screen share takes left 70% of canvas, others take right 30% stacked vertically
      const screenShareWidth = Math.floor(canvasWidth * 0.7);
      const screenShareHeight = canvasHeight;
      const othersWidth = canvasWidth - screenShareWidth;
      const othersHeight = Math.floor(canvasHeight / (userCount - 1));
      
      // Screen share (first user) - large view on the left
      layout.push({
        rtcStreamUid: 0, // Will be replaced with actual UID
        region: {
          xPos: 0,
          yPos: 0,
          zIndex: 1,
          width: screenShareWidth,
          height: screenShareHeight
        }
      });
      console.log(`📐 [MEDIA PUSH LAYOUT]   Screen share: xPos=0, yPos=0, size=${screenShareWidth}x${screenShareHeight}, zIndex=1`);
      
      // Other users - smaller tiles on the right, stacked vertically
      for (let i = 1; i < userCount; i++) {
        const yPos = (i - 1) * othersHeight;
        layout.push({
          rtcStreamUid: 0, // Will be replaced with actual UID
          region: {
            xPos: screenShareWidth,
            yPos: yPos,
            zIndex: i + 1,
            width: othersWidth,
            height: othersHeight
          }
        });
        console.log(`📐 [MEDIA PUSH LAYOUT]   User ${i + 1}: xPos=${screenShareWidth}, yPos=${yPos}, size=${othersWidth}x${othersHeight}, zIndex=${i + 1}`);
      }
    } else {
      // Regular grid layout for all users
      // Calculate grid dimensions to fit all users without overlap
      // For 2 users: 2 cols x 1 row (side by side)
      // For 3 users: 2 cols x 2 rows (2 on top, 1 on bottom)
      // For 4 users: 2 cols x 2 rows (2x2 grid)
      // For 5-6 users: 3 cols x 2 rows
      // etc.
      const cols = Math.ceil(Math.sqrt(userCount));
      const rows = Math.ceil(userCount / cols);
      const cellWidth = Math.floor(canvasWidth / cols);
      const cellHeight = Math.floor(canvasHeight / rows);
      
      console.log('📐 [MEDIA PUSH LAYOUT] Regular grid layout (no overlaps):');
      console.log('📐 [MEDIA PUSH LAYOUT]   User count:', userCount);
      console.log('📐 [MEDIA PUSH LAYOUT]   Canvas size:', canvasWidth, 'x', canvasHeight);
      console.log('📐 [MEDIA PUSH LAYOUT]   Grid: ', cols, 'cols x', rows, 'rows');
      console.log('📐 [MEDIA PUSH LAYOUT]   Cell size:', cellWidth, 'x', cellHeight, '(ensures no overlap)');
      
      for (let i = 0; i < userCount; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const xPos = col * cellWidth;
        const yPos = row * cellHeight;
        
        layout.push({
          rtcStreamUid: 0, // Will be replaced with actual UID
          region: {
            xPos: xPos,
            yPos: yPos,
            zIndex: i + 1,
            width: cellWidth,
            height: cellHeight
          }
        });
        
        console.log(`📐 [MEDIA PUSH LAYOUT]   User ${i + 1}: col=${col}, row=${row}, xPos=${xPos}, yPos=${yPos}, size=${cellWidth}x${cellHeight}, zIndex=${i + 1} (no overlap)`);
      }
    }
    
    // Verify no overlaps by checking all regions
    for (let i = 0; i < layout.length; i++) {
      for (let j = i + 1; j < layout.length; j++) {
        const r1 = layout[i].region;
        const r2 = layout[j].region;
        const overlaps = !(r1.xPos + r1.width <= r2.xPos || r2.xPos + r2.width <= r1.xPos ||
                          r1.yPos + r1.height <= r2.yPos || r2.yPos + r2.height <= r1.yPos);
        if (overlaps) {
          console.warn(`⚠️ [MEDIA PUSH LAYOUT] WARNING: Regions ${i + 1} and ${j + 1} overlap!`);
        }
      }
    }
    
    return layout;
  }

  // Get all host users (including main host, promoted users, and screen share)
  getAllHostUsers() {
    const users = [];
    let screenShareUser = null;
    
    console.log('👤 [MEDIA PUSH USERS] ============================================');
    console.log('👤 [MEDIA PUSH USERS] Gathering all host users for layout...');
    console.log('👤 [MEDIA PUSH USERS] isBroadcasting:', this.isBroadcasting);
    console.log('👤 [MEDIA PUSH USERS] currentUser.role:', this.currentUser.role);
    console.log('👤 [MEDIA PUSH USERS] currentUser.userId:', this.currentUser.userId);
    console.log('👤 [MEDIA PUSH USERS] remoteUsers count:', this.remoteUsers.size);
    console.log('👤 [MEDIA PUSH USERS] remoteUsers entries:', Array.from(this.remoteUsers.entries()).map(([uid, user]) => `UID ${uid}`).join(', '));
    
    // Get the screen share client's UID if it exists
    const screenShareUid = this.screenShareClient?._screenShareUid;
    
    // Add main host if broadcasting (but not if it's the screen share)
    if (this.isBroadcasting && this.currentUser.role === 'host') {
      const hostNumericUid = this.hashUserIdToNumber(this.currentUser.rtmUserId);
      // Only add main host if it's not the screen share UID
      if (!screenShareUid || hostNumericUid !== screenShareUid) {
        users.push({
          uid: hostNumericUid,
          isMainHost: true,
          isScreenShare: false
        });
        console.log('👤 [MEDIA PUSH USERS] ✅ Main host added:', this.currentUser.userId, '-> UID:', hostNumericUid);
      } else {
        console.log('👤 [MEDIA PUSH USERS] ⚠️ Main host is screen share, will add separately');
      }
    } else {
      console.log('👤 [MEDIA PUSH USERS] ⚠️ Main host NOT added (isBroadcasting:', this.isBroadcasting, ', role:', this.currentUser.role, ')');
    }
    
    // Add all remote users (promoted users and screen share)
    for (const [uid, user] of this.remoteUsers.entries()) {
      const rtmUserId = this.userIdMap.get(uid);
      console.log('👤 [MEDIA PUSH USERS] Checking remote user UID:', uid, 'RTM ID:', rtmUserId || 'none');
      
      // Check if this is the screen share user
      const isScreenShare = (screenShareUid && uid === screenShareUid) || (rtmUserId && rtmUserId.endsWith('-screen'));
      
      if (isScreenShare) {
        // Store screen share user separately - it will be prioritized in layout
        screenShareUser = {
          uid: uid,
          isMainHost: false,
          isScreenShare: true
        };
        console.log('👤 [MEDIA PUSH USERS] ✅ Screen share user found:', rtmUserId || `UID ${uid}`, '-> UID:', uid, '(will be prioritized in layout)');
      } else {
        // Add regular promoted user
        users.push({
          uid: uid,
          isMainHost: false,
          isScreenShare: false
        });
        console.log('👤 [MEDIA PUSH USERS] ✅ Remote user added:', rtmUserId || `UID ${uid}`, '-> UID:', uid);
      }
    }
    
    // Add screen share user at the beginning if it exists (so it gets prioritized in layout)
    if (screenShareUser) {
      users.unshift(screenShareUser);
    }
    
    console.log('👤 [MEDIA PUSH USERS] Total users for layout:', users.length);
    console.log('👤 [MEDIA PUSH USERS] User UIDs:', users.map(u => `${u.uid}${u.isScreenShare ? ' (screen share)' : ''}`).join(', '));
    console.log('👤 [MEDIA PUSH USERS] ============================================');
    return users;
  }

  async startMediaPush(rtmpUrl, options = {}) {
    // Media Push uses: /v1/projects/{appid}/rtmp-converters
    // Media Push token should be generated with UID 0 since the converter itself doesn't have a UID
    // The UIDs in the layout are for the actual users being transcoded, not the converter
    const pushId = options.id || `mediapush-${Date.now()}`; // Get pushId from options or generate one
    const token = await this.fetchTokenFromBackend(this.channelName, 0, 'host', `${this.currentUser.userId}-mediapush`, 'rtc');
    
    // Get all host users in the channel
    const allUsers = this.getAllHostUsers();
    const userCount = allUsers.length || 1; // At least 1 (main host)
    
    // Calculate layout
    const canvasWidth = options.width || 640;
    const canvasHeight = options.height || 360;
    // Pass users array so screen share can be prioritized
    const layout = this.calculateMediaPushLayout(userCount, canvasWidth, canvasHeight, allUsers);
    
    // Fill in actual UIDs
    for (let i = 0; i < layout.length && i < allUsers.length; i++) {
      layout[i].rtcStreamUid = allUsers[i].uid;
    }
    
    // If no users yet, use main host UID
    if (layout.length > 0 && layout[0].rtcStreamUid === 0) {
      const hostNumericUid = this.hashUserIdToNumber(this.currentUser.rtmUserId);
      layout[0].rtcStreamUid = hostNumericUid;
    }
    
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/rtmp-converters`;
    const body = {
      converter: {
        rtmpUrl: rtmpUrl,
        name: options.name || `Converter_${Date.now()}`,
        jitterBufferSizeMs: options.jitterBufferSizeMs || 1000,
        transcodeOptions: {
          rtcChannel: this.channelName,
          rtcToken: token, // Token goes in transcodeOptions, not in converter root
          audioOptions: {
            codecProfile: 'LC-AAC',
            sampleRate: 48000,
            bitrate: 48,
            audioChannels: 1
          },
          videoOptions: {
            canvas: {
              width: canvasWidth,
              height: canvasHeight
            },
            bitrate: options.bitrate || 800,
            frameRate: options.fps || 15,
            codec: 'H.264',
            codecProfile: 'high',
            layout: layout
          }
        }
      }
    };

    // Frontend logs removed - check terminal for REST API logs
    
    try {
      const response = await axios.post(url, body);
      
      // Store converter ID for later updates - tie it to the specific pushId
      const converterId = response.data?.converter?.id || response.data?.id || response.data?.converterId;
      if (converterId) {
        this.activeMediaPushConverters.set(converterId, {
          rtmpUrl,
          pushId: pushId, // Store the pushId to track which push destination this converter belongs to
          canvasWidth,
          canvasHeight
        });
        console.log('✅ [MEDIA PUSH] Stored converter:', converterId, 'for pushId:', pushId);
      }
      
      return response;
    } catch (err) {
      // Frontend logs removed - check terminal for REST API error logs
      throw err;
    }
  }

  async updateMediaPushLayout(converterId) {
    if (!converterId) {
      throw new Error('Converter ID is required');
    }
    
    const converterInfo = this.activeMediaPushConverters.get(converterId);
    if (!converterInfo) {
      console.warn('⚠️ [MEDIA PUSH] Converter not found in active list:', converterId);
      return;
    }
    
    console.log('🔄 [MEDIA PUSH UPDATE] ============================================');
    console.log('🔄 [MEDIA PUSH UPDATE] Updating layout for converter:', converterId);
    console.log('🔄 [MEDIA PUSH UPDATE] Triggered by user join/leave event');
    
    // Get ALL current host users (existing + new) - this ensures we include everyone
    const allUsers = this.getAllHostUsers();
    const userCount = allUsers.length || 1;
    
    console.log('🔄 [MEDIA PUSH UPDATE] Current user count:', userCount);
    console.log('🔄 [MEDIA PUSH UPDATE] Users:', allUsers.map(u => `UID ${u.uid}${u.isMainHost ? ' (host)' : ''}`).join(', '));
    console.log('🔄 [MEDIA PUSH UPDATE] Canvas size:', converterInfo.canvasWidth, 'x', converterInfo.canvasHeight);
    
    // Recalculate ENTIRE layout from scratch - this ensures no overlaps and proper grid positioning
    // The layout array will completely replace the existing one
    // Pass users array so screen share can be prioritized
    const layout = this.calculateMediaPushLayout(userCount, converterInfo.canvasWidth, converterInfo.canvasHeight, allUsers);
    
    // Fill in actual UIDs for all users
    console.log('🔄 [MEDIA PUSH UPDATE] Assigning UIDs to layout positions (complete replacement):');
    for (let i = 0; i < layout.length && i < allUsers.length; i++) {
      layout[i].rtcStreamUid = allUsers[i].uid;
      const region = layout[i].region;
      console.log(`🔄 [MEDIA PUSH UPDATE]   Position ${i + 1}: UID ${allUsers[i].uid} at (${region.xPos}, ${region.yPos}) size ${region.width}x${region.height} zIndex=${region.zIndex}`);
    }
    
    // If no users yet, use main host UID
    if (layout.length > 0 && layout[0].rtcStreamUid === 0) {
      const hostNumericUid = this.hashUserIdToNumber(this.currentUser.rtmUserId);
      layout[0].rtcStreamUid = hostNumericUid;
      console.log('🔄 [MEDIA PUSH UPDATE]   Using main host UID as fallback:', hostNumericUid);
    }
    
    console.log('🔄 [MEDIA PUSH UPDATE] Final layout array (complete replacement):', JSON.stringify(layout, null, 2));
    console.log('🔄 [MEDIA PUSH UPDATE] Layout array length:', layout.length, '(will replace existing layout)');
    
    // Update using PATCH with fields parameter (in body as per Agora API)
    // The layout array will completely replace the existing layout (not merge)
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/rtmp-converters/${converterId}`;
    const body = {
      converter: {
        transcodeOptions: {
          videoOptions: {
            canvas: {
              width: converterInfo.canvasWidth,
              height: converterInfo.canvasHeight
            },
            bitrate: 800,
            frameRate: 15,
            layout: layout // Complete replacement of layout array with all users
          }
        }
      },
      fields: 'transcodeOptions.videoOptions.canvas,transcodeOptions.videoOptions.bitrate,transcodeOptions.videoOptions.frameRate,transcodeOptions.videoOptions.layout'
    };
    
    console.log('🔄 [MEDIA PUSH UPDATE] Layout array in request body:', layout.length, 'items');
    console.log('🔄 [MEDIA PUSH UPDATE] This will completely replace the existing layout array');
    console.log('🔄 [MEDIA PUSH UPDATE] Layout UIDs in request:', layout.map(l => l.rtcStreamUid).join(', '));
    console.log('🔄 [MEDIA PUSH UPDATE] Full layout array being sent:', JSON.stringify(layout, null, 2));
    
    console.log('🔄 [MEDIA PUSH UPDATE] Sending PATCH request to update layout...');
    console.log('🔄 [MEDIA PUSH UPDATE] Full request body:', JSON.stringify(body, null, 2));
    
    try {
      const response = await axios.patch(url, body);
      console.log('✅ [MEDIA PUSH UPDATE] Layout updated successfully!');
      console.log('✅ [MEDIA PUSH UPDATE] Response status:', response.status);
      console.log('✅ [MEDIA PUSH UPDATE] Response data:', JSON.stringify(response.data, null, 2));
      console.log('🔄 [MEDIA PUSH UPDATE] ============================================');
      return response;
    } catch (err) {
      console.error('❌ [MEDIA PUSH UPDATE] Layout update failed!');
      console.error('❌ [MEDIA PUSH UPDATE] Error message:', err.message);
      console.error('❌ [MEDIA PUSH UPDATE] Error status:', err.response?.status);
      console.error('❌ [MEDIA PUSH UPDATE] Error response:', err.response?.data);
      console.error('🔄 [MEDIA PUSH UPDATE] ============================================');
      throw err;
    }
  }

  async updateAllMediaPushLayouts() {
    // Update all active Media Push converters when users join/leave
    const converterCount = this.activeMediaPushConverters.size;
    if (converterCount === 0) {
      console.log('🔄 [MEDIA PUSH UPDATE] No active converters to update');
      return;
    }
    
    console.log('🔄 [MEDIA PUSH UPDATE] Updating', converterCount, 'active converter(s) due to user join/leave');
    
    for (const [converterId] of this.activeMediaPushConverters.entries()) {
      try {
        await this.updateMediaPushLayout(converterId);
        console.log('✅ [MEDIA PUSH UPDATE] Successfully updated converter:', converterId);
      } catch (err) {
        console.error('❌ [MEDIA PUSH UPDATE] Failed to update converter:', converterId, err.message);
      }
    }
  }

  async deleteMediaPush(converterId) {
    if (!converterId) {
      throw new Error('Converter ID is required');
    }
    
    // Verify this converter exists in our tracking
    const converterInfo = this.activeMediaPushConverters.get(converterId);
    if (converterInfo) {
      console.log('🔄 [MEDIA PUSH DELETE] Deleting converter:', converterId, 'for pushId:', converterInfo.pushId);
    } else {
      console.warn('⚠️ [MEDIA PUSH DELETE] Converter not found in active list:', converterId);
    }
    
    // Media Push delete uses: /v1/projects/{appid}/rtmp-converters/{id}
    const url = `/api/media-proxy?path=api.agora.io/v1/projects/${this.appId}/rtmp-converters/${converterId}`;
    
    // Frontend logs removed - check terminal for REST API logs
    
    try {
      const response = await axios.delete(url);
      
      // Remove from active converters after successful delete
      this.activeMediaPushConverters.delete(converterId);
      console.log('✅ [MEDIA PUSH DELETE] Removed converter from tracking:', converterId);
      
      return response;
    } catch (err) {
      // Even if delete fails, remove from tracking if it was a "not found" error
      if (err.response?.data?.reason === 'Resource is not found and destroyed.' || 
          err.message?.includes('not found')) {
        this.activeMediaPushConverters.delete(converterId);
        console.log('✅ [MEDIA PUSH DELETE] Removed converter from tracking (already deleted):', converterId);
      }
      // Frontend logs removed - check terminal for REST API error logs
      throw err;
    }
  }

  getRTMPURL(region) {
    // Get RTMP server URL based on region
    const rtmpServers = {
      'na': 'rtls-ingress-prod-na.agoramdn.com',
      'eu': 'rtls-ingress-prod-eu.agoramdn.com',
      'ap': 'rtls-ingress-prod-ap.agoramdn.com',
      'cn': 'rtls-ingress-prod-cn.agoramdn.com'
    };
    return rtmpServers[region] || rtmpServers['na'];
  }

  async startMediaGateway(options = {}) {
    // Media Gateway uses: /v1/projects/{appid}/rtls/ingress/streamkeys
    // Generate token for Media Gateway with specific UID
    const gatewayUid = options.uid || 888;
    const token = await this.fetchTokenFromBackend(this.channelName, gatewayUid, 'host', `${this.currentUser.userId}-gateway`, 'rtc');
    
    // Body format: { settings: { channel, uid, expiresAfter, token } }
    // Use default template if not specified (media_services uses templateId)
    // Media Gateway requires region in the path (default to 'na' for North America)
    // Media Gateway API format: https://api.agora.io/{region}/v1/projects/{appid}/rtls/ingress/streamkeys
    // Region options: na (North America), eu (Europe), ap (Asia Pacific), cn (China)
    // Default to 'na' - user can override via NEXT_PUBLIC_AGORA_REGION env var
    const region = process.env.NEXT_PUBLIC_AGORA_REGION || 'na';
    const url = `/api/media-proxy?path=api.agora.io/${region}/v1/projects/${this.appId}/rtls/ingress/streamkeys`;
    // Media Gateway stream key creation does NOT require token in the body
    // Token is only used when OBS connects to the stream, not when creating the key
    const body = {
      settings: {
        channel: this.channelName,
        uid: `${gatewayUid}`
      },
      expiresAfter: options.expiresAfter || 0 // 0 = never expires
    };
    
    // Add template if provided (for default templates)
    if (options.templateId) {
      body.settings.templateId = options.templateId;
    }
    
    // Get RTMP URL based on region
    const rtmpServer = this.getRTMPURL(region);
    const rtmpUrl = `rtmp://${rtmpServer}/live`;
    
    // Frontend logs removed - check terminal for REST API logs
    
    try {
      const response = await axios.post(url, body);
      
      // Add RTMP URL to response for UI
      if (response.data) {
        response.data.rtmpUrl = rtmpUrl;
        response.data.rtmpServer = rtmpServer;
        response.data.region = region;
      }
      
      return response;
    } catch (err) {
      console.error('❌ [MEDIA GATEWAY] ============================================');
      console.error('❌ [MEDIA GATEWAY] Request failed');
      console.error('❌ [MEDIA GATEWAY] Error message:', err.message);
      console.error('❌ [MEDIA GATEWAY] Error status:', err.response?.status);
      console.error('❌ [MEDIA GATEWAY] Full Error Response:', JSON.stringify(err.response?.data, null, 2));
      console.error('❌ [MEDIA GATEWAY] Request that failed:', JSON.stringify(body, null, 2));
      console.error('❌ [MEDIA GATEWAY] URL that failed:', url);
      console.error('❌ [MEDIA GATEWAY] ============================================');
      throw err;
    }
  }

  // AI Agent Logic
  async startAiAgent(prompt) {
    const url = `/api/agora-agents`;
    const body = {
      action: 'start',
      channelName: this.channelName,
      agentUid: 8888,
      clientUid: this.currentUser.userId,
      prompt: prompt
    };
    
    console.log('🤖 [AI AGENT] Starting AI Agent...');
    console.log('🤖 [AI AGENT] URL:', url);
    console.log('🤖 [AI AGENT] Request body:', JSON.stringify({ ...body, prompt: prompt?.substring(0, 100) + '...' }, null, 2));
    
    try {
      const response = await axios.post(url, body);
      console.log('✅ [AI AGENT] Response status:', response.status);
      console.log('✅ [AI AGENT] Response data:', JSON.stringify(response.data, null, 2));
      return response;
    } catch (err) {
      console.error('❌ [AI AGENT] Request failed:', err);
      console.error('❌ [AI AGENT] Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      throw err;
    }
  }

  // OBS WebSocket Methods
  async connectOBS(host, port, password) {
    // Close existing connection if any
    if (this.obsWebSocket) {
      this.obsWebSocket.close(1000, 'Reconnecting');
      this.obsWebSocket = null;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://${host}:${port}`);
      
      ws.onopen = () => {
        console.log('🎬 [OBS] WebSocket connection opened, waiting for Hello...');
      };
      
      ws.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Handle Hello (op: 0)
          if (data.op === 0) {
            console.log('🎬 [OBS] Received Hello, authenticating...');
            
            const helloData = data.d;
            const rpcVersion = helloData.rpcVersion || 1;
            
            // Check if authentication is required
            if (helloData.authentication) {
              const challenge = helloData.authentication.challenge;
              const salt = helloData.authentication.salt;
              
              const auth = await this.computeOBSAuth(password, salt, challenge);
              
              // Send Identify (op: 1) with authentication
              ws.send(JSON.stringify({
                op: 1,
                d: {
                  rpcVersion: rpcVersion,
                  authentication: auth
                }
              }));
            } else {
              // No authentication required
              ws.send(JSON.stringify({
                op: 1,
                d: {
                  rpcVersion: rpcVersion
                }
              }));
            }
          }
          
          // Handle Identified (op: 2)
          else if (data.op === 2) {
            console.log('✅ [OBS] Authenticated successfully (Identified)');
            // Set WebSocket reference immediately
            this.obsWebSocket = ws;
            
            // Notify UI that OBS is connected and ready (this will load profiles)
            if (this.onOBSConnected) {
              // Call in next tick to ensure WebSocket is fully set
              setTimeout(() => {
                this.onOBSConnected();
              }, 0);
            }
            
            // Start preview updates
            this.startOBSPreview();
            
            resolve(ws);
          }
          
          // Handle Events (op: 5)
          else if (data.op === 5) {
            const eventType = data.d?.eventType;
            
            if (eventType === 'ConnectionOpened') {
              console.log('✅ [OBS] Connection opened event received');
              // Ensure WebSocket reference is set
              this.obsWebSocket = ws;
              
              if (this.onOBSConnectionOpened) {
                this.onOBSConnectionOpened();
              }
            } else if (eventType === 'StreamStateChanged') {
              const outputState = data.d?.eventData?.outputState;
              console.log('📺 [OBS] Stream state changed:', outputState);
              
              if (this.onOBSStreamStateChanged) {
                this.onOBSStreamStateChanged(outputState);
              }
            } else if (eventType === 'ConnectionClosed') {
              console.log('❌ [OBS] Connection closed event received');
              this.obsWebSocket = null;
              this.stopOBSPreview();
              this.stopOBSPreviewPIP();
              
              if (this.onOBSConnectionClosed) {
                this.onOBSConnectionClosed();
              }
            }
          }
          
          // Handle RequestResponse (op: 7)
          else if (data.op === 7) {
            const requestId = data.d?.requestId;
            const pending = this.obsPendingRequests.get(requestId);
            
            if (pending) {
              this.obsPendingRequests.delete(requestId);
              
              // OBS WebSocket 5.x: requestStatus.code === 100 means success
              // Response data can be at data.d.responseData or directly in data.d
              if (data.d?.requestStatus && data.d.requestStatus.code === 100) {
                // Success - responseData might be at data.d.responseData or data.d
                const responseData = data.d.responseData !== undefined ? data.d.responseData : data.d;
                console.log('✅ [OBS] Request succeeded:', requestId, 'Response:', JSON.stringify(responseData, null, 2));
                pending.resolve(responseData);
              } else {
                // Error
                const errorMsg = data.d?.requestStatus?.comment || data.d?.requestStatus?.message || 'OBS request failed';
                const errorCode = data.d?.requestStatus?.code || 'unknown';
                console.error('❌ [OBS] Request failed:', requestId, 'Code:', errorCode, 'Message:', errorMsg, 'Full response:', JSON.stringify(data.d, null, 2));
                pending.reject(new Error(`${errorMsg} (code: ${errorCode})`));
              }
            } else {
              console.log('⚠️ [OBS] Request response received but no pending request found:', requestId, 'Available requests:', Array.from(this.obsPendingRequests.keys()));
            }
          }
        } catch (err) {
          console.error('❌ [OBS] Message handling error:', err);
        }
      };
      
      ws.onerror = (error) => {
        console.error('❌ [OBS] WebSocket error:', error);
        reject(error);
      };
      
      ws.onclose = (event) => {
        console.log('🎬 [OBS] WebSocket connection closed', event.code, event.reason);
        this.obsWebSocket = null;
        this.stopOBSPreview();
        this.stopOBSPreviewPIP();
        
        if (this.onOBSConnectionClosed) {
          this.onOBSConnectionClosed();
        }
      };
      
      // Timeout after 10 seconds
      setTimeout(() => {
        if (!this.obsWebSocket) {
          ws.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);
    });
  }

  async computeOBSAuth(password, salt, challenge) {
    // Step 1: secret = Base64(SHA256(password + salt))
    const passwordSalt = password + salt;
    const passwordSaltBytes = new TextEncoder().encode(passwordSalt);
    const passwordSaltHash = await crypto.subtle.digest('SHA-256', passwordSaltBytes);
    const secret = btoa(String.fromCharCode(...new Uint8Array(passwordSaltHash)));
    
    // Step 2: auth = Base64(SHA256(secret + challenge))
    const secretChallenge = secret + challenge;
    const secretChallengeBytes = new TextEncoder().encode(secretChallenge);
    const secretChallengeHash = await crypto.subtle.digest('SHA-256', secretChallengeBytes);
    const auth = btoa(String.fromCharCode(...new Uint8Array(secretChallengeHash)));
    
    return auth;
  }

  async disconnectOBS() {
    if (this.obsWebSocket) {
      this.obsWebSocket.close(1000, 'Client disconnect');
      this.obsWebSocket = null;
    }
    this.stopOBSPreview();
    this.stopOBSPreviewPIP();
    console.log('✅ [OBS] Disconnected from OBS');
  }

  async sendOBSRequest(requestType, requestData = {}) {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      throw new Error('OBS WebSocket not connected');
    }
    
    return new Promise((resolve, reject) => {
      const requestId = `req-${Date.now()}-${Math.random()}`;
      
      this.obsPendingRequests.set(requestId, { resolve, reject });
      
      this.obsWebSocket.send(JSON.stringify({
        op: 6,
        d: {
          requestType,
          requestId,
          requestData
        }
      }));
      
      // Timeout after 5 seconds
      setTimeout(() => {
        if (this.obsPendingRequests.has(requestId)) {
          this.obsPendingRequests.delete(requestId);
          reject(new Error('OBS request timeout'));
        }
      }, 5000);
    });
  }

  async startOBSPreview() {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    // Stop any existing preview
    this.stopOBSPreview();
    
    try {
      const sceneList = await this.sendOBSRequest('GetSceneList');
      if (sceneList && sceneList.currentProgramSceneName) {
        this.updateOBSPreview();
        // Update scene name every 2 seconds
        this.obsPreviewInterval = setInterval(() => this.updateOBSPreview(), 2000);
      }
    } catch (error) {
      console.error('❌ [OBS] Error starting preview:', error);
    }
  }

  async stopOBSPreview() {
    if (this.obsPreviewInterval) {
      clearInterval(this.obsPreviewInterval);
      this.obsPreviewInterval = null;
    }
  }

  async updateOBSPreview() {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      const sceneList = await this.sendOBSRequest('GetSceneList', {});
      const streamStatus = await this.sendOBSRequest('GetStreamStatus', {});
      
      // OBS WebSocket 5.x: scene name might be at different locations
      const sceneName = sceneList.currentProgramSceneName || sceneList.scenes?.[0]?.sceneName || sceneList.sceneName || null;
      
      if (!sceneName) {
        if (this.onOBSPreviewUpdate) {
          this.onOBSPreviewUpdate({ sceneName: null, isStreaming: false });
        }
        return;
      }
      
      // OBS WebSocket 5.x: outputActive might be at different locations
      const isStreaming = streamStatus?.outputActive || streamStatus?.outputState === 'OBS_WEBSOCKET_OUTPUT_STARTED' || false;
      
      if (this.onOBSPreviewUpdate) {
        this.onOBSPreviewUpdate({ sceneName, isStreaming });
      }
    } catch (error) {
      console.error('❌ [OBS] Preview update error:', error);
      // Still update with null to show error state
      if (this.onOBSPreviewUpdate) {
        this.onOBSPreviewUpdate({ sceneName: null, isStreaming: false });
      }
    }
  }

  async startOBSPreviewPIP() {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    this.stopOBSPreviewPIP();
    this.updateOBSPreviewPIP();
    // Update preview every 500ms for smooth video
    this.obsPIPInterval = setInterval(() => this.updateOBSPreviewPIP(), 500);
  }

  async stopOBSPreviewPIP() {
    if (this.obsPIPInterval) {
      clearInterval(this.obsPIPInterval);
      this.obsPIPInterval = null;
    }
  }

  async updateOBSPreviewPIP() {
    if (!this.obsWebSocket || this.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      const sceneList = await this.sendOBSRequest('GetSceneList');
      if (!sceneList || !sceneList.currentProgramSceneName) {
        if (this.onOBSPIPUpdate) {
          this.onOBSPIPUpdate(null);
        }
        return;
      }
      
      // Get screenshot of the program output
      const screenshot = await this.sendOBSRequest('GetSourceScreenshot', {
        sourceName: sceneList.currentProgramSceneName,
        imageFormat: 'png',
        imageWidth: 480,
        imageHeight: 270,
        imageCompressionQuality: 1
      });
      
      if (screenshot && screenshot.imageData && this.onOBSPIPUpdate) {
        this.onOBSPIPUpdate(screenshot.imageData);
      }
    } catch (error) {
      // Ignore errors silently
    }
  }

  // Ban all users from a channel (kicks everyone out)
  async banAllUsersFromChannel(channelName) {
    try {
      console.log('🚫 [BAN] Banning all users from channel:', channelName);
      console.log('🚫 [BAN] Ban request payload:', { channelName });
      
      const response = await fetch('/api/ban-users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channelName: channelName
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ban users from channel');
      }

      const data = await response.json();
      console.log('✅ [BAN] All users banned from channel:', channelName);
      return data;
    } catch (err) {
      console.error('❌ [BAN] Error banning users:', err);
      throw err;
    }
  }

  async leave() {
    console.log('🚪 [LEAVE] Leaving channel...');
    
    // Store channel name before leaving (for banning users)
    const channelName = this.currentChannelName || this.channelName;
    
    // If this is the main host leaving, notify all users to leave and ban them
    if (this.currentUser.role === 'host' && this.rtmClient && this.rtmLoggedIn && channelName) {
      try {
        console.log('📢 [LEAVE] Host leaving - notifying all users to leave...');
        // Send a message to all users in the channel to leave
        await this.rtmClient.publishMessage(
          channelName,
          JSON.stringify({ type: 'HOST_LEFT', message: 'The host has ended the stream' }),
          { enableOfflineMessaging: false }
        );
        console.log('✅ [LEAVE] Notification sent to all users');
      } catch (err) {
        console.error('❌ [LEAVE] Error sending leave notification:', err);
      }
    }
    
    // Reset join state flags
    this.isJoining = false;
    this.isJoined = false;
    this.isBroadcasting = false;
    
    // Stop screen share if active
    if (this.screenShareClient || this.localScreenTrack) {
      try {
        await this.stopScreenShare();
      } catch (err) {
        console.error('❌ [LEAVE] Error stopping screen share:', err);
      }
    }
    
    await this.unpublishTracks();
    
    if (this.rtcClient) {
      try {
        await this.rtcClient.leave();
        console.log('✅ [LEAVE] RTC client left');
      } catch (err) {
        console.error('❌ [LEAVE] Error leaving RTC:', err);
      }
    }
    
    if (this.rtmClient) {
      try {
        if (channelName) {
          await this.rtmClient.unsubscribe(channelName);
        }
        await this.rtmClient.logout();
        console.log('✅ [LEAVE] RTM client logged out');
      } catch (err) {
        console.error('❌ [LEAVE] Error logging out RTM:', err);
      }
    }
    
    // If host is leaving, ban all remaining users from the channel (after leaving)
    if (this.currentUser.role === 'host' && channelName) {
      try {
        console.log('🏁 [LEAVE] Host left - banning all remaining users from channel:', channelName);
        await this.banAllUsersFromChannel(channelName);
        console.log('✅ [LEAVE] All remaining users kicked from channel:', channelName);
      } catch (banError) {
        console.warn('⚠️ [LEAVE] Failed to kick users from channel, but continuing:', banError.message);
        console.warn('⚠️ [LEAVE] Ban error details:', banError);
      }
    }
    
    if (this.mediaPullPlayerId) {
      try {
        await this.deleteMediaPull();
      } catch (err) {
        console.error('❌ [LEAVE] Error deleting media pull:', err);
      }
    }
    
    // Clear channel name reference
    this.currentChannelName = null;
    
    console.log('✅ [LEAVE] Left channels and logged out');
  }

  // Cloud Recording Methods
  async acquireRecordingResource(channelName, recordingType) {
    try {
      const response = await fetch('/api/cloud-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'acquire',
          channelName,
          recordingType
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to acquire recording resource');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('❌ [RECORDING] Acquire error:', err);
      throw err;
    }
  }

  async startCloudRecording(channelName, recordingType, resourceId, webpageUrl = null) {
    try {
      const response = await fetch('/api/cloud-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          channelName,
          recordingType,
          resourceId,
          webpageUrl
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start recording');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('❌ [RECORDING] Start error:', err);
      throw err;
    }
  }

  async stopCloudRecording(channelName, recordingType, resourceId, sid) {
    try {
      const response = await fetch('/api/cloud-recording', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          channelName,
          recordingType,
          resourceId,
          sid
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to stop recording');
      }

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('❌ [RECORDING] Stop error:', err);
      throw err;
    }
  }

  // STT (Speech-to-Text) Methods
  async startSTT(config) {
    try {
      console.log('🎤 [STT] Starting STT with config:', config);
      
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          channelName: this.channelName,
          config: {
            ...config,
            name: config.name || this.channelName
          }
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to start STT');
      }

      const data = await response.json();
      if (data.agent_id) {
        this.sttAgentId = data.agent_id;
        this.sttConfig = config;
        console.log('✅ [STT] STT started with agent ID:', this.sttAgentId);
      }
      
      return data;
    } catch (err) {
      console.error('❌ [STT] Start error:', err);
      throw err;
    }
  }

  async stopSTT() {
    try {
      if (!this.sttAgentId) {
        throw new Error('No active STT session');
      }

      console.log('🎤 [STT] Stopping STT, agent ID:', this.sttAgentId);
      
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'stop',
          channelName: this.channelName,
          agentId: this.sttAgentId
        })
      });

      if (!response.ok) {
        let error = {};
        try {
          const text = await response.text();
          if (text) {
            error = JSON.parse(text);
          }
        } catch (e) {
          // If parsing fails, use empty object
        }
        throw new Error(error.error || 'Failed to stop STT');
      }

      // Check if response has content before parsing JSON
      const text = await response.text();
      let data = {};
      if (text && text.trim()) {
        try {
          data = JSON.parse(text);
        } catch (e) {
          // If parsing fails, use empty object (empty response is valid)
          data = { success: true };
        }
      } else {
        // Empty response is valid - just return success
        data = { success: true };
      }
      
      this.sttAgentId = null;
      this.sttConfig = null;
      console.log('✅ [STT] STT stopped');
      
      return data;
    } catch (err) {
      console.error('❌ [STT] Stop error:', err);
      throw err;
    }
  }

  async updateSTT(updateMask, updateConfig) {
    try {
      if (!this.sttAgentId) {
        throw new Error('No active STT session');
      }

      console.log('🎤 [STT] Updating STT, agent ID:', this.sttAgentId, 'Update mask:', updateMask);
      
      const response = await fetch('/api/stt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          channelName: this.channelName,
          agentId: this.sttAgentId,
          updateMask,
          config: updateConfig
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update STT');
      }

      const data = await response.json();
      // Update local config if needed
      if (updateConfig.translateConfig) {
        this.sttConfig = { ...this.sttConfig, translateConfig: updateConfig.translateConfig };
      }
      
      return data;
    } catch (err) {
      console.error('❌ [STT] Update error:', err);
      throw err;
    }
  }

  // Subscribe to transcription/translation languages for a specific user
  subscribeToSTTLanguages(uid, transcriptionLanguages = [], translationMap = new Map()) {
    this.sttSubscribedLanguages.set(uid, {
      transcription: transcriptionLanguages,
      translation: translationMap
    });
    console.log('🎤 [STT] Subscribed to languages for UID:', uid, {
      transcription: transcriptionLanguages,
      translation: Array.from(translationMap.entries())
    });
  }

  // Unsubscribe from STT languages for a user
  unsubscribeFromSTTLanguages(uid) {
    this.sttSubscribedLanguages.delete(uid);
    console.log('🎤 [STT] Unsubscribed from languages for UID:', uid);
  }
}

const agoraService = new AgoraService();
export default agoraService;

