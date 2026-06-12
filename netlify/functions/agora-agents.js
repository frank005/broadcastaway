const fetch = require('node-fetch');
require('./utils/AccessToken2.js');
const { RtcTokenBuilder, RtcRole } = require('./utils/RtcTokenBuilder2.js');

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

      // Resolve preset configuration
      const asrPreset = process.env.ASR_PRESET || '';
      const llmPreset = process.env.LLM_PRESET || '';
      const ttsPreset = process.env.TTS_PRESET || '';

      // Build preset string (comma-joined list of active presets)
      const activePresets = [asrPreset, llmPreset, ttsPreset].filter(Boolean);
      const presetString = activePresets.join(',');

      const asrLanguage = process.env.ASR_LANGUAGE || process.env.AGORA_ASR_LANGUAGE || 'en-US';
      const llmMaxHistory = parseInt(process.env.LLM_MAX_HISTORY) || parseInt(process.env.AI_AGENT_MAX_HISTORY) || 10;
      const llmTemperature = parseFloat(process.env.LLM_TEMPERATURE) || parseFloat(process.env.OPENAI_TEMPERATURE) || 0.7;
      const llmMaxTokens = parseInt(process.env.LLM_MAX_TOKENS) || parseInt(process.env.OPENAI_MAX_TOKENS) || 500;

      // Build ASR config
      let asrConfig;
      if (asrPreset) {
        const asrVendor = asrPreset.startsWith('deepgram') ? 'deepgram' : 'ares';
        asrConfig = { vendor: asrVendor, language: asrLanguage };
      } else {
        asrConfig = { vendor: process.env.ASR_VENDOR || 'ares', language: asrLanguage };
      }

      // Build LLM config
      const systemMessage = process.env.AI_AGENT_SYSTEM_MESSAGE || prompt || 'You are a helpful assistant.';
      const greetingMessage = process.env.AI_AGENT_GREETING_MESSAGE || '';
      const failureMessage = process.env.AI_AGENT_FAILURE_MESSAGE || "I'm having trouble processing that. Could you please rephrase?";
      let llmConfig;
      if (llmPreset) {
        llmConfig = {
          vendor: 'openai',
          system_messages: [{ role: 'system', content: systemMessage }],
          greeting_message: greetingMessage,
          failure_message: failureMessage,
          max_history: llmMaxHistory,
          input_modalities: ["text"],
          output_modalities: ["text"],
          params: {
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }
        };
      } else {
        llmConfig = {
          url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
          api_key: openaiKey || '',
          system_messages: [{ role: 'system', content: systemMessage }],
          greeting_message: greetingMessage,
          failure_message: failureMessage,
          max_history: llmMaxHistory,
          input_modalities: ["text"],
          output_modalities: ["text"],
          params: {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          }
        };
      }

      // Build TTS config
      let ttsConfig;
      if (ttsPreset) {
        const ttsVendor = ttsPreset.startsWith('minimax_speech_') ? 'minimax' : 'openai';
        const ttsParams = {};
        if (ttsPreset.startsWith('minimax_speech_')) {
          const voiceId = process.env.TTS_MINIMAX_VOICE_ID || '';
          const sampleRate = parseInt(process.env.TTS_MINIMAX_SAMPLE_RATE) || 32000;
          if (voiceId) ttsParams.voice_setting = { voice_id: voiceId };
          ttsParams.audio_setting = { sample_rate: sampleRate };
        } else {
          ttsParams.voice = process.env.TTS_OPENAI_VOICE || 'alloy';
          ttsParams.speed = parseFloat(process.env.TTS_OPENAI_SPEED) || 1.0;
        }
        ttsConfig = {
          enabled: false,
          vendor: ttsVendor,
          skip_patterns: [3, 4],
          ...(Object.keys(ttsParams).length > 0 ? { params: ttsParams } : {})
        };
      } else {
        ttsConfig = {
          enabled: false,
          vendor: process.env.TTS_VENDOR || 'microsoft',
          skip_patterns: [3, 4],
          params: {
            key: process.env.MICROSOFT_TTS_API_KEY || '',
            region: process.env.MICROSOFT_TTS_REGION || 'eastus',
            voice_name: process.env.MICROSOFT_TTS_VOICE || 'en-US-EvelynMultilingualNeural',
            speed: parseFloat(process.env.MICROSOFT_TTS_SPEED) || 1.3,
          }
        };
      }

      // Generate agent token if certificate is configured
      let agentToken = '';
      const bcastAppId = process.env.REACT_APP_AGORA_APP_ID;
      const bcastAppCertificate = process.env.AGORA_APP_CERTIFICATE;
      if (bcastAppCertificate && bcastAppId && agentUid) {
        try {
          const TTL = 3600;
          const expireAt = Math.floor(Date.now() / 1000) + TTL;
          agentToken = await RtcTokenBuilder.buildTokenWithRtm(
            bcastAppId,
            bcastAppCertificate,
            channelName,
            agentUid.toString(),
            RtcRole.PUBLISHER,
            expireAt,
            expireAt
          );
        } catch (tokenErr) {
          console.error('⚠️ Failed to generate agent token:', tokenErr);
        }
      }

      const agentConfig = {
        name: `agent_${Date.now()}`,
        ...(presetString ? { preset: presetString } : {}),
        properties: {
          channel: channelName,
          token: agentToken,
          agent_rtc_uid: agentUid.toString(),
          remote_rtc_uids: ["*"],
          enable_string_uid: false,
          idle_timeout: 30,
          agent_rtm_uid: channelName + "_agent",
          advanced_features: {
            enable_rtm: true,
            enable_aivad: false
          },
          asr: asrConfig,
          llm: llmConfig,
          tts: ttsConfig
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

