import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, PhoneOff, 
  Users, Settings, Share2, Rocket, Download, Server, Bot, Play, Pause
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import agoraService from '../services/agoraService';
import VideoPlayer from '../components/VideoPlayer';

const BroadcastPage = () => {
  const { channelName } = useParams();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get('name');
  const navigate = useNavigate();

  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState([]);
  const [promotionRequests, setPromotionRequests] = useState([]);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat', 'participants', 'media'
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaTab, setMediaTab] = useState('pull'); // 'pull', 'push', 'gateway'
  const [pullUrl, setPullUrl] = useState('');
  const [pushUrl, setPushUrl] = useState('');
  const [isAiMode, setIsAiMode] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [mediaPullState, setMediaPullState] = useState({
    isPlaying: false,
    volume: 100,
    seekPosition: 0
  });
  const [screenShareTrack, setScreenShareTrack] = useState(null);

  useEffect(() => {
    const init = async () => {
      const appId = process.env.REACT_APP_AGORA_APP_ID;
      if (!appId) {
        toast.error('Agora App ID not configured');
        return;
      }

      await agoraService.init(appId, userName);
      
      agoraService.onPromotionRequest = (userId) => {
        setPromotionRequests(prev => [...new Set([...prev, userId])]);
        toast(`${userId} requested to join the stage!`, { icon: '🙌' });
      };

      agoraService.onMessageReceived = (content, senderId) => {
        setChatMessages(prev => [...prev, { senderId, content, timestamp: new Date() }]);
      };

      agoraService.onTrackPublished = (user, type) => {
        if (type === 'video') {
          setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
        }
      };

      agoraService.onTrackUnpublished = (user, type) => {
        if (type === 'video') {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        }
      };

      agoraService.onScreenShareStarted = () => {
        setIsScreenSharing(true);
        setScreenShareTrack(agoraService.localScreenTrack);
      };

      agoraService.onScreenShareStopped = () => {
        setIsScreenSharing(false);
        setScreenShareTrack(null);
      };

      try {
        await agoraService.join(channelName, 'host');
        setLocalVideoTrack(agoraService.localVideoTrack);
        setLocalAudioTrack(agoraService.localAudioTrack);
        toast.success('Broadcast started!');
      } catch (err) {
        toast.error('Failed to join channel');
        console.error(err);
      }
    };

    init();

    return () => {
      agoraService.leave();
    };
  }, [channelName, userName]);

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

  const handleEndStream = async () => {
    await agoraService.leave();
    navigate('/');
  };

  const handlePromote = async (userId) => {
    await agoraService.promoteUser(userId);
    setPromotionRequests(prev => prev.filter(id => id !== userId));
    toast.success(`Promoted ${userId} to stage`);
  };

  const handleDemote = async (userId) => {
    await agoraService.demoteUser(userId);
    toast(`Demoted ${userId} from stage`, { icon: '👋' });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await agoraService.sendChatMessage(newMessage);
    setChatMessages(prev => [...prev, { senderId: 'You', content: newMessage, timestamp: new Date() }]);
    setNewMessage('');
  };

  const handleScreenShare = async () => {
    try {
      if (isScreenSharing) {
        await agoraService.stopScreenShare();
        toast.success('Screen share stopped');
      } else {
        await agoraService.startScreenShare();
        toast.success('Screen share started!');
      }
    } catch (err) {
      toast.error(`Screen share failed: ${err.message}`);
    }
  };

  const startPull = async () => {
    try {
      await agoraService.startMediaPull(pullUrl);
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

  const updateMediaPullVolume = async (volume) => {
    try {
      await agoraService.updateMediaPull({ volume });
      setMediaPullState(prev => ({ ...prev, volume }));
    } catch (err) {
      toast.error('Failed to update volume');
    }
  };

  const seekMediaPull = async (position) => {
    try {
      await agoraService.updateMediaPull({ seekPosition: position });
      setMediaPullState(prev => ({ ...prev, seekPosition: position }));
      toast(`Seeked to ${position}s`);
    } catch (err) {
      toast.error('Failed to seek');
    }
  };

  const startPush = async () => {
    try {
      await agoraService.startMediaPush(pushUrl);
      toast.success('Media push started!');
    } catch (err) {
      toast.error('Failed to start media push');
    }
  };

  const startGateway = async () => {
    try {
      const res = await agoraService.startMediaGateway();
      const { streamKey, serverUrl } = res.data.stream;
      toast.success('Gateway stream key created!');
      console.log('Server URL:', serverUrl);
      console.log('Stream Key:', streamKey);
    } catch (err) {
      toast.error('Failed to create gateway');
    }
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
      // In a real app, we would call stopAgent here
      toast('AI Agent stopped', { id: 'ai-agent' });
    }
  };

  return (
    <div className="flex flex-col h-screen bg-agora-dark text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-agora-dark border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-red-600 px-3 py-1 rounded-full animate-pulse">
            <div className="w-2 h-2 bg-white rounded-full"></div>
            <span className="text-xs font-bold uppercase tracking-wider">Live</span>
          </div>
          <h1 className="text-lg font-bold">{channelName}</h1>
          <span className="text-gray-400 text-sm">|</span>
          <span className="text-gray-400 text-sm">Host: {userName}</span>
        </div>
        <div className="flex items-center space-x-4">
          <button 
            onClick={toggleAiMode}
            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-all ${
              isAiMode ? 'bg-agora-blue text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            <Bot size={18} />
            <span className="font-medium">AI Agent {isAiMode ? 'ON' : 'OFF'}</span>
          </button>
          <button 
            onClick={handleEndStream}
            className="flex items-center space-x-2 bg-agora-error px-4 py-2 rounded-lg hover:bg-red-600 transition-all font-bold"
          >
            <PhoneOff size={18} />
            <span>End Stream</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className={`flex-1 grid gap-4 ${
            (remoteUsers.length + (screenShareTrack ? 1 : 0)) > 1 ? 'grid-cols-2' : 'grid-cols-1'
          }`}>
            <div className="relative group">
              <VideoPlayer track={localVideoTrack} isLocal={true} />
              {!isCamOn && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-lg">
                  <VideoOff size={64} className="text-gray-600" />
                </div>
              )}
            </div>
            {screenShareTrack && (
              <div className="relative group border-2 border-agora-blue rounded-xl overflow-hidden">
                <VideoPlayer track={screenShareTrack} isLocal={true} />
                <div className="absolute top-4 left-4 bg-agora-blue px-3 py-1 rounded-full text-xs font-bold">
                  Screen Share
                </div>
              </div>
            )}
            {remoteUsers.map(user => (
              <div key={user.uid} className="relative group">
                <VideoPlayer track={user.videoTrack} user={user} />
                <button 
                  onClick={() => handleDemote(user.uid)}
                  className="absolute top-4 right-4 bg-red-600 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Users size={16} />
                </button>
              </div>
            ))}
            {remoteUsers.length === 0 && (
              <div className="flex items-center justify-center bg-gray-800/50 rounded-lg border-2 border-dashed border-gray-700 text-gray-500">
                <p>Waiting for promoted co-hosts...</p>
              </div>
            )}
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
            <button className="p-4 rounded-full bg-gray-700 text-white hover:bg-gray-600 transition-all">
              <Settings size={24} />
            </button>
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
              <div className="space-y-4">
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex flex-col ${msg.senderId === 'You' ? 'items-end' : 'items-start'}`}>
                    <span className="text-xs text-gray-500 mb-1">{msg.senderId}</span>
                    <div className={`px-4 py-2 rounded-2xl max-w-[80%] ${msg.senderId === 'You' ? 'bg-agora-blue text-white' : 'bg-gray-800 text-gray-300'}`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'participants' && (
              <div className="space-y-6">
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
                                onClick={() => agoraService.deleteMediaPull().then(() => toast.success('Media pull stopped'))}
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
                      <input 
                        type="text" 
                        placeholder="RTMP Push URL" 
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue"
                        value={pushUrl}
                        onChange={(e) => setPushUrl(e.target.value)}
                      />
                      <button onClick={startPush} className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm">Start Media Push</button>
                    </div>
                  )}
                  {mediaTab === 'gateway' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-400">Connect OBS or external encoder to this channel.</p>
                      <button onClick={startGateway} className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm">Create Gateway Stream</button>
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
                placeholder="Type a message..." 
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                className="p-2 bg-agora-blue rounded-xl text-white"
              >
                <Share2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default BroadcastPage;

