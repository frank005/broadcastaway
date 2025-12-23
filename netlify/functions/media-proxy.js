const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
      body: '',
    };
  }

  try {
    console.log('🌐 [MEDIA PROXY] Request received');
    console.log('🌐 [MEDIA PROXY] Method:', event.httpMethod);
    console.log('🌐 [MEDIA PROXY] Path:', event.path);
    console.log('🌐 [MEDIA PROXY] Query params:', event.queryStringParameters);
    console.log('🌐 [MEDIA PROXY] Body:', event.body);
    
    const customerId = process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_REST_API_SECRET;
    const appId = process.env.REACT_APP_AGORA_APP_ID;

    console.log('🌐 [MEDIA PROXY] Customer ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🌐 [MEDIA PROXY] Customer Secret:', customerSecret ? 'SET' : 'MISSING');
    console.log('🌐 [MEDIA PROXY] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');

    if (!customerId || !customerSecret || !appId) {
      console.error('❌ [MEDIA PROXY] Missing credentials');
      throw new Error('Agora REST credentials or App ID not set');
    }

    // Path format: /api/media-proxy/{base}/{path}
    // Example: /api/media-proxy/api.agora.io/v1/projects/...
    const pathParts = event.path.replace('/.netlify/functions/media-proxy', '').split('/').filter(Boolean);
    const base = pathParts[0];
    const apiPath = '/' + pathParts.slice(1).join('/');
    
    const queryParams = event.queryStringParameters && Object.keys(event.queryStringParameters).length > 0
      ? '?' + new URLSearchParams(event.queryStringParameters).toString()
      : '';
    
    const targetUrl = `https://${base}${apiPath}${queryParams}`;

    console.log('🌐 [MEDIA PROXY] Target URL:', targetUrl);

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${Buffer.from(`${customerId}:${customerSecret}`).toString('base64')}`,
    };

    const fetchOptions = {
      method: event.httpMethod,
      headers: headers,
    };

    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      fetchOptions.body = event.body;
      console.log('🌐 [MEDIA PROXY] Request body:', event.body);
    }

    console.log(`🌐 [MEDIA PROXY] Proxying ${event.httpMethod} to ${targetUrl}`);

    const response = await fetch(targetUrl, fetchOptions);
    const responseData = await response.text();

    console.log('🌐 [MEDIA PROXY] Response status:', response.status);
    console.log('🌐 [MEDIA PROXY] Response data:', responseData.substring(0, 500));

    return {
      statusCode: response.status,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: responseData,
    };
  } catch (error) {
    console.error('❌ [MEDIA PROXY] Proxy error:', error);
    console.error('❌ [MEDIA PROXY] Error details:', {
      message: error.message,
      stack: error.stack
    });
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ error: error.message }),
    };
  }
};

