import { NextRequest, NextResponse } from 'next/server';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';
// Mark as dynamic since we use searchParams
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const channelName = searchParams.get('channel');
    
    if (!channelName) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required parameter: channel',
          data: {
            channelName: '',
            totalUsers: 0,
            hostCount: 0,
            viewerCount: 0,
            broadcasters: [],
            audience: []
          }
        },
        { status: 400 }
      );
    }
    
    console.log('📊 [HOSTS API] Request received for channel:', channelName);
    
    // Get Agora credentials
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    
    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [HOSTS API] Missing credentials');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing Agora credentials',
          data: {
            channelName,
            totalUsers: 0,
            hostCount: 0,
            viewerCount: 0,
            broadcasters: [],
            audience: []
          }
        },
        { status: 500 }
      );
    }
    
    // Build Agora REST API URL
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';
    const encodedChannelName = encodeURIComponent(channelName);
    const url = `${baseUrl}/dev/v1/channel/user/${appId}/${encodedChannelName}`;
    
    console.log('📊 [HOSTS API] Fetching from:', url);
    
    // Create Basic Auth header
    const authString = `${customerId}:${customerSecret}`;
    const auth = Buffer.from(authString).toString('base64');
    
    // Add timeout to prevent hanging requests (5 seconds)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
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
        console.warn('⚠️ [HOSTS API] Request timeout for', channelName);
        return NextResponse.json(
          { 
            success: false, 
            error: 'Request timeout',
            data: {
              channelName,
              totalUsers: 0,
              hostCount: 0,
              viewerCount: 0,
              broadcasters: [],
              audience: []
            }
          },
          { status: 504 }
        );
      }
      throw err;
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ [HOSTS API] Agora API error for ${channelName}:`, response.status, errorText);
      
      // If channel doesn't exist (404), return empty data instead of error
      if (response.status === 404) {
        console.log('📺 [HOSTS API] Channel does not exist:', channelName);
        return NextResponse.json({
          success: true,
          data: {
            channelName,
            totalUsers: 0,
            hostCount: 0,
            viewerCount: 0,
            broadcasters: [],
            audience: []
          }
        });
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: `Agora API error: ${response.status}`,
          data: {
            channelName,
            totalUsers: 0,
            hostCount: 0,
            viewerCount: 0,
            broadcasters: [],
            audience: []
          }
        },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    console.log('📊 [HOSTS API] Raw response for', channelName, ':', JSON.stringify(data, null, 2));
    
    if (!data.success) {
      console.warn('⚠️ [HOSTS API] Agora API returned error for', channelName, ':', data.message);
      return NextResponse.json(
        { 
          success: false, 
          error: data.message || 'Unknown error',
          data: {
            channelName,
            totalUsers: 0,
            hostCount: 0,
            viewerCount: 0,
            broadcasters: [],
            audience: []
          }
        },
        { status: 500 }
      );
    }
    
    // Check if channel exists
    if (!data.data?.channel_exist) {
      console.log('📺 [HOSTS API] Channel does not exist:', channelName);
      return NextResponse.json({
        success: true,
        data: {
          channelName,
          totalUsers: 0,
          hostCount: 0,
          viewerCount: 0,
          broadcasters: [],
          audience: []
        }
      });
    }
    
    // Extract broadcasters and audience
    const broadcasters = data.data?.broadcasters || [];
    const audience = data.data?.audience || [];
    const hostCount = broadcasters.length;
    const viewerCount = audience.length;
    const totalUsers = hostCount + viewerCount;
    
    console.log(`📊 [HOSTS API] Channel ${channelName}: ${hostCount} hosts, ${viewerCount} viewers, ${totalUsers} total`);
    
    return NextResponse.json({
      success: true,
      data: {
        channelName,
        totalUsers,
        hostCount,
        viewerCount,
        broadcasters,
        audience
      }
    });
  } catch (error: any) {
    console.error('❌ [HOSTS API] Error:', error);
    const channelName = request.nextUrl.searchParams.get('channel') || '';
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Internal server error',
        data: {
          channelName,
          totalUsers: 0,
          hostCount: 0,
          viewerCount: 0,
          broadcasters: [],
          audience: []
        }
      },
      { status: 500 }
    );
  }
}

