'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Users, Play, RefreshCw, AlertCircle, Clock } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Channel {
  name: string;
  hostCount: number;
  viewerCount: number;
  totalUsers: number;
  uidCount: number;
  updatedAt?: string;
}

export default function ChannelList() {
  const router = useRouter();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const isFetchingRef = useRef(false);

  // Fetch host information for a specific channel
  const fetchHostInfo = async (channelName: string) => {
    try {
      const response = await fetch(`/api/hosts?channel=${encodeURIComponent(channelName)}`);
      const data = await response.json();
      
      if (data.success) {
        return {
          hostCount: data.data.hostCount || 0,
          viewerCount: data.data.viewerCount || 0,
          totalUsers: data.data.totalUsers || 0
        };
      } else {
        console.warn(`Failed to fetch host info for ${channelName}:`, data.error);
        return { hostCount: 0, viewerCount: 0, totalUsers: 0 };
      }
    } catch (error) {
      console.warn(`Error fetching host info for ${channelName}:`, error);
      return { hostCount: 0, viewerCount: 0, totalUsers: 0 };
    }
  };

  const fetchChannels = useCallback(async () => {
    // Cancel any previous request first
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Reset fetching state if it was stuck
    if (isFetchingRef.current) {
      console.log('🔄 [CHANNEL LIST] Resetting stuck fetch state...');
      isFetchingRef.current = false;
    }

    // Create new abort controller for this request
    const controller = new AbortController();
    abortControllerRef.current = controller;
    isFetchingRef.current = true;

    try {
      setError(null);
      setRefreshing(true);
      setLoading(true); // Ensure loading state is set
      
      const params = new URLSearchParams({
        page: '0',
        pageSize: '50',
      });
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      // Step 1: Get channel list
      const response = await fetch(`/api/channels?${params}`, {
        signal: controller.signal,
      });
      
      // Check if request was aborted
      if (controller.signal.aborted) {
        return;
      }
      
      const data = await response.json();
      
      // Check again after async operation
      if (controller.signal.aborted) {
        return;
      }
      
      if (data.success) {
        console.log('📊 [CHANNEL LIST] Step 1 - Channel list received:', data.channels);
        
        // Step 2: Batch fetch host info for all channels at once
        // Instead of individual calls, we could batch this, but for now we'll add a small delay
        // to prevent overwhelming the API
        const channelsWithHosts = await Promise.all(
          data.channels.map(async (channel: Channel, index: number) => {
            // Stagger requests slightly to reduce load spikes
            if (index > 0 && index % 5 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            const hostInfo = await fetchHostInfo(channel.name);
            console.log(`📊 [CHANNEL LIST] Step 2 - Host info for ${channel.name}:`, hostInfo);
            
            // Use the exact counts from the host API
            const totalUsers = hostInfo.totalUsers || 0;
            const hostCount = hostInfo.hostCount || 0;
            const viewerCount = hostInfo.viewerCount || 0;
            
            return {
              ...channel,
              hostCount,
              viewerCount,
              totalUsers
            };
          })
        );
        
        // Step 3: Filter out channels with no users (non-existent or empty channels)
        const activeChannels = channelsWithHosts.filter(channel => channel.totalUsers > 0);
        console.log(`📊 [CHANNEL LIST] Step 3 - Filtered ${channelsWithHosts.length} channels to ${activeChannels.length} active channels`);
        
        setChannels(activeChannels);
      } else {
        setError(data.error || 'Failed to fetch channels');
      }
    } catch (err: any) {
      // Don't set error if request was aborted
      if (err.name === 'AbortError') {
        console.log('⏸️ [CHANNEL LIST] Request aborted');
        // Still reset state even if aborted
        setLoading(false);
        setRefreshing(false);
        isFetchingRef.current = false;
        return;
      }
      console.error('❌ [CHANNEL LIST] Error fetching channels:', err);
      setError(err.message || 'Failed to fetch channels');
      setLoading(false);
      setRefreshing(false);
    } finally {
      // Always reset fetching state, even if aborted
      if (!controller.signal.aborted) {
        setLoading(false);
        setRefreshing(false);
      }
      // Always reset the fetching ref to allow new requests
      isFetchingRef.current = false;
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-refresh is disabled by default to reduce function calls
  // Users can enable it via the toggle button in the UI
  useEffect(() => {
    if (searchTerm.trim()) return; // Don't auto-refresh when searching
    if (!autoRefreshEnabled) return; // Only refresh if enabled by user
    
    // Get refresh interval from env, or default to 30 seconds
    const refreshMs = parseInt(process.env.NEXT_PUBLIC_CHANNEL_LIST_REFRESH_MS || '30000');
    const intervalMs = refreshMs > 0 ? refreshMs : 30000;
    
    // Only refresh if page is visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && !isFetchingRef.current) {
        fetchChannels();
      }
    };
    
    const interval = setInterval(() => {
      // Only refresh if page is visible and not already fetching
      if (document.visibilityState === 'visible' && !isFetchingRef.current) {
        fetchChannels();
      }
    }, intervalMs);

    // Also refresh when page becomes visible again
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      // Cleanup: abort any in-flight request when component unmounts
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [fetchChannels, searchTerm, autoRefreshEnabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleJoinChannel = (channelName: string) => {
    router.push(`/watch/${channelName}`);
  };

  const formatViewerCount = (hostCount: number, viewerCount: number) => {
    if (hostCount === 0 && viewerCount === 0) return 'No activity';
    if (hostCount === 0) {
      if (viewerCount === 1) return '1 viewer';
      return `${viewerCount} viewers`;
    }
    if (viewerCount === 0) {
      return `${hostCount} host${hostCount > 1 ? 's' : ''}`;
    }
    return `${hostCount} host${hostCount > 1 ? 's' : ''} • ${viewerCount} viewer${viewerCount > 1 ? 's' : ''}`;
  };

  const formatChannelName = (name: string) => {
    if (!name) return 'Unknown Channel';
    // Remove bc_ prefix and clean up channel names
    let cleaned = name.replace(/^bc_/, '');
    // Remove random suffix pattern (_1234) if present
    cleaned = cleaned.replace(/_\d+$/, '');
    // Replace underscores with spaces
    cleaned = cleaned.replace(/_/g, ' ');
    return cleaned;
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          Live Broadcasting Channels
        </h1>
        <p className="text-gray-600 text-sm sm:text-base">
          Discover and join live broadcasts
        </p>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-5 sm:mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue focus:border-transparent text-base"
          />
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchChannels}
            disabled={refreshing}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-agora-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors font-medium"
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setAutoRefreshEnabled(!autoRefreshEnabled)}
            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors font-medium ${
              autoRefreshEnabled
                ? 'bg-green-500 text-white hover:bg-green-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
            title={autoRefreshEnabled ? 'Auto-refresh enabled (click to disable)' : 'Auto-refresh disabled (click to enable)'}
          >
            <Clock size={16} className={autoRefreshEnabled ? 'animate-pulse' : ''} />
            <span className="hidden sm:inline">{autoRefreshEnabled ? 'Auto' : 'Manual'}</span>
          </button>
        </div>
      </div>

      {/* Info Note */}
      <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p>
          <strong>Note:</strong> Auto-refresh is disabled by default to reduce server load. 
          Click the <strong>Refresh</strong> button to update the channel list, or enable <strong>Auto</strong> for automatic updates.
        </p>
      </div>

      {/* Stats */}
      <div className="mb-6 text-sm text-gray-600">
        <span>{channels.length} active channel{channels.length !== 1 ? 's' : ''} found</span>
        {searchTerm && (
          <span className="ml-4">Searching for: &quot;{searchTerm}&quot;</span>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-agora-blue mx-auto mb-4" />
          <p className="text-gray-600">Loading channels...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Channels</h3>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchChannels}
            className="px-4 py-2 bg-agora-blue text-white rounded-lg hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-12">
          <Users className="mx-auto mb-4 text-gray-400" size={48} />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Channels Found</h3>
          <p className="text-gray-600">
            {searchTerm 
              ? `No channels match "${searchTerm}"`
              : 'No live channels available right now'
            }
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow"
            >
              <div className="mb-3 sm:mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-1.5 sm:mb-2 truncate">
                  {formatChannelName(channel.name)}
                </h3>

                <div className="flex items-center gap-1.5 text-sm text-gray-500">
                  <Users size={16} />
                  <span>{formatViewerCount(channel.hostCount || 0, channel.viewerCount || 0)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="text-xs text-gray-500 truncate">
                  {channel.updatedAt && (
                    <span>Updated {new Date(channel.updatedAt).toLocaleTimeString()}</span>
                  )}
                </div>

                <button
                  onClick={() => handleJoinChannel(channel.name)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-agora-blue text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex-shrink-0"
                >
                  <Play size={16} />
                  <span>Watch</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

