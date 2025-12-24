import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channelName, config } = body;
    
    console.log('🎤 [STT API] Request received');
    console.log('🎤 [STT API] Action:', action);
    console.log('🎤 [STT API] Channel:', channelName);
    
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [STT API] Missing credentials');
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
      if (!config) {
        return NextResponse.json(
          { error: 'STT configuration is required' },
          { status: 400 }
        );
      }

      // Get tokens for pub and sub bots
      const pubBotUid = config.rtcConfig?.pubBotUid || process.env.STT_PUB_BOT_UID || '66666';
      const subBotUid = config.rtcConfig?.subBotUid || process.env.STT_SUB_BOT_UID || '666';

      // Get tokens for both bots
      const [pubTokenRes, subTokenRes] = await Promise.all([
        fetch(`${request.nextUrl.origin}/api/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelName,
            uid: pubBotUid,
            role: 'host'
          })
        }),
        fetch(`${request.nextUrl.origin}/api/token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelName,
            uid: subBotUid,
            role: 'host'
          })
        })
      ]);

      const pubTokenData = await pubTokenRes.json();
      const subTokenData = await subTokenRes.json();
      const pubToken = pubTokenData.token || '';
      const subToken = subTokenData.token || '';

      // Get maxIdleTime from env (default 60)
      const maxIdleTime = parseInt(process.env.STT_MAX_IDLE_TIME || '60');

      // Generate random task name
      const randomSuffix = Math.random().toString(36).substring(2, 15);
      const taskName = config.name 
        ? `${config.name}_${randomSuffix}` 
        : `${channelName}_${randomSuffix}`;

      // Build request body
      const requestBody: any = {
        name: taskName,
        languages: config.languages || ['en-US'],
        maxIdleTime: maxIdleTime,
        rtcConfig: {
          channelName,
          pubBotUid: pubBotUid.toString(),
          subBotUid: subBotUid.toString(),
          pubBotToken: pubToken,
          subBotToken: subToken
        }
      };

      // Add encryption config from env (off by default)
      const encryptionMode = process.env.STT_ENCRYPTION_MODE;
      if (encryptionMode && parseInt(encryptionMode) > 0) {
        requestBody.rtcConfig.cryptionMode = parseInt(encryptionMode);
        if (process.env.STT_ENCRYPTION_SECRET) {
          requestBody.rtcConfig.secret = process.env.STT_ENCRYPTION_SECRET;
        }
        if (process.env.STT_ENCRYPTION_SALT) {
          requestBody.rtcConfig.salt = process.env.STT_ENCRYPTION_SALT;
        }
      }

      // Add translation config if provided
      if (config.translateConfig && config.translateConfig.enable) {
        requestBody.translateConfig = {
          enable: true,
          forceTranslateInterval: config.translateConfig.forceTranslateInterval || 5,
          languages: config.translateConfig.languages || []
        };
      }

      // Add S3 storage config from env (if configured)
      const s3Bucket = process.env.STT_STORAGE_BUCKET;
      if (s3Bucket && s3Bucket.trim() !== '') {
        // Build file name prefix with date and channel name (same logic as recording)
        const buildFileNamePrefix = (envPrefix: string | undefined): string[] => {
          const basePrefix = envPrefix
            ? envPrefix.split(',').map(p => p.trim()).filter(Boolean)
            : [];
          
          // Get current date in YYYY,MM,DD format
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, '0');
          const day = String(now.getDate()).padStart(2, '0');
          
          // Clean channel name for file path:
          // 1. Remove bc_ prefix
          // 2. Remove random suffix pattern (_1234)
          // 3. Agora fileNamePrefix only allows alphanumeric characters (NO dashes, NO underscores)
          // 4. Replace all non-alphanumeric with nothing (remove them)
          let cleanChannelName = channelName.replace(/^bc_/, '');
          cleanChannelName = cleanChannelName.replace(/_\d+$/, '');
          // Remove ALL non-alphanumeric characters (no dashes, no underscores allowed)
          cleanChannelName = cleanChannelName.replace(/[^a-zA-Z0-9]/g, '');
          
          // Ensure cleanChannelName is not empty
          if (!cleanChannelName) {
            cleanChannelName = 'stt';
          }
          
          // Clean all prefix elements to ensure they only contain alphanumeric characters
          // Agora fileNamePrefix validation is strict - only alphanumeric allowed (no dashes, no underscores)
          const cleanPrefixElements = (elements: string[]): string[] => {
            return elements
              .map(p => String(p).replace(/[^a-zA-Z0-9]/g, '')) // Remove all non-alphanumeric
              .filter(p => p.length > 0); // Remove empty strings
          };
          
          const cleanedBasePrefix = cleanPrefixElements(basePrefix);
          
          // Combine: envPrefix,YYYY,MM,DD,cleanChannelName
          // If basePrefix is empty, just use date and channel name
          const prefix = cleanedBasePrefix.length > 0 
            ? [...cleanedBasePrefix, String(year), month, day, cleanChannelName]
            : [String(year), month, day, cleanChannelName];
          
          // Final validation: ensure all elements are alphanumeric only
          const validatedPrefix = prefix
            .map(p => String(p).replace(/[^a-zA-Z0-9]/g, ''))
            .filter(p => p.length > 0);
          
          // Agora requires at least one element
          if (validatedPrefix.length === 0) {
            validatedPrefix.push('stt');
          }
          
          return validatedPrefix;
        };

        const fileNamePrefix = buildFileNamePrefix(process.env.STT_STORAGE_FILE_NAME_PREFIX);
        
        requestBody.captionConfig = {
          sliceDuration: 60,
          storage: {
            bucket: s3Bucket,
            accessKey: process.env.STT_STORAGE_ACCESS_KEY || '',
            secretKey: process.env.STT_STORAGE_SECRET_KEY || '',
            vendor: parseInt(process.env.STT_STORAGE_VENDOR || '1'),
            region: parseInt(process.env.STT_STORAGE_REGION || '0'),
            fileNamePrefix: fileNamePrefix
          }
        };
      }

      const url = `${baseUrl}/api/speech-to-text/v1/projects/${appId}/join`;
      console.log('🎤 [STT API] Starting STT:', url);
      console.log('🎤 [STT API] Request body:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();
      console.log('🎤 [STT API] Start response:', data);

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || data.error || 'Failed to start STT' },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'stop') {
      const { agentId } = body;
      if (!agentId) {
        return NextResponse.json(
          { error: 'agentId is required' },
          { status: 400 }
        );
      }

      const url = `${baseUrl}/api/speech-to-text/v1/projects/${appId}/agents/${agentId}/leave`;
      console.log('🎤 [STT API] Stopping STT:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers
      });

      if (!response.ok) {
        // Try to parse error response, but handle empty responses
        let errorData = {};
        try {
          const text = await response.text();
          if (text) {
            errorData = JSON.parse(text);
          }
        } catch (e) {
          // If parsing fails, use empty object
        }
        return NextResponse.json(
          { error: errorData.message || errorData.error || 'Failed to stop STT' },
          { status: response.status }
        );
      }

      // Check if response has content before parsing JSON
      const text = await response.text();
      if (text && text.trim()) {
        try {
          const data = JSON.parse(text);
          console.log('🎤 [STT API] Stop response:', data);
          return NextResponse.json(data);
        } catch (e) {
          // If parsing fails, return success with empty object
          console.log('🎤 [STT API] Stop response: empty (200 OK)');
          return NextResponse.json({ success: true });
        }
      } else {
        // Empty response - just return success
        console.log('🎤 [STT API] Stop response: empty (200 OK)');
        return NextResponse.json({ success: true });
      }
    }

    if (action === 'update') {
      const { agentId, updateMask, config: updateConfig } = body;
      if (!agentId || !updateMask) {
        return NextResponse.json(
          { error: 'agentId and updateMask are required' },
          { status: 400 }
        );
      }

      const sequenceId = Date.now();
      const url = `${baseUrl}/api/speech-to-text/v1/projects/${appId}/agents/${agentId}/update?sequenceId=${sequenceId}&updateMask=${updateMask}`;
      console.log('🎤 [STT API] Updating STT:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(updateConfig)
      });

      const data = await response.json();
      console.log('🎤 [STT API] Update response:', data);

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || data.error || 'Failed to update STT' },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ [STT API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

