import { NextRequest, NextResponse } from 'next/server';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  return handleMediaProxy(request, 'GET');
}

export async function POST(request: NextRequest) {
  return handleMediaProxy(request, 'POST');
}

export async function PUT(request: NextRequest) {
  return handleMediaProxy(request, 'PUT');
}

export async function DELETE(request: NextRequest) {
  return handleMediaProxy(request, 'DELETE');
}

export async function PATCH(request: NextRequest) {
  return handleMediaProxy(request, 'PATCH');
}

async function handleMediaProxy(request: NextRequest, method: string) {
  try {
    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path') || '';
    const sequence = searchParams.get('sequence');
    
    console.log('🌐 [MEDIA PROXY] Request received');
    console.log('🌐 [MEDIA PROXY] Method:', method);
    console.log('🌐 [MEDIA PROXY] Path:', path);
    console.log('🌐 [MEDIA PROXY] Sequence:', sequence);
    
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;

    console.log('🌐 [MEDIA PROXY] Customer ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🌐 [MEDIA PROXY] Customer Secret:', customerSecret ? 'SET' : 'MISSING');
    console.log('🌐 [MEDIA PROXY] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');

    if (!customerId || !customerSecret || !appId) {
      console.error('❌ [MEDIA PROXY] Missing credentials');
      return NextResponse.json(
        { error: 'Agora REST credentials or App ID not set' },
        { status: 500 }
      );
    }

    if (!path) {
      return NextResponse.json(
        { error: 'Path parameter required' },
        { status: 400 }
      );
    }

    // Build target URL - path should be like "api.agora.io/dev/v1/..."
    let targetUrl = `https://${path}`;
    const fields = searchParams.get('fields');
    const queryParams = [];
    if (sequence) {
      queryParams.push(`sequence=${sequence}`);
    }
    if (fields) {
      queryParams.push(`fields=${fields}`);
    }
    if (queryParams.length > 0) {
      targetUrl += (targetUrl.includes('?') ? '&' : '?') + queryParams.join('&');
    }
    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');

    console.log('🌐 [MEDIA PROXY] Target URL:', targetUrl);

    const body = method !== 'GET' && method !== 'DELETE' ? await request.text() : undefined;
    
    // Log full request body for all REST API calls
    console.log('🌐 [MEDIA PROXY] ============================================');
    console.log('🌐 [MEDIA PROXY] Method:', method);
    console.log('🌐 [MEDIA PROXY] Target URL:', targetUrl);
    if (body) {
      try {
        const bodyJson = JSON.parse(body);
        console.log('🌐 [MEDIA PROXY] Full Request Body:', JSON.stringify(bodyJson, null, 2));
      } catch {
        console.log('🌐 [MEDIA PROXY] Full Request Body (raw):', body);
      }
    } else {
      console.log('🌐 [MEDIA PROXY] Request Body: (none - GET/DELETE request)');
    }
    console.log('🌐 [MEDIA PROXY] ============================================');
    
    const response = await fetch(targetUrl, {
      method,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
      body,
    });

    const responseData = await response.text();
    let jsonData;
    try {
      jsonData = JSON.parse(responseData);
    } catch {
      jsonData = responseData;
    }

    console.log('🌐 [MEDIA PROXY] ============================================');
    console.log('🌐 [MEDIA PROXY] Response status:', response.status);
    if (response.ok) {
      console.log('✅ [MEDIA PROXY] Full Response data:', JSON.stringify(jsonData, null, 2));
    } else {
      console.error('❌ [MEDIA PROXY] Error Response status:', response.status);
      console.error('❌ [MEDIA PROXY] Full Error Response:', JSON.stringify(jsonData, null, 2));
    }
    console.log('🌐 [MEDIA PROXY] ============================================');

    return NextResponse.json(jsonData, { status: response.status });
  } catch (error: any) {
    console.error('❌ [MEDIA PROXY] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

