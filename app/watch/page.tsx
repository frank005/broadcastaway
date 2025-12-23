'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function WatchPage() {
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

  const handleJoin = () => {
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

    console.log('👀 [WATCH] Original channel name:', channelName);
    console.log('👀 [WATCH] Final channel name:', finalChannelName);

    // Save name to localStorage
    localStorage.setItem('castaway_username', userName);
    router.push(`/watch/${finalChannelName}?name=${userName}`);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full agora-card space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-agora-blue rounded-full text-white">
              <Users size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-agora-dark">Join Channel</h1>
          <p className="text-agora-grey mt-2">Enter channel details to watch</p>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-agora-dark mb-1">Your Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue"
              placeholder="e.g. John Doe"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-agora-dark mb-1">Channel Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue"
              placeholder="e.g. summer-deals"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Channel will be joined as: <code className="bg-gray-100 px-1 rounded">bc_{channelName.trim() || 'your-name'}</code>
            </p>
          </div>

          <button
            onClick={handleJoin}
            className="w-full agora-btn agora-btn-primary py-3 text-lg mt-4"
          >
            Join Channel
          </button>
        </div>
      </div>
    </div>
  );
}

