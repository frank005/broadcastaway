import React, { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, 
  Users, MessageSquare, Share2, Rocket, Hand
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import agoraService from '../services/agoraService';
import VideoPlayer from '../components/VideoPlayer';

const AudiencePage = () => {
  const { channelName } = useParams();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get('name');
  const navigate = useNavigate();

  const [remoteUsers, setRemoteUsers] = useState([]);
  const [role, setRole] = useState('audience'); // 'audience' or 'promoted'
  const [localVideoTrack, setLocalVideoTrack] = useState(null);
  const [localAudioTrack, setLocalAudioTrack] = useState(null);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isCamOn, setIsCamOn] = useState(true);
  const [hasApplied, setHasApplied] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');

  useEffect(() => {
    const init = async () => {
      const appId = process.env.REACT_APP_AGORA_APP_ID;
      if (!appId) {
        toast.error('Agora App ID not configured');
        return;
      }

      await agoraService.init(appId, userName);

      agoraService.onMessageReceived = (content, senderId) => {
        setChatMessages(prev => [...prev, { senderId, content, timestamp: new Date() }]);
      };

      agoraService.onTrackPublished = (user, type) => {
        if (type === 'video') {
          // In a real app, we might check if user.uid is the host
          // For now, first user to publish is likely the host
          setRemoteUsers(prev => [...prev.filter(u => u.uid !== user.uid), user]);
        }
      };

      agoraService.onTrackUnpublished = (user, type) => {
        if (type === 'video') {
          setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        }
      };

      agoraService.onPromoted = () => {
        setRole('promoted');
        setLocalVideoTrack(agoraService.localVideoTrack);
        setLocalAudioTrack(agoraService.localAudioTrack);
        toast.success('You are now ON STAGE!', { duration: 5000, icon: '🌟' });
      };

      agoraService.onDemoted = () => {
        setRole('audience');
        setLocalVideoTrack(null);
        setLocalAudioTrack(null);
        toast('You have been moved back to audience', { icon: '👋' });
      };

      try {
        await agoraService.join(channelName, 'audience');
        toast.success(`Joined ${channelName}`);
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

  const handleLeave = async () => {
    await agoraService.leave();
    navigate('/');
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;
    await agoraService.sendChatMessage(newMessage);
    setChatMessages(prev => [...prev, { senderId: 'You', content: newMessage, timestamp: new Date() }]);
    setNewMessage('');
  };

  return (
    <div className="flex flex-col h-screen bg-agora-dark text-white overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-agora-dark border-b border-gray-800">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-agora-blue px-3 py-1 rounded-full">
            <Users size={14} className="text-white" />
            <span className="text-xs font-bold uppercase tracking-wider">Watching</span>
          </div>
          <h1 className="text-lg font-bold">{channelName}</h1>
          <span className="text-gray-400 text-sm">|</span>
          <span className="text-gray-400 text-sm">{userName}</span>
        </div>
        <div className="flex items-center space-x-4">
          {role === 'audience' ? (
            <button 
              onClick={handleApply}
              disabled={hasApplied}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg font-bold transition-all ${
                hasApplied ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-agora-blue text-white hover:bg-blue-600'
              }`}
            >
              <Hand size={18} />
              <span>{hasApplied ? 'Request Sent' : 'Ask to Join Stage'}</span>
            </button>
          ) : (
            <button 
              onClick={handleDemoteSelf}
              className="flex items-center space-x-2 bg-agora-warning text-agora-dark px-4 py-2 rounded-lg hover:bg-yellow-500 transition-all font-bold"
            >
              <Rocket size={18} />
              <span>Leave Stage</span>
            </button>
          )}
          <button 
            onClick={handleLeave}
            className="flex items-center space-x-2 bg-gray-800 px-4 py-2 rounded-lg hover:bg-gray-700 transition-all text-gray-300"
          >
            <PhoneOff size={18} />
            <span>Leave Room</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden">
        {/* Main Stage */}
        <div className="flex-1 flex flex-col p-6 space-y-4">
          <div className={`flex-1 grid gap-4 ${remoteUsers.length + (role === 'promoted' ? 1 : 0) > 1 ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {/* Host / Other Promoted Users */}
            {remoteUsers.map(user => (
              <div key={user.uid} className="relative group shadow-2xl">
                <VideoPlayer track={user.videoTrack} user={user} />
              </div>
            ))}
            
            {/* Self (if promoted) */}
            {role === 'promoted' && (
              <div className="relative group shadow-2xl border-2 border-agora-blue rounded-xl overflow-hidden">
                <VideoPlayer track={localVideoTrack} isLocal={true} />
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
        <div className="w-96 bg-gray-900 border-l border-gray-800 flex flex-col shadow-2xl">
          <div className="flex border-b border-gray-800">
            <button className="flex-1 py-5 text-sm font-bold border-b-2 border-agora-blue text-agora-blue uppercase tracking-widest">
              Live Chat
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex flex-col ${msg.senderId === 'You' ? 'items-end' : 'items-start'}`}>
                <div className="flex items-center space-x-2 mb-1">
                  <span className={`text-[10px] font-bold uppercase ${msg.senderId === 'You' ? 'text-agora-blue' : 'text-gray-500'}`}>
                    {msg.senderId}
                  </span>
                </div>
                <div className={`px-4 py-2.5 rounded-2xl max-w-[90%] text-sm shadow-sm ${
                  msg.senderId === 'You' 
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

          <div className="p-6 border-t border-gray-800 bg-gray-950">
            <div className="flex space-x-3">
              <input 
                type="text" 
                placeholder="Send a message..." 
                className="flex-1 bg-gray-900 border border-gray-800 rounded-2xl px-5 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-agora-blue transition-all"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button 
                onClick={handleSendMessage}
                className="p-3 bg-agora-blue rounded-2xl text-white hover:bg-blue-600 transition-all shadow-lg shadow-blue-500/20"
              >
                <Share2 size={22} />
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default AudiencePage;

