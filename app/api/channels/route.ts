import { NextRequest, NextResponse } from 'next/server';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';
// Mark as dynamic since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    // Agora API uses 0-based indexing (page_no=0 is the first page)
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
    // Agora uses 0-based pagination (page_no=0 is the first page)
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    const url = `${baseUrl}/dev/v1/channel/${appId}?page_no=${page}&page_size=${pageSize}`;
    
    console.log('📊 [CHANNELS API] Using endpoint:', url);
    
    // Create Basic Auth header (Buffer is available in Node.js runtime)
    const authString = `${customerId}:${customerSecret}`;
    const auth = Buffer.from(authString).toString('base64');
    
    console.log('📊 [CHANNELS API] Fetching from Agora:', url);
    
    // Add timeout to prevent hanging requests
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
    
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        console.error('❌ [CHANNELS API] Request timeout');
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout - Agora API took too long to respond',
            channels: [],
            total: 0,
            page,
            pageSize
          },
          { status: 504 }
        );
      }
      throw err;
    }
    
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
    console.log('📊 [CHANNELS API] data.data structure:', data.data ? Object.keys(data.data) : 'no data.data');
    console.log('📊 [CHANNELS API] data.data.channels type:', data.data?.channels ? typeof data.data.channels : 'undefined');
    console.log('📊 [CHANNELS API] data.data.channels isArray:', Array.isArray(data.data?.channels));
    
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
    // NEW: Check if data.data itself is an array (some Agora responses might have this structure)
    else if (data.data && Array.isArray(data.data) && data.data.length > 0) {
      // Check if first element looks like a channel object
      const firstItem = data.data[0];
      if (firstItem && (firstItem.channel_name || firstItem.name || firstItem.channelName)) {
        channels = data.data;
        console.log('📊 [CHANNELS API] Found channels in data.data (direct array):', channels.length);
      }
    }
    
    console.log('📊 [CHANNELS API] Parsed channels:', channels.length);
    console.log('📊 [CHANNELS API] total_size:', data.data?.total_size, 'vs channels.length:', channels.length);
    
    if (channels.length > 0) {
      console.log('📊 [CHANNELS API] First channel sample:', JSON.stringify(channels[0], null, 2));
      console.log('📊 [CHANNELS API] All channel names:', channels.map((ch: any) => ch.channel_name || ch.name || ch.channelName || 'NO_NAME'));
      console.log('📊 [CHANNELS API] All channel keys:', channels.map((ch: any) => Object.keys(ch || {})));
      
      // Log all channel names before filtering
      channels.forEach((ch: any, idx: number) => {
        const name = ch.channel_name || ch.name || ch.channelName || 'NO_NAME';
        const uidCount = ch.uid_count || ch.user_count || ch.uidCount || 0;
        console.log(`📊 [CHANNELS API] Channel ${idx}: name="${name}", uid_count=${uidCount}, keys=${Object.keys(ch).join(',')}`);
      });
    } else if (data.data?.total_size > 0) {
      // If total_size > 0 but channels array is empty, log warning
      console.warn('⚠️ [CHANNELS API] WARNING: total_size indicates channels exist but channels array is empty!');
      console.warn('⚠️ [CHANNELS API] Full data.data structure:', JSON.stringify(data.data, null, 2));
    }
    
    // Filter to only show channels starting with "bc_"
    const broadcastChannels = channels.filter((ch: any) => {
      const name = ch.channel_name || ch.name || ch.channelName || '';
      const matches = name.startsWith('bc_');
      if (!matches && name) {
        console.log(`📊 [CHANNELS API] Channel "${name}" filtered out (doesn't start with bc_)`);
      }
      return matches;
    });
    
    console.log('📊 [CHANNELS API] Broadcast channels (bc_ prefix):', broadcastChannels.length);
    console.log('📊 [CHANNELS API] Broadcast channel names:', broadcastChannels.map((ch: any) => ch.channel_name || ch.name || ch.channelName));
    
    // Apply search filter if provided (search within bc_ channels only)
    let filteredChannels = broadcastChannels;
    if (search) {
      filteredChannels = broadcastChannels.filter((ch: any) => {
        const name = (ch.channel_name || ch.name || '').toLowerCase();
        return name.includes(search.toLowerCase());
      });
      console.log('📊 [CHANNELS API] After search filter:', filteredChannels.length);
    }
    
    // Simplify: Just return basic channel info, let frontend fetch host counts separately
    // This matches shopscribe's approach and is more resilient
    const processedChannels = filteredChannels.map((channel: any) => {
      const channelName = channel.channel_name || channel.name || channel.channelName;
      const baseUserCount = channel.user_count || channel.uid_count || 0;
      
      return {
        ...channel,
        name: channelName,
        // Provide basic counts from channel list response
        // Frontend will fetch detailed counts via /api/hosts
        hostCount: 0, // Will be populated by frontend
        viewerCount: 0, // Will be populated by frontend
        totalUsers: baseUserCount,
        uidCount: baseUserCount,
      };
    });
    
    // Filter out channels with no users (based on uid_count from channel list)
    const activeChannels = processedChannels.filter((ch: any) => {
      const hasUsers = ch.uidCount > 0;
      if (!hasUsers) {
        console.log(`📊 [CHANNELS API] Filtering out channel "${ch.name}" (uidCount: ${ch.uidCount})`);
      }
      return hasUsers;
    });
    
    console.log('📊 [CHANNELS API] Returning', activeChannels.length, 'channels (host counts will be fetched by frontend)');
    
    // Add cache headers to prevent stale data, but allow short-term caching
    // Cache for 2 seconds to reduce load, but ensure fresh data
    return NextResponse.json({
      success: true,
      channels: activeChannels,
      total: activeChannels.length,
      page,
      pageSize,
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=2, stale-while-revalidate=5',
      },
    });
  } catch (error: any) {
    console.error('❌ [CHANNELS API] Error:', error);
    const page = parseInt(new URL(request.url).searchParams.get('page') || '0');
    return NextResponse.json(
      { 
        success: false, 
        error: error.message,
        channels: [],
        total: 0,
        page,
        pageSize: 20
      },
      { status: 500 }
    );
  }
}

