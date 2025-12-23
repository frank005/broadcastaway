'use client';

import { useState, useEffect, useCallback } from 'react';
import { Search, Users, Play, RefreshCw, AlertCircle } from 'lucide-react';
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

  const fetchChannels = useCallback(async () => {
    try {
      setError(null);
      setRefreshing(true);
      
      const params = new URLSearchParams({
        page: '0',
        pageSize: '50',
      });
      
      if (searchTerm.trim()) {
        params.append('search', searchTerm.trim());
      }
      
      const response = await fetch(`/api/channels?${params}`);
      const data = await response.json();
      
      if (data.success) {
        setChannels(data.channels || []);
      } else {
        setError(data.error || 'Failed to fetch channels');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [searchTerm]);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (searchTerm.trim()) return; // Don't auto-refresh when searching
    
    const interval = setInterval(() => {
      if (!loading && !refreshing) {
        fetchChannels();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchChannels, loading, refreshing, searchTerm]);

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
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Live Broadcasting Channels
        </h1>
        <p className="text-gray-600">
          Discover and join live broadcasts
        </p>
      </div>

      {/* Search and Controls */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search channels..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-agora-blue focus:border-transparent"
          />
        </div>
        
        <button
          onClick={fetchChannels}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-3 bg-agora-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </button>
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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {channels.map((channel) => (
            <div
              key={channel.name}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 truncate">
                  {formatChannelName(channel.name)}
                </h3>
                
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users size={16} />
                  <span>{formatViewerCount(channel.hostCount || 0, channel.viewerCount || 0)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {channel.updatedAt && (
                    <span>Updated {new Date(channel.updatedAt).toLocaleTimeString()}</span>
                  )}
                </div>
                
                <button
                  onClick={() => handleJoinChannel(channel.name)}
                  className="flex items-center gap-2 px-4 py-2 bg-agora-blue text-white rounded-lg hover:bg-blue-600 transition-colors"
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

