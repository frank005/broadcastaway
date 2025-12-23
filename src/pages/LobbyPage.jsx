import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Video, Users, ShoppingBag } from 'lucide-react';
import { toast } from 'react-hot-toast';

const LobbyPage = () => {
  const [channelName, setChannelName] = useState('');
  const [userName, setUserName] = useState('');
  const [mode, setMode] = useState('audience'); // 'host' or 'audience'
  const navigate = useNavigate();

  const handleJoin = () => {
    if (!channelName || !userName) {
      toast.error('Please enter both channel name and your name');
      return;
    }

    if (mode === 'host') {
      navigate(`/broadcast/${channelName}?name=${userName}`);
    } else {
      navigate(`/watch/${channelName}?name=${userName}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4">
      <div className="max-w-md w-full agora-card space-y-8 p-8">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-agora-blue rounded-full text-white">
              <Radio size={32} />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-agora-dark">BroadCastaway</h1>
          <p className="text-agora-grey mt-2">The ultimate live shopping experience</p>
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
            <label className="block text-sm font-medium text-agora-dark mb-1">Room Name</label>
            <input
              type="text"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue"
              placeholder="e.g. summer-deals"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <button
              onClick={() => setMode('host')}
              className={`flex flex-col items-center p-4 border-2 rounded-xl transition-all ${
                mode === 'host' ? 'border-agora-blue bg-blue-50' : 'border-gray-100'
              }`}
            >
              <Video className={mode === 'host' ? 'text-agora-blue' : 'text-gray-400'} />
              <span className={`mt-2 font-medium ${mode === 'host' ? 'text-agora-blue' : 'text-gray-400'}`}>Start Hosting</span>
            </button>
            <button
              onClick={() => setMode('audience')}
              className={`flex flex-col items-center p-4 border-2 rounded-xl transition-all ${
                mode === 'audience' ? 'border-agora-blue bg-blue-50' : 'border-gray-100'
              }`}
            >
              <Users className={mode === 'audience' ? 'text-agora-blue' : 'text-gray-400'} />
              <span className={`mt-2 font-medium ${mode === 'audience' ? 'text-agora-blue' : 'text-gray-400'}`}>Join Room</span>
            </button>
          </div>

          <button
            onClick={handleJoin}
            className="w-full agora-btn agora-btn-primary py-3 text-lg mt-4"
          >
            {mode === 'host' ? 'Create Live Stream' : 'Join as Audience'}
          </button>
        </div>

        <div className="pt-6 border-t border-gray-100 flex items-center justify-center text-sm text-agora-grey">
          <ShoppingBag size={16} className="mr-2" />
          Powered by Agora Conversational AI
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;

