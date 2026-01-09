'use client';

import { useEffect, useState, useRef } from 'react';

interface AIOverlayProps {
  participants: string[];
  remoteUsers: any[];
  agoraService: any;
  isAiMode?: boolean; // Primary indicator - set when AI Agent is started (shows "AI Active" popup)
}

const AIOverlay = ({ participants, remoteUsers, agoraService, isAiMode = false }: AIOverlayProps) => {
  const [isAIPresent, setIsAIPresent] = useState(false);
  const [isAISpeaking, setIsAISpeaking] = useState(false);
  const [hasAudioTrack, setHasAudioTrack] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0); // 0-100 for visualizer (smoothed)
  const [aiUserId, setAiUserId] = useState<number | null>(null); // Track AI user ID for dependencies
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const aiUserRef = useRef<any>(null);
  const smoothedAudioLevelRef = useRef<number>(0); // For exponential smoothing

  // Detect AI user from participants or remoteUsers
  useEffect(() => {
    // Priority 1: Check isAiMode - this is set when "AI Active" popup shows (endpoint returned 200 OK)
    // This is the most reliable indicator that the agent exists
    const hasAgentId = agoraService?.currentAgentId != null;
    const aiIsActive = isAiMode || hasAgentId;
    
    // Hardcoded agent UID (8888) - used when creating the agent
    const AGENT_UID = 8888;
    let aiUser: any = null;
    let foundBy = '';
    
    // If AI mode is active or agent ID exists, we know the agent was created successfully
    if (aiIsActive) {
      // Try to find the user by the hardcoded agent UID (8888)
      // Check remoteUsers array for UID 8888
      aiUser = remoteUsers.find(user => {
        const uid = typeof user.uid === 'string' ? parseInt(user.uid) : user.uid;
        return uid === AGENT_UID;
      });
      
      // If not found, check agoraService.remoteUsers map
      if (!aiUser && agoraService?.remoteUsers) {
        aiUser = agoraService.remoteUsers.get(AGENT_UID);
        if (!aiUser) {
          // Also check as string
          aiUser = agoraService.remoteUsers.get(String(AGENT_UID));
        }
        // Also iterate through all users to find by numeric UID
        if (!aiUser) {
          for (const [uid, user] of agoraService.remoteUsers.entries()) {
            const numericUid = typeof uid === 'string' ? parseInt(uid) : uid;
            if (numericUid === AGENT_UID) {
              aiUser = user;
              break;
            }
          }
        }
      }
      
      if (aiUser) {
        foundBy = 'Agent ID (endpoint response)';
      }
    }
    
    // Priority 2: Check participants for AI (RTM UID ending with "-AI" or "_AI")
    // The actual format from agora-agents route is "{hostName}-AI" (with hyphen)
    if (!aiUser) {
      const aiParticipant = participants.find(p => p.endsWith('-AI') || p.endsWith('_AI'));
      
      if (aiParticipant) {
        // First try to find in remoteUsers array
        aiUser = remoteUsers.find(user => {
          const rtmUserId = agoraService?.userIdMap?.get(user.uid) || user.rtmUserId;
          return rtmUserId === aiParticipant;
        });

        // If not found, check agoraService.remoteUsers map directly
        if (!aiUser && agoraService?.remoteUsers) {
          for (const [uid, user] of agoraService.remoteUsers.entries()) {
            const rtmUserId = agoraService?.userIdMap?.get(uid) || user.rtmUserId;
            if (rtmUserId === aiParticipant) {
              aiUser = user;
              break;
            }
          }
        }
        
        if (aiUser) {
          foundBy = 'RTM UID pattern';
        }
      }
    }
    
    // Priority 3: Fallback - check for UID 8888 even without agent ID
    // This handles edge cases where agent ID might not be set but agent exists
    if (!aiUser && !aiIsActive) {
      aiUser = remoteUsers.find(user => {
        const uid = typeof user.uid === 'string' ? parseInt(user.uid) : user.uid;
        return uid === AGENT_UID;
      });
      
      if (!aiUser && agoraService?.remoteUsers) {
        aiUser = agoraService.remoteUsers.get(AGENT_UID);
        if (!aiUser) {
          aiUser = agoraService.remoteUsers.get(String(AGENT_UID));
        }
        if (!aiUser) {
          for (const [uid, user] of agoraService.remoteUsers.entries()) {
            const numericUid = typeof uid === 'string' ? parseInt(uid) : uid;
            if (numericUid === AGENT_UID) {
              aiUser = user;
              break;
            }
          }
        }
      }
      
      if (aiUser) {
        foundBy = 'UID 8888 (fallback)';
      }
    }
    
    // If we found an AI user OR AI is active (agent was created), mark as present
    // For audience side: if we find the user in participants or remoteUsers, show it
    // Also check if participant with "-AI" exists (like "Aleksey-AI")
    const hasAiParticipant = participants.some(p => p.endsWith('-AI') || p.endsWith('_AI'));
    const aiParticipantName = participants.find(p => p.endsWith('-AI') || p.endsWith('_AI'));
    
    // Show overlay if:
    // 1. We found the AI user in RTC
    // 2. AI is active (isAiMode or hasAgentId) - host side
    // 3. AI participant exists in RTM - audience side
    const shouldShow = aiUser || aiIsActive || hasAiParticipant;
    
    if (shouldShow) {
      setIsAIPresent(true);
      
      if (aiUser) {
        // Only update if the user actually changed
        if (aiUserRef.current?.uid !== aiUser.uid) {
          aiUserRef.current = aiUser;
          setAiUserId(aiUser.uid);
          const rtmUserId = agoraService?.userIdMap?.get(aiUser.uid) || aiUser.rtmUserId;
          console.log('🤖 [AI OVERLAY] AI detected:', {
            rtcUid: aiUser.uid,
            rtmUid: rtmUserId,
            hasAudio: !!aiUser.audioTrack,
            foundBy: foundBy || (hasAiParticipant ? 'Participant list' : 'Agent ID'),
            agentId: agoraService?.currentAgentId,
            isAiMode: isAiMode,
            hasAiParticipant: hasAiParticipant
          });
        }
      } else if (aiIsActive || hasAiParticipant) {
        // Agent ID exists or participant found but user not found in RTC yet (might be joining)
        // Keep showing overlay but don't set user ref yet
        console.log('🤖 [AI OVERLAY] AI active (isAiMode:', isAiMode, ', hasParticipant:', hasAiParticipant, ', participant:', aiParticipantName, ', ID:', agoraService?.currentAgentId, ') but not yet in RTC');
      }
    } else {
      if (isAIPresent) {
        console.log('🤖 [AI OVERLAY] AI no longer present, hiding overlay');
        setIsAIPresent(false);
        aiUserRef.current = null;
        setAiUserId(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAiMode, participants.join(','), remoteUsers.length, agoraService?.currentAgentId]);

  // Monitor AI audio for voice activity
  useEffect(() => {
    if (!isAIPresent) {
      // Clean up if AI is not present
      if (analyserRef.current && audioContextRef.current) {
        try {
          analyserRef.current.disconnect();
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        } catch (err) {
          console.warn('⚠️ [AI OVERLAY] Error cleaning up audio context:', err);
        }
        analyserRef.current = null;
        audioContextRef.current = null;
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsAISpeaking(false);
      setAudioLevel(0);
      return;
    }

    // Re-find the AI user in case it was just added
    const AGENT_UID = 8888;
    let currentUser = aiUserRef.current;
    
    // If we don't have a user ref yet, try to find it by multiple methods
    if (!currentUser) {
      // Method 1: Check for UID 8888
      currentUser = remoteUsers.find(user => {
        const uid = typeof user.uid === 'string' ? parseInt(user.uid) : user.uid;
        return uid === AGENT_UID;
      });
      
      // Method 2: Check by RTM UID pattern (like "Aleksey-AI")
      if (!currentUser) {
        const aiParticipant = participants.find(p => p.endsWith('-AI') || p.endsWith('_AI'));
        if (aiParticipant) {
          currentUser = remoteUsers.find(user => {
            const rtmUserId = agoraService?.userIdMap?.get(user.uid) || user.rtmUserId;
            return rtmUserId === aiParticipant;
          });
        }
      }
      
      // Method 3: Check agoraService.remoteUsers map
      if (!currentUser && agoraService?.remoteUsers) {
        currentUser = agoraService.remoteUsers.get(AGENT_UID);
        if (!currentUser) {
          currentUser = agoraService.remoteUsers.get(String(AGENT_UID));
        }
        if (!currentUser) {
          // Check by RTM UID in agoraService
          const aiParticipant = participants.find(p => p.endsWith('-AI') || p.endsWith('_AI'));
          if (aiParticipant) {
            for (const [uid, user] of agoraService.remoteUsers.entries()) {
              const rtmUserId = agoraService?.userIdMap?.get(uid) || user.rtmUserId;
              if (rtmUserId === aiParticipant) {
                currentUser = user;
                break;
              }
            }
          }
          // Fallback: check all users for UID 8888
          if (!currentUser) {
            for (const [uid, user] of agoraService.remoteUsers.entries()) {
              const numericUid = typeof uid === 'string' ? parseInt(uid) : uid;
              if (numericUid === AGENT_UID) {
                currentUser = user;
                break;
              }
            }
          }
        }
      }
      
      // Method 4: Check RTC client's remoteUsers directly
      if (!currentUser && agoraService?.rtcClient?.remoteUsers) {
        currentUser = agoraService.rtcClient.remoteUsers.find((u: any) => {
          const uid = typeof u.uid === 'string' ? parseInt(u.uid) : u.uid;
          return uid === AGENT_UID;
        });
        if (currentUser) {
          console.log('🤖 [AI OVERLAY] Found AI user from RTC client remoteUsers');
        }
      }
      
      if (currentUser) {
        aiUserRef.current = currentUser;
        setAiUserId(currentUser.uid);
        console.log('🤖 [AI OVERLAY] Found AI user for audio monitoring:', currentUser.uid, 'hasAudio:', !!currentUser.audioTrack);
      } else {
        // No user found yet, but AI is active - wait for it
        console.log('🤖 [AI OVERLAY] AI is present but user not in RTC yet, participants:', participants);
        setIsAISpeaking(false);
        setAudioLevel(0);
        return;
      }
    }

    if (!currentUser) {
      return;
    }

    let audioTrack = currentUser.audioTrack;

    // If audio track not found, try to get it from agoraService
    if (!audioTrack && agoraService?.remoteUsers) {
      const serviceUser = agoraService.remoteUsers.get(currentUser.uid);
      if (serviceUser) {
        audioTrack = serviceUser.audioTrack;
        // Update the ref if we got a better user object
        if (serviceUser.audioTrack && !currentUser.audioTrack) {
          aiUserRef.current = serviceUser;
          currentUser = serviceUser;
        }
      }
    }

    // Also try to get audio track directly from the RTC client if available
    if (!audioTrack && agoraService?.rtcClient) {
      try {
        // Try to find user by UID in RTC client's remoteUsers array
        const rtcUser = agoraService.rtcClient.remoteUsers?.find((u: any) => {
          const uid = typeof u.uid === 'string' ? parseInt(u.uid) : u.uid;
          return uid === AGENT_UID || uid === currentUser.uid;
        });
        if (rtcUser) {
          console.log('🤖 [AI OVERLAY] Found RTC user:', rtcUser.uid, 'hasAudioTrack:', !!rtcUser.audioTrack, 'hasAudio:', rtcUser.hasAudio);
          if (rtcUser.audioTrack) {
            audioTrack = rtcUser.audioTrack;
            console.log('🤖 [AI OVERLAY] Found audio track from RTC client, UID:', rtcUser.uid);
            // Update the ref with the RTC user
            if (!currentUser.audioTrack) {
              aiUserRef.current = rtcUser;
              currentUser = rtcUser;
            }
          }
        } else {
          console.log('🤖 [AI OVERLAY] RTC client remoteUsers:', agoraService.rtcClient.remoteUsers?.map((u: any) => ({ uid: u.uid, hasAudio: u.hasAudio, hasAudioTrack: !!u.audioTrack })));
        }
      } catch (err) {
        console.warn('⚠️ [AI OVERLAY] Error accessing RTC client:', err);
      }
    }

    if (!audioTrack) {
      console.log('🤖 [AI OVERLAY] AI user found but no audio track yet, UID:', currentUser.uid, 'Will retry when track becomes available...');
      setIsAISpeaking(false);
      setAudioLevel(0);
      // Return and let the effect re-run when remoteUsers changes
      return;
    }
    
    console.log('🎤 [AI OVERLAY] Audio track found for AI user:', currentUser.uid, 'Track type:', audioTrack?.constructor?.name, 'Has track:', !!audioTrack);

    // Set up audio analysis
    const setupAudioAnalysis = async () => {
      try {
        // Don't set up if already set up and context is still active
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          console.log('🤖 [AI OVERLAY] Audio context already active, reusing');
          return;
        }

        // Clean up any existing context first
        if (audioContextRef.current) {
          try {
            if (audioContextRef.current.state !== 'closed') {
              await audioContextRef.current.close();
            }
          } catch (err) {
            console.warn('⚠️ [AI OVERLAY] Error closing existing context:', err);
          }
        }

        // Create audio context
        const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        audioContextRef.current = audioContext;

        // Create analyser node
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = 0.3; // Lower for more responsive detection
        analyserRef.current = analyser;

        // Get the audio stream from the track
        // For Agora tracks, try different methods to get the MediaStreamTrack
        let mediaStreamTrack: MediaStreamTrack;
        
        if (typeof (audioTrack as any).getMediaStreamTrack === 'function') {
          mediaStreamTrack = (audioTrack as any).getMediaStreamTrack();
          console.log('🤖 [AI OVERLAY] Got MediaStreamTrack via getMediaStreamTrack()');
        } else if (audioTrack instanceof MediaStreamTrack) {
          mediaStreamTrack = audioTrack;
          console.log('🤖 [AI OVERLAY] AudioTrack is already MediaStreamTrack');
        } else {
          // Try to use the track directly - Agora tracks might work this way
          console.log('🤖 [AI OVERLAY] Trying to use audioTrack directly');
          mediaStreamTrack = audioTrack as any;
        }
        
        // Create a MediaStream from the track
        const mediaStream = new MediaStream([mediaStreamTrack]);
        console.log('🤖 [AI OVERLAY] Created MediaStream with', mediaStream.getAudioTracks().length, 'audio track(s)');
        
        // Create source from stream
        const source = audioContext.createMediaStreamSource(mediaStream);
        source.connect(analyser);
        console.log('🤖 [AI OVERLAY] Connected audio source to analyser');

        // Monitor audio levels - use fftSize for time domain data
        const dataArray = new Uint8Array(analyser.fftSize);
        const threshold = 15; // Lower threshold for better sensitivity

        const checkAudioLevel = () => {
          if (!analyserRef.current || !audioContextRef.current || audioContextRef.current.state === 'closed') {
            return;
          }

          // Use getByteTimeDomainData for better voice detection (waveform data)
          analyserRef.current.getByteTimeDomainData(dataArray);
          
          // Calculate RMS (Root Mean Square) for better voice detection
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128; // Normalize to -1 to 1
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length);
          const volume = rms * 100; // Convert to 0-100 scale

          // Update speaking state based on threshold
          const isSpeaking = volume > threshold;
          setIsAISpeaking(isSpeaking);
          
          // Calculate normalized level (0-100)
          let normalizedLevel = 0;
          if (isSpeaking) {
            // Normalize volume to 0-100, with threshold as minimum
            // Map from threshold to 100, so threshold = 0% and 100 = 100%
            normalizedLevel = Math.min(100, Math.max(0, ((volume - threshold) / (100 - threshold)) * 100));
          }
          
          // Apply exponential smoothing to prevent rapid flashing
          // Smoothing factor: 0.2 = fast response, 0.3 = medium, 0.5 = slow
          // Higher smoothing = slower response but less flashing
          const smoothingFactor = 0.3;
          smoothedAudioLevelRef.current = smoothedAudioLevelRef.current * (1 - smoothingFactor) + normalizedLevel * smoothingFactor;
          
          // Always update state (React will batch updates efficiently)
          setAudioLevel(smoothedAudioLevelRef.current);

          animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
        };

        checkAudioLevel();
        console.log('🤖 [AI OVERLAY] Audio analysis started for AI, threshold:', threshold);
      } catch (err) {
        console.error('❌ [AI OVERLAY] Failed to set up audio analysis:', err);
        setIsAISpeaking(false);
        setAudioLevel(0);
      }
    };

    setupAudioAnalysis();

    // Cleanup function
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (analyserRef.current && audioContextRef.current) {
        try {
          analyserRef.current.disconnect();
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        } catch (err) {
          console.warn('⚠️ [AI OVERLAY] Error cleaning up audio context:', err);
        }
        analyserRef.current = null;
        audioContextRef.current = null;
      }
      setIsAISpeaking(false);
      setAudioLevel(0);
    };
  }, [isAIPresent, aiUserId, remoteUsers.length, participants.join(','), agoraService?.remoteUsers]);

  // Check if AI user has audio track (either directly or from agoraService)
  useEffect(() => {
    if (aiUserRef.current) {
      const directAudio = aiUserRef.current.audioTrack;
      const serviceUser = aiUserRef.current.uid && agoraService?.remoteUsers?.get(aiUserRef.current.uid);
      const serviceAudio = serviceUser?.audioTrack;
      const hasAudio = !!(directAudio || serviceAudio);
      setHasAudioTrack(hasAudio);
      
      // Update the ref with the latest user object if it has audio track
      if (serviceUser && serviceUser.audioTrack && !aiUserRef.current.audioTrack) {
        aiUserRef.current = serviceUser;
      }
    } else {
      setHasAudioTrack(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAIPresent, aiUserId]);

  // Don't render if AI is not present
  if (!isAIPresent) {
    return null;
  }


  // Subtle visual feedback - very smooth transitions
  // Use a very small brightness change (only 5-10% variation) to avoid flashing
  const brightnessMultiplier = 1.0 + (audioLevel / 100) * 0.08; // 1.0 to 1.08 (8% max increase)
  const bgOpacity = 0.8; // Keep opacity constant to avoid flashing
  const shadowIntensity = (audioLevel / 100) * 0.3; // Very subtle shadow

  return (
    <div className="absolute inset-0 z-50 pointer-events-none">
      {/* AI Indicator Overlay - Smoothly transitions from dark to light purple/blue when speaking */}
      <div 
        className="absolute top-4 left-4 backdrop-blur-md px-3 py-2 rounded-lg shadow-lg border flex items-center gap-2.5 transition-all duration-300 ease-out"
        style={{
          background: `linear-gradient(to right, 
            rgba(147, 51, 234, ${bgOpacity * brightnessMultiplier}), 
            rgba(59, 130, 246, ${bgOpacity * brightnessMultiplier})
          )`,
          borderColor: `rgba(192, 132, 252, ${0.25 + shadowIntensity * 0.2})`,
          boxShadow: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 
            0 2px 4px -1px rgba(0, 0, 0, 0.06),
            0 0 ${8 * shadowIntensity}px rgba(147, 51, 234, ${0.2 * shadowIntensity})`,
        }}
      >
        <span className="text-white font-semibold text-sm drop-shadow-sm">
          AI
        </span>
        {/* Always show volume bars - they animate smoothly when speaking */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-end gap-0.5 h-6">
            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => {
              // Base height when not speaking (minimum)
              const minHeight = 4;
              // Max height when speaking - bars go up to near the top
              const maxHeight = 20;
              // Base height for the bar - animation will scale from this
              const baseHeight = isAISpeaking ? maxHeight : minHeight;
              
              const normalizedLevel = Math.min(100, Math.max(0, audioLevel));
              const barOpacity = isAISpeaking 
                ? Math.min(1, 0.5 + (normalizedLevel / 100) * 0.5)
                : 0.25;
              const glowIntensity = Math.min(6, normalizedLevel / 15);
              
              // Animation delay for wave effect (each bar starts at different time)
              // Creates a wave that moves from left to right gradually
              // Pattern: Lower -> Middle -> Top -> Middle -> Lower
              // Increased delay for smoother, more visible wave progression
              const animationDelay = i * 0.15; // Staggered delays for 10 bars (0s, 0.15s, 0.3s, ...)
              
              return (
                <div
                  key={i}
                  className={`w-1.5 rounded-full bg-white ${isAISpeaking ? 'animate-wave-drop' : ''}`}
                  style={{
                    height: `${baseHeight}px`,
                    opacity: barOpacity,
                    boxShadow: isAISpeaking && normalizedLevel > 20 
                      ? `0 0 ${glowIntensity}px rgba(255, 255, 255, 0.6), 0 0 ${glowIntensity * 1.5}px rgba(255, 255, 255, 0.3)` 
                      : 'none',
                    animationDelay: `${animationDelay}s`,
                    transition: isAISpeaking ? 'opacity 150ms ease-out' : 'height 150ms ease-out, opacity 150ms ease-out',
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIOverlay;
