import { NextRequest, NextResponse } from 'next/server';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channelName, agentUid, clientUid, prompt } = body;
    
    console.log('🤖 [AI AGENT API] Request received');
    console.log('🤖 [AI AGENT API] Request params:', { action, channelName, agentUid, clientUid, hasPrompt: !!prompt });
    
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    const openaiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

    console.log('🤖 [AI AGENT API] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');
    console.log('🤖 [AI AGENT API] Customer ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🤖 [AI AGENT API] Customer Secret:', customerSecret ? 'SET' : 'MISSING');
    console.log('🤖 [AI AGENT API] OpenAI Key:', openaiKey ? 'SET' : 'MISSING');
    console.log('🤖 [AI AGENT API] Base URL:', baseUrl);

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [AI AGENT API] Missing Agora configuration');
      return NextResponse.json(
        { error: 'Agora configuration missing' },
        { status: 500 }
      );
    }

    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    };

    if (action === 'start') {
      if (!openaiKey) {
        return NextResponse.json(
          { error: 'OpenAI API key not set' },
          { status: 500 }
        );
      }

      // Conversational AI uses: /api/conversational-ai-agent/v2/projects/{appId}/join
      const agentUrl = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/join`;
      const agentBody = {
        agent: {
          llm: {
            provider: 'openai',
            model: process.env.OPENAI_MODEL || 'gpt-4',
            apiKey: openaiKey,
            apiUrl: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
            maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '500'),
            temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
          },
          prompt: prompt || 'You are a helpful live shopping assistant.',
          name: `Agent_${Date.now()}`,
        }
      };

      console.log('🤖 [AI AGENT API] Creating agent:', agentUrl);
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(agentBody),
      });

      const data = await response.json();
      console.log('🤖 [AI AGENT API] Agent created:', data);

      return NextResponse.json(data, { status: response.status });
    } else {
      return NextResponse.json(
        { error: 'Unknown action' },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error('❌ [AI AGENT API] Error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

