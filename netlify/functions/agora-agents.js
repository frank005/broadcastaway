const fetch = require('node-fetch');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: '',
    };
  }

  try {
    console.log('🤖 [AI AGENT API] Request received');
    console.log('🤖 [AI AGENT API] Method:', event.httpMethod);
    console.log('🤖 [AI AGENT API] Body:', event.body);
    
    const { action, channelName, agentUid, clientUid, prompt } = JSON.parse(event.body || '{}');
    
    console.log('🤖 [AI AGENT API] Request params:', { action, channelName, agentUid, clientUid, hasPrompt: !!prompt });
    
    const appId = process.env.REACT_APP_AGORA_APP_ID;
    const customerId = process.env.AGORA_REST_API_KEY || process.env.AGORA_CUSTOMER_ID;
    const customerSecret = process.env.AGORA_REST_API_SECRET || process.env.AGORA_CUSTOMER_SECRET;
    const openaiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

    console.log('🤖 [AI AGENT API] App ID:', appId ? `${appId.substring(0, 8)}...` : 'MISSING');
    console.log('🤖 [AI AGENT API] Customer ID:', customerId ? `${customerId.substring(0, 8)}...` : 'MISSING');
    console.log('🤖 [AI AGENT API] Customer Secret:', customerSecret ? 'SET' : 'MISSING');
    console.log('🤖 [AI AGENT API] OpenAI Key:', openaiKey ? 'SET' : 'MISSING');
    console.log('🤖 [AI AGENT API] Base URL:', baseUrl);

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [AI AGENT API] Missing Agora configuration');
      throw new Error('Agora configuration missing');
    }

    const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${auth}`
    };

    if (action === 'start') {
      console.log('🤖 [AI AGENT API] Creating agent configuration...');
      const agentConfig = {
        name: `agent_${Date.now()}`,
        properties: {
          channel: channelName,
          token: '', 
          agent_rtc_uid: agentUid.toString(),
          remote_rtc_uids: ["*"],
          enable_string_uid: false,
          idle_timeout: 30,
          agent_rtm_uid: channelName + "_agent",
          advanced_features: {
            enable_rtm: true,
            enable_aivad: false
          },
          asr: {
            vendor: process.env.ASR_VENDOR || "ares",
            language: process.env.AGORA_ASR_LANGUAGE || "en-US"
          },
          llm: {
            url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
            api_key: openaiKey || '',
            system_messages: [{ role: 'system', content: prompt || 'You are a helpful assistant.' }],
            greeting_message: "",
            failure_message: "I'm having trouble processing that. Could you please rephrase?",
            max_history: 10,
            input_modalities: ["text"],
            output_modalities: ["text"],
            params: {
              model: process.env.OPENAI_MODEL || "gpt-4o",
              temperature: parseFloat(process.env.OPENAI_TEMPERATURE) || 0.2,
              max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS) || 1000
            }
          },
          tts: {
            enabled: false, // Disable TTS by default
            vendor: process.env.TTS_VENDOR || 'microsoft',
            skip_patterns: [3, 4],
            params: {
              key: process.env.MICROSOFT_TTS_API_KEY || '',
              region: process.env.MICROSOFT_TTS_REGION || 'eastus',
              voice_name: process.env.MICROSOFT_TTS_VOICE || 'en-US-EvelynMultilingualNeural',
              sample_rate: 24000,
              speed: 1.3
            }
          }
        }
      };

      const url = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/join`;
      console.log('🤖 [AI AGENT API] Calling Agora API:', url);
      console.log('🤖 [AI AGENT API] Agent config:', JSON.stringify(agentConfig, null, 2));
      
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(agentConfig)
      });
      
      console.log('🤖 [AI AGENT API] Response status:', response.status);
      const responseText = await response.text();
      console.log('🤖 [AI AGENT API] Response body:', responseText);
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('❌ [AI AGENT API] Failed to parse response as JSON');
        throw new Error(`Invalid JSON response: ${responseText.substring(0, 200)}`);
      }

      if (!response.ok) {
        console.error('❌ [AI AGENT API] Agora API error:', data);
        throw new Error(data.message || `HTTP ${response.status}: ${responseText}`);
      }

      console.log('✅ [AI AGENT API] Agent created successfully:', data);

      return {
        statusCode: 200,
        headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
        body: JSON.stringify({ success: true, data })
      };
    }

    console.error('❌ [AI AGENT API] Unsupported action:', action);
    return {
      statusCode: 400,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Unsupported action' })
    };
  } catch (error) {
    console.error('❌ [AI AGENT API] Error:', error);
    console.error('❌ [AI AGENT API] Error details:', {
      message: error.message,
      stack: error.stack
    });
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};

