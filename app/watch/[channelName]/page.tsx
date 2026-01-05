'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Users, MessageSquare, Share2, Rocket, Hand, BarChart3, PictureInPicture, Circle, Image, Palette, Sparkles, X, Check, Play, Languages
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import agoraService from '../../../src/services/agoraService';
import VideoPlayer from '../../components/VideoPlayer';
import { SOURCE_LANGUAGES, TARGET_LANGUAGES } from '../../utils/sttLanguages';

function AudiencePageContent() {
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

  const [remoteUsers, setRemoteUsers] = useState<any[]>([]);
  const [role, setRole] = useState('audience'); // 'audience' or 'promoted'
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [statsData, setStatsData] = useState<Map<number, any>>(new Map());
  const [clientStats, setClientStats] = useState<any>(null);
  const statsIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasAddedJoinMessageRef = useRef(false); // Prevent duplicate join messages
  const promotionMessagesShownRef = useRef<Set<string>>(new Set()); // Track shown promotion/demotion messages
  const promotionMessageRef = useRef(false); // Prevent duplicate promotion messages
  const [isRecording, setIsRecording] = useState(false); // Track recording state from host
  
  // Debug: Log when isRecording changes
  useEffect(() => {
    console.log('📹 [AUDIENCE] isRecording state changed:', isRecording);
  }, [isRecording]);
  
  // STT State (for audience)
  const [sttTranscriptions, setSttTranscriptions] = useState<Map<number, { text: string; language: string; timestamp: Date }>>(new Map());
  // Store translations per user - key is uid, value is map of targetLang -> translation
  const [sttTranslations, setSttTranslations] = useState<Map<number, Map<string, { text: string; sourceLang: string; targetLang: string; timestamp: Date }>>>(new Map());
  const [sttUserLanguageSelections, setSttUserLanguageSelections] = useState<Map<number, { transcriptionLang: string; translationLang?: string }>>(new Map());
  const [sttAvailableLanguages, setSttAvailableLanguages] = useState<string[]>([]); // Languages available from STT config
  const [sttTranslationPairs, setSttTranslationPairs] = useState<Array<{ source: string; target: string[] }>>([]); // Translation pairs from STT config
  
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
    // Check if name exists in URL params or localStorage
    const urlName = searchParams?.get('name');
    const savedName = localStorage.getItem('castaway_username');
    
    // Only show modal if no name is found anywhere
    if (!urlName && !savedName && !userName) {
      setShowNameModal(true);
      return;
    }
    
    // If we have a name in URL/localStorage but userName state is empty, wait for it to be set
    if (!userName && (urlName || savedName)) {
      return; // Wait for the other useEffect to set userName
    }

    // Close modal if we have a name
    if (userName) {
      setShowNameModal(false);
    }

    // Monitor console for UID-BANNED errors
    const originalError = console.error;
    const errorHandler = (...args: any[]) => {
      const errorStr = args.map(arg => String(arg)).join(' ');
      if (errorStr.includes('UID-BANNED') || errorStr.includes('BANNED')) {
        console.log('🚫 [PAGE] UID-BANNED detected in console error');
        if (agoraService.onKicked) {
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

      await agoraService.init(appId, userName);

      agoraService.onMessageReceived = (content: string, senderId: string) => {
        // Check if this is a recording state message or STT config message
        try {
          const message = JSON.parse(content);
          if (message.type === 'RECORDING_STATE') {
            console.log('📹 [AUDIENCE] Received RECORDING_STATE:', message.isRecording);
            const newRecordingState = message.isRecording || false;
            console.log('📹 [AUDIENCE] Setting isRecording to:', newRecordingState);
            setIsRecording(newRecordingState);
            return; // Don't add to chat
          }
          if (message.type === 'STT_STOP') {
            // Clear STT state when host stops STT
            console.log('📢 [AUDIENCE] Received STT stop message');
            setSttAvailableLanguages([]);
            setSttTranslationPairs([]);
            setSttTranscriptions(new Map());
            setSttTranslations(new Map());
            setSttUserLanguageSelections(new Map());
            return; // Don't add to chat
          }
          if (message.type === 'STT_CONFIG') {
            // Store STT configuration from host (optional - we also auto-detect from stream messages)
            console.log('📢 [AUDIENCE] Received STT config (optional):', message);
            if (message.languages) {
              setSttAvailableLanguages(prev => {
                // Merge with existing languages (don't overwrite, in case we already detected some)
                const merged = Array.from(new Set([...prev, ...message.languages]));
                console.log('📢 [AUDIENCE] Merged available languages:', merged);
                return merged;
              });
            }
            if (message.translateConfig && message.translateConfig.languages) {
              setSttTranslationPairs(prev => {
                // Merge translation pairs
                const merged = [...prev];
                message.translateConfig.languages.forEach((pair: { source: string; target: string[] }) => {
                  const existing = merged.find(p => p.source === pair.source);
                  if (existing) {
                    // Merge target languages
                    existing.target = Array.from(new Set([...existing.target, ...pair.target]));
                  } else {
                    merged.push(pair);
                  }
                });
                console.log('📢 [AUDIENCE] Merged translation pairs:', merged);
                return merged;
              });
            }
            return; // Don't add to chat
          }
        } catch (e) {
          // Not JSON, treat as regular chat message
        }
        // Get display name from map, fallback to senderId if not found
        const displayName = agoraService.rtmUserIdToDisplayNameMap?.get(senderId) || senderId;
        setChatMessages(prev => [...prev, { senderId: displayName, content, timestamp: new Date() }]);
      };

      agoraService.onParticipantsUpdate = (participantsList: string[]) => {
        setParticipants(participantsList);
        console.log('👥 [AUDIENCE] Participants updated:', participantsList);
      };

      agoraService.onUserJoined = (userId: string) => {
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

      agoraService.onTrackPublished = async (user: any, type: string) => {
        if (type === 'video') {
          // Ensure rtmUserId is set (unique RTM ID for internal use)
          if (!user.rtmUserId) {
            user.rtmUserId = agoraService.userIdMap?.get(user.uid) || `User-${user.uid}`;
          }
          
          // Check if this is a screen share user
          const rtmUserId = agoraService.userIdMap?.get(user.uid) || user.rtmUserId;
          const isScreenShare = rtmUserId && rtmUserId.endsWith('-screen');
          
          // Use display name from displayNameMap if available (shows original name, not unique RTM ID)
          let displayName = agoraService.displayNameMap?.get(user.uid) || user.displayName;
          
          // If it's a screen share and we don't have a display name, try to get it from RTM metadata
          if (isScreenShare && !displayName && rtmUserId && agoraService.rtmClient && agoraService.rtmLoggedIn) {
            try {
              // First, try to get display name from the screen share user's metadata
              const screenShareMetadata = await agoraService.rtmClient.storage.getUserMetadata({ userId: rtmUserId });
              const screenShareDisplayName = screenShareMetadata?.metadata?.displayName?.value;
              
              if (screenShareDisplayName) {
                displayName = screenShareDisplayName;
              } else {
                // If not found, try to get the host's display name from the base user ID
                const baseUserId = rtmUserId.replace(/-screen$/, '');
                const hostMetadata = await agoraService.rtmClient.storage.getUserMetadata({ userId: baseUserId });
                const hostDisplayName = hostMetadata?.metadata?.displayName?.value || 
                                       hostMetadata?.metadata?.username?.value ||
                                       agoraService.rtmUserIdToDisplayNameMap?.get(baseUserId);
                
                if (hostDisplayName) {
                  // Construct screen share display name from host's display name
                  displayName = `${hostDisplayName}-screen`;
                } else {
                  // Last resort: try to extract from RTM user ID (e.g., "frank-12345-screen" -> "frank")
                  const parts = baseUserId.split('-');
                  if (parts.length > 1) {
                    // Take the first part as the base name (e.g., "frank" from "frank-12345")
                    displayName = `${parts[0]}-screen`;
                  } else {
                    displayName = `${baseUserId}-screen`;
                  }
                }
              }
              
              // Store it in displayNameMap for future reference
              if (displayName) {
                agoraService.displayNameMap?.set(user.uid, displayName);
              }
            } catch (err) {
              console.warn('⚠️ [AUDIENCE] Failed to get screen share display name from metadata:', err);
              // Fallback: try to extract from RTM user ID
              const baseUserId = rtmUserId.replace(/-screen$/, '');
              const parts = baseUserId.split('-');
              if (parts.length > 1) {
                displayName = `${parts[0]}-screen`;
              } else {
                displayName = `${baseUserId}-screen`;
              }
              agoraService.displayNameMap?.set(user.uid, displayName);
            }
          }
          
          // Fallback to User-{uid} if still no display name
          if (!displayName) {
            displayName = `User-${user.uid}`;
          }
          
          user.displayName = displayName;
          console.log('👤 [AUDIENCE] User published:', { 
            uid: user.uid, 
            displayName, 
            rtmUserId,
            isScreenShare,
            hasVideo: !!user.videoTrack,
            videoTrackId: user.videoTrack?.getTrackId?.(),
            videoTrackType: typeof user.videoTrack
          });
          // Only add if video track is actually available
          if (user.videoTrack) {
            setRemoteUsers(prev => {
              const filtered = prev.filter(u => u.uid !== user.uid);
              return [...filtered, user];
            });
            
            // Initialize language selection for new user if STT languages are available
            if (sttAvailableLanguages.length > 0) {
              setSttUserLanguageSelections(prev => {
                const newMap = new Map(prev);
                if (!newMap.has(user.uid)) {
                  newMap.set(user.uid, { transcriptionLang: sttAvailableLanguages[0] });
                  // Subscribe to default language
                  agoraService.subscribeToSTTLanguages(user.uid, [sttAvailableLanguages[0]], new Map());
                }
                return newMap;
              });
            }
            
            // Also initialize for promoted user (self) if they're on stage
            if (role === 'promoted' && sttAvailableLanguages.length > 0) {
              const localUid = (agoraService.rtcClient as any)?._uid || -1;
              setSttUserLanguageSelections(prev => {
                const newMap = new Map(prev);
                if (!newMap.has(localUid)) {
                  newMap.set(localUid, { transcriptionLang: sttAvailableLanguages[0] });
                  // Subscribe to default language
                  agoraService.subscribeToSTTLanguages(localUid, [sttAvailableLanguages[0]], new Map());
                }
                return newMap;
              });
            }
            
            console.log('✅ [AUDIENCE] Added user to remoteUsers:', user.uid);
          } else {
            console.warn('⚠️ [AUDIENCE] User published but video track is missing:', user.uid);
          }
        }
      };

      agoraService.onTrackUnpublished = (user: any, type: string) => {
        if (type === 'video') {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        }
      };

      // STT Callbacks
      agoraService.onTranscriptionReceived = (uid: number, text: string, language: string) => {
        console.log('📝 [AUDIENCE] Transcription received:', { uid, text, language });
        
        // If language is 'unknown', try to infer from available languages
        let actualLanguage = language;
        if (!language || language === 'unknown') {
          // Try to get from available languages first
          setSttAvailableLanguages(prev => {
            if (prev.length > 0) {
              actualLanguage = prev[0];
              console.log('📝 [AUDIENCE] Language was unknown, using first available:', actualLanguage);
            } else {
              // If no available languages yet, try common defaults or wait for STT config
              // For now, we'll use 'en-US' as a fallback since it's most common
              actualLanguage = 'en-US';
              console.log('📝 [AUDIENCE] No available languages, using fallback:', actualLanguage);
            }
            return prev;
          });
          
          // If we still don't have a language, use fallback
          if (!actualLanguage || actualLanguage === 'unknown') {
            actualLanguage = 'en-US';
          }
        }
        
        // Auto-detect STT is active and add language to available languages if not already present
        if (actualLanguage && actualLanguage !== 'unknown') {
          setSttAvailableLanguages(prev => {
            if (!prev.includes(actualLanguage)) {
              const updated = [...prev, actualLanguage];
              console.log('📝 [AUDIENCE] Auto-detected STT language:', actualLanguage, 'Available languages:', updated);
              return updated;
            }
            return prev;
          });
          
          // Initialize language selection for this user if not already set
          setSttUserLanguageSelections(prev => {
            const newMap = new Map(prev);
            const currentSelection = newMap.get(uid);
            // Always update if current is 'unknown' or not set
            if (!currentSelection || currentSelection.transcriptionLang === 'unknown' || !currentSelection.transcriptionLang) {
              newMap.set(uid, { transcriptionLang: actualLanguage });
              agoraService.subscribeToSTTLanguages(uid, [actualLanguage], new Map());
              console.log('📝 [AUDIENCE] Initialized/updated language selection for UID:', uid, 'Language:', actualLanguage);
            }
            return newMap;
          });
        }
        
        // Always store transcription with the actual language, let UI filter by language selection
        setSttTranscriptions(prev => {
          const newMap = new Map(prev);
          newMap.set(uid, { text, language: actualLanguage || language, timestamp: new Date() });
          console.log('📝 [AUDIENCE] Stored transcription for UID:', uid, 'Language:', actualLanguage || language, 'Total:', newMap.size);
          return newMap;
        });
      };

      agoraService.onTranslationReceived = (uid: number, text: string, sourceLang: string, targetLang: string) => {
        console.log('🌐 [AUDIENCE] Translation received:', { uid, text, sourceLang, targetLang });
        
        // Auto-detect translation pairs - add to translation pairs if not already present
        setSttTranslationPairs(prev => {
          const existingPair = prev.find(p => p.source === sourceLang);
          if (existingPair) {
            // Add target language if not already in the list
            if (!existingPair.target.includes(targetLang)) {
              const updated = prev.map(p => 
                p.source === sourceLang 
                  ? { ...p, target: [...p.target, targetLang] }
                  : p
              );
              console.log('🌐 [AUDIENCE] Auto-detected translation pair:', sourceLang, '->', targetLang);
              return updated;
            }
            return prev;
          } else {
            // Create new translation pair
            const updated = [...prev, { source: sourceLang, target: [targetLang] }];
            console.log('🌐 [AUDIENCE] Auto-detected new translation pair:', sourceLang, '->', targetLang);
            return updated;
          }
        });
        
        // Store translation - store all translations per user, keyed by targetLang
        // The UI will filter to show only the one matching the user's selected translation language
        setSttTranslations(prev => {
          const newMap = new Map(prev);
          const userTranslations = newMap.get(uid) || new Map();
          userTranslations.set(targetLang, { text, sourceLang, targetLang, timestamp: new Date() });
          newMap.set(uid, userTranslations);
          console.log('🌐 [AUDIENCE] Stored translation for UID:', uid, 'Target:', targetLang, 'User has', userTranslations.size, 'translation languages');
          return newMap;
        });
      };

      agoraService.onPromoted = () => {
        setRole('promoted');
        setLocalVideoTrack(agoraService.localVideoTrack);
        setLocalAudioTrack(agoraService.localAudioTrack);
        toast.success('You are now ON STAGE!', { duration: 5000, icon: '🌟' });
        
        // Initialize STT language selection for promoted user if STT is available
        if (sttAvailableLanguages.length > 0) {
          const localUid = (agoraService.rtcClient as any)?._uid || -1;
          setSttUserLanguageSelections(prev => {
            const newMap = new Map(prev);
            if (!newMap.has(localUid)) {
              newMap.set(localUid, { transcriptionLang: sttAvailableLanguages[0] });
              // Subscribe to default language
              agoraService.subscribeToSTTLanguages(localUid, [sttAvailableLanguages[0]], new Map());
            }
            return newMap;
          });
        }
        
        // Add system message (prevent duplicates)
        const messageKey = 'promoted-self';
        if (!promotionMessagesShownRef.current.has(messageKey)) {
          promotionMessagesShownRef.current.add(messageKey);
          const timestamp = new Date().toLocaleTimeString();
          setChatMessages(prev => [...prev, {
            senderId: 'System',
            content: `[${timestamp}] [System] You have been promoted to stage`,
            timestamp: new Date(),
            isSystem: true
          }]);
        }
      };

      agoraService.onDemoted = () => {
        setRole('audience');
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
        setHasApplied(false); // Reset so user can request promotion again
        toast('You have been moved back to audience', { icon: '👋' });
        
        // Add system message (prevent duplicates)
        const messageKey = 'demoted-self';
        if (!promotionMessagesShownRef.current.has(messageKey)) {
          promotionMessagesShownRef.current.add(messageKey);
          const timestamp = new Date().toLocaleTimeString();
          setChatMessages(prev => [...prev, {
            senderId: 'System',
            content: `[${timestamp}] [System] You have been moved back to audience`,
            timestamp: new Date(),
            isSystem: true
          }]);
        }
      };

      agoraService.onScreenShareStarted = () => {
        const timestamp = new Date().toLocaleTimeString();
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] Screen share started`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onScreenShareStopped = () => {
        const timestamp = new Date().toLocaleTimeString();
        setChatMessages(prev => [...prev, {
          senderId: 'System',
          content: `[${timestamp}] [System] Screen share stopped`,
          timestamp: new Date(),
          isSystem: true
        }]);
      };

      agoraService.onHostLeft = (message: string) => {
        toast.error(message || 'The host has ended the stream', { duration: 2000 });
        agoraService.leave().catch(console.error);
        router.push('/browse');
      };

      agoraService.onKicked = (message: string) => {
        toast.error(message || 'You have been removed from the channel', { duration: 2000 });
        agoraService.leave().catch(console.error);
        router.push('/browse');
      };

      try {
        await agoraService.join(channelName, 'audience');
        toast.success(`Joined ${channelName}`);
        
        // Add system message for joining (only one message, prevent duplicates)
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
      } catch (err: any) {
        const errorMessage = err?.message || 'Failed to join channel';
        
        // Check if user is banned (UID-BANNED error)
        if (errorMessage.includes('UID-BANNED') || errorMessage.includes('BANNED')) {
          console.log('🚫 [PAGE] User is banned (UID-BANNED detected)');
          toast.error('You have been banned from this channel');
          agoraService.leave().catch(console.error);
          router.push('/browse');
          return;
        }
        
        toast.error('Failed to join channel');
        console.error(err);
      }
    };

    init();

    return () => {
      console.error = originalError; // Restore original console.error
      agoraService.leave();
    };
  }, [channelName, userName]);

  const handleApply = async () => {
    if (hasApplied) return;
    await agoraService.applyToHost();
    setHasApplied(true);
    toast.success('Request sent to host');
  };

  const handleDemoteSelf = async () => {
    await agoraService.demoteSelf();
  };

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
      containerElement.innerHTML = '';
      try {
        localVideoTrack.play(containerElement);
      } catch (err) {
        console.error('Error playing preview:', err);
      }
      return () => {
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

  const handleLeave = async () => {
    const timestamp = new Date().toLocaleTimeString();
    setChatMessages(prev => [...prev, {
      senderId: 'System',
      content: `[${timestamp}] [System] You left the RTC channel`,
      timestamp: new Date(),
      isSystem: true
    }]);
    await agoraService.leave();
    router.push('/');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
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
        
        // Get local video/audio stats for promoted users
        const localVideoStats = agoraService.rtcClient.getLocalVideoStats();
        const localAudioStats = agoraService.rtcClient.getLocalAudioStats();
        
        const newStats = new Map<number, any>();
        
        // Process each remote user - include all users with stats, not just those in remoteUsers
        // This ensures stats are available even if remoteUsers hasn't been updated yet
        Object.keys(remoteVideoStats || {}).forEach((uidStr) => {
          const uid = parseInt(uidStr);
          const videoStats = remoteVideoStats[uid];
          const audioStats = remoteAudioStats[uid];
          const networkQuality = networkQualityMap[uidStr] || { uplink: 0, downlink: 0 };
          
          // Only add if we have valid stats
          if (videoStats || audioStats) {
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
          }
        });
        
        // Add local stats for promoted users (if they have tracks)
        if (role === 'promoted' && localVideoTrack && localVideoStats) {
          const localNetworkQuality = { uplink: 0, downlink: 0 };
          try {
            const networkQuality = agoraService.rtcClient.getLocalNetworkQuality?.();
            if (networkQuality) {
              localNetworkQuality.uplink = networkQuality.uplinkNetworkQuality || 0;
              localNetworkQuality.downlink = networkQuality.downlinkNetworkQuality || 0;
            }
          } catch (e) {}
          
          // Use current user's numeric UID for local stats
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
        
        // Don't filter - show stats for all users that have stats
        // The overlay will only show if the user exists in remoteUsers (checked in render)
        setStatsData(newStats);
      } catch (err) {
        console.error('Failed to collect stats:', err);
      }
    }, 1000);
  };

  const stopStatsCollection = () => {
    if (statsIntervalRef.current) {
      clearInterval(statsIntervalRef.current);
      statsIntervalRef.current = null;
    }
  };

  // Start stats collection immediately when joined (for bandwidth indicators)
  useEffect(() => {
    if (agoraService.rtcClient && agoraService.isJoined) {
      startStatsCollection();
    }
    
    return () => {
      stopStatsCollection();
      // Clear stats on unmount
      setStatsData(new Map());
      setClientStats(null);
    };
  }, [agoraService.isJoined]);

  const handlePIP = async () => {
    try {
      if (!document.pictureInPictureEnabled) {
        toast.error('Picture-in-Picture is not supported in this browser');
        return;
      }

      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        toast('Exited Picture-in-Picture');
        return;
      }

      // First try to find a screen share video (like rtc-signaling)
      const screenShareVideo = document.querySelector('.screen-share video') as HTMLVideoElement;
      if (screenShareVideo && screenShareVideo.srcObject) {
        try {
          await screenShareVideo.requestPictureInPicture();
          toast('Entered Picture-in-Picture');
          return;
        } catch (error) {
          console.error('Error entering PiP mode with screen share:', error);
        }
      }

      // Then try to find a regular remote video
      const remoteVideo = document.querySelector('#remoteVideo video') as HTMLVideoElement;
      if (remoteVideo && remoteVideo.srcObject) {
        try {
          await remoteVideo.requestPictureInPicture();
          toast('Entered Picture-in-Picture');
          return;
        } catch (error) {
          console.error('Error entering PiP mode with remote video:', error);
        }
      }

      // Look in VideoPlayer containers (where Agora SDK places videos)
      const containers = document.querySelectorAll('.video-player-container');
      for (const container of Array.from(containers)) {
        const video = container.querySelector('video') as HTMLVideoElement;
        if (video && video.srcObject) {
          try {
            await video.requestPictureInPicture();
            toast('Entered Picture-in-Picture');
            return;
          } catch (error) {
            console.error('Error entering PiP mode:', error);
          }
        }
      }

      // Fallback: look for any video element with srcObject
      const videoElements = document.querySelectorAll('video');
      for (const video of Array.from(videoElements)) {
        if (video.srcObject) {
          try {
            await video.requestPictureInPicture();
            toast('Entered Picture-in-Picture');
            return;
          } catch (error) {
            console.error('Error entering PiP mode:', error);
          }
        }
      }

      toast.error('No video available for Picture-in-Picture');
    } catch (err: any) {
      console.error('PIP error:', err);
      toast.error(`PIP failed: ${err.message}`);
    }
  };

  const handleNameSubmit = () => {
    if (!nameInput.trim()) {
      toast.error('Please enter your name');
      return;
    }
    // Close modal and update URL with name parameter
    setShowNameModal(false);
    router.push(`/watch/${channelName}?name=${encodeURIComponent(nameInput.trim())}`);
  };

  return (
    <div className="flex flex-col h-screen bg-agora-dark text-white overflow-hidden">
      {/* Name Entry Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6 w-full max-w-md">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-white">Enter Your Name</h2>
            <p className="text-gray-400 text-sm mb-4">Please enter your name to join the channel</p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleNameSubmit()}
              placeholder="Your name"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-agora-blue"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={handleNameSubmit}
                className="flex-1 bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-bold text-white"
              >
                Join Channel
              </button>
              <button
                onClick={() => router.push('/browse')}
                className="flex-1 bg-gray-700 hover:bg-gray-600 px-4 py-2 rounded-lg font-bold text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between px-3 sm:px-4 lg:px-6 py-2 sm:py-3 lg:py-4 bg-agora-dark border-b border-gray-800">
        <div className="flex items-center space-x-2 sm:space-x-4 min-w-0 flex-1">
          <div className="flex items-center space-x-1 sm:space-x-2 bg-agora-blue px-2 sm:px-3 py-1 rounded-full flex-shrink-0">
            <Users size={12} className="sm:w-3.5 sm:h-3.5 text-white" />
            <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider hidden sm:inline">Watching</span>
          </div>
          <h1 className="text-sm sm:text-base lg:text-lg font-bold truncate">{displayName || channelName}</h1>
          <span className="text-gray-400 text-xs sm:text-sm hidden sm:inline">|</span>
          <span className="text-gray-400 text-xs sm:text-sm truncate hidden sm:inline">{userName}</span>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4 flex-shrink-0">
          {role === 'audience' ? (
            <button 
              onClick={handleApply}
              disabled={hasApplied}
              className={`flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg font-bold transition-all text-xs sm:text-sm ${
                hasApplied ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-agora-blue text-white hover:bg-blue-600'
              }`}
            >
              <Hand size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
              <span className="hidden sm:inline">{hasApplied ? 'Request Sent' : 'Ask to Join Stage'}</span>
              <span className="sm:hidden">{hasApplied ? 'Sent' : 'Join'}</span>
            </button>
          ) : (
            <button 
              onClick={handleDemoteSelf}
              className="flex items-center space-x-1 sm:space-x-2 bg-yellow-500 text-agora-dark px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-yellow-600 transition-all font-bold text-xs sm:text-sm"
            >
              <Rocket size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
              <span className="hidden sm:inline">Leave Stage</span>
              <span className="sm:hidden">Leave</span>
            </button>
          )}
          {/* Statistics Toggle Button */}
          <button
            onClick={() => setShowStats(!showStats)}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              showStats ? 'bg-agora-blue text-white' : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
            }`}
            title={showStats ? "Hide Statistics" : "Show Statistics"}
          >
            <BarChart3 size={16} />
          </button>
          {/* PIP Button */}
          {document.pictureInPictureEnabled && (
            <button
              onClick={handlePIP}
              className="flex items-center justify-center w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 transition-colors text-gray-300"
              title="Picture-in-Picture"
            >
              <PictureInPicture size={16} />
            </button>
          )}
          <button 
            onClick={handleLeave}
            className="flex items-center space-x-1 sm:space-x-2 bg-gray-800 px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-lg hover:bg-gray-700 transition-all text-gray-300 text-xs sm:text-sm"
          >
            <PhoneOff size={14} className="sm:w-4 sm:h-4 lg:w-[18px] lg:h-[18px]" />
            <span className="hidden sm:inline">Leave Room</span>
            <span className="sm:hidden">Leave</span>
          </button>
        </div>
      </header>

      {/* Advanced Statistics Overlay - Only show client stats, detailed stats are on video tiles */}
      {showStats && (
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

      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-4 relative min-w-0">
          {/* Recording Indicator - Top Right Corner of Video Area */}
          {isRecording ? (
            <div className="absolute top-2 right-2 sm:top-6 sm:right-6 z-[100] flex items-center space-x-2 bg-red-600 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full shadow-lg">
              <Circle size={8} className="fill-white text-white animate-pulse" />
              <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-white">Recording</span>
            </div>
          ) : null}
          <div className={`flex-1 grid gap-2 sm:gap-4 ${remoteUsers.length + (role === 'promoted' ? 1 : 0) > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
            {/* Host / Other Promoted Users */}
            {remoteUsers.map(user => {
              const displayName = user.displayName || user.rtmUserId || `User-${user.uid}`;
              const userStats = statsData.get(user.uid);
              const userLangSelection = sttUserLanguageSelections.get(user.uid) || (sttAvailableLanguages.length > 0 ? { transcriptionLang: sttAvailableLanguages[0] } : { transcriptionLang: 'en-US' });
              // If language selection is 'unknown', try to use first available or fallback to en-US
              const effectiveLang = userLangSelection.transcriptionLang === 'unknown' 
                ? (sttAvailableLanguages.length > 0 ? sttAvailableLanguages[0] : 'en-US')
                : userLangSelection.transcriptionLang;
              const transcription = sttTranscriptions.get(user.uid);
              const userTranslations = sttTranslations.get(user.uid);
              const translation = userLangSelection.translationLang && userTranslations 
                ? userTranslations.get(userLangSelection.translationLang) 
                : undefined;
              
              // Debug log
              if (sttAvailableLanguages.length === 0 && sttTranscriptions.size > 0) {
                console.log('⚠️ [AUDIENCE] STT transcriptions exist but no languages configured. Transcriptions:', Array.from(sttTranscriptions.keys()));
              }
              
              return (
                <div key={user.uid} className="relative group shadow-2xl">
                  <VideoPlayer 
                    track={user.videoTrack} 
                    user={{ ...user, uid: displayName, originalUid: user.uid }}
                    showBandwidth={!!userStats}
                    bandwidthStats={userStats ? {
                      uplink: userStats.network?.uplink,
                      downlink: userStats.network?.downlink,
                      bitrate: userStats.bitrate
                    } : undefined}
                  />
                  {/* STT Language Selection and Transcription Overlay (only show when STT languages are available) */}
                  {sttAvailableLanguages.length > 0 && (
                    <>
                      {/* Language Selection Controls - Top Left */}
                      <div className="absolute top-2 left-2 z-30 bg-black/90 rounded-lg p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 w-[140px] sm:w-[180px] border border-gray-600">
                        <div>
                          <label className="text-xs text-gray-300 mb-1 block font-semibold">Transcription:</label>
                          <select
                            value={userLangSelection.transcriptionLang}
                            onChange={(e) => {
                              const newTranscriptionLang = e.target.value;
                              setSttUserLanguageSelections(prev => {
                                const newMap = new Map(prev);
                                newMap.set(user.uid, { ...userLangSelection, transcriptionLang: newTranscriptionLang });
                                return newMap;
                              });
                              // Clear old transcriptions/translations for this user
                              setSttTranscriptions(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(user.uid);
                                return newMap;
                              });
                              setSttTranslations(prev => {
                                const newMap = new Map(prev);
                                const userTranslations = newMap.get(user.uid);
                                if (userTranslations) {
                                  userTranslations.clear();
                                  newMap.set(user.uid, userTranslations);
                                }
                                return newMap;
                              });
                              // Update subscription in agoraService
                              const translationMap = new Map();
                              if (userLangSelection.translationLang && sttTranslationPairs.length > 0) {
                                // Check if translation is still valid for new transcription language
                                const translationPair = userLangSelection.translationLang ? sttTranslationPairs.find(
                                  p => p.source === newTranscriptionLang && p.target.includes(userLangSelection.translationLang!)
                                ) : null;
                                if (translationPair) {
                                  translationMap.set(newTranscriptionLang, [userLangSelection.translationLang]);
                                }
                              }
                              agoraService.subscribeToSTTLanguages(user.uid, [newTranscriptionLang], translationMap);
                            }}
                            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white hover:bg-gray-700"
                          >
                            {sttAvailableLanguages.map(lang => {
                              const langName = SOURCE_LANGUAGES.find(l => l.code === lang)?.name || lang;
                              return (
                                <option key={lang} value={lang}>{langName}</option>
                              );
                            })}
                          </select>
                        </div>
                        {sttTranslationPairs.length > 0 && (
                          <div>
                            <label className="text-xs text-gray-300 mb-1 block font-semibold">Translation:</label>
                            <select
                              value={userLangSelection.translationLang || ''}
                              onChange={(e) => {
                                const selectedLang = e.target.value;
                                setSttUserLanguageSelections(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(user.uid, { ...userLangSelection, translationLang: selectedLang });
                                  return newMap;
                                });
                                // Clear old translations for this user when changing translation language
                                setSttTranslations(prev => {
                                  const newMap = new Map(prev);
                                  const userTranslations = newMap.get(user.uid);
                                  if (userTranslations) {
                                    userTranslations.clear();
                                    newMap.set(user.uid, userTranslations);
                                  }
                                  return newMap;
                                });
                                // Find the translation pair for this user's selected transcription language
                                const translationPair = sttTranslationPairs.find(
                                  p => p.source === userLangSelection.transcriptionLang
                                );
                                if (translationPair && selectedLang) {
                                  const translationMap = new Map();
                                  translationMap.set(userLangSelection.transcriptionLang, [selectedLang]);
                                  agoraService.subscribeToSTTLanguages(user.uid, [userLangSelection.transcriptionLang], translationMap);
                                } else if (!selectedLang) {
                                  // Clear translation subscription if "None" is selected
                                  agoraService.subscribeToSTTLanguages(user.uid, [userLangSelection.transcriptionLang], new Map());
                                }
                              }}
                              className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white hover:bg-gray-700"
                            >
                              <option value="">None</option>
                              {sttTranslationPairs
                                .find(p => p.source === userLangSelection.transcriptionLang)
                                ?.target.map(targetLang => {
                                  const langName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
                                  return (
                                    <option key={targetLang} value={targetLang}>{langName}</option>
                                  );
                                })}
                            </select>
                          </div>
                        )}
                      </div>
                      {/* Transcription/Translation Overlay on Video - Bottom */}
                      <div className="absolute bottom-2 left-2 right-2 z-30 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-600/50 max-w-full">
                        {transcription && (transcription.language === userLangSelection.transcriptionLang || transcription.language === effectiveLang || (transcription.language === 'unknown' && effectiveLang)) ? (
                          <>
                            <div className="text-base text-white font-medium mb-1 break-words">{transcription.text}</div>
                            {translation && translation.targetLang === userLangSelection.translationLang && (
                              <div className="text-sm text-gray-300 italic break-words">{translation.text}</div>
                            )}
                          </>
                        ) : (
                          <div className="text-xs text-gray-500 italic">Waiting for transcription...</div>
                        )}
                      </div>
                    </>
                  )}
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
                </div>
              );
            })}
            
            {/* Self (if promoted) */}
            {role === 'promoted' && (
              <div className="relative group shadow-2xl border-2 border-agora-blue rounded-xl overflow-hidden">
                {(() => {
                  const localUid = (agoraService.rtcClient as any)?._uid || -1;
                  const localStats = statsData.get(localUid);
                  const promotedUserLangSelection = sttUserLanguageSelections.get(localUid) || (sttAvailableLanguages.length > 0 ? { transcriptionLang: sttAvailableLanguages[0] } : { transcriptionLang: 'en-US' });
                  // If language selection is 'unknown', try to use first available or fallback to en-US
                  const promotedEffectiveLang = promotedUserLangSelection.transcriptionLang === 'unknown' 
                    ? (sttAvailableLanguages.length > 0 ? sttAvailableLanguages[0] : 'en-US')
                    : promotedUserLangSelection.transcriptionLang;
                  const transcription = sttTranscriptions.get(localUid);
                  const userTranslations = sttTranslations.get(localUid);
                  const translation = promotedUserLangSelection.translationLang && userTranslations 
                    ? userTranslations.get(promotedUserLangSelection.translationLang) 
                    : undefined;
                  
                  return (
                    <>
                      <VideoPlayer 
                        track={localVideoTrack} 
                        isLocal={true}
                        showBandwidth={!!localStats}
                        bandwidthStats={localStats ? {
                          uplink: localStats.network?.uplink || 0,
                          downlink: localStats.network?.downlink || 0,
                          bitrate: localStats.bitrate || 0
                        } : undefined}
                      />
                      {/* STT Language Selection and Transcription Overlay for Promoted User (only show when STT languages are available) */}
                      {sttAvailableLanguages.length > 0 && (
                        <>
                          {/* Language Selection Controls - Top Left */}
                          <div className="absolute top-2 left-2 z-30 bg-black/90 rounded-lg p-1.5 sm:p-2 space-y-1.5 sm:space-y-2 w-[140px] sm:w-[180px] border border-gray-600">
                            <div>
                              <label className="text-xs text-gray-300 mb-1 block font-semibold">Transcription:</label>
                              <select
                                value={promotedUserLangSelection.transcriptionLang}
                              onChange={(e) => {
                                const newTranscriptionLang = e.target.value;
                                setSttUserLanguageSelections(prev => {
                                  const newMap = new Map(prev);
                                  newMap.set(localUid, { ...promotedUserLangSelection, transcriptionLang: newTranscriptionLang });
                                  return newMap;
                                });
                                // Clear old transcriptions/translations for this user
                                setSttTranscriptions(prev => {
                                  const newMap = new Map(prev);
                                  newMap.delete(localUid);
                                  return newMap;
                                });
                                setSttTranslations(prev => {
                                  const newMap = new Map(prev);
                                  const userTranslations = newMap.get(localUid);
                                  if (userTranslations) {
                                    userTranslations.clear();
                                    newMap.set(localUid, userTranslations);
                                  }
                                  return newMap;
                                });
                                // Update subscription in agoraService
                                const translationMap = new Map();
                                if (promotedUserLangSelection.translationLang && sttTranslationPairs.length > 0) {
                                  // Check if translation is still valid for new transcription language
                                  const translationPair = promotedUserLangSelection.translationLang ? sttTranslationPairs.find(
                                    p => p.source === newTranscriptionLang && p.target.includes(promotedUserLangSelection.translationLang!)
                                  ) : null;
                                  if (translationPair) {
                                    translationMap.set(newTranscriptionLang, [promotedUserLangSelection.translationLang]);
                                  }
                                }
                                agoraService.subscribeToSTTLanguages(localUid, [newTranscriptionLang], translationMap);
                              }}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white hover:bg-gray-700"
                              >
                                {sttAvailableLanguages.map(lang => {
                                  const langName = SOURCE_LANGUAGES.find(l => l.code === lang)?.name || lang;
                                  return (
                                    <option key={lang} value={lang}>{langName}</option>
                                  );
                                })}
                              </select>
                            </div>
                            {sttTranslationPairs.length > 0 && (
                              <div>
                                <label className="text-xs text-gray-300 mb-1 block font-semibold">Translation:</label>
                                <select
                                  value={promotedUserLangSelection.translationLang || ''}
                                  onChange={(e) => {
                                    const selectedLang = e.target.value;
                                    setSttUserLanguageSelections(prev => {
                                      const newMap = new Map(prev);
                                      newMap.set(localUid, { ...promotedUserLangSelection, translationLang: selectedLang });
                                      return newMap;
                                    });
                                    // Clear old translations for this user when changing translation language
                                    setSttTranslations(prev => {
                                      const newMap = new Map(prev);
                                      const userTranslations = newMap.get(localUid);
                                      if (userTranslations) {
                                        userTranslations.clear();
                                        newMap.set(localUid, userTranslations);
                                      }
                                      return newMap;
                                    });
                                    // Find the translation pair for this user's selected transcription language
                                    const translationPair = sttTranslationPairs.find(
                                      p => p.source === promotedUserLangSelection.transcriptionLang
                                    );
                                    if (translationPair && selectedLang) {
                                      const translationMap = new Map();
                                      translationMap.set(promotedUserLangSelection.transcriptionLang, [selectedLang]);
                                      agoraService.subscribeToSTTLanguages(localUid, [promotedUserLangSelection.transcriptionLang], translationMap);
                                    } else if (!selectedLang) {
                                      // Clear translation subscription if "None" is selected
                                      agoraService.subscribeToSTTLanguages(localUid, [promotedUserLangSelection.transcriptionLang], new Map());
                                    }
                                  }}
                                  className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1.5 text-xs text-white hover:bg-gray-700"
                                >
                                  <option value="">None</option>
                                  {sttTranslationPairs
                                    .find(p => p.source === promotedUserLangSelection.transcriptionLang)
                                    ?.target.map(targetLang => {
                                      const langName = TARGET_LANGUAGES.find(l => l.code === targetLang)?.name || targetLang;
                                      return (
                                        <option key={targetLang} value={targetLang}>{langName}</option>
                                      );
                                    })}
                                </select>
                              </div>
                            )}
                          </div>
                          {/* Transcription/Translation Overlay on Video - Bottom */}
                          <div className="absolute bottom-2 left-2 right-2 z-30 bg-black/50 backdrop-blur-sm rounded-lg p-3 border border-gray-600/50 max-w-full">
                            {transcription && (transcription.language === promotedUserLangSelection.transcriptionLang || transcription.language === promotedEffectiveLang || (transcription.language === 'unknown' && promotedEffectiveLang)) ? (
                              <>
                                <div className="text-base text-white font-medium mb-1 break-words">{transcription.text}</div>
                                {translation && translation.targetLang === promotedUserLangSelection.translationLang && (
                                  <div className="text-sm text-gray-300 italic break-words">{translation.text}</div>
                                )}
                              </>
                            ) : (
                              <div className="text-xs text-gray-500 italic">Waiting for transcription...</div>
                            )}
                          </div>
                        </>
                      )}
                      {/* Statistics Overlay for promoted user */}
                      {showStats && localStats && (
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
                      )}
                    </>
                  );
                })()}
                {!isCamOn && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
                    <VideoOff size={64} className="text-gray-600" />
                  </div>
                )}
                {/* Local Controls for promoted user */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex space-x-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={toggleMic}
                    className={`p-2 rounded-full ${isMicOn ? 'bg-gray-700' : 'bg-red-600'}`}
                  >
                    {isMicOn ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button 
                    onClick={toggleCam}
                    className={`p-2 rounded-full ${isCamOn ? 'bg-gray-700' : 'bg-red-600'}`}
                  >
                    {isCamOn ? <Video size={20} /> : <VideoOff size={20} />}
                  </button>
                  <button 
                    onClick={() => setShowVirtualBgModal(true)}
                    className={`p-2 rounded-full ${isVirtualBgEnabled ? 'bg-agora-blue' : 'bg-gray-700'}`}
                    title="Virtual Background"
                  >
                    <Image size={20} />
                  </button>
                </div>
              </div>
            )}

            {remoteUsers.length === 0 && role !== 'promoted' && (
              <div className="flex flex-col items-center justify-center bg-gray-800/30 rounded-3xl border-2 border-dashed border-gray-700/50 text-gray-500">
                <div className="p-6 bg-gray-800/50 rounded-full mb-4">
                  <Video size={48} className="text-gray-700" />
                </div>
                <p className="text-lg">Waiting for the host to start the broadcast...</p>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80 xl:w-96 bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-800 flex flex-col shadow-2xl max-h-[50vh] lg:max-h-none">
          <div className="flex border-b border-gray-800">
            <button className="flex-1 py-5 text-sm font-bold border-b-2 border-agora-blue text-agora-blue uppercase tracking-widest">
              Live Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6 space-y-2 sm:space-y-4">
            {/* Participants List - Always visible at top of chat with scrollable max height */}
            <div className="mb-4 pb-4 border-b border-gray-800">
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Participants ({participants.length + 1})</h3>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {/* Self */}
                <div className="flex items-center space-x-2 bg-agora-blue/20 p-2 rounded-lg border border-agora-blue/50">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm font-medium">{userName} (You{role === 'promoted' ? ' - On Stage' : ''})</span>
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
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.senderId === 'You' ? 'items-end' : 'items-start'}`}>
                {!msg.isSystem && (
                  <div className="flex items-center space-x-2 mb-1">
                    <span className={`text-[10px] font-bold uppercase ${msg.senderId === 'You' ? 'text-agora-blue' : 'text-gray-500'}`}>
                      {msg.senderId}
                    </span>
                  </div>
                )}
                <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm shadow-sm ${
                  msg.isSystem
                    ? 'bg-gray-800/50 text-gray-400 italic border border-gray-700/50'
                    : msg.senderId === 'You' 
                    ? 'bg-agora-blue text-white rounded-tr-none' 
                    : 'bg-gray-800 text-gray-200 rounded-tl-none border border-gray-700'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
                <MessageSquare size={32} />
                <p className="text-sm">Welcome to the chat!</p>
              </div>
            )}
          </div>

          <div className="p-3 sm:p-4 lg:p-6 border-t border-gray-800 bg-gray-950">
            <div className="flex space-x-2 sm:space-x-3">
              <input 
                type="text" 
                placeholder="Send a message..." 
                className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue transition-all"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                className="p-2 sm:p-2.5 lg:p-3 bg-agora-blue rounded-2xl text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20 flex-shrink-0"
              >
                <Share2 size={18} className="sm:w-5 sm:h-5 lg:w-[22px] lg:h-[22px]" />
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Virtual Background Modal */}
      {showVirtualBgModal && (
        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6 w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold">Virtual Background</h2>
              <button
                onClick={() => setShowVirtualBgModal(false)}
                className="text-gray-400 hover:text-white text-2xl p-1"
              >
                ×
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Preview */}
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">Preview</h3>
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
              <div className="space-y-3 sm:space-y-4">
                <h3 className="text-base sm:text-lg font-semibold">Background Options</h3>
                
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
    </div>
  );
}

export default function AudiencePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-agora-blue"></div>
      </div>
    }>
      <AudiencePageContent />
    </Suspense>
  );
}

