'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ShoppingBag, Video, Users, Home, Settings, HelpCircle, X, Menu } from 'lucide-react';
import { toast } from 'react-hot-toast';

function NavigationContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [obsPort, setObsPort] = useState<string>('4455');
  const [obsPassword, setObsPassword] = useState<string>('');
  const [settings, setSettings] = useState({
    videoQuality: '720p',
    audioQuality: '48kHz',
    lowLatency: false,
    autoStartBroadcast: false
  });
  const [availableCameras, setAvailableCameras] = useState<MediaDeviceInfo[]>([]);
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>('');
  const [selectedMicrophone, setSelectedMicrophone] = useState<string>('');
  const [showOBSSetupInstructions, setShowOBSSetupInstructions] = useState(false);
  const [cameraPreviewStream, setCameraPreviewStream] = useState<MediaStream | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement>(null);
  const currentPreviewDeviceId = useRef<string>('');

  useEffect(() => {
    // Get username from URL params or localStorage
    const urlName = searchParams?.get('name');
    if (urlName) {
      setUserName(urlName);
      // Save to localStorage for persistence
      localStorage.setItem('castaway_username', urlName);
    } else {
      // Try to get from localStorage
      const savedName = localStorage.getItem('castaway_username');
      if (savedName) {
        setUserName(savedName);
      }
    }

    // Load settings from localStorage
    const savedSettings = localStorage.getItem('castaway_user_settings');
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setSettings(parsed);
      } catch (e) {
        console.warn('Failed to parse saved settings:', e);
      }
    }

    // Load OBS settings from localStorage
    const savedOBSPort = localStorage.getItem('castaway_obs_port');
    const savedOBSPassword = localStorage.getItem('castaway_obs_password');
    if (savedOBSPort) setObsPort(savedOBSPort);
    if (savedOBSPassword) setObsPassword(savedOBSPassword);

    // Load available devices
    loadDevices();
  }, [searchParams]);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const cameras = devices.filter(d => d.kind === 'videoinput');
      const microphones = devices.filter(d => d.kind === 'audioinput');
      setAvailableCameras(cameras);
      setAvailableMicrophones(microphones);
      
      // Load preferred devices from localStorage
      const preferredCamera = localStorage.getItem('castaway_preferred_camera');
      const preferredMicrophone = localStorage.getItem('castaway_preferred_microphone');
      
      if (cameras.length > 0) {
        if (preferredCamera && cameras.find(c => c.deviceId === preferredCamera)) {
          setSelectedCamera(preferredCamera);
        } else if (!selectedCamera) {
          setSelectedCamera(cameras[0].deviceId);
        }
      }
      if (microphones.length > 0) {
        if (preferredMicrophone && microphones.find(m => m.deviceId === preferredMicrophone)) {
          setSelectedMicrophone(preferredMicrophone);
        } else if (!selectedMicrophone) {
          setSelectedMicrophone(microphones[0].deviceId);
        }
      }
    } catch (err) {
      console.error('Failed to load devices:', err);
    }
  };

  const startCameraPreview = async (deviceId: string) => {
    try {
      // Stop existing preview
      if (cameraPreviewStream) {
        cameraPreviewStream.getTracks().forEach(track => track.stop());
        setCameraPreviewStream(null);
      }

      if (!deviceId) return;

      // Start new preview
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false
      });
      
      setCameraPreviewStream(stream);
      currentPreviewDeviceId.current = deviceId;
      
      if (cameraPreviewRef.current) {
        cameraPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Failed to start camera preview:', err);
      toast.error('Failed to start camera preview');
    }
  };

  const stopCameraPreview = () => {
    if (cameraPreviewStream) {
      cameraPreviewStream.getTracks().forEach(track => track.stop());
      setCameraPreviewStream(null);
    }
    if (cameraPreviewRef.current) {
      cameraPreviewRef.current.srcObject = null;
    }
    currentPreviewDeviceId.current = '';
  };

  // Update preview when camera selection changes
  useEffect(() => {
    if (showSettings && selectedCamera && selectedCamera !== currentPreviewDeviceId.current) {
      startCameraPreview(selectedCamera);
    } else if (!showSettings) {
      stopCameraPreview();
    }

    return () => {
      if (!showSettings) {
        stopCameraPreview();
      }
    };
  }, [selectedCamera, showSettings]);

  const navItems = [
    { path: '/browse', label: 'Browse', icon: Home },
    { path: '/host', label: 'Host', icon: Video },
    { path: '/watch', label: 'Watch', icon: Users },
  ];

  const isActive = (path: string) => {
    if (path === '/browse' && (pathname === '/' || pathname === '/browse')) return true;
    return pathname?.startsWith(path);
  };

  const getUserInitial = () => {
    if (userName) {
      return userName.charAt(0).toUpperCase();
    }
    return 'U';
  };

  return (
    <>
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo */}
            <Link href="/browse" className="flex items-center gap-2 text-lg sm:text-xl font-bold text-gray-900">
              <ShoppingBag className="text-agora-blue" size={20} />
              <span>BroadCastaway</span>
            </Link>

            {/* Navigation Links - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-100 text-agora-blue'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={18} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* Right side - Mobile menu button + User profile */}
            <div className="flex items-center gap-2">
              {/* Mobile Menu Button */}
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors"
                aria-label="Toggle menu"
              >
                {showMobileMenu ? <X size={24} className="text-gray-700" /> : <Menu size={24} className="text-gray-700" />}
              </button>

              {/* User profile icon */}
              <button
                onClick={() => setShowSettings(true)}
                className="w-8 h-8 sm:w-9 sm:h-9 bg-agora-blue rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors cursor-pointer"
                title="Settings"
              >
                <span className="text-white font-medium text-sm">{getUserInitial()}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <div className="container mx-auto px-4 py-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    onClick={() => setShowMobileMenu(false)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                      isActive(item.path)
                        ? 'bg-blue-100 text-agora-blue'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon size={20} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </nav>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-white">Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-400 hover:text-white text-2xl p-1"
              >
                ×
              </button>
            </div>
            <div className="space-y-6">
              {/* User Profile Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-white">Profile</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Your Name</label>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => {
                        const newName = e.target.value;
                        setUserName(newName);
                        localStorage.setItem('castaway_username', newName);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Enter your name"
                    />
                    <p className="text-xs text-gray-500 mt-1">This name will be used when creating or joining rooms</p>
                  </div>
                </div>
              </div>

              {/* Device Settings */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-white">Device Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Camera</label>
                    <select 
                      value={selectedCamera}
                      onChange={(e) => setSelectedCamera(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      {availableCameras.map(camera => (
                        <option key={camera.deviceId} value={camera.deviceId}>
                          {camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`}
                        </option>
                      ))}
                    </select>
                    {/* Camera Preview */}
                    {selectedCamera && (
                      <div className="mt-3 bg-black rounded-lg overflow-hidden aspect-video relative">
                        <video
                          ref={cameraPreviewRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover"
                        />
                        {!cameraPreviewStream && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-gray-500 text-sm">
                            Loading preview...
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Microphone</label>
                    <select 
                      value={selectedMicrophone}
                      onChange={(e) => setSelectedMicrophone(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
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
                    className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold text-white"
                  >
                    Refresh Devices
                  </button>
                </div>
              </div>

              {/* OBS Settings */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-white">OBS WebSocket Settings</h3>
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
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
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                      placeholder="Enter OBS WebSocket password"
                    />
                  </div>
                  <button
                    onClick={() => setShowOBSSetupInstructions(true)}
                    className="w-full bg-gray-700 hover:bg-gray-600 py-2 rounded-lg text-sm font-bold text-white flex items-center justify-center space-x-2"
                  >
                    <HelpCircle size={16} />
                    <span>View OBS Setup Instructions</span>
                  </button>
                </div>
              </div>

              {/* Broadcast Settings */}
              <div className="border-t border-gray-700 pt-4">
                <h3 className="text-lg font-semibold mb-3 text-white">Broadcast Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Video Quality</label>
                    <select 
                      value={settings.videoQuality}
                      onChange={(e) => {
                        const newQuality = e.target.value;
                        const updated = { ...settings, videoQuality: newQuality };
                        setSettings(updated);
                        localStorage.setItem('castaway_user_settings', JSON.stringify(updated));
                        toast.success(`Video quality set to ${newQuality} (will apply on next broadcast)`);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
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
                        const updated = { ...settings, audioQuality: newQuality };
                        setSettings(updated);
                        localStorage.setItem('castaway_user_settings', JSON.stringify(updated));
                        toast.success(`Audio quality set to ${newQuality} (will apply on next broadcast)`);
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white"
                    >
                      <option value="48kHz">High (48kHz)</option>
                      <option value="24kHz">Medium (24kHz)</option>
                      <option value="16kHz">Low (16kHz)</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">Low Latency Mode</span>
                    <input 
                      type="checkbox" 
                      checked={settings.lowLatency}
                      onChange={(e) => setSettings(prev => ({ ...prev, lowLatency: e.target.checked }))}
                      className="w-4 h-4" 
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-white">Auto-start Broadcast</span>
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
                  localStorage.setItem('castaway_user_settings', JSON.stringify(settings));
                  // Also save per-user if username is available
                  if (userName) {
                    const settingsKey = `castaway_settings_${userName.charAt(0).toUpperCase()}`;
                    localStorage.setItem(settingsKey, JSON.stringify(settings));
                  }
                  // Save device preferences
                  if (selectedCamera) {
                    localStorage.setItem('castaway_preferred_camera', selectedCamera);
                  }
                  if (selectedMicrophone) {
                    localStorage.setItem('castaway_preferred_microphone', selectedMicrophone);
                  }
                  toast.success('Settings saved!');
                }}
                className="w-full bg-agora-blue py-2 rounded-lg font-bold text-sm mt-4 text-white"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* OBS Setup Instructions Modal */}
      {showOBSSetupInstructions && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl font-bold text-white">OBS WebSocket Setup</h2>
              <button
                onClick={() => setShowOBSSetupInstructions(false)}
                className="text-gray-400 hover:text-white text-2xl p-1"
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
                <li>Use the OBS Controls button in the broadcast page to connect to OBS</li>
              </ol>
              <div className="mt-6 pt-4 border-t border-gray-700">
                <button
                  onClick={() => setShowOBSSetupInstructions(false)}
                  className="w-full bg-agora-blue hover:bg-blue-600 px-4 py-2 rounded-lg font-bold text-white"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function Navigation() {
  return (
    <Suspense fallback={
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/browse" className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <ShoppingBag className="text-agora-blue" size={24} />
              <span>BroadCastaway</span>
            </Link>
            <div className="flex items-center gap-1">
              <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse" />
            </div>
          </div>
        </div>
      </nav>
    }>
      <NavigationContent />
    </Suspense>
  );
}

