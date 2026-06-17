import { NextRequest, NextResponse } from 'next/server';
import { createRequire } from 'module';
import { authMode, getSessionUser } from '@/lib/auth';

// Ensure we're using Node.js runtime (not Edge)
export const runtime = 'nodejs';

// Create require function for CommonJS modules in ES module context
const require = createRequire(import.meta.url);

// Load token builder utilities
let RtcTokenBuilder: any, RtcRole: any;

try {
  // First load AccessToken2 and services (required by RtcTokenBuilder2)
  require('../../../netlify/functions/utils/AccessToken2.js');
  
  // Now load RtcTokenBuilder2
  const tokenBuilder = require('../../../netlify/functions/utils/RtcTokenBuilder2.js');
  RtcTokenBuilder = tokenBuilder.RtcTokenBuilder;
  RtcRole = tokenBuilder.RtcRole;
  
  if (!RtcTokenBuilder || !RtcRole) {
    console.error('❌ [AI AGENT API] Token builder exports not found');
    throw new Error('Token builder exports not found');
  }
  
  console.log('✅ [AI AGENT API] Token builder loaded successfully');
} catch (error) {
  console.error('❌ [AI AGENT API] Failed to load token builder:', error);
  // Don't throw here - let the route handle it
}

export async function POST(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user && authMode() !== 'bypass') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, channelName, agentUid, clientUid, prompt, profileContext } = body;
    
    console.log('🤖 [AI AGENT API] Request received');
    console.log('🤖 [AI AGENT API] Request params:', { action, channelName, agentUid, clientUid, hasPrompt: !!prompt });
    
    if (action === 'start') {
      if (!channelName || !agentUid || !clientUid) {
        return NextResponse.json(
          { error: 'Missing required fields: channelName, agentUid, clientUid' },
          { status: 400 }
        );
      }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      const appCertificate = process.env.AGORA_APP_CERTIFICATE;
      const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
      const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
      const openaiKey = process.env.OPENAI_API_KEY;
      const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

      if (!appId || !customerId || !customerSecret) {
        console.error('❌ [AI AGENT API] Missing Agora configuration');
        return NextResponse.json(
          { error: 'Agora configuration missing' },
          { status: 500 }
        );
      }

      if (!appCertificate) {
        console.error('❌ [AI AGENT API] Missing Agora certificate for token generation');
        return NextResponse.json(
          { error: 'AGORA_APP_CERTIFICATE not set (required for token generation)' },
          { status: 500 }
        );
      }

      // Resolve preset configuration
      const asrPreset = process.env.ASR_PRESET || '';
      const llmPreset = process.env.LLM_PRESET || '';
      const ttsPreset = process.env.TTS_PRESET || '';
      const activePresets = [asrPreset, llmPreset, ttsPreset].filter(Boolean);
      const presetString = activePresets.join(',');

      // OpenAI key is only required when no LLM preset is set
      if (!llmPreset && !openaiKey) {
        return NextResponse.json(
          { error: 'OPENAI_API_KEY required when LLM_PRESET is not set' },
          { status: 500 }
        );
      }

      // Ensure token builder is loaded
      if (!RtcTokenBuilder || !RtcRole) {
        try {
          require('../../../netlify/functions/utils/AccessToken2.js');
          const tokenBuilder = require('../../../netlify/functions/utils/RtcTokenBuilder2.js');
          RtcTokenBuilder = tokenBuilder.RtcTokenBuilder;
          RtcRole = tokenBuilder.RtcRole;
        } catch (loadError: any) {
          console.error('❌ [AI AGENT API] Failed to load token builder:', loadError);
          return NextResponse.json(
            { error: 'Token builder utilities not available: ' + (loadError?.message || String(loadError)) },
            { status: 500 }
          );
        }
      }

      // Generate combined RTC+RTM token for the agent
      const expirationTimeInSeconds = 3600;
      const currentTimestamp = Math.floor(Date.now() / 1000);
      const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;
      
      const agentRtcUid = parseInt(agentUid.toString());
      
      // Create RTM UID from host name: "{hostName}-AI"
      // RTM UIDs must be 1-64 characters, alphanumeric, underscore, or hyphen only
      const sanitizeForRtm = (name: string) => {
        if (!name) return 'Host';
        // Replace invalid characters with underscore, keep alphanumeric, underscore, hyphen
        let sanitized = name.replace(/[^a-zA-Z0-9_\-]/g, '_');
        // Replace spaces with hyphen for readability
        sanitized = sanitized.replace(/\s+/g, '-');
        // Trim to max length (leave room for "-AI" suffix)
        const maxLength = 60; // 64 - 4 for "-AI"
        if (sanitized.length > maxLength) {
          sanitized = sanitized.substring(0, maxLength);
        }
        return sanitized || 'Host';
      };
      
      const hostName = sanitizeForRtm(clientUid || 'Host');
      const agentRtmUid = `${hostName}-AI`; // Format: "{hostName}-AI" (with hyphen)
      
      console.log('🔐 [AI AGENT API] Generating combined RTC+RTM token for agent...');
      console.log('🔐 [AI AGENT API] Token params:', {
        channelName,
        agentRtcUid,
        agentRtmUid,
        hostName: clientUid,
        role: 'PUBLISHER'
      });
      
      const agentToken = await RtcTokenBuilder.buildTokenWithRtm2(
        appId,
        appCertificate,
        channelName,
        agentRtcUid.toString(), // RTC account (string)
        RtcRole.PUBLISHER, // Agent needs PUBLISHER role
        privilegeExpiredTs, // tokenExpire
        privilegeExpiredTs, // joinChannelPrivilegeExpire
        privilegeExpiredTs, // pubAudioPrivilegeExpire
        privilegeExpiredTs, // pubVideoPrivilegeExpire
        privilegeExpiredTs, // pubDataStreamPrivilegeExpire
        agentRtmUid, // RTM user ID: "{hostName}_AI"
        privilegeExpiredTs // RTM token expire
      );
      
      console.log('✅ [AI AGENT API] Agent token generated:', agentToken ? `present (${agentToken.length} chars)` : 'EMPTY');

      // Build system messages array
      const systemMessages = [];
      
      // Always load system message from file (synced via GitHub)
      // This avoids the 4KB Lambda environment variable limit
      // The file can be updated and pushed to GitHub to change the system message
      let systemPrompt: string | null = null;
      
      try {
        const fs = require('fs');
        const path = require('path');
        const systemMessagePath = path.join(process.cwd(), 'app', 'api', 'ai-agent-system-message.txt');
        if (fs.existsSync(systemMessagePath)) {
          systemPrompt = fs.readFileSync(systemMessagePath, 'utf-8').trim();
          console.log('✅ [AI AGENT API] Loaded system message from file (synced via GitHub)');
        } else {
          console.warn('⚠️ [AI AGENT API] System message file not found at:', systemMessagePath);
        }
      } catch (error) {
        console.error('❌ [AI AGENT API] Could not load system message from file:', error);
      }
      
      // Fallback priority: file → prompt param → env var → default
      // File is always used if it exists (synced via GitHub)
      // Note: env var is last priority to avoid 4KB limit issues
      if (!systemPrompt) {
        systemPrompt = prompt || process.env.AI_AGENT_SYSTEM_MESSAGE || 'You are a helpful live shopping assistant. Help the host sell products.';
        console.log('⚠️ [AI AGENT API] Using fallback system message (file not available)');
      }
      
      // Replace {HOST_NAME} placeholder with actual host name
      // Extract display name from clientUid (format: "NAME_RANDOM_CHARS" or "NAME-RANDOM")
      // Take the first part before underscore/hyphen, or use the whole thing if no separator
      let hostDisplayName = 'the host';
      if (clientUid) {
        // Split by underscore or hyphen and take the first part
        const parts = clientUid.split(/[_-]/);
        hostDisplayName = parts[0] || clientUid;
        // Replace underscores/hyphens with spaces for readability if there are multiple parts
        if (parts.length > 1) {
          hostDisplayName = parts[0];
        }
      }
      if (systemPrompt) {
        systemPrompt = systemPrompt.replace(/{HOST_NAME}/g, hostDisplayName);
        console.log('✅ [AI AGENT API] Replaced {HOST_NAME} placeholder with:', hostDisplayName, '(extracted from:', clientUid, ')');
      }
      
      // Add main system prompt
      systemMessages.push({
        role: 'system',
        content: systemPrompt
      });

      const asrLanguage = process.env.ASR_LANGUAGE || process.env.AGORA_ASR_LANGUAGE || 'en-US';
      const llmMaxHistory = parseInt(process.env.LLM_MAX_HISTORY || process.env.AI_AGENT_MAX_HISTORY || '10');
      const llmTemperature = parseFloat(process.env.LLM_TEMPERATURE || process.env.OPENAI_TEMPERATURE || '0.7');
      const llmMaxTokens = parseInt(process.env.LLM_MAX_TOKENS || process.env.OPENAI_MAX_TOKENS || '500');

      // ASR config
      let asrConfig: any;
      if (asrPreset) {
        const asrVendor = asrPreset.startsWith('deepgram_') ? 'deepgram' : 'ares';
        asrConfig = { vendor: asrVendor, language: asrLanguage };
      } else {
        asrConfig = { vendor: process.env.ASR_VENDOR || 'ares', language: asrLanguage };
      }

      // LLM config
      let llmConfig: any;
      if (llmPreset) {
        llmConfig = {
          vendor: 'openai',
          system_messages: systemMessages,
          greeting_message: process.env.AI_AGENT_GREETING_MESSAGE || '',
          failure_message: process.env.AI_AGENT_FAILURE_MESSAGE || "I'm having trouble processing that. Could you please rephrase?",
          max_history: llmMaxHistory,
          input_modalities: ['text'],
          output_modalities: ['text'],
          params: { temperature: llmTemperature, max_tokens: llmMaxTokens },
        };
      } else {
        llmConfig = {
          url: process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions',
          api_key: openaiKey,
          system_messages: systemMessages,
          greeting_message: process.env.AI_AGENT_GREETING_MESSAGE || '',
          failure_message: process.env.AI_AGENT_FAILURE_MESSAGE || "I'm having trouble processing that. Could you please rephrase?",
          max_history: llmMaxHistory,
          input_modalities: ['text'],
          output_modalities: ['text'],
          params: {
            model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
            temperature: llmTemperature,
            max_tokens: llmMaxTokens,
          },
        };
      }

      // TTS config
      let ttsConfig: any;
      if (ttsPreset) {
        const ttsVendor = ttsPreset.startsWith('minimax_speech_') ? 'minimax' : 'openai';
        const ttsParams: any = {};
        if (ttsPreset.startsWith('minimax_speech_')) {
          const voiceId = process.env.TTS_MINIMAX_VOICE_ID || '';
          const sampleRate = parseInt(process.env.TTS_MINIMAX_SAMPLE_RATE || '32000');
          if (voiceId) ttsParams.voice_setting = { voice_id: voiceId };
          ttsParams.audio_setting = { sample_rate: sampleRate };
        } else {
          ttsParams.voice = process.env.TTS_OPENAI_VOICE || 'alloy';
          ttsParams.speed = parseFloat(process.env.TTS_OPENAI_SPEED || '1.0');
        }
        ttsConfig = {
          vendor: ttsVendor,
          skip_patterns: [3, 4],
          ...(Object.keys(ttsParams).length > 0 ? { params: ttsParams } : {}),
        };
      } else {
        ttsConfig = {
          vendor: 'microsoft',
          skip_patterns: [3, 4],
          params: {
            key: process.env.MICROSOFT_TTS_API_KEY || '',
            region: process.env.MICROSOFT_TTS_REGION || 'eastus',
            voice_name: process.env.MICROSOFT_TTS_VOICE || 'en-US-EvelynMultilingualNeural',
            sample_rate: 24000,
            speed: parseFloat(process.env.MICROSOFT_TTS_SPEED || '1.3'),
          },
        };
      }

      // Generate agent configuration with required payload parameters (matching working structure)
      const agentConfig: any = {
        name: `broadcastaway_agent_${Date.now()}`,
        ...(presetString ? { preset: presetString } : {}),
        properties: {
          channel: channelName,
          token: agentToken, // Combined RTC+RTM token for agent
          agent_rtc_uid: agentUid.toString(),
          remote_rtc_uids: ["*"], // Allow all clients to connect
          enable_string_uid: false,
          idle_timeout: 30,
          agent_rtm_uid: agentRtmUid, // Format: "{hostName}_AI"
          advanced_features: {
            enable_rtm: true, // Required: enable RTM for data channel
            enable_aivad: false
          },
          asr: asrConfig,
          turn_detection: {
            interrupt_mode: "append",
          },
          parameters: {
            audio_scenario: "chorus",
            data_channel: "rtm",
            enable_metrics: true,
            enable_error_message: true,
            transcript: {
              enable: true,
              redundant: false
            }
          },
          llm: llmConfig,
          tts: ttsConfig
        }
      };

      const auth = Buffer.from(`${customerId}:${customerSecret}`).toString('base64');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      };

      // Conversational AI uses: /api/conversational-ai-agent/v2/projects/{appId}/join
      const agentUrl = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/join`;
      
      // Create a safe version of agentConfig for logging (mask sensitive keys)
      const safeAgentConfig = JSON.parse(JSON.stringify(agentConfig));
      if (safeAgentConfig.properties?.llm?.api_key) {
        safeAgentConfig.properties.llm.api_key = safeAgentConfig.properties.llm.api_key.substring(0, 8) + '...';
      }
      if (safeAgentConfig.properties?.tts?.params?.key) {
        safeAgentConfig.properties.tts.params.key = safeAgentConfig.properties.tts.params.key ? safeAgentConfig.properties.tts.params.key.substring(0, 8) + '...' : '';
      }
      
      console.log('🤖 [AI AGENT API] Creating agent:', agentUrl);
      console.log('🤖 [AI AGENT API] Request body:', JSON.stringify(safeAgentConfig, null, 2));
      const response = await fetch(agentUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(agentConfig),
      });

      const data = await response.json();
      console.log('🤖 [AI AGENT API] Agent created:', data);

      if (data && (data.agent_id || data.agentId)) {
        const agentId = data.agent_id || data.agentId;
        console.log(`✅ [AI AGENT API] Created Agora agent ${agentId}`);
        return NextResponse.json({
          success: true,
          data: data
        }, { status: response.status });
      } else {
        console.error('❌ [AI AGENT API] No agent ID in response:', data);
        return NextResponse.json(
          { error: 'Failed to create agent - no agentId in response' },
          { status: 500 }
        );
      }
    } else if (action === 'stop') {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: 'agentId is required' },
          { status: 400 }
        );
      }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
      const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
      const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

      if (!appId || !customerId || !customerSecret) {
        console.error('❌ [AI AGENT API] Missing Agora configuration for stop');
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

      // Call the leave endpoint: /api/conversational-ai-agent/v2/projects/{appId}/agents/{agentId}/leave
      const leaveUrl = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/agents/${agentId}/leave`;
      
      console.log('🛑 [AI AGENT API] Stopping agent:', agentId);
      console.log('🛑 [AI AGENT API] Leave URL:', leaveUrl);
      
      try {
        const response = await fetch(leaveUrl, {
          method: 'POST',
          headers,
        });

        const data = await response.json();
        console.log('🛑 [AI AGENT API] Leave response status:', response.status);
        console.log('🛑 [AI AGENT API] Leave response data:', data);

        if (!response.ok) {
          console.error('❌ [AI AGENT API] Failed to leave agent:', data);
          return NextResponse.json(
            { error: data.message || data.error || 'Failed to stop agent' },
            { status: response.status }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Agent stopped successfully',
          agentId: agentId,
          data: data
        });
      } catch (error: any) {
        console.error('❌ [AI AGENT API] Error stopping agent:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to stop agent' },
          { status: 500 }
        );
      }
    } else if (action === 'interrupt') {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: 'agentId is required' },
          { status: 400 }
        );
      }

      const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
      const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
      const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
      const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

      if (!appId || !customerId || !customerSecret) {
        console.error('❌ [AI AGENT API] Missing Agora configuration for interrupt');
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

      // Call the interrupt endpoint: /api/conversational-ai-agent/v2/projects/{appId}/agents/{agentId}/interrupt
      const interruptUrl = `${baseUrl}/api/conversational-ai-agent/v2/projects/${appId}/agents/${encodeURIComponent(agentId)}/interrupt`;
      
      console.log('⏸️ [AI AGENT API] Interrupting agent:', agentId);
      console.log('⏸️ [AI AGENT API] Interrupt URL:', interruptUrl);
      
      try {
        const response = await fetch(interruptUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({})
        });

        const data = await response.json();
        console.log('⏸️ [AI AGENT API] Interrupt response status:', response.status);
        console.log('⏸️ [AI AGENT API] Interrupt response data:', data);

        if (!response.ok) {
          console.error('❌ [AI AGENT API] Failed to interrupt agent:', data);
          return NextResponse.json(
            { error: data.message || data.error || 'Failed to interrupt agent' },
            { status: response.status }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Agent interrupted successfully',
          agentId: agentId,
          data: data
        });
      } catch (error: any) {
        console.error('❌ [AI AGENT API] Error interrupting agent:', error);
        return NextResponse.json(
          { error: error.message || 'Failed to interrupt agent' },
          { status: 500 }
        );
      }
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

