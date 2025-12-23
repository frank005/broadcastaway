'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUp, ArrowDown } from 'lucide-react';

interface VideoPlayerProps {
  track: any;
  user?: any;
  isLocal?: boolean;
  showBandwidth?: boolean;
  bandwidthStats?: {
    uplink?: number;
    downlink?: number;
    bitrate?: number;
  };
}

const VideoPlayer = ({ track, user, isLocal = false, showBandwidth = false, bandwidthStats }: VideoPlayerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const getQualityColor = (quality: number) => {
    if (quality <= 1) return 'text-green-400';
    if (quality <= 2) return 'text-yellow-400';
    if (quality <= 3) return 'text-orange-400';
    return 'text-red-400';
  };

  const getQualityDot = (quality: number) => {
    let colorClass = 'bg-green-400';
    if (quality <= 1) colorClass = 'bg-green-400';
    else if (quality <= 2) colorClass = 'bg-yellow-400';
    else if (quality <= 3) colorClass = 'bg-orange-400';
    else colorClass = 'bg-red-400';
    return <div className={`w-2 h-2 rounded-full ${colorClass}`} />;
  };

  useEffect(() => {
    if (!containerRef.current || !track) {
      if (!track) {
        console.log('⚠️ [VIDEO PLAYER] No track provided');
      }
      return;
    }

    console.log('🎥 [VIDEO PLAYER] Playing track:', {
      trackId: track.getTrackId?.() || 'unknown',
      isLocal,
      hasPlay: typeof track.play === 'function'
    });

    try {
      track.play(containerRef.current);
      console.log('✅ [VIDEO PLAYER] Track play called');
      
      // Set video element styles to ensure proper fitting
      const videoElement = containerRef.current.querySelector('video');
      if (videoElement) {
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';
      }
    } catch (err) {
      console.error('❌ [VIDEO PLAYER] Failed to play track:', err);
    }
    
    return () => {
      try {
        track.stop();
      } catch (err) {
        console.error('❌ [VIDEO PLAYER] Error stopping track:', err);
      }
    };
  }, [track, isLocal]);

  // Monitor for video element and apply styles
  useEffect(() => {
    if (!containerRef.current) return;
    
    const observer = new MutationObserver(() => {
      const videoElement = containerRef.current?.querySelector('video');
      if (videoElement) {
        videoElement.style.width = '100%';
        videoElement.style.height = '100%';
        videoElement.style.objectFit = 'contain';
      }
    });
    
    observer.observe(containerRef.current, { childList: true, subtree: true });
    
    return () => observer.disconnect();
  }, []);

  if (!track) {
    return (
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden flex items-center justify-center">
        <div className="text-gray-500 text-sm">No video track</div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        .video-player-container video {
          width: 100% !important;
          height: 100% !important;
          object-fit: contain !important;
        }
      `}</style>
      <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
        <div 
          ref={containerRef} 
          className="video-player-container w-full h-full"
          style={{ 
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        ></div>
        {/* User Label - Hide for Media Pull users (UID 999) as they don't have RTM sync */}
        {(() => {
          // Check if this is a Media Pull user (UID 999, no RTM sync)
          // Media Pull users have UID 999 and no RTM user ID
          const uidValue = user?.uid;
          const rtmUserId = user?.rtmUserId;
          const originalUid = user?.originalUid || user?.uid; // Check if originalUid is preserved
          
          // Media Pull uses UID 999 and doesn't have RTM sync
          const isMediaPull = 
            (originalUid === 999 || originalUid === '999') || // Original UID is 999
            (uidValue === 999 || uidValue === '999') || // Current UID is 999
            (typeof uidValue === 'string' && uidValue === 'User-999') || // Display name is User-999
            (!rtmUserId && (originalUid === 999 || originalUid === '999')); // No RTM ID and UID is 999
          
          if (isMediaPull) {
            return null; // Don't show label for Media Pull users
          }
          
          return (
            <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-sm flex items-center gap-2">
              {isLocal ? 'You (Host)' : user?.displayName || user?.uid || 'Remote User'}
            </div>
          );
        })()}
        {/* Bandwidth Indicators - Top Right - Always visible if stats available */}
        {bandwidthStats && (
          <div className="absolute top-4 right-4 bg-black/70 backdrop-blur-md px-2 py-1.5 rounded-full flex items-center gap-2">
            <div className="flex items-center gap-1">
              <ArrowUp className="w-3 h-3 text-white" />
              {getQualityDot(bandwidthStats.uplink || 0)}
            </div>
            <div className="flex items-center gap-1">
              <ArrowDown className="w-3 h-3 text-white" />
              {getQualityDot(bandwidthStats.downlink || 0)}
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default VideoPlayer;

