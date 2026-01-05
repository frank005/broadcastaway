'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Radio, Video } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function HostPage() {
  const [channelName, setChannelName] = useState('');
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Load saved name from localStorage
    const savedName = localStorage.getItem('castaway_username');
    if (savedName) {
      setUserName(savedName);
    }
  }, []);

  const handleStart = () => {
    if (!channelName || !userName) {
      toast.error('Please enter both channel name and your name');
      return;
    }

    // Clean and normalize channel name
    const cleanedName = channelName.trim().toLowerCase().replace(/\s+/g, '-');
    
    // Add bc_ prefix if not already present
    const finalChannelName = cleanedName.startsWith('bc_') 
      ? cleanedName 
      : `bc_${cleanedName}`;

    console.log('📺 [HOST] Original channel name:', channelName);
    console.log('📺 [HOST] Final channel name:', finalChannelName);

    // Check for auto-start broadcast setting
    const savedSettings = localStorage.getItem('castaway_user_settings');
    let autoStart = false;
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        autoStart = parsed.autoStartBroadcast || false;
      } catch (e) {
        console.warn('Failed to parse saved settings:', e);
      }
    }

    // Save name to localStorage
    localStorage.setItem('castaway_username', userName);
    
    // Build URL with autoStart parameter if enabled
    const urlParams = new URLSearchParams({ name: userName });
    if (autoStart) {
      urlParams.append('autoStart', 'true');
    }
    
    router.push(`/broadcast/${finalChannelName}?${urlParams.toString()}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-3 sm:px-4 py-4">
      <div className="max-w-md w-full agora-card space-y-6 sm:space-y-8 p-5 sm:p-8">
        <div className="text-center">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="p-2.5 sm:p-3 bg-agora-blue rounded-full text-white">
              <Video size={28} className="sm:w-8 sm:h-8" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-agora-dark">Start Broadcasting</h1>
          <p className="text-agora-grey mt-2 text-sm sm:text-base">Create your live stream</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-agora-dark mb-1.5">Your Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue text-base"
              placeholder="e.g. John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-agora-dark mb-1.5">Channel Name</label>
            <input
              type="text"
              className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue text-base"
              placeholder="e.g. summer-deals"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
            <p className="mt-1.5 text-xs text-gray-500">
              Channel will be created as: <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">bc_{channelName.trim() || 'your-name'}</code>
            </p>
          </div>

          <button
            onClick={handleStart}
            className="w-full agora-btn agora-btn-primary py-3.5 text-base sm:text-lg mt-4 font-semibold"
          >
            Start Live Stream
          </button>
        </div>
      </div>
    </div>
  );
}

