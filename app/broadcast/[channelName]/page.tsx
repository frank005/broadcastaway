'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, 
  Users, Settings, Share2, Rocket, Download, Server, Bot, Play, Pause,
  Check, X, RefreshCw, Upload, Clock, Copy, HelpCircle, User, BarChart3, Circle, MoreVertical, Image, Palette, Sparkles
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import agoraService from '../../../src/services/agoraService';
import VideoPlayer from '../../components/VideoPlayer';

export default function BroadcastPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const channelName = (params?.channelName as string) || '';
  const [userName, setUserName] = useState<string>('');
  const [displayName, setDisplayName] = useState<string>('');
  
  // Extract display name (remove bc_ prefix and random suffix)
  useEffect(() => {
    if (channelName) {
      let cleaned = channelName.replace(/^bc_/, '');
      cleaned = cleaned.replace(/_\d+$/, '');
      cleaned = cleaned.replace(/_/g, ' ');
      setDisplayName(cleaned || channelName);
    }
  }, [channelName]);
  
  useEffect(() => {
    // Get from URL params first, then localStorage
    const urlName = searchParams?.get('name');
    if (urlName) {
      setUserName(urlName);
      localStorage.setItem('castaway_username', urlName);
    } else {
      const savedName = localStorage.getItem('castaway_username');
      if (savedName) {
        setUserName(savedName);
      }
    }
    
    // Listen for storage changes (when name is updated in Navigation)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'castaway_username' && e.newValue) {
        setUserName(e.newValue);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [searchParams]);

  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [promotionRequests, setPromotionRequests] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'participants', 'media'
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [rtmLoggedIn, setRtmLoggedIn] = useState(false);
  const [mediaTab, setMediaTab] = useState('pull'); // 'pull', 'push', 'gateway'
  const [pullUrl, setPullUrl] = useState('');
  const [pushUrls, setPushUrls] = useState<Array<{ id: string; url: string; converterId?: string }>>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState({
    videoQuality: '720p',
    audioQuality: '48kHz',
    lowLatency: false,
    autoStartBroadcast: false
  });
  const [isAiMode, setIsAiMode] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaPullState, setMediaPullState] = useState({
    isPlaying: false,
    volume: 100,
    seekPosition: 0,
    repeatTime: 1 // Default: play once
  });
  const [screenShareTrack, setScreenShareTrack] = useState<any>(null);
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [participants, setParticipants] = useState<string[]>([]);
  const [gatewayStreamKey, setGatewayStreamKey] = useState<string>('');
  const [gatewayServerUrl, setGatewayServerUrl] = useState<string>('');
  const [obsConnected, setObsConnected] = useState(false);
  const [obsPort, setObsPort] = useState<string>('4455');
  const [obsPassword, setObsPassword] = useState<string>('');
  const [showCamera, setShowCamera] = useState(true); // Toggle between camera and OBS control bar
  const [obsProfiles, setObsProfiles] = useState<string[]>([]);
  const [obsCurrentProfile, setObsCurrentProfile] = useState<string>('');
  const [obsNewProfileName, setObsNewProfileName] = useState<string>('');
  const [showNewProfileInput, setShowNewProfileInput] = useState(false);
  const [obsStreamingStatus, setObsStreamingStatus] = useState<string>('');
  const [obsPIPVisible, setObsPIPVisible] = useState(false);
  const [showOBSSettings, setShowOBSSettings] = useState(false);
  const [obsScenes, setObsScenes] = useState<string[]>([]);
  const [obsCurrentScene, setObsCurrentScene] = useState<string>('');
  const [obsSceneCollections, setObsSceneCollections] = useState<string[]>([]);
  const [obsCurrentSceneCollection, setObsCurrentSceneCollection] = useState<string>('');
  const [obsNewSceneCollectionName, setObsNewSceneCollectionName] = useState<string>('');
  const [obsShowNewSceneCollectionInput, setObsShowNewSceneCollectionInput] = useState(false);
  const [obsVideoSettings, setObsVideoSettings] = useState<any>(null);
  const [obsAudioSettings, setObsAudioSettings] = useState<any>(null);
  const [obsOutputSettings, setObsOutputSettings] = useState<any>(null);
  const [obsStreamServiceSettings, setObsStreamServiceSettings] = useState<any>(null);
  const [obsCurrentSceneItems, setObsCurrentSceneItems] = useState<any[]>([]);
  const [obsSettingsTab, setObsSettingsTab] = useState<string>('scenes'); // 'scenes', 'collections', 'profiles', 'video', 'audio', 'output', 'stream', 'sources'
  const [showOBSSetupInstructions, setShowOBSSetupInstructions] = useState(false);
  const [showOBSBar, setShowOBSBar] = useState(false);
  const [obsBarOpen, setObsBarOpen] = useState(false);
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<Map<number, any>>(new Map());
  const [clientStats, setClientStats] = useState<any>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAddedJoinMessageRef = useRef(false); // Prevent duplicate join messages
  const promotionMessagesRef = useRef<Set<string>>(new Set()); // Track promotion messages to prevent duplicates
  
  // Cloud Recording State
  const [showRecordingModal, setShowRecordingModal] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingComposite, setRecordingComposite] = useState(false);
  const [recordingWebpage, setRecordingWebpage] = useState(false);
  const [recordingSessions, setRecordingSessions] = useState<{
    composite?: { resourceId: string; sid: string };
    webpage?: { resourceId: string; sid: string };
  }>({});
  const [recordingLinks, setRecordingLinks] = useState<{
    composite?: { m3u8?: string; mp4?: string };
    webpage?: { m3u8?: string; mp4?: string };
  }>({});
  const [showRecordingLinksModal, setShowRecordingLinksModal] = useState(false);

  // Virtual Background State
  const [showVirtualBgModal, setShowVirtualBgModal] = useState(false);
  const [virtualBgType, setVirtualBgType] = useState<'none' | 'blur' | 'color' | 'image' | 'video'>('none');
  const [virtualBgColor, setVirtualBgColor] = useState('#4b2e83');
  const [virtualBgBlur, setVirtualBgBlur] = useState(2); // 1=Low, 2=Medium, 3=High
  const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [isVirtualBgEnabled, setIsVirtualBgEnabled] = useState(false);
  const virtualBgProcessorRef = useRef<any>(null);
  const previewVideoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true; // Prevent state updates after unmount
    
    // Monitor console for UID-BANNED errors
    const originalError = console.error;
    const errorHandler = (...args: any[]) => {
      const errorStr = args.map(arg => String(arg)).join(' ');
      if (errorStr.includes('UID-BANNED') || errorStr.includes('BANNED')) {
        console.log('🚫 [PAGE] UID-BANNED detected in console error');
        if (isMounted && agoraService.onKicked) {
          agoraService.onKicked('You have been banned from this channel');
        }
      }
      originalError.apply(console, args);
    };
    console.error = errorHandler;
    
    const init = async () => {
      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      if (!appId) {
        toast.error('Agora App ID not configured');
        return;
      }

      // Only initialize if we have a userName - don't initialize with empty string
      // This prevents creating RTM clients with "user_xxx" when userName isn't ready yet
      if (userName) {
        await agoraService.init(appId, userName);
      } else {
        console.log('⏸️ [PAGE] Waiting for userName before initializing Agora service...');
        return; // Exit early if no userName yet
      }
      
      // Load settings from localStorage (try user-specific first, then global)
      const savedSettings = userName 
        ? localStorage.getItem(`castaway_settings_${userName.charAt(0).toUpperCase()}`) 
        : null;
      const globalSettings = localStorage.getItem('castaway_user_settings');
      const settingsToLoad = savedSettings || globalSettings;
      let loadedSettings = settings;
      if (settingsToLoad) {
        try {
          const parsed = JSON.parse(settingsToLoad);
          loadedSettings = parsed;
          setSettings(parsed);
          // Apply quality settings to agoraService
          agoraService.setQualitySettings(parsed.videoQuality, parsed.audioQuality);
        } catch (e) {
          console.warn('Failed to parse saved settings:', e);
        }
      }
      
      
      // Load stream key from localStorage for this channel
      if (channelName) {
        const gatewayKey = `castaway_gateway_${channelName}`;
        const savedGateway = localStorage.getItem(gatewayKey);
        if (savedGateway) {
          try {
            const parsed = JSON.parse(savedGateway);
            setGatewayStreamKey(parsed.streamKey || '');
            setGatewayServerUrl(parsed.serverUrl || '');
          } catch (e) {
            console.warn('Failed to parse saved gateway:', e);
          }
        }
      }
      
      // Load OBS settings from localStorage
      const savedOBSPort = localStorage.getItem('castaway_obs_port');
      const savedOBSPassword = localStorage.getItem('castaway_obs_password');
      if (savedOBSPort) setObsPort(savedOBSPort);
      if (savedOBSPassword) setObsPassword(savedOBSPassword);
      
      // Load recording links from localStorage
      const savedRecordingLinks = localStorage.getItem(`castaway_recording_links_${channelName}`);
      if (savedRecordingLinks) {
        try {
          const parsed = JSON.parse(savedRecordingLinks);
          setRecordingLinks(parsed);
        } catch (e) {
          console.warn('Failed to parse saved recording links:', e);
        }
      }
      
      agoraService.onPromotionRequest = (userId: string) => {
        if (!isMounted) return;
        setPromotionRequests(prev => Array.from(new Set([...prev, userId])));
        toast(`${userId} requested to join the stage!`, { icon: '🙌' });
      };

      agoraService.onMessageReceived = (content: string, senderId: string) => {
        if (!isMounted) return;
        // Check if this is a recording state message (shouldn't happen from host, but handle it)
        try {
          const message = JSON.parse(content);
          if (message.type === 'RECORDING_STATE') {
            // This shouldn't happen from host, but handle it
            return;
          }
        } catch (e) {
          // Not JSON, treat as regular chat message
        }
        // Get display name from map, fallback to senderId if not found
        const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(senderId) || senderId;
        setChatMessages(prev => [...prev, { senderId: displayName, content, timestamp: new Date() }]);
      };

      agoraService.onParticipantsUpdate = (participantsList: string[]) => {
        if (!isMounted) return;
        setParticipants(participantsList);
        console.log('👥 [PAGE] Participants updated:', participantsList);
      };

      agoraService.onUserJoined = (userId: string) => {
        if (!isMounted) return;
        const timestamp = new Date().toLocaleTimeString();
        // Get display name from map, fallback to userId if not found
        const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] ${displayName} joined the channel`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onUserLeft = (userId: string) => {
        if (!isMounted) return;
        const timestamp = new Date().toLocaleTimeString();
        // Get display name from map, fallback to userId if not found
        const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] ${displayName} left the channel`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onTrackPublished = (user: any, type: string) => {
        if (!isMounted) return;
        if (type === 'video') {
          // Use RTM user ID if available, otherwise use RTC UID
          const displayName = user.rtmUserId || `User-${user.uid}`;
          user.displayName = displayName;
          setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
          console.log('👤 [PAGE] User published:', { uid: user.uid, displayName, hasVideo: !!user.videoTrack });
        }
      };

      agoraService.onTrackUnpublished = (user: any, type: string) => {
        if (!isMounted) return;
        if (type === 'video') {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
          // Remove stats for this user
          setStatsData(prev => {
            const newStats = new Map(prev);
            newStats.delete(user.uid);
            return newStats;
          });
        }
      };

      agoraService.onDemoted = (userId: string) => {
        if (!isMounted) return;
        // When a user is demoted, remove them from remoteUsers
        // This ensures the demote button stays in sync
        setRemoteUsers(prev => prev.filter(u => u.rtmUserId !== userId && u.displayName !== userId));
        console.log('👋 [PAGE] User demoted:', userId);
        
        // Add system message (prevent duplicates)
        const messageKey = `demote-${userId}`;
        if (!promotionMessagesRef.current.has(messageKey)) {
          promotionMessagesRef.current.add(messageKey);
          const timestamp = new Date().toLocaleTimeString();
          // Get display name from map, fallback to userId if not found
          const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
          setChatMessages(prev => [...prev, {
            senderId: 'System',
            content: `[${timestamp}] [System] ${displayName} has been moved back to audience`,
            timestamp: new Date(),
            isSystem: true
          }]);
        }
      };

      agoraService.onScreenShareStarted = () => {
        if (!isMounted) return;
        setIsScreenSharing(true);
        // Don't show screen share locally for the host - audience will see it via RTC
        // The screen share is published to the channel, so others can see it
        // Host doesn't need to see their own screen share locally
        console.log('🖥️ [PAGE] Screen share started - published to channel (audience will see it)');
        setScreenShareTrack(null); // Clear any previous screen share track
        
        // Add system message
        const timestamp = new Date().toLocaleTimeString();
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] Screen share started`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onScreenShareStopped = () => {
        if (!isMounted) return;
        setIsScreenSharing(false);
        setScreenShareTrack(null);
        
        // Remove stats for screen share user
        const screenShareUid = agoraService.screenShareClient?._screenShareUid;
        if (screenShareUid) {
          setStatsData(prev => {
            const newStats = new Map(prev);
            newStats.delete(screenShareUid);
            return newStats;
          });
        }
        
        // Add system message
        const timestamp = new Date().toLocaleTimeString();
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] Screen share stopped`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onKicked = (message: string) => {
        if (!isMounted) return;
        toast.error(message || 'You have been removed from the channel', { duration: 2000 });
        agoraService.leave().catch(console.error);
        router.push('/browse');
      };

      try {
        await agoraService.join(channelName, 'host');
        if (isMounted) {
          // Add system message for host joining (prevent duplicates)
          if (!hasAddedJoinMessageRef.current) {
            const timestamp = new Date().toLocaleTimeString();
            setChatMessages(prev => [...prev, {
              senderId: 'System',
              content: `[${timestamp}] [System] You subscribed to channel: ${channelName}`,
              timestamp: new Date(),
              isSystem: true
            }]);
            hasAddedJoinMessageRef.current = true;
          }
          // Host joined but not broadcasting yet - tracks will be created when startBroadcast() is called
          console.log('✅ [PAGE] Host joined, waiting for broadcast to start...');
          setIsBroadcasting(agoraService.isBroadcasting || false);
          
          // Check RTM login status
          setRtmLoggedIn(agoraService.rtmLoggedIn || false);
          if (!agoraService.rtmLoggedIn) {
            toast.error('RTM not logged in - Chat will not work', { duration: 5000 });
          }
          
          // Auto-start broadcast if enabled (check URL param first, then loaded settings)
          const urlAutoStart = searchParams?.get('autoStart') === 'true';
          const settingsAutoStart = loadedSettings.autoStartBroadcast;
          const shouldAutoStart = urlAutoStart || settingsAutoStart;
          
          if (shouldAutoStart && !agoraService.isBroadcasting) {
            console.log('🚀 [PAGE] Auto-starting broadcast...', { urlAutoStart, settingsAutoStart });
            // Small delay to ensure everything is ready
            setTimeout(async () => {
              try {
                await agoraService.startBroadcast();
                if (isMounted) {
                  setIsBroadcasting(true);
                  toast.success('Broadcast started automatically');
                }
              } catch (err: any) {
                console.error('❌ [PAGE] Auto-start broadcast failed:', err);
                if (isMounted) {
                  toast.error(`Auto-start failed: ${err.message}`);
                }
              }
            }, 500);
          }
        }
      } catch (err: any) {
        if (isMounted) {
          const errorMessage = err?.message || 'Failed to join channel';
          
          // Check if user is banned (UID-BANNED error)
          if (errorMessage.includes('UID-BANNED') || errorMessage.includes('BANNED')) {
            console.log('🚫 [PAGE] User is banned (UID-BANNED detected)');
            toast.error('You have been banned from this channel');
            agoraService.leave().catch(console.error);
            router.push('/browse');
            return;
          }
          
          toast.error(`Failed to join: ${errorMessage}`);
          console.error('❌ [PAGE] Join error:', err);
          console.error('❌ [PAGE] Error details:', {
            message: err?.message,
            code: err?.code,
            name: err?.name,
            stack: err?.stack
          });
        }
      }
    };

    init();

    return () => {
      isMounted = false; // Prevent state updates after cleanup
      console.error = originalError; // Restore original console.error
      agoraService.leave();
    };
  }, [channelName, userName]);

  // Load available devices
  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      
      // Set default selections if not set
      if (cameras.length > 0 && !selectedCamera) {
        setSelectedCamera(cameras[0].deviceId);
      }
      if (microphones.length > 0 && !selectedMicrophone) {
        setSelectedMicrophone(microphones[0].deviceId);
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  // Switch camera device
  const switchCamera = async (deviceId: string) => {
    if (!agoraService.localVideoTrack) return;
    try {
      await agoraService.localVideoTrack.setDevice(deviceId);
      setSelectedCamera(deviceId);
      toast.success('Camera switched');
    } catch (err: any) {
      toast.error(`Failed to switch camera: ${err.message}`);
    }
  };

  // Switch microphone device
  const switchMicrophone = async (deviceId: string) => {
    if (!agoraService.localAudioTrack) return;
    try {
      await agoraService.localAudioTrack.setDevice(deviceId);
      setSelectedMicrophone(deviceId);
      toast.success('Microphone switched');
    } catch (err: any) {
      toast.error(`Failed to switch microphone: ${err.message}`);
    }
  };

  // Load devices on mount
  useEffect(() => {
    loadDevices();
  }, []);

  const toggleMic = async () => {
    if (localAudioTrack) {
      const newState = !isMicOn;
      await localAudioTrack.setEnabled(newState);
      setIsMicOn(newState);
    }
  };

  const toggleCam = async () => {
    if (localVideoTrack) {
      const newState = !isCamOn;
      await localVideoTrack.setEnabled(newState);
      setIsCamOn(newState);
    }
  };

  const handleEndShow = async () => {
    try {
      await agoraService.endShow();
      setIsBroadcasting(false);
      setLocalVideoTrack(null);
      setLocalAudioTrack(null);
      toast.success('Show ended - you remain as host');
    } catch (err: any) {
      toast.error(`Failed to end show: ${err.message}`);
    }
  };

  const handleEndStream = async () => {
    const timestamp = new Date().toLocaleTimeString();
    setChatMessages(prev => [...prev, {
      senderId: 'System',
      content: `[${timestamp}] [System] You left the RTC channel`,
      timestamp: new Date(),
      isSystem: true
    }]);
    await agoraService.leave();
    router.push('/browse');
  };

  const handlePromote = async (userId: string) => {
    try {
      await agoraService.promoteUser(userId);
      setPromotionRequests(prev => prev.filter(id => id !== userId));
      // Get display name from map, fallback to userId if not found
      const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
      toast.success(`Promoted ${displayName} to stage`);
      console.log('✅ [PAGE] Promoted user:', userId);
      
      // Add system message (prevent duplicates)
      const messageKey = `promote-${userId}`;
      if (!promotionMessagesRef.current.has(messageKey)) {
        promotionMessagesRef.current.add(messageKey);
        const timestamp = new Date().toLocaleTimeString();
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] ${displayName} has been promoted to stage`,
          timestamp: new Date(),
          isSystem: true
        }]);
      }
    } catch (err: any) {
      console.error('❌ [PAGE] Failed to promote user:', err);
      toast.error(`Failed to promote ${userId}: ${err.message}`);
    }
  };

  const handleDemote = async (userId: string) => {
    try {
      await agoraService.demoteUser(userId);
      // Don't remove from remoteUsers immediately - let RTM events handle it
      // The demote will trigger RTM events that will update the state properly
      toast(`Demoted ${userId} from stage`, { icon: '👋' });
      console.log('✅ [PAGE] Demoted user:', userId);
    } catch (err: any) {
      console.error('❌ [PAGE] Failed to demote user:', err);
      toast.error(`Failed to demote ${userId}: ${err.message}`);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    if (!rtmLoggedIn) {
      toast.error('Chat is not available - RTM not logged in');
      return;
    }
    await agoraService.sendChatMessage(newMessage);
    setChatMessages(prev => [...prev, { senderId: 'You', content: newMessage, timestamp: new Date() }]);
    setNewMessage('');
  };

  const startStatsCollection = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
    }
    
    // Enable network quality monitoring
    if (agoraService.rtcClient) {
      try {
        agoraService.rtcClient.enableNetworkQuality?.();
      } catch (e) {
        console.warn('Failed to enable network quality:', e);
      }
    }
    
    statsIntervalRef.current = setInterval(async () => {
      if (!agoraService.rtcClient) return;
      
      try {
        // Get client stats
        const clientStatsData = agoraService.rtcClient.getRTCStats();
        setClientStats(clientStatsData);
        
        // Get remote video stats
        const remoteVideoStats = agoraService.rtcClient.getRemoteVideoStats();
        const remoteAudioStats = agoraService.rtcClient.getRemoteAudioStats();
        
        // Get network quality - this is async and returns a promise
        let networkQualityMap: any = {};
        try {
          if (agoraService.rtcClient.getRemoteNetworkQuality) {
            const remoteNetworkQuality = await agoraService.rtcClient.getRemoteNetworkQuality();
            // Convert to map with proper structure
            for (const uidStr in remoteNetworkQuality) {
              const quality = remoteNetworkQuality[uidStr];
              networkQualityMap[uidStr] = {
                uplink: quality.uplinkNetworkQuality || 0,
                downlink: quality.downlinkNetworkQuality || 0
              };
            }
          }
        } catch (e) {
          console.warn('Failed to get network quality:', e);
        }
        
        // Get local video/audio stats for host
        const localVideoStats = agoraService.rtcClient.getLocalVideoStats();
        const localAudioStats = agoraService.rtcClient.getLocalAudioStats();
        
        const newStats = new Map<number, any>();
        
        // Process each remote user
        Object.keys(remoteVideoStats || {}).forEach((uidStr) => {
          const uid = parseInt(uidStr);
          const videoStats = remoteVideoStats[uid];
          const audioStats = remoteAudioStats[uid];
          const networkQuality = networkQualityMap[uidStr] || { uplink: 0, downlink: 0 };
          
          newStats.set(uid, {
            video: videoStats,
            audio: audioStats,
            network: networkQuality,
            // receiveBitrate is in bps, convert to Kbps for display
            bitrate: ((videoStats?.receiveBitrate || videoStats?.receiveBitrateBig || 0) / 1000),
            // Add comprehensive stats like rtc-signaling (using correct property names)
            rtt: videoStats?.end2EndDelay || 0,
            videoLossRate: (videoStats?.packetLossRate || 0) * 100,
            videoPacketsLost: videoStats?.receivePacketsLost || 0, // Fixed: use receivePacketsLost not packetsLost
            audioLossRate: (audioStats?.packetLossRate || 0) * 100,
            audioPacketsLost: audioStats?.receivePacketsLost || 0, // Fixed: use receivePacketsLost for consistency
            resolution: `${videoStats?.receiveResolutionWidth || 0}x${videoStats?.receiveResolutionHeight || 0}`,
            fps: videoStats?.decodeFrameRate || 0,
            renderFps: videoStats?.renderFrameRate || 0, // Added: render frame rate like rtc-signaling
            codec: videoStats?.codecType || 'VP8',
            audioCodec: audioStats?.codecType || 'opus',
            audioBitrate: (audioStats?.receiveBitrate || 0) / 1000,
            audioJitter: audioStats?.jitter || 0,
            receiveDelay: videoStats?.receiveDelay || 0, // Added: receive delay like rtc-signaling
            transportDelay: videoStats?.transportDelay || 0 // Added: transport delay like rtc-signaling
          });
        });
        
        // Add local stats for host (if broadcasting) - use numeric UID
        if (isBroadcasting && localVideoTrack && localVideoStats) {
          const localNetworkQuality = { uplink: 0, downlink: 0 };
          try {
            const networkQuality = agoraService.rtcClient.getLocalNetworkQuality?.();
            if (networkQuality) {
              localNetworkQuality.uplink = networkQuality.uplinkNetworkQuality || 0;
              localNetworkQuality.downlink = networkQuality.downlinkNetworkQuality || 0;
            }
          } catch (e) {}
          
          // Use current user's numeric UID for local stats (from RTC client)
          const localUid = (agoraService.rtcClient as any)?._uid || -1;
          newStats.set(localUid, {
            video: localVideoStats,
            audio: localAudioStats,
            network: localNetworkQuality,
            // sendBitrate is in bps, convert to Kbps for display
            bitrate: ((localVideoStats?.sendBitrate || 0) / 1000),
            rtt: localVideoStats?.sendRttMs || 0,
            videoLossRate: (localVideoStats?.currentPacketLossRate || 0) * 100,
            videoPacketsLost: localVideoStats?.sendPacketsLost || 0,
            audioLossRate: (localAudioStats?.currentPacketLossRate || 0) * 100,
            audioPacketsLost: localAudioStats?.sendPacketsLost || 0,
            resolution: `${localVideoStats?.sendResolutionWidth || 0}x${localVideoStats?.sendResolutionHeight || 0}`,
            fps: localVideoStats?.sendFrameRate || 0,
            codec: localVideoStats?.codecType || 'VP8',
            audioCodec: localAudioStats?.codecType || 'opus',
            audioBitrate: (localAudioStats?.sendBitrate || 0) / 1000,
            audioJitter: localAudioStats?.sendJitterMs || 0,
            encodeDelay: localVideoStats?.encodeDelay || 0,
            targetBitrate: (localVideoStats?.targetSendBitrate || 0) / 1000,
            isLocal: true
          });
        }
        
        setStatsData(newStats);
      } catch (err) {
        console.error('Failed to collect stats:', err);
      }
    }, 1000); // Update every second
  };

  const stopStatsCollection = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  // Start stats collection immediately when broadcasting (for bandwidth indicators)
  useEffect(() => {
    if (isBroadcasting && agoraService.rtcClient) {
      startStatsCollection();
    } else {
      stopStatsCollection();
    }
    
    return () => {
      stopStatsCollection();
      // Clear stats on unmount
      setStatsData(new Map());
      setClientStats(null);
    };
  }, [isBroadcasting]);

  const handleStartBroadcast = async () => {
    try {
      await agoraService.startBroadcast();
      setIsBroadcasting(true);
      // Tracks should now be available
      setLocalVideoTrack(agoraService.localVideoTrack);
      setLocalAudioTrack(agoraService.localAudioTrack);
      toast.success('Broadcast started! Audience can now see you.');
      // Start statistics collection
      if (showStats) {
        startStatsCollection();
      }
    } catch (err: any) {
      toast.error(`Failed to start broadcast: ${err.message}`);
      console.error('❌ [PAGE] Start broadcast error:', err);
    }
  };

  const handleScreenShare = async () => {
    if (!isBroadcasting) {
      toast.error('Please start broadcasting first');
      return;
    }
    try {
      if (isScreenSharing) {
        await agoraService.stopScreenShare();
        toast.success('Screen share stopped');
      } else {
        await agoraService.startScreenShare();
        toast.success('Screen share started!');
      }
    } catch (err: any) {
      toast.error(`Screen share failed: ${err.message}`);
    }
  };

  // Virtual Background Presets
  const virtualBgPresets = {
    images: [
      {
        id: 'cat1',
        name: 'Yawning Cat',
        url: 'https://static6.depositphotos.com/1005348/610/i/450/depositphotos_6100822-stock-photo-yawning-cat.jpg',
        thumbnail: 'https://static6.depositphotos.com/1005348/610/i/450/depositphotos_6100822-stock-photo-yawning-cat.jpg'
      },
      {
        id: 'office',
        name: 'Modern Office',
        url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
        thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=400&h=300&fit=crop'
      },
      {
        id: 'nature',
        name: 'Nature Scene',
        url: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&h=1080&fit=crop',
        thumbnail: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=400&h=300&fit=crop'
      },
      {
        id: 'space',
        name: 'Space',
        url: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=1920&h=1080&fit=crop',
        thumbnail: 'https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=400&h=300&fit=crop'
      }
    ],
    videos: [
      {
        id: 'catvideo',
        name: 'Cat Video',
        url: 'https://cdn.pixabay.com/video/2016/05/11/3092-166221773_large.mp4',
        thumbnail: 'https://images.pexels.com/videos/2491284/pexels-photo-2491284.jpeg?auto=compress&cs=tinysrgb&dpr=1&w=400'
      }
    ]
  };

  // Load media with CORS handling
  const loadMediaWithCORS = async (url: string, type: 'img' | 'video'): Promise<HTMLImageElement | HTMLVideoElement> => {
    return new Promise((resolve, reject) => {
      if (type === 'img') {
        const img = document.createElement('img');
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      } else {
        const video = document.createElement('video');
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.onloadeddata = () => resolve(video);
        video.onerror = () => reject(new Error(`Failed to load video: ${url}`));
        video.src = url;
      }
    });
  };

  // Apply virtual background
  const applyVirtualBackground = async () => {
    if (!localVideoTrack || !agoraService.localVideoTrack) {
      toast.error('No video track available');
      return;
    }

    try {
      // Wait for VirtualBackgroundExtension to be available
      const waitForVB = () => {
        return new Promise((resolve, reject) => {
          let attempts = 0;
          const check = () => {
            attempts++;
            if ((window as any).VirtualBackgroundExtension) {
              resolve((window as any).VirtualBackgroundExtension);
            } else if (attempts >= 50) {
              reject(new Error('VirtualBackgroundExtension failed to load'));
            } else {
              setTimeout(check, 200);
            }
          };
          check();
        });
      };

      const VirtualBackgroundExtensionClass = await waitForVB() as any;
      const AgoraRTC = (window as any).AgoraRTC;

      if (!AgoraRTC) {
        toast.error('AgoraRTC not available');
        return;
      }

      // Remove existing processor if any
      if (virtualBgProcessorRef.current) {
        try {
          await agoraService.localVideoTrack.unpipe();
          await virtualBgProcessorRef.current.unpipe();
          await virtualBgProcessorRef.current.disable();
          await virtualBgProcessorRef.current.release();
          virtualBgProcessorRef.current = null;
        } catch (e) {
          console.warn('Error removing existing processor:', e);
        }
      }

      if (virtualBgType === 'none') {
        // Properly disable and remove the processor
        if (virtualBgProcessorRef.current) {
          try {
            await agoraService.localVideoTrack.unpipe();
            await virtualBgProcessorRef.current.unpipe();
            await virtualBgProcessorRef.current.disable();
            await virtualBgProcessorRef.current.release();
            virtualBgProcessorRef.current = null;
          } catch (e) {
            console.warn('Error removing processor:', e);
          }
        }
        setIsVirtualBgEnabled(false);
        
        // Force VideoPlayer to re-render to show original track
        if (localVideoTrack) {
          const updatedTrack = agoraService.localVideoTrack;
          setLocalVideoTrack(null);
          setTimeout(() => {
            setLocalVideoTrack(updatedTrack);
          }, 50);
        }
        
        toast.success('Virtual background disabled');
        return;
      }

      // Register extension
      const vb = new VirtualBackgroundExtensionClass();
      AgoraRTC.registerExtensions([vb]);

      // Create processor
      const processor = await vb.createProcessor();

      // Set up event handlers
      processor.eventBus?.on('PERFORMANCE_WARNING', () => {
        console.warn('Virtual background performance warning');
        toast.error('Virtual background performance warning');
      });

      processor.eventBus?.on('cost', (cost: number) => {
        console.log(`Virtual background cost: ${cost}`);
      });

      processor.onoverload = async () => {
        console.log('Virtual background overload');
        toast.error('Virtual background overload');
      };

      // Initialize processor
      await processor.init('not_needed');

      // Set options based on type
      const options: any = {
        type: virtualBgType === 'image' ? 'img' : virtualBgType === 'video' ? 'video' : virtualBgType,
        fit: 'cover'
      };

      if (virtualBgType === 'color') {
        options.color = virtualBgColor;
      } else if (virtualBgType === 'blur') {
        options.blurDegree = virtualBgBlur;
      } else if (virtualBgType === 'image') {
        if (!selectedPreset) {
          toast.error('Please select an image');
          return;
        }
        const preset = virtualBgPresets.images.find(p => p.id === selectedPreset);
        if (!preset) {
          toast.error('Selected image not found');
          return;
        }
        try {
          options.source = await loadMediaWithCORS(preset.url, 'img');
        } catch (error: any) {
          toast.error(`Failed to load image: ${error.message}`);
          return;
        }
      } else if (virtualBgType === 'video') {
        if (!selectedPreset) {
          toast.error('Please select a video');
          return;
        }
        const preset = virtualBgPresets.videos.find(p => p.id === selectedPreset);
        if (!preset) {
          toast.error('Selected video not found');
          return;
        }
        try {
          options.source = await loadMediaWithCORS(preset.url, 'video');
        } catch (error: any) {
          toast.error(`Failed to load video: ${error.message}`);
          return;
        }
      }

      processor.setOptions(options);
      await processor.enable();

      // Pipe the processor
      await agoraService.localVideoTrack.pipe(processor).pipe(agoraService.localVideoTrack.processorDestination);

      virtualBgProcessorRef.current = processor;
      setIsVirtualBgEnabled(true);
      
      // Force VideoPlayer to re-render by updating the track reference
      // This ensures the processed track is displayed
      if (localVideoTrack) {
        // Create a new object reference to trigger re-render
        const updatedTrack = agoraService.localVideoTrack;
        setLocalVideoTrack(null);
        setTimeout(() => {
          setLocalVideoTrack(updatedTrack);
        }, 50);
      }
      
      toast.success('Virtual background applied');
    } catch (error: any) {
      console.error('Error applying virtual background:', error);
      
      // Clean up processor if something went wrong
      if (virtualBgProcessorRef.current) {
        try {
          await agoraService.localVideoTrack.unpipe();
          await virtualBgProcessorRef.current.unpipe();
          await virtualBgProcessorRef.current.disable();
          await virtualBgProcessorRef.current.release();
          virtualBgProcessorRef.current = null;
        } catch (cleanupError) {
          console.warn('Error cleaning up processor:', cleanupError);
        }
      }
      setIsVirtualBgEnabled(false);
      
      toast.error(`Failed to apply virtual background: ${error.message}`);
    }
  };

  // Setup preview video when modal opens
  useEffect(() => {
    if (showVirtualBgModal && localVideoTrack && previewVideoRef.current) {
      const containerElement = previewVideoRef.current;
      // Clear any existing content
      containerElement.innerHTML = '';
      // Play the track on the preview container
      try {
        localVideoTrack.play(containerElement);
      } catch (err) {
        console.error('Error playing preview:', err);
      }
      return () => {
        // Don't stop the track as it's used for broadcasting
        // Just stop playing on this element
        try {
          if (containerElement) {
            localVideoTrack.stop(containerElement);
          }
        } catch (err) {
          // Ignore errors when stopping
        }
      };
    }
  }, [showVirtualBgModal, localVideoTrack]);

  const startPull = async () => {
    try {
      await agoraService.startMediaPull(pullUrl, mediaPullState.repeatTime);
      setMediaPullState(prev => ({ ...prev, isPlaying: true }));
      toast.success('Media pull started!');
    } catch (err) {
      toast.error('Failed to start media pull');
    }
  };

  const pauseMediaPull = async () => {
    try {
      await agoraService.updateMediaPull({ isPause: true });
      setMediaPullState(prev => ({ ...prev, isPlaying: false }));
      toast('Media paused');
    } catch (err) {
      toast.error('Failed to pause media');
    }
  };

  const playMediaPull = async () => {
    try {
      await agoraService.updateMediaPull({ isPause: false });
      setMediaPullState(prev => ({ ...prev, isPlaying: true }));
      toast('Media playing');
    } catch (err) {
      toast.error('Failed to play media');
    }
  };

  const updateMediaPullVolume = async (volume: number) => {
    try {
      await agoraService.updateMediaPull({ volume });
      setMediaPullState(prev => ({ ...prev, volume }));
    } catch (err) {
      toast.error('Failed to update volume');
    }
  };

  const seekMediaPull = async (position: number) => {
    try {
      await agoraService.updateMediaPull({ seekPosition: position });
      setMediaPullState(prev => ({ ...prev, seekPosition: position }));
      toast(`Seeked to ${position}s`);
    } catch (err) {
      toast.error('Failed to seek');
    }
  };

  const addPushDestination = () => {
    const newId = `push-${Date.now()}`;
    setPushUrls(prev => [...prev, { id: newId, url: '' }]);
  };

  const removePushDestination = (id: string) => {
    setPushUrls(prev => prev.filter(p => p.id !== id));
  };

  const updatePushUrl = (id: string, url: string) => {
    setPushUrls(prev => prev.map(p => p.id === id ? { ...p, url } : p));
  };

  const startPush = async (pushUrl: string, pushId: string) => {
    try {
      const res = await agoraService.startMediaPush(pushUrl, { id: pushId });
      // Store converter ID for stopping later
      const converterId = res.data?.converter?.id || res.data?.id || res.data?.converterId;
      setPushUrls(prev => prev.map(p => p.id === pushId ? { ...p, converterId } : p));
      toast.success('Media push started!');
    } catch (err: any) {
      toast.error(`Failed to start media push: ${err.message}`);
    }
  };

  const stopPush = async (pushId: string) => {
    try {
      const push = pushUrls.find(p => p.id === pushId);
      if (!push) {
        toast.error('Push destination not found');
        return;
      }
      
      if (push.converterId) {
        // Use the specific converterId for this push destination
        console.log('🛑 [MEDIA PUSH] Stopping push:', pushId, 'with converterId:', push.converterId);
        await agoraService.deleteMediaPush(push.converterId);
        setPushUrls(prev => prev.filter(p => p.id !== pushId));
        toast.success('Media push stopped!');
      } else {
        // No converterId means it was never started, just remove from UI
        console.log('🛑 [MEDIA PUSH] Removing unstarted push:', pushId);
        setPushUrls(prev => prev.filter(p => p.id !== pushId));
        toast('Push destination removed');
      }
    } catch (err: any) {
      // If delete fails (resource not found), still remove from UI
      if (err.response?.data?.reason === 'Resource is not found and destroyed.' || 
          err.message?.includes('not found')) {
        setPushUrls(prev => prev.filter(p => p.id !== pushId));
        toast('Media push already stopped');
      } else {
        toast.error(`Failed to stop media push: ${err.message}`);
      }
    }
  };

  // Helper function to update OBS stream key with proper format
  const updateOBSStreamKey = useCallback(async (streamKey: string, serverUrl: string, showToast: boolean = true) => {
    if (!streamKey || !serverUrl) {
      return;
    }
    
    // Check if OBS is connected
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    
    try {
      // OBS needs the full URL: rtmp://hostname/live
      // Ensure serverUrl has rtmp:// prefix and /live suffix
      let rtmpUrl = serverUrl;
      if (!rtmpUrl.startsWith('rtmp://')) {
        rtmpUrl = `rtmp://${rtmpUrl}`;
      }
      if (!rtmpUrl.endsWith('/live')) {
        rtmpUrl = `${rtmpUrl}/live`;
      }
      
      await agoraService.sendOBSRequest('SetStreamServiceSettings', {
        streamServiceType: 'rtmp_custom',
        streamServiceSettings: {
          server: rtmpUrl,
          key: streamKey
        }
      });
      
      if (showToast) {
        toast.success('Stream key updated in OBS');
      }
    } catch (obsErr: any) {
      console.warn('Failed to update stream key in OBS:', obsErr);
      if (showToast) {
        toast.error(`Failed to update stream key: ${obsErr.message}`);
      }
    }
  }, []);

  // Auto-update stream key to OBS whenever it changes
  useEffect(() => {
    if (gatewayStreamKey && gatewayServerUrl && obsConnected) {
      updateOBSStreamKey(gatewayStreamKey, gatewayServerUrl, false);
    }
  }, [gatewayStreamKey, gatewayServerUrl, obsConnected, updateOBSStreamKey]);

  const startGateway = async () => {
    try {
      // Don't use templateId: 'default' - it may not exist. Let Agora use default settings
      const res = await agoraService.startMediaGateway({});
      // Response format may vary - check for stream key in different locations
      const streamKey = res.data?.stream?.streamKey || res.data?.streamKey || res.data?.key || res.data?.data?.streamKey;
      // Use RTMP URL from agoraService (region-based) instead of hardcoded fallback
      const serverUrl = res.data?.rtmpUrl || res.data?.stream?.serverUrl || res.data?.serverUrl || res.data?.url || res.data?.data?.serverUrl;
      setGatewayStreamKey(streamKey || '');
      setGatewayServerUrl(serverUrl || '');
      
      // Save to localStorage per room/channel
      if (streamKey && serverUrl && channelName) {
        const storageKey = `castaway_gateway_${channelName}`;
        localStorage.setItem(storageKey, JSON.stringify({ streamKey, serverUrl }));
      }
      
      toast.success('Gateway stream key created!');
      console.log('Server URL:', serverUrl);
      console.log('Stream Key:', streamKey);
      
      // Auto-update stream key to OBS if connected
      await updateOBSStreamKey(streamKey, serverUrl);
    } catch (err) {
      toast.error('Failed to create gateway');
      console.error('Gateway error:', err);
    }
  };

  const connectOBS = async () => {
    if (!obsPassword) {
      toast.error('OBS WebSocket Password is required');
      return;
    }
    
    const host = '127.0.0.1';
    const port = parseInt(obsPort) || 4455;
    
    try {
      // Set up callbacks BEFORE connecting
      agoraService.onOBSConnected = async () => {
        console.log('✅ [OBS] Connected callback triggered, loading profiles...');
        // Set state first, then load data
        setObsConnected(true);
        
        // Auto-mute camera and mic when connecting to OBS
        if (agoraService.localVideoTrack) {
          agoraService.localVideoTrack.setEnabled(false);
          setIsCamOn(false);
        }
        if (agoraService.localAudioTrack) {
          agoraService.localAudioTrack.setEnabled(false);
          setIsMicOn(false);
        }
        setShowCamera(false);
        setShowOBSBar(true);
        
        // Start preview PIP automatically when OBS connects
        setTimeout(() => {
          if (!obsPIPVisible) {
            setObsPIPVisible(true);
            agoraService.startOBSPreviewPIP();
          }
        }, 500);
        
        // Wait a bit for state to propagate, then load profiles and scenes
        setTimeout(async () => {
          try {
            // Check WebSocket state directly to avoid race conditions
            if (agoraService.obsWebSocket && agoraService.obsWebSocket.readyState === WebSocket.OPEN) {
              await listOBSProfiles();
              await listOBSScenes();
            }
          } catch (err: any) {
            console.error('Failed to load OBS data:', err);
          }
        }, 100);
      };
      
      agoraService.onOBSConnectionOpened = () => {
        toast.success('Connected to OBS!');
      };
      
      agoraService.onOBSStreamStateChanged = (outputState: string) => {
        console.log('📺 [OBS] Stream state changed:', outputState);
        // You can add UI updates here if needed
      };
      
      // Set up preview update callback
      agoraService.onOBSPreviewUpdate = (data: any) => {
        const previewBarEl = document.getElementById("obs-preview-bar");
        const previewStatusBarEl = document.getElementById("obs-preview-status-bar");
        const previewMainEl = document.getElementById("obs-preview-main");
        
        if (data && data.sceneName) {
          const statusText = data.isStreaming ? '●' : '○';
          const statusColor = data.isStreaming ? 'text-red-400' : 'text-gray-400';
          
          if (previewBarEl) {
            previewBarEl.innerHTML = `
              <div class="flex flex-col items-center justify-center h-full">
                <div class="${statusColor} text-xs">${statusText}</div>
                <div class="text-gray-300 text-[8px] text-center truncate w-full">${data.sceneName}</div>
              </div>
            `;
          }
          if (previewStatusBarEl) {
            previewStatusBarEl.textContent = data.sceneName;
          }
          if (previewMainEl) {
            previewMainEl.innerHTML = `
              <div class="w-full h-full flex flex-col items-center justify-center p-4">
                <div class="${statusColor} text-2xl mb-2">${statusText}</div>
                <div class="text-gray-300 text-sm text-center">${data.sceneName}</div>
                ${data.isStreaming ? '<div class="text-red-400 text-xs mt-1">Streaming</div>' : ''}
              </div>
            `;
          }
        } else {
          if (previewBarEl) previewBarEl.innerHTML = '<div class="text-[10px]">OBS</div>';
          if (previewMainEl) {
            previewMainEl.innerHTML = '<div class="text-gray-500 text-sm">OBS Preview - Scene information will appear here</div>';
          }
        }
      };
      
      // Set up OBS PIP preview update callback
      agoraService.onOBSPIPUpdate = (imageData: string | null) => {
        const pipContent = document.getElementById('obs-preview-pip-content');
        const previewMainEl = document.getElementById('obs-preview-main');
        
        if (imageData) {
          // imageData from OBS is already base64, check if it has the data URL prefix
          const imageSrc = imageData.startsWith('data:') ? imageData : `data:image/png;base64,${imageData}`;
          
          if (pipContent) {
            pipContent.innerHTML = `<img src="${imageSrc}" alt="OBS Preview" style="width: 100%; height: 100%; object-fit: contain;" />`;
          }
          
          // Also update main preview when showing OBS (not camera)
          if (previewMainEl && !showCamera && obsConnected) {
            previewMainEl.innerHTML = `<img src="${imageSrc}" alt="OBS Preview" style="width: 100%; height: 100%; object-fit: contain;" />`;
          }
        } else {
          if (pipContent) {
            pipContent.innerHTML = '';
          }
          if (previewMainEl && !showCamera && obsConnected) {
            previewMainEl.innerHTML = '<div class="text-gray-500 text-sm">OBS Preview - Waiting for preview...</div>';
          }
        }
      };
      
      // Now connect to OBS
      await agoraService.connectOBS(host, port, obsPassword);
      
      // Preview updates are started automatically in connectOBS when op: 2 is received
    } catch (err: any) {
      console.error('❌ [OBS] Connection error:', err);
      toast.error(`Failed to connect: ${err.message}`);
    }
  };

  const disconnectOBS = async () => {
    await agoraService.disconnectOBS();
    setObsConnected(false);
    setShowOBSBar(false);
    
    // Re-enable camera when disconnecting from OBS
    if (agoraService.localVideoTrack) {
      agoraService.localVideoTrack.setEnabled(true);
    }
    setShowCamera(true);
    toast('OBS disconnected');
  };

  // OBS Preview functions now handled by agoraService

  const switchToCamera = () => {
    setShowCamera(true);
    // Re-enable camera and update state
    if (agoraService.localVideoTrack) {
      agoraService.localVideoTrack.setEnabled(true);
      setIsCamOn(true); // Update camera state
    }
  };

  const switchToOBS = () => {
    setShowCamera(false);
    // Disable camera when switching to OBS
    if (agoraService.localVideoTrack) {
      agoraService.localVideoTrack.setEnabled(false);
    }
  };

  // OBS Profile Management
  const listOBSProfiles = async () => {
    // Check WebSocket state directly instead of obsConnected state
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetProfileList', {});
      // OBS WebSocket 5.x: profiles might be at response.profiles or response
      const profiles = response.profiles || (Array.isArray(response) ? response : []);
      const currentProfile = response.currentProfileName || response.currentProfile || '';
      setObsProfiles(profiles);
      setObsCurrentProfile(currentProfile);
      console.log('✅ [OBS] Profiles loaded:', profiles.length, 'Current:', currentProfile);
      if (profiles.length > 0) {
        toast.success('Profiles loaded');
      } else {
        toast('No profiles found');
      }
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load profiles:', err);
      toast.error(`Failed to load profiles: ${err.message}`);
    }
  };

  const handleProfileSelectChange = (value: string) => {
    if (value === '__create_new__') {
      setShowNewProfileInput(true);
    } else {
      setShowNewProfileInput(false);
      setObsNewProfileName('');
      if (value) {
        updateOBSProfile(value);
      }
    }
  };

  const updateOBSProfile = async (profileName?: string) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    const profile = profileName || obsCurrentProfile;
    if (!profile) {
      toast.error('Please select a profile');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetCurrentProfile', { profileName: profile });
      
      // If we have a stream key, set it in OBS
      if (gatewayStreamKey && gatewayServerUrl) {
        await updateOBSStreamKey(gatewayStreamKey, gatewayServerUrl, false);
        toast.success('Profile updated with stream key');
      } else {
        toast.success('Profile updated');
      }
      setObsCurrentProfile(profile);
    } catch (err: any) {
      toast.error(`Failed to update profile: ${err.message}`);
    }
  };

  const createOBSProfile = async () => {
    if (!obsNewProfileName.trim()) {
      toast.error('Please enter a profile name');
      return;
    }
    try {
      await agoraService.sendOBSRequest('CreateProfile', { profileName: obsNewProfileName });
      await agoraService.sendOBSRequest('SetCurrentProfile', { profileName: obsNewProfileName });
      toast.success(`Profile "${obsNewProfileName}" created`);
      setObsNewProfileName('');
      setShowNewProfileInput(false);
      await listOBSProfiles();
    } catch (err: any) {
      toast.error(`Failed to create profile: ${err.message}`);
    }
  };

  const getOBSStreamStatus = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetStreamStatus', {});
      if (response.outputActive) {
        const duration = response.totalStreamTime || 0;
        const hours = Math.floor(duration / 3600);
        const minutes = Math.floor((duration % 3600) / 60);
        const seconds = duration % 60;
        const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        setObsStreamingStatus(`Streaming: ${timeStr}`);
        toast.success(`Streaming for ${timeStr}`);
      } else {
        setObsStreamingStatus('Not streaming');
        toast('Not currently streaming');
      }
    } catch (err: any) {
      toast.error(`Failed to get status: ${err.message}`);
    }
  };

  const startOBSStream = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      setObsStreamingStatus('Starting stream...');
      await agoraService.sendOBSRequest('StartStream', {});
      setObsStreamingStatus('Stream start requested');
      toast.success('Stream start requested');
    } catch (err: any) {
      setObsStreamingStatus(`Error: ${err.message}`);
      toast.error(`Failed to start stream: ${err.message}`);
    }
  };

  const stopOBSStream = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      setObsStreamingStatus('Stopping stream...');
      await agoraService.sendOBSRequest('StopStream', {});
      setObsStreamingStatus('Stream stop requested');
      toast.success('Stream stop requested');
    } catch (err: any) {
      setObsStreamingStatus(`Error: ${err.message}`);
      toast.error(`Failed to stop stream: ${err.message}`);
    }
  };

  const toggleOBSPreviewPIP = () => {
    const newState = !obsPIPVisible;
    setObsPIPVisible(newState);
    if (newState) {
      agoraService.startOBSPreviewPIP();
      // Callback is already set up in connectOBS
    } else {
      agoraService.stopOBSPreviewPIP();
      // Clear main preview when PIP is closed
      const previewMainEl = document.getElementById('obs-preview-main');
      if (previewMainEl) {
        previewMainEl.innerHTML = '<div class="text-gray-500 text-sm">OBS Preview - Click Preview PIP to see live preview</div>';
      }
    }
  };

  // OBS Scene Management
  const listOBSScenes = async () => {
    // Check WebSocket state directly instead of obsConnected state
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetSceneList', {});
      // OBS WebSocket 5.x: scenes might be at response.scenes or response
      const scenes = response.scenes || (Array.isArray(response) ? response : []);
      const sceneNames = scenes.map((s: any) => s.sceneName || s.name || s);
      const currentScene = response.currentProgramSceneName || response.currentScene || sceneNames[0] || '';
      setObsScenes(sceneNames);
      setObsCurrentScene(currentScene);
      console.log('✅ [OBS] Scenes loaded:', sceneNames.length, 'Current:', currentScene);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load scenes:', err);
      toast.error(`Failed to load scenes: ${err.message}`);
    }
  };

  const setOBSScene = async (sceneName: string) => {
    // Check WebSocket state directly instead of obsConnected state
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetCurrentProgramScene', { sceneName });
      setObsCurrentScene(sceneName);
      toast.success(`Switched to scene: ${sceneName}`);
      // Refresh scene list to update current scene
      await listOBSScenes();
      await loadOBSSceneItems(sceneName);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to set scene:', err);
      toast.error(`Failed to set scene: ${err.message}`);
    }
  };

  // OBS Scene Collections Management
  const listOBSSceneCollections = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetSceneCollectionList', {});
      const collections = response.sceneCollections || (Array.isArray(response) ? response : []);
      const currentCollection = response.currentSceneCollectionName || response.currentSceneCollection || '';
      setObsSceneCollections(collections);
      setObsCurrentSceneCollection(currentCollection);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load scene collections:', err);
      toast.error(`Failed to load scene collections: ${err.message}`);
    }
  };

  const setOBSSceneCollection = async (collectionName: string) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetCurrentSceneCollection', { sceneCollectionName: collectionName });
      setObsCurrentSceneCollection(collectionName);
      toast.success(`Switched to scene collection: ${collectionName}`);
      await listOBSSceneCollections();
      await listOBSScenes();
    } catch (err: any) {
      console.error('❌ [OBS] Failed to set scene collection:', err);
      toast.error(`Failed to set scene collection: ${err.message}`);
    }
  };

  const createOBSSceneCollection = async () => {
    if (!obsNewSceneCollectionName.trim()) {
      toast.error('Please enter a scene collection name');
      return;
    }
    try {
      await agoraService.sendOBSRequest('CreateSceneCollection', { sceneCollectionName: obsNewSceneCollectionName });
      await agoraService.sendOBSRequest('SetCurrentSceneCollection', { sceneCollectionName: obsNewSceneCollectionName });
      toast.success(`Scene collection "${obsNewSceneCollectionName}" created`);
      setObsNewSceneCollectionName('');
      setObsShowNewSceneCollectionInput(false);
      await listOBSSceneCollections();
    } catch (err: any) {
      toast.error(`Failed to create scene collection: ${err.message}`);
    }
  };

  // OBS Video Settings
  const loadOBSVideoSettings = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetVideoSettings', {});
      setObsVideoSettings(response);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load video settings:', err);
    }
  };

  const updateOBSVideoSettings = async (settings: any) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetVideoSettings', settings);
      toast.success('Video settings updated');
      await loadOBSVideoSettings();
    } catch (err: any) {
      toast.error(`Failed to update video settings: ${err.message}`);
    }
  };

  // OBS Audio Settings
  const loadOBSAudioSettings = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetAudioSettings', {});
      setObsAudioSettings(response);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load audio settings:', err);
    }
  };

  const updateOBSAudioSettings = async (settings: any) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetAudioSettings', settings);
      toast.success('Audio settings updated');
      await loadOBSAudioSettings();
    } catch (err: any) {
      toast.error(`Failed to update audio settings: ${err.message}`);
    }
  };

  // OBS Output Settings
  const loadOBSOutputSettings = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetOutputSettings', {});
      setObsOutputSettings(response);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load output settings:', err);
    }
  };

  const updateOBSOutputSettings = async (settings: any) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      toast.error('Please connect to OBS first');
      return;
    }
    try {
      await agoraService.sendOBSRequest('SetOutputSettings', settings);
      toast.success('Output settings updated');
      await loadOBSOutputSettings();
    } catch (err: any) {
      toast.error(`Failed to update output settings: ${err.message}`);
    }
  };

  // OBS Stream Service Settings
  const loadOBSStreamServiceSettings = async () => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const response = await agoraService.sendOBSRequest('GetStreamServiceSettings', {});
      setObsStreamServiceSettings(response);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load stream service settings:', err);
    }
  };

  // OBS Scene Items (Sources)
  const loadOBSSceneItems = async (sceneName?: string) => {
    if (!agoraService.obsWebSocket || agoraService.obsWebSocket.readyState !== WebSocket.OPEN) {
      return;
    }
    try {
      const scene = sceneName || obsCurrentScene;
      if (!scene) {
        setObsCurrentSceneItems([]);
        return;
      }
      const response = await agoraService.sendOBSRequest('GetSceneItemList', { sceneName: scene });
      const items = response.sceneItems || (Array.isArray(response) ? response : []);
      setObsCurrentSceneItems(items);
    } catch (err: any) {
      console.error('❌ [OBS] Failed to load scene items:', err);
      setObsCurrentSceneItems([]);
    }
  };

  // Helper function to generate S3 recording URL
  const generateRecordingUrl = (
    bucket: string,
    vendor: number,
    region: number,
    fileNamePrefix: string[],
    fileName: string
  ): string => {
    // S3 region mapping (vendor 1 = Amazon S3)
    const s3Regions: { [key: number]: string } = {
      0: 'us-east-1',
      1: 'us-east-2',
      2: 'us-west-1',
      3: 'us-west-2',
      4: 'eu-west-1',
      5: 'eu-west-2',
      6: 'eu-west-3',
      7: 'eu-central-1',
      8: 'ap-southeast-1',
      9: 'ap-southeast-2',
      10: 'ap-northeast-1',
      11: 'ap-northeast-2',
      12: 'sa-east-1',
      13: 'ca-central-1',
      14: 'ap-south-1',
      15: 'cn-north-1',
      16: 'cn-northwest-1',
      18: 'af-south-1',
      19: 'ap-east-1',
      20: 'ap-northeast-3',
      21: 'eu-north-1',
      22: 'me-south-1',
      24: 'ap-southeast-3',
      25: 'eu-south-1'
    };

    if (vendor === 1) {
      // Amazon S3
      const regionStr = s3Regions[region] || 'us-east-1';
      const prefixPath = fileNamePrefix.join('/');
      
      // Check if fileName already includes a path (contains slashes)
      // Agora may return just the filename or the full path
      let filePath: string;
      
      if (fileName.includes('/')) {
        // File name already includes the full path (e.g., "BroadCastaway/composite/2025/12/23/summer/37279fd86a4b1620b24306be5369d171_summer_0.mp4")
        // Use it as-is - Agora returns the full path
        filePath = fileName;
      } else {
        // File name is just the filename (e.g., "37279fd86a4b1620b24306be5369d171_summer_0.mp4")
        // Prepend the prefix path
        filePath = `${prefixPath}/${fileName}`;
      }
      
      // Ensure no double slashes and remove leading slash
      filePath = filePath.replace(/\/+/g, '/').replace(/^\//, '');
      
      return `https://${bucket}.s3.${regionStr}.amazonaws.com/${filePath}`;
    }
    
    // For other vendors, return empty string (can be extended later)
    return '';
  };

  const toggleAiMode = async () => {
    const newState = !isAiMode;
    setIsAiMode(newState);
    if (newState) {
      try {
        toast.loading('Starting AI Agent...', { id: 'ai-agent' });
        await agoraService.startAiAgent('You are a live shopping assistant. Help the host sell products.');
        toast.success('AI Agent is now active!', { id: 'ai-agent' });
      } catch (err) {
        toast.error('Failed to start AI Agent', { id: 'ai-agent' });
        setIsAiMode(false);
      }
    } else {
      toast('AI Agent stopped', { id: 'ai-agent' });
    }
  };

  // Cloud Recording Handlers
  const handleStartRecording = async () => {
    if (!recordingComposite && !recordingWebpage) {
      toast.error('Please select at least one recording type');
      return;
    }

    try {
      const sessions: any = {};

      // Start composite recording if selected
      if (recordingComposite) {
        toast.loading('Starting composite recording...', { id: 'recording-composite' });
        const acquireRes = await agoraService.acquireRecordingResource(channelName, 'composite');
        const startRes = await agoraService.startCloudRecording(channelName, 'composite', acquireRes.resourceId);
        sessions.composite = {
          resourceId: acquireRes.resourceId,
          sid: startRes.sid
        };
        toast.success('Composite recording started!', { id: 'recording-composite' });
      }

      // Start webpage recording if selected
      if (recordingWebpage) {
        toast.loading('Starting webpage recording...', { id: 'recording-webpage' });
        const acquireRes = await agoraService.acquireRecordingResource(channelName, 'web');
        const webpageUrl = `${window.location.origin}/watch/${channelName}?name=Recording&uid=${process.env.NEXT_PUBLIC_RECORDING_WEBPAGE_UID || '8888888'}`;
        // @ts-ignore - webpageUrl is optional string parameter
        const startRes = await agoraService.startCloudRecording(channelName, 'web', acquireRes.resourceId, webpageUrl);
        sessions.webpage = {
          resourceId: acquireRes.resourceId,
          sid: startRes.sid
        };
        toast.success('Webpage recording started!', { id: 'recording-webpage' });
      }

      setRecordingSessions(sessions);
      setIsRecording(true);
      setShowRecordingModal(false);
      setRecordingLinks({}); // Clear previous links when starting new recording
      // Clear from localStorage
      localStorage.removeItem(`castaway_recording_links_${channelName}`);
      
      // Broadcast recording state to all users via RTM
      if (agoraService.rtmChannel && agoraService.rtmLoggedIn) {
        try {
          await agoraService.rtmChannel.publishMessage(
            JSON.stringify({ type: 'RECORDING_STATE', isRecording: true })
          );
        } catch (err) {
          console.error('Failed to broadcast recording state:', err);
        }
      }
    } catch (err: any) {
      toast.error(`Failed to start recording: ${err.message}`);
      console.error('Recording error:', err);
    }
  };

  const handleStopRecording = async () => {
    // Always reset UI state, even if API calls fail
    const resetUIState = () => {
      setRecordingSessions({});
      setIsRecording(false);
      setRecordingComposite(false);
      setRecordingWebpage(false);
      // Note: Don't clear recordingLinks here - they should persist after stopping
      
      // Broadcast recording state to all users via RTM
      if (agoraService.rtmChannel && agoraService.rtmLoggedIn) {
        try {
          agoraService.rtmChannel.publishMessage(
            JSON.stringify({ type: 'RECORDING_STATE', isRecording: false })
          ).catch((err: any) => {
            console.error('Failed to broadcast recording state:', err);
          });
        } catch (err: any) {
          console.error('Failed to broadcast recording state:', err);
        }
      }
    };

    try {
      // Stop composite recording if active
      if (recordingSessions.composite) {
        toast.loading('Stopping composite recording...', { id: 'stop-composite' });
        try {
          const stopRes = await agoraService.stopCloudRecording(
            channelName,
            'composite',
            recordingSessions.composite.resourceId,
            recordingSessions.composite.sid
          );
          
          // Extract file names and generate URLs
          if (stopRes.serverResponse?.fileList && stopRes.storageConfig) {
            const fileList = stopRes.serverResponse.fileList;
            const { bucket, vendor, region, fileNamePrefix } = stopRes.storageConfig;
            
            let m3u8Url = '';
            let mp4Url = '';
            
            fileList.forEach((file: any) => {
              // Handle both object format {fileName: "..."} and string format
              const fileName = typeof file === 'string' ? file : (file.fileName || file);
              if (fileName && typeof fileName === 'string') {
                if (fileName.endsWith('.m3u8')) {
                  m3u8Url = generateRecordingUrl(bucket, vendor, region, fileNamePrefix, fileName);
                } else if (fileName.endsWith('.mp4')) {
                  mp4Url = generateRecordingUrl(bucket, vendor, region, fileNamePrefix, fileName);
                }
              }
            });
            
            if (m3u8Url || mp4Url) {
              setRecordingLinks((prev: any) => {
                const updatedLinks = {
                  ...prev,
                  composite: { m3u8: m3u8Url || undefined, mp4: mp4Url || undefined }
                };
                // Save to localStorage
                localStorage.setItem(`castaway_recording_links_${channelName}`, JSON.stringify(updatedLinks));
                return updatedLinks;
              });
            }
          }
          
          toast.success('Composite recording stopped!', { id: 'stop-composite' });
        } catch (err: any) {
          // Check if it's a "not found" or "already stopped" error
          const errorMsg = err.message?.toLowerCase() || '';
          if (errorMsg.includes('not found') || errorMsg.includes('already stopped') || errorMsg.includes('resource')) {
            toast('Composite recording was already stopped', { id: 'stop-composite' });
          } else {
            toast.error(`Failed to stop composite recording: ${err.message}`, { id: 'stop-composite' });
          }
          console.warn('Composite recording stop error (continuing anyway):', err);
        }
      }

      // Stop webpage recording if active
      if (recordingSessions.webpage) {
        toast.loading('Stopping webpage recording...', { id: 'stop-webpage' });
        try {
          const stopRes = await agoraService.stopCloudRecording(
            channelName,
            'web',
            recordingSessions.webpage.resourceId,
            recordingSessions.webpage.sid
          );
          
          // Extract file names and generate URLs
          if (stopRes.serverResponse?.fileList && stopRes.storageConfig) {
            const fileList = stopRes.serverResponse.fileList;
            const { bucket, vendor, region, fileNamePrefix } = stopRes.storageConfig;
            
            let m3u8Url = '';
            let mp4Url = '';
            
            fileList.forEach((file: any) => {
              // Handle both object format {fileName: "..."} and string format
              const fileName = typeof file === 'string' ? file : (file.fileName || file);
              if (fileName && typeof fileName === 'string') {
                if (fileName.endsWith('.m3u8')) {
                  m3u8Url = generateRecordingUrl(bucket, vendor, region, fileNamePrefix, fileName);
                } else if (fileName.endsWith('.mp4')) {
                  mp4Url = generateRecordingUrl(bucket, vendor, region, fileNamePrefix, fileName);
                }
              }
            });
            
            if (m3u8Url || mp4Url) {
              setRecordingLinks((prev: any) => {
                const updatedLinks = {
                  ...prev,
                  webpage: { m3u8: m3u8Url || undefined, mp4: mp4Url || undefined }
                };
                // Save to localStorage
                localStorage.setItem(`castaway_recording_links_${channelName}`, JSON.stringify(updatedLinks));
                return updatedLinks;
              });
            }
          }
          
          toast.success('Webpage recording stopped!', { id: 'stop-webpage' });
        } catch (err: any) {
          // Check if it's a "not found" or "already stopped" error
          const errorMsg = err.message?.toLowerCase() || '';
          if (errorMsg.includes('not found') || errorMsg.includes('already stopped') || errorMsg.includes('resource')) {
            toast('Webpage recording was already stopped', { id: 'stop-webpage' });
          } else {
            toast.error(`Failed to stop webpage recording: ${err.message}`, { id: 'stop-webpage' });
          }
          console.warn('Webpage recording stop error (continuing anyway):', err);
        }
      }

      // Always reset UI state regardless of API call results
      resetUIState();
    } catch (err: any) {
      // Fallback error handling - still reset UI state
      console.error('Unexpected error stopping recording:', err);
      toast.error(`Error stopping recording: ${err.message}`);
      resetUIState();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-agora-dark text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-agora-dark border-b border-gray-800">
        <div className="flex items-center space-x-4">
          {isBroadcasting ? (
            <div className="flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full animate-pulse">
              <div className="w-2 h-2 bg-white rounded-full"></div>
              <span className="text-xs font-bold uppercase tracking-wider">Live</span>
            </div>
          ) : (
            <div className="flex items-center space-x-2 bg-gray-700 px-3 py-1 rounded-full">
              <span className="text-xs font-bold uppercase tracking-wider">Offline</span>
            </div>
          )}
          {/* Recording Indicator */}
          {isRecording && (
            <div className="flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full">
              <Circle size={8} className="fill-white text-white" />
              <span className="text-xs font-bold uppercase tracking-wider">Recording</span>
            </div>
          )}
          <h1 className="text-lg font-bold">{displayName || channelName}</h1>
          <span className="text-gray-400 text-sm">|</span>
          <span className="text-gray-400 text-sm">Host: {userName}</span>
        </div>
        <div className="flex items-center space-x-4">
          {!isBroadcasting ? (
            <button 
              onClick={handleStartBroadcast}
              className="flex items-center space-x-2 bg-agora-blue px-6 py-2 rounded-lg hover:bg-blue-600 transition-all font-bold"
            >
              <Play size={18} />
              <span>Start Broadcast</span>
            </button>
          ) : (
            <>
              <button 
                onClick={toggleAiMode}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
                  isAiMode ? 'bg-agora-blue text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                <Bot size={18} />
                <span className="font-medium">AI Agent {isAiMode ? 'ON' : 'OFF'}</span>
              </button>
              {isBroadcasting && (
                <button 
                  onClick={handleEndShow}
                  className="flex items-center space-x-2 bg-yellow-600 px-4 py-2 rounded-lg hover:bg-yellow-700 transition-all font-bold"
                >
                  <Pause size={18} />
                  <span>End Show</span>
                </button>
              )}
              <button 
                onClick={handleEndStream}
                className="flex items-center space-x-2 bg-red-600 px-4 py-2 rounded-lg hover:bg-red-700 transition-all font-bold"
              >
                <PhoneOff size={18} />
                <span>End Stream</span>
              </button>
            </>
          )}
          {/* Statistics Toggle Button - Small and unobtrusive */}
          {isBroadcasting && (
            <button
              onClick={() => setShowStats(!showStats)}
              className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
                showStats ? 'bg-agora-blue text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
              }`}
              title={showStats ? "Hide Statistics" : "Show Statistics"}
            >
              <BarChart3 size={16} />
            </button>
          )}
          {/* Copy Link Button - Icon only */}
          <button
            onClick={async () => {
              const url = `${window.location.origin}/watch/${channelName}`;
              try {
                await navigator.clipboard.writeText(url);
                toast.success('Link copied! Share this to let others join as audience.');
              } catch (err) {
                toast.error('Failed to copy link');
              }
            }}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors"
            title="Copy audience join link"
          >
            <Copy size={18} />
          </button>
        </div>
      </header>

      {/* Advanced Statistics Overlay - Only show client stats, detailed stats are on video tiles */}
      {showStats && isBroadcasting && (
        <div className="absolute top-20 right-4 bg-gray-900/95 backdrop-blur-sm border border-gray-700 rounded-lg p-4 z-40 max-w-sm">
          <div className="text-sm font-bold mb-2 text-white">Client Statistics</div>
          {clientStats && (
            <div className="text-xs text-gray-300 space-y-1 mb-3">
              <div>RTT: {clientStats.RTT || 0}ms</div>
              <div>Outgoing B/W: {((Number(clientStats.OutgoingAvailableBandwidth) || 0) * 0.001).toFixed(2)} Mbps</div>
              <div>Send: {((Number(clientStats.SendBitrate) || 0) * 0.000001).toFixed(2)} Mbps</div>
              <div>Receive: {((Number(clientStats.RecvBitrate) || 0) * 0.000001).toFixed(2)} Mbps</div>
            </div>
          )}
          <div className="text-xs text-gray-400 italic">Detailed stats shown on video tiles</div>
        </div>
      )}


      {/* OBS Control Bar - Separate section below header */}
      {obsBarOpen && (
        <div className="px-6 py-2 bg-gray-900 border-b border-gray-800">
          <div className="flex items-center gap-2 flex-wrap">
            {/* OBS Setup Instructions Button - Always visible */}
            <button
              onClick={() => setShowOBSSetupInstructions(true)}
              className="flex items-center space-x-1 bg-gray-700 hover:bg-gray-600 px-2 py-1 rounded text-xs"
              title="OBS WebSocket Setup Instructions"
            >
            <HelpCircle size={14} />
            <span>OBS Setup</span>
          </button>
          
          {/* OBS Preview */}
          <div 
            id="obs-preview-bar" 
            className="w-20 h-12 bg-black rounded flex flex-col items-center justify-center text-gray-400 text-xs p-1 cursor-pointer hover:border-agora-blue border-2 border-transparent"
            title="OBS Preview"
            onClick={toggleOBSPreviewPIP}
          >
            <div className="text-[10px]">OBS</div>
          </div>
          <div id="obs-preview-status-bar" className="text-xs text-gray-400 w-24"></div>
          
          {/* Port Input */}
          <input 
            type="text" 
            placeholder="Port (4455)" 
            value={obsPort}
            onChange={(e) => setObsPort(e.target.value)}
            className="w-[80px] px-2 py-1 text-xs h-10 bg-gray-700 border border-gray-600 rounded"
            title="OBS WebSocket port"
          />
          
          {/* Password Input */}
          <input 
            type="password" 
            placeholder="OBS Password" 
            value={obsPassword}
            onChange={(e) => setObsPassword(e.target.value)}
            className="w-[120px] px-2 py-1 text-xs h-10 bg-gray-700 border border-gray-600 rounded"
            title="OBS WebSocket password"
          />
          
          {/* Connection Buttons */}
          {!obsConnected ? (
            <button 
              onClick={connectOBS}
              className="w-12 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded transition-colors"
              title="Connect to OBS"
            >
              <Check size={20} />
            </button>
          ) : (
            <>
              <div className="text-xs text-green-400 min-w-[80px]">✓ Connected</div>
              <button 
                onClick={disconnectOBS}
                className="w-12 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded transition-colors"
                title="Disconnect from OBS"
              >
                <X size={20} />
              </button>
            </>
          )}
          
          {/* Streaming Controls */}
          {obsConnected && (
            <>
              <button 
                onClick={startOBSStream}
                className="w-12 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded transition-colors"
                title="Start OBS Stream"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle></svg>
              </button>
              <button 
                onClick={stopOBSStream}
                className="w-12 h-10 flex items-center justify-center bg-red-600 hover:bg-red-700 rounded transition-colors"
                title="Stop OBS Stream"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12"></rect></svg>
              </button>
              <button 
                onClick={getOBSStreamStatus}
                className="w-12 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                title="Check Stream Status"
              >
                <Clock size={20} />
              </button>
              <div className="text-xs text-gray-400 min-w-[100px]">{obsStreamingStatus}</div>
              
              {/* Profile Controls */}
              <select 
                value={showNewProfileInput ? '__create_new__' : obsCurrentProfile}
                onChange={(e) => handleProfileSelectChange(e.target.value)}
                className="px-2 py-1 text-xs h-10 bg-gray-700 border border-gray-600 rounded"
                title="Select OBS Profile"
              >
                <option value="">Profile...</option>
                {obsProfiles.map(profile => (
                  <option key={profile} value={profile}>{profile}</option>
                ))}
                <option value="__create_new__">+ Create New</option>
              </select>
              {showNewProfileInput && (
                <div className="flex space-x-1">
                  <input
                    type="text"
                    placeholder="Name"
                    value={obsNewProfileName}
                    onChange={(e) => setObsNewProfileName(e.target.value)}
                    className="px-2 py-1 text-xs h-10 bg-gray-700 border border-gray-600 rounded"
                    onKeyPress={(e) => e.key === 'Enter' && createOBSProfile()}
                  />
                  <button
                    onClick={createOBSProfile}
                    className="px-2 py-1 text-xs h-10 bg-green-600 hover:bg-green-700 rounded"
                  >
                    Create
                  </button>
                </div>
              )}
              <button 
                onClick={listOBSProfiles}
                className="w-12 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                title="Refresh Profiles"
              >
                <RefreshCw size={16} />
              </button>
              <button 
                onClick={() => updateOBSProfile()}
                className="w-12 h-10 flex items-center justify-center bg-green-600 hover:bg-green-700 rounded transition-colors"
                title="Update Profile Settings"
              >
                <Upload size={16} />
              </button>
              <button
                onClick={() => setShowOBSSettings(true)}
                className="w-12 h-10 flex items-center justify-center bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                title="OBS Settings"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={toggleOBSPreviewPIP}
                className="px-2 py-1 text-xs h-10 bg-gray-600 hover:bg-gray-500 rounded transition-colors"
                title="Toggle Preview PIP"
              >
                Preview PIP
              </button>
            </>
          )}
          </div>
        </div>
      )}

      <main className="flex-1 flex overflow-hidden">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className={`flex-1 grid gap-4 ${
            remoteUsers.length + (isBroadcasting && localVideoTrack ? 1 : 0) > 1 ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            <div className="relative group">
              {showCamera && isBroadcasting && localVideoTrack ? (
                <>
                  <VideoPlayer 
                    track={localVideoTrack} 
                    isLocal={true}
                    showBandwidth={isBroadcasting}
                    bandwidthStats={(() => {
                      const localUid = (agoraService.rtcClient as any)?._uid || -1;
                      const localStats = statsData.get(localUid);
                      return localStats ? {
                        uplink: localStats.network?.uplink || 0,
                        downlink: localStats.network?.downlink || 0,
                        bitrate: localStats.bitrate || 0 // Already in Kbps
                      } : undefined;
                    })()}
                  />
                  {/* Local Statistics Overlay - Comprehensive stats like rtc-signaling */}
                  {showStats && (() => {
                    const localUid = (agoraService.rtcClient as any)?._uid || -1;
                    const localStats = statsData.get(localUid);
                    if (!localStats) return null;
                    
                    return (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm p-3 text-xs text-white max-h-[200px] overflow-y-auto z-20">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="font-semibold mb-1 text-agora-blue">Network</div>
                            <div>Quality: U-{localStats.network?.uplink || 0} D-{localStats.network?.downlink || 0}</div>
                            <div>RTT: {localStats.rtt?.toFixed(0) || 0}ms</div>
                            <div>Video Loss: {localStats.videoLossRate?.toFixed(1) || 0}%</div>
                            <div>Video Pkts Lost: {localStats.videoPacketsLost || 0}</div>
                            <div>Audio Loss: {localStats.audioLossRate?.toFixed(1) || 0}%</div>
                            <div>Audio Pkts Lost: {localStats.audioPacketsLost || 0}</div>
                            <div className="font-semibold mb-1 mt-2 text-agora-blue">Video</div>
                            <div>Resolution: {localStats.resolution || '0x0'}</div>
                            <div>FPS: {localStats.fps?.toFixed(1) || 0}</div>
                            <div>Codec: {localStats.codec || 'VP8'}</div>
                          </div>
                          <div>
                            <div className="font-semibold mb-1 text-agora-blue">Performance</div>
                            <div>Encode Delay: {localStats.encodeDelay?.toFixed(1) || 0}ms</div>
                            <div>Target Bitrate: {localStats.targetBitrate?.toFixed(2) || 0} Kbps</div>
                            <div>Video Bitrate: {(localStats.bitrate || 0).toFixed(2)} Kbps</div>
                            <div className="font-semibold mb-1 mt-2 text-agora-blue">Audio</div>
                            <div>Audio Bitrate: {localStats.audioBitrate?.toFixed(2) || 0} Kbps</div>
                            <div>Codec: {localStats.audioCodec || 'opus'}</div>
                            <div>Jitter: {localStats.audioJitter?.toFixed(1) || 0}ms</div>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {!isCamOn && (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/80 rounded-lg">
                      <div className="text-center">
                        <VideoOff size={64} className="text-gray-400 mx-auto mb-2" />
                        <div className="text-gray-400 text-sm">Camera is muted</div>
                      </div>
                    </div>
                  )}
                </>
              ) : obsConnected && !showCamera ? (
                <div className="w-full h-full bg-gray-900 rounded-lg flex flex-col border-2 border-agora-blue">
                  {/* OBS Preview Area */}
                  <div className="flex-1 flex items-center justify-center bg-black relative overflow-hidden">
                    <div 
                      id="obs-preview-main" 
                      className="w-full h-full flex items-center justify-center"
                    >
                      <div className="text-gray-500 text-sm">OBS Preview - Scene information will appear here</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex flex-col items-center justify-center border-2 border-dashed border-gray-700">
                  {!isBroadcasting ? (
                    <>
                      <div className="text-center mb-6">
                        <div className="p-6 bg-gray-800/50 rounded-full mb-4 inline-block">
                          <Play size={48} className="text-gray-500" />
                        </div>
                        <div className="text-gray-400 text-lg font-semibold mb-2">Ready to Broadcast</div>
                        <div className="text-gray-600 text-sm">Click "Start Broadcast" to go live</div>
                      </div>
                      <button 
                        onClick={handleStartBroadcast}
                        className="flex items-center space-x-3 bg-agora-blue px-8 py-4 rounded-xl hover:bg-blue-600 transition-all font-bold text-lg shadow-lg shadow-blue-500/30"
                      >
                        <Play size={24} />
                        <span>Start Broadcast</span>
                      </button>
                    </>
                  ) : (
                    <div className="text-center">
                      <div className="text-gray-500 text-sm mb-2">Waiting for camera...</div>
                      <div className="text-gray-600 text-xs">Check browser console for track creation logs</div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Screen share is published to channel - audience will see it via RTC user-published event */}
            {/* Host doesn't need to see their own screen share locally */}
            {remoteUsers.map(user => {
              // Use display name from displayNameMap if available (shows original name, not unique RTM ID)
              // Media Gateway user (UID 888) should show host's name
              let displayName = agoraService.displayNameMap?.get(user.uid) || user.displayName;
              if (user.uid === 888 && userName) {
                displayName = userName;
              }
              if (!displayName) {
                displayName = `User-${user.uid}`;
              }
              // Check if this is a screen share user (UID ends with screen share pattern)
              const screenShareUid = agoraService.screenShareClient?._screenShareUid;
              const rtmUserId = agoraService.userIdMap?.get(user.uid) || user.rtmUserId; // For internal checks
              const isScreenShare = (screenShareUid && user.uid === screenShareUid) || 
                                   (rtmUserId && rtmUserId.endsWith('-screen'));
              // Don't show Media Gateway user (888) when OBS is connected - host has preview
              if (user.uid === 888 && obsConnected) {
                return null;
              }
              const userStats = statsData.get(user.uid);
              return (
                <div key={user.uid} className="relative group">
                  <VideoPlayer 
                    track={user.videoTrack} 
                    user={{ ...user, uid: displayName, rtmUserId, originalUid: user.uid }}
                    showBandwidth={!!userStats}
                    bandwidthStats={userStats ? {
                      uplink: userStats.network?.uplink,
                      downlink: userStats.network?.downlink,
                      bitrate: userStats.bitrate
                    } : undefined}
                  />
                  {/* Statistics Overlay - Comprehensive stats like rtc-signaling */}
                  {showStats && userStats && (
                    <div className="absolute bottom-0 left-0 right-0 bg-black/90 backdrop-blur-sm p-3 text-xs text-white max-h-[200px] overflow-y-auto z-20">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="font-semibold mb-1 text-agora-blue">Network</div>
                          <div>Quality: U-{userStats.network?.uplink || 0} D-{userStats.network?.downlink || 0}</div>
                          <div>RTT: {userStats.rtt?.toFixed(0) || 0}ms</div>
                          <div>Video Loss: {userStats.videoLossRate?.toFixed(1) || 0}%</div>
                          <div>Video Pkts Lost: {userStats.videoPacketsLost || 0}</div>
                          <div>Audio Loss: {userStats.audioLossRate?.toFixed(1) || 0}%</div>
                          <div>Audio Pkts Lost: {userStats.audioPacketsLost || 0}</div>
                          <div className="font-semibold mb-1 mt-2 text-agora-blue">Video</div>
                          <div>Resolution: {userStats.resolution || '0x0'}</div>
                          <div>FPS: {userStats.fps?.toFixed(1) || 0}</div>
                          <div>Codec: {userStats.codec || 'VP8'}</div>
                        </div>
                        <div>
                          <div className="font-semibold mb-1 text-agora-blue">Performance</div>
                          <div>Bitrate: {(userStats.bitrate || 0).toFixed(2)} Kbps</div>
                          <div className="font-semibold mb-1 mt-2 text-agora-blue">Audio</div>
                          <div>Audio Bitrate: {userStats.audioBitrate?.toFixed(2) || 0} Kbps</div>
                          <div>Codec: {userStats.audioCodec || 'opus'}</div>
                          <div>Jitter: {userStats.audioJitter?.toFixed(1) || 0}ms</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Don't show demote button for screen share user */}
                  {!isScreenShare && (
                    <button 
                      onClick={() => handleDemote(displayName)}
                      className="absolute top-4 right-4 bg-red-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Users size={16} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Host Controls */}
          <div className="flex items-center justify-center space-x-6 py-4 bg-gray-800/50 backdrop-blur-md rounded-2xl border border-gray-700">
            <button 
              onClick={toggleMic}
              className={`p-4 rounded-full transition-all ${isMicOn ? 'bg-gray-700 text-white' : 'bg-red-600 text-white'}`}
            >
              {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
            </button>
            <button 
              onClick={toggleCam}
              className={`p-4 rounded-full transition-all ${isCamOn ? 'bg-gray-700 text-white' : 'bg-red-600 text-white'}`}
            >
              {isCamOn ? <Video size={24} /> : <VideoOff size={24} />}
            </button>
            <button 
              onClick={handleScreenShare}
              className={`p-4 rounded-full transition-all ${
                isScreenSharing ? 'bg-agora-blue text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
            >
              <ScreenShare size={24} />
            </button>
            <div className="h-8 w-px bg-gray-600"></div>
            {/* Virtual Background Button */}
            <button
              onClick={() => setShowVirtualBgModal(true)}
              className={`p-4 rounded-full transition-all ${
                isVirtualBgEnabled ? 'bg-agora-blue text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title="Virtual Background"
            >
              <Image size={24} />
            </button>
            {/* OBS Controls Toggle Button */}
            <button
              onClick={() => setObsBarOpen(!obsBarOpen)}
              className={`p-4 rounded-full transition-all ${
                obsBarOpen ? 'bg-agora-blue text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={obsBarOpen ? "Hide OBS Controls" : "Show OBS Controls"}
            >
              <Server size={24} />
            </button>
            {/* Recording Button */}
            <button
              onClick={() => isRecording ? handleStopRecording() : setShowRecordingModal(true)}
              className={`p-4 rounded-full transition-all ${
                isRecording ? 'bg-red-600 text-white' : 'bg-gray-700 text-white hover:bg-gray-600'
              }`}
              title={isRecording ? "Stop Recording" : "Start Recording"}
            >
              <Circle size={24} className={isRecording ? 'fill-white text-white' : 'fill-red-600 text-red-600'} />
            </button>
            {/* Recording Links Button */}
            {(recordingLinks.composite || recordingLinks.webpage) && (
              <button
                onClick={() => setShowRecordingLinksModal(true)}
                className="p-4 rounded-full transition-all bg-gray-700 text-white hover:bg-gray-600"
                title="View Recording Links"
              >
                <MoreVertical size={24} />
              </button>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col">
          <div className="flex border-b border-gray-800">
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'chat' ? 'border-agora-blue text-agora-blue' : 'border-transparent text-gray-500'}`}
            >
              Chat
            </button>
            <button 
              onClick={() => setActiveTab('participants')}
              className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'participants' ? 'border-agora-blue text-agora-blue' : 'border-transparent text-gray-500'}`}
            >
              Stage ({promotionRequests.length})
            </button>
            <button 
              onClick={() => setActiveTab('media')}
              className={`flex-1 py-4 text-sm font-bold border-b-2 transition-all ${activeTab === 'media' ? 'border-agora-blue text-agora-blue' : 'border-transparent text-gray-500'}`}
            >
              Media
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === 'chat' && (
              <div className="flex-1 flex flex-col">
                {/* Participants List - Always visible at top of chat */}
                <div className="mb-4 pb-4 border-b border-gray-800">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Participants ({participants.length + 1})</h3>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {/* Host (self) */}
                    <div className="flex items-center space-x-2 bg-agora-blue/20 p-2 rounded-lg border border-agora-blue/50">
                      <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">{userName} (You - Host)</span>
                    </div>
                    {/* Other participants */}
                    {participants.map(userId => {
                      const isPromoted = remoteUsers.some(u => u.rtmUserId === userId);
                      // Get display name from map, fallback to userId if not found
                      const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
                      return (
                        <div key={userId} className="flex items-center justify-between bg-gray-800 p-2 rounded-lg border border-gray-700">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="text-sm font-medium">{displayName}</span>
                            {isPromoted && (
                              <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded-full">On Stage</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {participants.length === 0 && <p className="text-gray-600 text-xs">No other participants</p>}
                  </div>
                </div>
                {!rtmLoggedIn && (
                  <div className="bg-yellow-600/20 border border-yellow-600/50 rounded-lg p-3 m-4">
                    <p className="text-yellow-400 text-sm font-medium">
                      ⚠️ Chat is disabled - RTM not logged in. Chat messages will not be sent or received.
                    </p>
                  </div>
                )}
                <div className="flex-1 overflow-y-auto space-y-4 p-4">
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`flex flex-col ${msg.senderId === 'You' ? 'items-end' : 'items-start'}`}>
                      {!msg.isSystem && (
                        <span className="text-xs text-gray-500 mb-1">{msg.senderId}</span>
                      )}
                      <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${
                        msg.isSystem
                          ? 'bg-gray-800/50 text-gray-400 italic border border-gray-700/50'
                          : msg.senderId === 'You' 
                          ? 'bg-agora-blue text-white' 
                          : 'bg-gray-800 text-gray-300'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">All Participants ({participants.length + 1})</h3>
                  <div className="space-y-2">
                    {/* Host (self) */}
                    <div className="flex items-center justify-between bg-agora-blue/20 p-3 rounded-xl border border-agora-blue/50">
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-medium">{userName} (You - Host)</span>
                      </div>
                    </div>
                    {/* Other participants */}
                    {participants.map(userId => {
                      const isPromoted = remoteUsers.some(u => u.rtmUserId === userId);
                      // Get display name from map, fallback to userId if not found
                      const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(userId) || userId;
                      return (
                        <div key={userId} className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                          <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                            <span className="font-medium">{displayName}</span>
                            {isPromoted && (
                              <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded-full">On Stage</span>
                            )}
                          </div>
                          {isPromoted && (
                            <button 
                              onClick={() => handleDemote(userId)}
                              className="bg-red-600 text-xs font-bold px-3 py-1.5 rounded-lg hover:bg-red-700"
                            >
                              Demote
                            </button>
                          )}
                        </div>
                      );
                    })}
                    {participants.length === 0 && <p className="text-gray-600 text-sm">No other participants</p>}
                  </div>
                </div>
                <div>
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-4">Requests to join stage</h3>
                  <div className="space-y-3">
                    {promotionRequests.map(userId => (
                      <div key={userId} className="flex items-center justify-between bg-gray-800 p-3 rounded-xl border border-gray-700">
                        <span className="font-medium">{userId}</span>
                        <button 
                          onClick={() => handlePromote(userId)}
                          className="bg-agora-blue text-xs font-bold px-3 py-1.5 rounded-lg"
                        >
                          Approve
                        </button>
                      </div>
                    ))}
                    {promotionRequests.length === 0 && <p className="text-gray-600 text-sm">No pending requests</p>}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-6">
                <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg">
                  <button 
                    onClick={() => setMediaTab('pull')}
                    className={`flex-1 flex flex-col items-center py-2 rounded-md ${mediaTab === 'pull' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                  >
                    <Download size={18} />
                    <span className="text-[10px] mt-1 uppercase font-bold">Pull</span>
                  </button>
                  <button 
                    onClick={() => setMediaTab('push')}
                    className={`flex-1 flex flex-col items-center py-2 rounded-md ${mediaTab === 'push' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                  >
                    <Rocket size={18} />
                    <span className="text-[10px] mt-1 uppercase font-bold">Push</span>
                  </button>
                  <button 
                    onClick={() => setMediaTab('gateway')}
                    className={`flex-1 flex flex-col items-center py-2 rounded-md ${mediaTab === 'gateway' ? 'bg-gray-700 text-white' : 'text-gray-500'}`}
                  >
                    <Server size={18} />
                    <span className="text-[10px] mt-1 uppercase font-bold">Gateway</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {mediaTab === 'pull' && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Inject an external video stream into the channel.</p>
                        <input 
                          type="text" 
                          placeholder="Video URL (RTMP/HLS/MP4)" 
                          className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue mb-3"
                          value={pullUrl}
                          onChange={(e) => setPullUrl(e.target.value)}
                        />
                        <div className="mb-3">
                          <label className="text-xs text-gray-400 mb-1 block">Repeat Time (for on-demand streams)</label>
                          <select
                            value={mediaPullState.repeatTime}
                            onChange={(e) => setMediaPullState(prev => ({ ...prev, repeatTime: parseInt(e.target.value) }))}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue"
                          >
                            <option value="1">1 - Play once (Default)</option>
                            <option value="-1">-1 - Play in loop</option>
                            <option value="2">2 - Play twice</option>
                            <option value="3">3 - Play three times</option>
                            <option value="5">5 - Play five times</option>
                            <option value="10">10 - Play ten times</option>
                          </select>
                          <p className="text-xs text-gray-500 mt-1">
                            Number of times to play the media stream. Only applies to on-demand streams.
                          </p>
                        </div>
                        {!agoraService.mediaPullPlayerId ? (
                          <button onClick={startPull} className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm">Start Media Pull</button>
                        ) : (
                          <div className="space-y-3">
                            <div className="flex space-x-2">
                              <button 
                                onClick={mediaPullState.isPlaying ? pauseMediaPull : playMediaPull}
                                className="flex-1 bg-gray-700 py-2 rounded-lg font-bold text-sm flex items-center justify-center space-x-2"
                              >
                                {mediaPullState.isPlaying ? <Pause size={16} /> : <Play size={16} />}
                                <span>{mediaPullState.isPlaying ? 'Pause' : 'Play'}</span>
                              </button>
                              <button 
                                onClick={async () => {
                                  try {
                                    await agoraService.deleteMediaPull();
                                    toast.success('Media pull stopped');
                                  } catch (err: any) {
                                    // If delete fails (e.g., resource not found), still clear the UI
                                    if (err.response?.data?.reason === 'Resource is not found and destroyed.' || 
                                        err.message?.includes('not found')) {
                                      agoraService.mediaPullPlayerId = null;
                                      toast('Media pull already stopped');
                                    } else {
                                      toast.error('Failed to stop media pull');
                                    }
                                  }
                                }}
                                className="px-4 bg-red-600 py-2 rounded-lg font-bold text-sm"
                              >
                                Stop
                              </button>
                            </div>
                            <div className="space-y-2">
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Volume: {mediaPullState.volume}%</label>
                                <input 
                                  type="range" 
                                  min="0" 
                                  max="200" 
                                  value={mediaPullState.volume}
                                  onChange={(e) => updateMediaPullVolume(parseInt(e.target.value))}
                                  className="w-full"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-gray-400 mb-1 block">Seek Position (seconds)</label>
                                <input 
                                  type="number" 
                                  min="0"
                                  value={mediaPullState.seekPosition}
                                  onChange={(e) => setMediaPullState(prev => ({ ...prev, seekPosition: parseInt(e.target.value) || 0 }))}
                                  onBlur={() => seekMediaPull(mediaPullState.seekPosition)}
                                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {mediaTab === 'push' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400">Push the live stream to external CDN (YouTube/Facebook).</p>
                      <div className="space-y-3">
                        {pushUrls.map((push, index) => (
                          <div key={push.id} className="flex items-center space-x-2">
                            <input 
                              type="text" 
                              placeholder={`RTMP Push URL ${index + 1}`}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue"
                              value={push.url}
                              onChange={(e) => updatePushUrl(push.id, e.target.value)}
                              disabled={!!push.converterId}
                            />
                            {!push.converterId ? (
                              <>
                                <button 
                                  onClick={() => {
                                    if (!push.url.trim()) {
                                      toast.error('Please enter an RTMP URL');
                                      return;
                                    }
                                    startPush(push.url, push.id);
                                  }}
                                  className="bg-agora-blue px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap"
                                >
                                  Start
                                </button>
                                <button 
                                  onClick={() => removePushDestination(push.id)}
                                  className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm"
                                  title="Remove destination"
                                >
                                  ×
                                </button>
                              </>
                            ) : (
                              <>
                                <button 
                                  onClick={() => stopPush(push.id)}
                                  className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-lg font-bold text-sm whitespace-nowrap"
                                >
                                  Stop
                                </button>
                                <button 
                                  onClick={() => stopPush(push.id)}
                                  className="bg-gray-600 hover:bg-gray-500 px-3 py-2 rounded-lg text-sm"
                                  title="Stop and remove"
                                >
                                  ×
                                </button>
                              </>
                            )}
                          </div>
                        ))}
                        <button 
                          onClick={addPushDestination}
                          className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-bold text-sm flex items-center justify-center space-x-2"
                        >
                          <span>+</span>
                          <span>Add Destination</span>
                        </button>
                      </div>
                    </div>
                  )}
                  {mediaTab === 'gateway' && (
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-2">Create stream key for OBS or external encoder.</p>
                        <button onClick={startGateway} className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm mb-3">Create Gateway Stream Key</button>
                        {gatewayStreamKey && (
                          <div className="space-y-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
                            <div>
                              <label className="text-xs text-gray-500 uppercase">Server URL</label>
                              <div className="bg-gray-900 p-2 rounded text-sm font-mono break-all">{gatewayServerUrl}</div>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500 uppercase">Stream Key</label>
                              <div className="bg-gray-900 p-2 rounded text-sm font-mono break-all">{gatewayStreamKey}</div>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="border-t border-gray-700 pt-4">
                        <p className="text-xs text-gray-400 mb-3">Use the OBS Controls bar at the top to connect to OBS WebSocket.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="p-4 border-t border-gray-800 bg-gray-900">
            <div className="flex space-x-2">
              <input 
                type="text" 
                placeholder={rtmLoggedIn ? "Type a message..." : "Chat disabled - RTM not logged in"}
                disabled={!rtmLoggedIn}
                className={`flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue ${
                  !rtmLoggedIn ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                disabled={!rtmLoggedIn}
                className={`p-2 bg-agora-blue rounded-xl text-white ${
                  !rtmLoggedIn ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>

        {/* OBS Settings Modal */}
        {showOBSSettings && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">OBS Settings</h2>
                <button 
                  onClick={() => {
                    setShowOBSSettings(false);
                    setObsSettingsTab('scenes');
                  }}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              
              {!obsConnected ? (
                <div className="text-center py-8">
                  <p className="text-gray-400 mb-4">Please connect to OBS first</p>
                  <button 
                    onClick={connectOBS}
                    className="bg-green-600 hover:bg-green-700 px-6 py-2 rounded-lg font-bold"
                  >
                    Connect to OBS
                  </button>
                </div>
              ) : (
                <>
                  {/* Tabs */}
                  <div className="flex space-x-2 mb-4 border-b border-gray-700 overflow-x-auto">
                    {['scenes', 'collections', 'profiles', 'video', 'audio', 'output', 'stream', 'sources'].map((tab) => (
                      <button
                        key={tab}
                        onClick={async () => {
                          setObsSettingsTab(tab);
                          // Load data when switching tabs
                          if (tab === 'collections') {
                            await listOBSSceneCollections();
                          } else if (tab === 'profiles') {
                            await listOBSProfiles();
                          } else if (tab === 'video') {
                            await loadOBSVideoSettings();
                          } else if (tab === 'audio') {
                            await loadOBSAudioSettings();
                          } else if (tab === 'output') {
                            await loadOBSOutputSettings();
                          } else if (tab === 'stream') {
                            await loadOBSStreamServiceSettings();
                          } else if (tab === 'sources') {
                            await loadOBSSceneItems();
                          }
                        }}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                          obsSettingsTab === tab
                            ? 'border-agora-blue text-agora-blue'
                            : 'border-transparent text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="flex-1 overflow-y-auto">
                    {obsSettingsTab === 'scenes' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Scenes</h3>
                          <button 
                            onClick={async () => {
                              await listOBSScenes();
                              await loadOBSSceneItems();
                            }}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="space-y-2">
                          {obsScenes.length > 0 ? (
                            obsScenes.map((scene) => (
                              <button
                                key={scene}
                                onClick={() => setOBSScene(scene)}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                  obsCurrentScene === scene
                                    ? 'bg-agora-blue text-white'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                              >
                                {scene}
                                {obsCurrentScene === scene && (
                                  <span className="ml-2 text-xs">●</span>
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No scenes found</p>
                          )}
                        </div>
                      </div>
                    )}

                    {obsSettingsTab === 'collections' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Scene Collections</h3>
                          <button 
                            onClick={listOBSSceneCollections}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="space-y-2">
                          {obsSceneCollections.length > 0 ? (
                            obsSceneCollections.map((collection) => (
                              <button
                                key={collection}
                                onClick={() => setOBSSceneCollection(collection)}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                  obsCurrentSceneCollection === collection
                                    ? 'bg-agora-blue text-white'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                              >
                                {collection}
                                {obsCurrentSceneCollection === collection && (
                                  <span className="ml-2 text-xs">●</span>
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No scene collections found</p>
                          )}
                        </div>
                        {obsShowNewSceneCollectionInput ? (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="New collection name"
                              value={obsNewSceneCollectionName}
                              onChange={(e) => setObsNewSceneCollectionName(e.target.value)}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                              onKeyPress={(e) => e.key === 'Enter' && createOBSSceneCollection()}
                            />
                            <button
                              onClick={createOBSSceneCollection}
                              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-bold"
                            >
                              Create
                            </button>
                            <button
                              onClick={() => {
                                setObsShowNewSceneCollectionInput(false);
                                setObsNewSceneCollectionName('');
                              }}
                              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setObsShowNewSceneCollectionInput(true)}
                            className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold"
                          >
                            + Create New Collection
                          </button>
                        )}
                      </div>
                    )}

                    {obsSettingsTab === 'profiles' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Profiles</h3>
                          <button 
                            onClick={listOBSProfiles}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="space-y-2">
                          {obsProfiles.length > 0 ? (
                            obsProfiles.map((profile) => (
                              <button
                                key={profile}
                                onClick={() => updateOBSProfile(profile)}
                                className={`w-full text-left px-4 py-2 rounded-lg transition-colors ${
                                  obsCurrentProfile === profile
                                    ? 'bg-agora-blue text-white'
                                    : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                                }`}
                              >
                                {profile}
                                {obsCurrentProfile === profile && (
                                  <span className="ml-2 text-xs">●</span>
                                )}
                              </button>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No profiles found</p>
                          )}
                        </div>
                        {showNewProfileInput ? (
                          <div className="flex space-x-2">
                            <input
                              type="text"
                              placeholder="New profile name"
                              value={obsNewProfileName}
                              onChange={(e) => setObsNewProfileName(e.target.value)}
                              className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                              onKeyPress={(e) => e.key === 'Enter' && createOBSProfile()}
                            />
                            <button
                              onClick={createOBSProfile}
                              className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-lg text-sm font-bold"
                            >
                              Create
                            </button>
                            <button
                              onClick={() => {
                                setShowNewProfileInput(false);
                                setObsNewProfileName('');
                              }}
                              className="bg-gray-600 hover:bg-gray-500 px-4 py-2 rounded-lg text-sm"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNewProfileInput(true)}
                            className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold"
                          >
                            + Create New Profile
                          </button>
                        )}
                      </div>
                    )}

                    {obsSettingsTab === 'video' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Video Settings</h3>
                          <button 
                            onClick={loadOBSVideoSettings}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            {obsVideoSettings ? 'Refresh' : 'Load'}
                          </button>
                        </div>
                        {!obsVideoSettings ? (
                          <p className="text-gray-400 text-sm">Click "Load" to fetch video settings</p>
                        ) : (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Base Resolution</label>
                            <input
                              type="text"
                              value={obsVideoSettings.baseWidth + 'x' + obsVideoSettings.baseHeight || ''}
                              onChange={(e) => {
                                const [width, height] = e.target.value.split('x').map(Number);
                                if (width && height) {
                                  updateOBSVideoSettings({ baseWidth: width, baseHeight: height });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Output Resolution</label>
                            <input
                              type="text"
                              value={obsVideoSettings.outputWidth + 'x' + obsVideoSettings.outputHeight || ''}
                              onChange={(e) => {
                                const [width, height] = e.target.value.split('x').map(Number);
                                if (width && height) {
                                  updateOBSVideoSettings({ outputWidth: width, outputHeight: height });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">FPS</label>
                            <input
                              type="number"
                              value={obsVideoSettings.fpsNumerator / obsVideoSettings.fpsDenominator || ''}
                              onChange={(e) => {
                                const fps = parseFloat(e.target.value);
                                if (fps) {
                                  updateOBSVideoSettings({ fpsNumerator: fps, fpsDenominator: 1 });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {obsSettingsTab === 'audio' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Audio Settings</h3>
                          <button 
                            onClick={loadOBSAudioSettings}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            {obsAudioSettings ? 'Refresh' : 'Load'}
                          </button>
                        </div>
                        {!obsAudioSettings ? (
                          <p className="text-gray-400 text-sm">Click "Load" to fetch audio settings</p>
                        ) : (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Sample Rate (Hz)</label>
                            <input
                              type="number"
                              value={obsAudioSettings.sampleRate || ''}
                              onChange={(e) => {
                                const rate = parseInt(e.target.value);
                                if (rate) {
                                  updateOBSAudioSettings({ sampleRate: rate });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Channels</label>
                            <select
                              value={obsAudioSettings.channels || ''}
                              onChange={(e) => updateOBSAudioSettings({ channels: parseInt(e.target.value) })}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            >
                              <option value="1">Mono</option>
                              <option value="2">Stereo</option>
                              <option value="4">4.0</option>
                              <option value="5">4.1</option>
                              <option value="6">5.1</option>
                              <option value="8">7.1</option>
                            </select>
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {obsSettingsTab === 'output' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Output Settings</h3>
                          <button 
                            onClick={loadOBSOutputSettings}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            {obsOutputSettings ? 'Refresh' : 'Load'}
                          </button>
                        </div>
                        {!obsOutputSettings ? (
                          <p className="text-gray-400 text-sm">Click "Load" to fetch output settings</p>
                        ) : (
                        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Output Mode</label>
                            <input
                              type="text"
                              value={obsOutputSettings.outputPath || 'N/A'}
                              readOnly
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Encoder</label>
                            <input
                              type="text"
                              value={obsOutputSettings.encoderName || 'N/A'}
                              readOnly
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Video Bitrate (Kbps)</label>
                            <input
                              type="number"
                              value={obsOutputSettings.videoBitrate || ''}
                              onChange={(e) => {
                                const bitrate = parseInt(e.target.value);
                                if (bitrate) {
                                  updateOBSOutputSettings({ videoBitrate: bitrate });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Audio Bitrate (Kbps)</label>
                            <input
                              type="number"
                              value={obsOutputSettings.audioBitrate || ''}
                              onChange={(e) => {
                                const bitrate = parseInt(e.target.value);
                                if (bitrate) {
                                  updateOBSOutputSettings({ audioBitrate: bitrate });
                                }
                              }}
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                        )}
                      </div>
                    )}

                    {obsSettingsTab === 'stream' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Stream Service</h3>
                          <button 
                            onClick={loadOBSStreamServiceSettings}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="bg-gray-800 rounded-lg p-4 space-y-3">
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Service Type</label>
                            <input
                              type="text"
                              value={obsStreamServiceSettings?.streamServiceType || 'rtmp_custom'}
                              readOnly
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Server URL</label>
                            <input 
                              type="text" 
                              value={gatewayServerUrl || obsStreamServiceSettings?.streamServiceSettings?.server || ''}
                              readOnly
                              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-sm text-gray-400 mb-1 block">Stream Key</label>
                            <div className="flex space-x-2">
                              <input 
                                type="text" 
                                value={gatewayStreamKey || obsStreamServiceSettings?.streamServiceSettings?.key || ''}
                                readOnly
                                className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                              />
                              <button
                                onClick={async () => {
                                  if (gatewayStreamKey && gatewayServerUrl) {
                                    await updateOBSStreamKey(gatewayStreamKey, gatewayServerUrl, true);
                                    await loadOBSStreamServiceSettings();
                                  } else {
                                    toast.error('No stream key available. Create one in Media Gateway tab first.');
                                  }
                                }}
                                className="bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded-lg text-sm font-bold"
                              >
                                Update in OBS
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {obsSettingsTab === 'sources' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">Scene Sources</h3>
                          <button 
                            onClick={async () => {
                              await listOBSScenes();
                              await loadOBSSceneItems();
                            }}
                            className="text-sm text-agora-blue hover:underline"
                          >
                            Refresh
                          </button>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          Current Scene: <span className="text-white font-medium">{obsCurrentScene || 'None'}</span>
                        </div>
                        <div className="space-y-2">
                          {obsCurrentSceneItems.length > 0 ? (
                            obsCurrentSceneItems.map((item: any, index: number) => (
                              <div
                                key={item.sceneItemId || index}
                                className="bg-gray-800 rounded-lg p-3"
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <div className="font-medium text-white">{item.sourceName || 'Unknown'}</div>
                                    <div className="text-xs text-gray-400">
                                      Type: {item.sourceType || 'Unknown'} | ID: {item.sceneItemId || 'N/A'}
                                    </div>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {item.inputKind || 'N/A'}
                                  </div>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-gray-400 text-sm">No sources found in current scene</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* OBS Setup Instructions Modal */}
        {showOBSSetupInstructions && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">OBS WebSocket Setup</h2>
                <button 
                  onClick={() => setShowOBSSetupInstructions(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4 text-sm">
                <ol className="list-decimal list-inside space-y-3 text-gray-300">
                  <li>Install the latest version of OBS Studio</li>
                  <li>Open OBS on this computer</li>
                  <li>In the OBS Menu bar, click <span className="font-semibold text-white">Tools → WebSocket Server Settings</span></li>
                  <li>Check <span className="font-semibold text-white">Enable WebSocket Server</span></li>
                  <li>Ensure <span className="font-semibold text-white">Server Port</span> is set to <span className="font-mono bg-gray-800 px-1 rounded">4455</span></li>
                  <li>Check <span className="font-semibold text-white">Enable Authentication</span></li>
                  <li>Enter a new <span className="font-semibold text-white">Server Password</span> manually, do not generate a random one. Make sure to hit <span className="font-semibold text-white">"Apply"</span> after setting your custom password.</li>
                  <li>Use the OBS Control Bar at the top of this page to connect to OBS</li>
                </ol>
                <div className="mt-6 pt-4 border-t border-gray-700">
                  <button
                    onClick={() => setShowOBSSetupInstructions(false)}
                    className="w-full bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-bold"
                  >
                    Got it!
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recording Links Modal */}
        {showRecordingLinksModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Recording Links</h2>
                <button 
                  onClick={() => setShowRecordingLinksModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                {recordingLinks.composite && (
                  <div>
                    <div className="text-sm font-semibold text-agora-blue mb-3">Composite Recording</div>
                    {recordingLinks.composite.m3u8 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">M3U8 (HLS):</div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={recordingLinks.composite.m3u8}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                          />
                          <button
                            onClick={() => {
                              if (recordingLinks.composite?.m3u8) {
                                navigator.clipboard.writeText(recordingLinks.composite.m3u8);
                                toast.success('M3U8 link copied!');
                              }
                            }}
                            className="bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded text-sm font-bold"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                    {recordingLinks.composite.mp4 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">MP4:</div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={recordingLinks.composite.mp4}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                          />
                          <button
                            onClick={() => {
                              if (recordingLinks.composite?.mp4) {
                                navigator.clipboard.writeText(recordingLinks.composite.mp4);
                                toast.success('MP4 link copied!');
                              }
                            }}
                            className="bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded text-sm font-bold"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {recordingLinks.webpage && (
                  <div className={recordingLinks.composite ? 'border-t border-gray-700 pt-4' : ''}>
                    <div className="text-sm font-semibold text-agora-blue mb-3">Webpage Recording</div>
                    {recordingLinks.webpage.m3u8 && (
                      <div className="mb-3">
                        <div className="text-xs text-gray-400 mb-1">M3U8 (HLS):</div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={recordingLinks.webpage.m3u8}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                          />
                          <button
                            onClick={() => {
                              if (recordingLinks.webpage?.m3u8) {
                                navigator.clipboard.writeText(recordingLinks.webpage.m3u8);
                                toast.success('M3U8 link copied!');
                              }
                            }}
                            className="bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded text-sm font-bold"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                    {recordingLinks.webpage.mp4 && (
                      <div>
                        <div className="text-xs text-gray-400 mb-1">MP4:</div>
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            readOnly
                            value={recordingLinks.webpage.mp4}
                            className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white"
                          />
                          <button
                            onClick={() => {
                              if (recordingLinks.webpage?.mp4) {
                                navigator.clipboard.writeText(recordingLinks.webpage.mp4);
                                toast.success('MP4 link copied!');
                              }
                            }}
                            className="bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded text-sm font-bold"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!recordingLinks.composite && !recordingLinks.webpage && (
                  <div className="text-center text-gray-400 py-8">
                    No recording links available. Start and stop a recording to generate links.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Recording Modal */}
        {showRecordingModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-md w-full mx-4">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Start Cloud Recording</h2>
                <button 
                  onClick={() => setShowRecordingModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4">
                <p className="text-sm text-gray-400 mb-4">
                  Select the recording type(s) you want to start:
                </p>
                
                <div className="space-y-3">
                  <label className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={recordingComposite}
                      onChange={(e) => setRecordingComposite(e.target.checked)}
                      className="w-5 h-5 text-agora-blue rounded focus:ring-agora-blue"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Composite Recording</div>
                      <div className="text-xs text-gray-400">Records everything in the channel</div>
                    </div>
                  </label>
                  
                  <label className="flex items-center space-x-3 p-3 bg-gray-800 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={recordingWebpage}
                      onChange={(e) => setRecordingWebpage(e.target.checked)}
                      className="w-5 h-5 text-agora-blue rounded focus:ring-agora-blue"
                    />
                    <div className="flex-1">
                      <div className="font-semibold text-white">Webpage Recording</div>
                      <div className="text-xs text-gray-400">Records the webpage view as an audience member</div>
                    </div>
                  </label>
                </div>

                <div className="flex space-x-3 pt-4">
                  <button
                    onClick={() => setShowRecordingModal(false)}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleStartRecording}
                    disabled={!recordingComposite && !recordingWebpage}
                    className="flex-1 bg-agora-blue hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-bold"
                  >
                    Start Recording
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Virtual Background Modal */}
        {showVirtualBgModal && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Virtual Background</h2>
                <button 
                  onClick={() => setShowVirtualBgModal(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Preview */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Preview</h3>
                  <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
                    <div
                      ref={previewVideoRef}
                      className="w-full h-full"
                    />
                    {!localVideoTrack && (
                      <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                        <div className="text-center">
                          <VideoOff size={48} className="mx-auto mb-2" />
                          <p>Camera not available</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Controls */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Background Options</h3>
                  
                  {/* Background Type Selection */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Background Type</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => {
                          setVirtualBgType('none');
                          setSelectedPreset(''); // Reset preset when changing type
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          virtualBgType === 'none'
                            ? 'border-agora-blue bg-agora-blue/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <X size={20} className="mx-auto mb-1" />
                        <span className="text-xs">None</span>
                      </button>
                      <button
                        onClick={() => {
                          setVirtualBgType('blur');
                          setSelectedPreset(''); // Reset preset when changing type
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          virtualBgType === 'blur'
                            ? 'border-agora-blue bg-agora-blue/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <Sparkles size={20} className="mx-auto mb-1" />
                        <span className="text-xs">Blur</span>
                      </button>
                      <button
                        onClick={() => {
                          setVirtualBgType('color');
                          setSelectedPreset(''); // Reset preset when changing type
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          virtualBgType === 'color'
                            ? 'border-agora-blue bg-agora-blue/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <Palette size={20} className="mx-auto mb-1" />
                        <span className="text-xs">Color</span>
                      </button>
                      <button
                        onClick={() => {
                          setVirtualBgType('image');
                          setSelectedPreset(''); // Reset preset when changing type
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          virtualBgType === 'image'
                            ? 'border-agora-blue bg-agora-blue/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <Image size={20} className="mx-auto mb-1" />
                        <span className="text-xs">Image</span>
                      </button>
                      <button
                        onClick={() => {
                          setVirtualBgType('video');
                          setSelectedPreset(''); // Reset preset when changing type
                        }}
                        className={`p-3 rounded-lg border-2 transition-all ${
                          virtualBgType === 'video'
                            ? 'border-agora-blue bg-agora-blue/20'
                            : 'border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        <Video size={20} className="mx-auto mb-1" />
                        <span className="text-xs">Video</span>
                      </button>
                    </div>
                  </div>

                  {/* Blur Options */}
                  {virtualBgType === 'blur' && (
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">
                        Blur Level: {virtualBgBlur === 1 ? 'Low' : virtualBgBlur === 2 ? 'Medium' : 'High'}
                      </label>
                      <input
                        type="range"
                        min="1"
                        max="3"
                        step="1"
                        value={virtualBgBlur}
                        onChange={(e) => setVirtualBgBlur(parseInt(e.target.value))}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* Color Picker */}
                  {virtualBgType === 'color' && (
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Background Color</label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={virtualBgColor}
                          onChange={(e) => setVirtualBgColor(e.target.value)}
                          className="w-16 h-10 rounded cursor-pointer"
                        />
                        <input
                          type="text"
                          value={virtualBgColor}
                          onChange={(e) => setVirtualBgColor(e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                          placeholder="#4b2e83"
                        />
                      </div>
                    </div>
                  )}

                  {/* Image Presets */}
                  {virtualBgType === 'image' && (
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Choose Image</label>
                      <div className="grid grid-cols-3 gap-2">
                        {virtualBgPresets.images.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setSelectedPreset(preset.id)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                              selectedPreset === preset.id
                                ? 'border-agora-blue ring-2 ring-agora-blue'
                                : 'border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <img
                              src={preset.thumbnail}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <span className="text-xs font-semibold text-white">{preset.name}</span>
                            </div>
                            {selectedPreset === preset.id && (
                              <div className="absolute top-1 right-1 bg-agora-blue rounded-full p-1">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Video Presets */}
                  {virtualBgType === 'video' && (
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Choose Video</label>
                      <div className="grid grid-cols-2 gap-2">
                        {virtualBgPresets.videos.map((preset) => (
                          <button
                            key={preset.id}
                            onClick={() => setSelectedPreset(preset.id)}
                            className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                              selectedPreset === preset.id
                                ? 'border-agora-blue ring-2 ring-agora-blue'
                                : 'border-gray-700 hover:border-gray-600'
                            }`}
                          >
                            <img
                              src={preset.thumbnail}
                              alt={preset.name}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                              <div className="text-center">
                                <Play size={24} className="mx-auto mb-1 text-white" />
                                <span className="text-xs font-semibold text-white">{preset.name}</span>
                              </div>
                            </div>
                            {selectedPreset === preset.id && (
                              <div className="absolute top-1 right-1 bg-agora-blue rounded-full p-1">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Apply Button */}
                  <div className="flex space-x-3 pt-4">
                    <button
                      onClick={() => setShowVirtualBgModal(false)}
                      className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (virtualBgType === 'image' && !selectedPreset) {
                          toast.error('Please select an image');
                          return;
                        }
                        if (virtualBgType === 'video' && !selectedPreset) {
                          toast.error('Please select a video');
                          return;
                        }
                        await applyVirtualBackground();
                        setShowVirtualBgModal(false);
                      }}
                      className="flex-1 bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-bold"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Settings Panel */}
        {showSettings && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
            <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Settings</h2>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="text-gray-400 hover:text-white text-2xl"
                >
                  ×
                </button>
              </div>
              <div className="space-y-6">
                {/* Device Settings */}
                <div>
                  <h3 className="text-lg font-semibold mb-3">Device Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Camera</label>
                      <select 
                        value={selectedCamera}
                        onChange={(e) => switchCamera(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      >
                        {availableCameras.map(camera => (
                          <option key={camera.deviceId} value={camera.deviceId}>
                            {camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Microphone</label>
                      <select 
                        value={selectedMicrophone}
                        onChange={(e) => switchMicrophone(e.target.value)}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      >
                        {availableMicrophones.map(mic => (
                          <option key={mic.deviceId} value={mic.deviceId}>
                            {mic.label || `Microphone ${availableMicrophones.indexOf(mic) + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      onClick={loadDevices}
                      className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold"
                    >
                      Refresh Devices
                    </button>
                  </div>
                </div>

                {/* OBS Settings */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold mb-3">OBS WebSocket Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">OBS Port</label>
                      <input
                        type="text"
                        value={obsPort}
                        onChange={(e) => {
                          setObsPort(e.target.value);
                          localStorage.setItem('castaway_obs_port', e.target.value);
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                        placeholder="4455"
                      />
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">OBS Password</label>
                      <input
                        type="password"
                        value={obsPassword}
                        onChange={(e) => {
                          setObsPassword(e.target.value);
                          localStorage.setItem('castaway_obs_password', e.target.value);
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                        placeholder="Enter OBS WebSocket password"
                      />
                    </div>
                    <button
                      onClick={() => setShowOBSSetupInstructions(true)}
                      className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold flex items-center justify-center space-x-2"
                    >
                      <HelpCircle size={16} />
                      <span>View OBS Setup Instructions</span>
                    </button>
                  </div>
                </div>

                {/* Broadcast Settings */}
                <div className="border-t border-gray-700 pt-4">
                  <h3 className="text-lg font-semibold mb-3">Broadcast Settings</h3>
                  <div className="space-y-3">
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Video Quality</label>
                      <select 
                        value={settings.videoQuality}
                        onChange={(e) => {
                          const newQuality = e.target.value;
                          setSettings(prev => ({ ...prev, videoQuality: newQuality }));
                          // Apply to agoraService immediately
                          agoraService.setQualitySettings(newQuality, settings.audioQuality);
                          // Save to localStorage
                          localStorage.setItem('castaway_user_settings', JSON.stringify({ ...settings, videoQuality: newQuality }));
                          toast.success(`Video quality set to ${newQuality}`);
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="720p">720p (HD)</option>
                        <option value="1080p">1080p (Full HD)</option>
                        <option value="480p">480p (SD)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-sm text-gray-400 mb-2 block">Audio Quality</label>
                      <select 
                        value={settings.audioQuality}
                        onChange={(e) => {
                          const newQuality = e.target.value;
                          setSettings(prev => ({ ...prev, audioQuality: newQuality }));
                          // Apply to agoraService immediately
                          agoraService.setQualitySettings(settings.videoQuality, newQuality);
                          // Save to localStorage
                          localStorage.setItem('castaway_user_settings', JSON.stringify({ ...settings, audioQuality: newQuality }));
                          toast.success(`Audio quality set to ${newQuality}`);
                        }}
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm"
                      >
                        <option value="48kHz">High (48kHz)</option>
                        <option value="24kHz">Medium (24kHz)</option>
                        <option value="16kHz">Low (16kHz)</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Low Latency Mode</span>
                      <input 
                        type="checkbox" 
                        checked={settings.lowLatency}
                        onChange={(e) => setSettings(prev => ({ ...prev, lowLatency: e.target.checked }))}
                        className="w-4 h-4" 
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Auto-start Broadcast</span>
                      <input 
                        type="checkbox" 
                        checked={settings.autoStartBroadcast}
                        onChange={(e) => {
                          const updated = { ...settings, autoStartBroadcast: e.target.checked };
                          setSettings(updated);
                          localStorage.setItem('castaway_user_settings', JSON.stringify(updated));
                          toast.success(`Auto-start broadcast ${e.target.checked ? 'enabled' : 'disabled'}`);
                        }}
                        className="w-4 h-4" 
                      />
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (userName) {
                      const settingsKey = `castaway_settings_${userName.charAt(0).toUpperCase()}`;
                      localStorage.setItem(settingsKey, JSON.stringify(settings));
                      toast.success('Settings saved!');
                    } else {
                      toast.error('Cannot save settings without username');
                    }
                  }}
                  className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm mt-4"
                >
                  Save Settings
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
      
      {/* OBS Preview PIP (Draggable) */}
      {obsPIPVisible && (
        <div 
          id="obs-preview-pip"
          className="fixed w-[480px] h-[270px] bg-black border-2 border-agora-blue rounded-lg z-[9999] cursor-move"
          style={{ top: '80px', right: '20px' }}
        >
          <div className="absolute top-0 left-0 right-0 bg-black/70 p-1 flex justify-between items-center text-[10px] z-10">
            <span>OBS Preview</span>
            <button 
              onClick={toggleOBSPreviewPIP}
              className="cursor-pointer text-white font-bold px-1 hover:text-red-400"
            >
              ✕
            </button>
          </div>
          <div id="obs-preview-pip-content" className="w-full h-full pt-6"></div>
        </div>
      )}
    </div>
  );
}

