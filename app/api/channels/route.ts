import { NextRequest, NextResponse } from 'next/server';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';
// Mark as dynamic since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const search = searchParams.get('search') || '';
    
    console.log('📊 [CHANNELS API] Request received');
    console.log('📊 [CHANNELS API] Params:', { page, pageSize, search });
    
    // Get Agora credentials
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    
    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [CHANNELS API] Missing credentials');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing Agora credentials',
          channels: [],
          total: 0,
          page,
          pageSize
        },
        { status: 500 }
      );
    }
    
    // Build Agora REST API URL
    // Correct endpoint: https://api.agora.io/dev/v1/channel/{appid}
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    const url = `${baseUrl}/dev/v1/channel/${appId}?page_no=${page}&page_size=${pageSize}`;
    
    console.log('📊 [CHANNELS API] Using endpoint:', url);
    
    // Create Basic Auth header (Buffer is available in Node.js runtime)
    const authString = `${customerId}:${customerSecret}`;
    const auth = Buffer.from(authString).toString('base64');
    
    console.log('📊 [CHANNELS API] Fetching from Agora:', url);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [CHANNELS API] Agora API error:', response.status, errorText);
      return NextResponse.json(
        { 
          success: false, 
          error: `Agora API error: ${response.status}`,
          channels: [],
          total: 0,
          page,
          pageSize
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('📊 [CHANNELS API] Raw Agora response:', JSON.stringify(data, null, 2));
    console.log('📊 [CHANNELS API] Response keys:', Object.keys(data));
    
    // According to Agora docs: { success: true, data: { channels: [...], total_size: 1 } }
    // Use simpler parsing like shopscribe - directly access data.data.channels
    let channels = [];
    
    // Primary format: data.data.channels (as per Agora documentation and shopscribe implementation)
    if (data.data && data.data.channels && Array.isArray(data.data.channels)) {
      channels = data.data.channels;
      console.log('📊 [CHANNELS API] Found channels in data.data.channels:', channels.length);
      console.log('📊 [CHANNELS API] total_size from response:', data.data.total_size);
    } 
    // Fallback: Check if data.success is false but channels might be elsewhere
    else if (!data.success && data.data && Array.isArray(data.data)) {
      channels = data.data;
      console.log('📊 [CHANNELS API] Found channels in data.data (array):', channels.length);
    }
    // Fallback: Check if channels is directly an array
    else if (Array.isArray(data.channels)) {
      channels = data.channels;
      console.log('📊 [CHANNELS API] Found channels as direct array:', channels.length);
    }
    
    console.log('📊 [CHANNELS API] Parsed channels:', channels.length);
    if (channels.length > 0) {
      console.log('📊 [CHANNELS API] First channel sample:', JSON.stringify(channels[0], null, 2));
      console.log('📊 [CHANNELS API] All channel names:', channels.map((ch: any) => ch.channel_name || ch.name || 'NO_NAME'));
    }
    
    // Filter to only show channels starting with "bc_"
    const broadcastChannels = channels.filter((ch: any) => {
      const name = ch.channel_name || ch.name || '';
      return name.startsWith('bc_');
    });
    
    console.log('📊 [CHANNELS API] Broadcast channels (bc_ prefix):', broadcastChannels.length);
    console.log('📊 [CHANNELS API] Broadcast channel names:', broadcastChannels.map((ch: any) => ch.channel_name || ch.name));
    
    // Apply search filter if provided (search within bc_ channels only)
    let filteredChannels = broadcastChannels;
    if (search) {
      filteredChannels = broadcastChannels.filter((ch: any) => {
        const name = (ch.channel_name || ch.name || '').toLowerCase();
        return name.includes(search.toLowerCase());
      });
      console.log('📊 [CHANNELS API] After search filter:', filteredChannels.length);
    }
    
    // Get host/viewer counts for each channel
    const channelsWithCounts = await Promise.all(
      filteredChannels.map(async (channel: any) => {
        const channelName = channel.channel_name || channel.name;
        // Use uid_count from channel data as baseline
        const baseUserCount = channel.uid_count || channel.user_count || 0;
        
        console.log(`📊 [CHANNELS API] Processing channel: ${channelName}, baseUserCount: ${baseUserCount}`);
        
        try {
          // Get channel user list to count hosts vs viewers
          // Correct endpoint: https://api.agora.io/dev/v1/channel/user/{appid}/{channelName}
          const userUrl = `${baseUrl}/dev/v1/channel/user/${appId}/${encodeURIComponent(channelName)}`;
          console.log(`📊 [CHANNELS API] Fetching users from: ${userUrl}`);
          
          const userResponse = await fetch(userUrl, {
            headers: {
              'Authorization': `Basic ${auth}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (userResponse.ok) {
            const userData = await userResponse.json();
            console.log(`📊 [CHANNELS API] User API response for ${channelName}:`, JSON.stringify(userData, null, 2));
            const users = userData.users || userData.data?.users || [];
            
            console.log(`📊 [CHANNELS API] Found ${users.length} users for ${channelName}`);
            
            // Count hosts (users with publish privilege) vs viewers
            let hostCount = 0;
            let viewerCount = 0;
            
            users.forEach((user: any) => {
              if (user.role === 'publisher' || user.role === 'host') {
                hostCount++;
              } else {
                viewerCount++;
              }
            });
            
            // If users array is empty but baseUserCount > 0, use baseUserCount
            // This handles cases where the user API returns empty array but channel has users
            const finalUserCount = users.length > 0 ? users.length : baseUserCount;
            const finalHostCount = users.length > 0 ? hostCount : (baseUserCount > 0 ? 1 : 0);
            const finalViewerCount = users.length > 0 ? viewerCount : Math.max(0, baseUserCount - 1);
            
            const result = {
              ...channel,
              name: channelName,
              hostCount: finalHostCount,
              viewerCount: finalViewerCount,
              totalUsers: finalUserCount,
              uidCount: finalUserCount,
            };
            
            console.log(`📊 [CHANNELS API] Channel ${channelName} result:`, result);
            return result;
          } else {
            const errorText = await userResponse.text();
            console.warn(`⚠️ [CHANNELS API] User API returned ${userResponse.status} for ${channelName}:`, errorText);
          }
        } catch (err) {
          console.warn(`⚠️ [CHANNELS API] Failed to get user count for ${channelName}:`, err);
        }
        
        // Fallback to channel uid_count if detailed user fetch failed
        const fallbackResult = {
          ...channel,
          name: channelName,
          hostCount: baseUserCount > 0 ? 1 : 0, // Assume at least 1 host if there are users
          viewerCount: Math.max(0, baseUserCount - 1), // Rest are viewers
          totalUsers: baseUserCount,
          uidCount: baseUserCount,
        };
        
        console.log(`📊 [CHANNELS API] Channel ${channelName} fallback result:`, fallbackResult);
        return fallbackResult;
      })
    );
    
    // Filter out channels with no users
    const activeChannels = channelsWithCounts.filter((ch: any) => ch.totalUsers > 0);
    
    console.log('📊 [CHANNELS API] Filtered results:', {
      totalChannels: channelsWithCounts.length,
      activeChannels: activeChannels.length,
      filtered: channelsWithCounts.filter((ch: any) => ch.totalUsers === 0).map((ch: any) => ch.name)
    });
    
    console.log('✅ [CHANNELS API] Returning', activeChannels.length, 'active channels');
    
    return NextResponse.json({
      success: true,
      channels: activeChannels,
      total: activeChannels.length,
      page,
      pageSize,
    });
  } catch (error: any) {
    console.error('❌ [CHANNELS API] Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        channels: [],
        total: 0,
        page: 1,
        pageSize: 20
      },
      { status: 500 }
    );
  }
}

