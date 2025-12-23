import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request) {
  try {
    const { channelName } = await request.json();

    if (!channelName) {
      return NextResponse.json(
        { error: 'Channel name is required' },
        { status: 400 }
      );
    }

    console.log('🚫 [BAN USERS] Banning all users from channel:', channelName);
    console.log('🚫 [BAN USERS] Ban request details:', {
      channelName,
      timestamp: new Date().toISOString()
    });

    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;

    // Debug environment variables
    console.log('🔧 [BAN USERS] Environment variables loaded:');
    console.log('🔧 [BAN USERS] AGORA_APP_ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');
    console.log('🔧 [BAN USERS] AGORA_CUSTOMER_ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🔧 [BAN USERS] AGORA_CUSTOMER_SECRET:', customerSecret ? `${customerSecret.substring(0, 8)}...` : 'MISSING');

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [BAN USERS] Missing Agora credentials');
      return NextResponse.json(
        { error: 'Agora credentials not configured' },
        { status: 500 }
      );
    }

    // Create basic auth header
    const authHeader = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

    // Use Agora's kicking-rule API to ban all users from the channel
    // This prevents users from rejoining for 60 seconds
    const banResponse = await fetch('https://api.sd-rtn.com/dev/v1/kicking-rule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authHeader}`
      },
      body: JSON.stringify({
        appid: appId,
        cname: channelName,
        uid: null, // null means ban all users
        ip: "",
        time_in_seconds: 5, // 60 seconds - ensure users are properly kicked
        privileges: ["join_channel"]
      })
    });

    if (!banResponse.ok) {
      const errorData = await banResponse.json().catch(() => ({}));
      console.error('❌ [BAN USERS] Failed to ban users:', errorData);
      return NextResponse.json(
        { error: errorData.message || 'Failed to ban users from channel' },
        { status: banResponse.status }
      );
    }

    const banData = await banResponse.json();
    console.log('✅ [BAN USERS] Users banned from channel:', banData);
    console.log('✅ [BAN USERS] Ban response status:', banResponse.status);

    return NextResponse.json({
      success: true,
      data: banData
    });

  } catch (error) {
    console.error('❌ [BAN USERS] Error banning users:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

