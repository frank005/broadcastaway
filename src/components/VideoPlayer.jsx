import React, { useEffect, useRef } from 'react';

const VideoPlayer = ({ track, user, isLocal = false }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !track) return;

    track.play(containerRef.current);
    
    return () => {
      track.stop();
    };
  }, [track]);

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <div ref={containerRef} className="w-full h-full"></div>
      <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-md px-3 py-1 rounded-full text-white text-sm">
        {isLocal ? 'You (Host)' : user?.uid || 'Remote User'}
      </div>
    </div>
  );
};

export default VideoPlayer;

