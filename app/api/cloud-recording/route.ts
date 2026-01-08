import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, channelName, recordingType, resourceId, sid } = body;
    
    console.log('📹 [CLOUD RECORDING API] Request received');
    console.log('📹 [CLOUD RECORDING API] Action:', action);
    console.log('📹 [CLOUD RECORDING API] Channel:', channelName);
    console.log('📹 [CLOUD RECORDING API] Type:', recordingType);
    
    const appId = process.env.NEXT_PUBLIC_AGORA_APP_ID;
    const customerId = process.env.AGORA_CUSTOMER_ID || process.env.AGORA_REST_API_KEY;
    const customerSecret = process.env.AGORA_CUSTOMER_SECRET || process.env.AGORA_REST_API_SECRET;
    const baseUrl = process.env.AGORA_BASE_URL || 'https://api.agora.io';

    if (!appId || !customerId || !customerSecret) {
      console.error('❌ [CLOUD RECORDING API] Missing credentials');
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

    if (action === 'acquire') {
      // Acquire recording resource
      const recordingUid = recordingType === 'composite' 
        ? process.env.RECORDING_COMPOSITE_UID || '7777777'
        : process.env.RECORDING_WEBPAGE_UID || '8888888';
      
      const acquireBody: any = {
        cname: channelName,
        uid: recordingUid,
        clientRequest: {}
      };

      if (recordingType === 'web') {
        acquireBody.clientRequest.resourceExpiredHour = 24;
        acquireBody.clientRequest.scene = 1;
      }

      const url = `${baseUrl}/v1/apps/${appId}/cloud_recording/acquire`;
      console.log('📹 [CLOUD RECORDING API] Acquiring resource:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(acquireBody)
      });

      const data = await response.json();
      console.log('📹 [CLOUD RECORDING API] Acquire response:', data);

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || 'Failed to acquire recording resource' },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'start') {
      // Start recording
      if (!resourceId) {
        return NextResponse.json(
          { error: 'resourceId is required' },
          { status: 400 }
        );
      }

      const recordingUid = recordingType === 'composite' 
        ? process.env.RECORDING_COMPOSITE_UID || '7777777'
        : process.env.RECORDING_WEBPAGE_UID || '8888888';

      // Get token for recording UID
      const tokenResponse = await fetch(`${request.nextUrl.origin}/api/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelName,
          uid: recordingUid,
          role: 'host' // Recording needs publisher role (host = publisher)
        })
      });
      const tokenData = await tokenResponse.json();
      const token = tokenData.token || '';

      let startBody: any;

      // Helper function to build file name prefix with date, time, and channel name
      const buildFileNamePrefix = (envPrefix: string | undefined): string[] => {
        const basePrefix = envPrefix
          ? envPrefix.split(',').map(p => p.trim()).filter(Boolean)
          : [];
        
        // Get current date and time
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        // Get time in HHMM format (e.g., 1430 for 2:30 PM)
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const time = hours + minutes; // HHMM format (e.g., "1430")
        
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
          cleanChannelName = 'recording';
        }
        
        // Clean all prefix elements to ensure they only contain alphanumeric characters
        // Agora fileNamePrefix validation is strict - only alphanumeric allowed (no dashes, no underscores)
        const cleanPrefixElements = (elements: string[]): string[] => {
          return elements
            .map(p => String(p).replace(/[^a-zA-Z0-9]/g, '')) // Remove all non-alphanumeric
            .filter(p => p.length > 0); // Remove empty strings
        };
        
        const cleanedBasePrefix = cleanPrefixElements(basePrefix);
        
        // Combine: envPrefix, YYYY, MM, DD, cleanChannelName, HHMM (time)
        // Channel name comes before time so recordings for the same channel are grouped together
        // Time is included to differentiate multiple recordings in the same day for the same channel
        // If basePrefix is empty, just use date, channel name, and time
        const prefix = cleanedBasePrefix.length > 0 
          ? [...cleanedBasePrefix, String(year), month, day, cleanChannelName, time]
          : [String(year), month, day, cleanChannelName, time];
        
        // Final validation: ensure all elements are alphanumeric only
        const validatedPrefix = prefix
          .map(p => String(p).replace(/[^a-zA-Z0-9]/g, ''))
          .filter(p => p.length > 0);
        
        // Agora requires at least one element
        if (validatedPrefix.length === 0) {
          validatedPrefix.push('recording');
        }
        
        return validatedPrefix;
      };

      if (recordingType === 'composite') {
        // Composite recording
        const fileNamePrefix = buildFileNamePrefix(process.env.RECORDING_COMPOSITE_STORAGE_FILE_NAME_PREFIX);

        startBody = {
          cname: channelName,
          uid: recordingUid,
          clientRequest: {
            token: token,
            recordingConfig: {
              maxIdleTime: parseInt(process.env.RECORDING_MAX_IDLE_TIME || '30'),
              streamTypes: parseInt(process.env.RECORDING_STREAM_TYPES || '2'),
              audioProfile: parseInt(process.env.RECORDING_AUDIO_PROFILE || '0'),
              channelType: parseInt(process.env.RECORDING_CHANNEL_TYPE || '1'),
              videoStreamType: parseInt(process.env.RECORDING_VIDEO_STREAM_TYPE || '0'),
              transcodingConfig: {
                width: parseInt(process.env.RECORDING_TRANSCODING_WIDTH || '720'),
                height: parseInt(process.env.RECORDING_TRANSCODING_HEIGHT || '1280'),
                bitrate: parseInt(process.env.RECORDING_TRANSCODING_BITRATE || '3420'),
                fps: parseInt(process.env.RECORDING_TRANSCODING_FPS || '30'),
                mixedVideoLayout: parseInt(process.env.RECORDING_MIXED_VIDEO_LAYOUT || '1')
              },
              subscribeVideoUids: [],
              unsubscribeVideoUids: [],
              subscribeAudioUids: [],
              unsubscribeAudioUids: [],
              subscribeUidGroup: 0,
              extensionParams: {
                enableLivePlaylist: true
              }
            },
            storageConfig: {
              accessKey: process.env.RECORDING_COMPOSITE_STORAGE_ACCESS_KEY || '',
              secretKey: process.env.RECORDING_COMPOSITE_STORAGE_SECRET_KEY || '',
              region: parseInt(process.env.RECORDING_COMPOSITE_STORAGE_REGION || '0'),
              vendor: parseInt(process.env.RECORDING_COMPOSITE_STORAGE_VENDOR || '1'),
              bucket: process.env.RECORDING_COMPOSITE_STORAGE_BUCKET || '',
              fileNamePrefix: fileNamePrefix
            },
            recordingFileConfig: {
              avFileType: ['hls', 'mp4']
            }
          }
        };
        
        console.log('📹 [CLOUD RECORDING API] ============================================');
        console.log('📹 [CLOUD RECORDING API] Composite Recording Start Body:');
        console.log(JSON.stringify(startBody, null, 2));
        console.log('📹 [CLOUD RECORDING API] ============================================');
      } else {
        // Webpage recording
        const fileNamePrefix = buildFileNamePrefix(process.env.RECORDING_WEB_STORAGE_FILE_NAME_PREFIX);
        
        // Validate fileNamePrefix - Agora requires it to be a non-empty array
        if (!Array.isArray(fileNamePrefix) || fileNamePrefix.length === 0) {
          console.error('❌ [CLOUD RECORDING API] Invalid fileNamePrefix:', fileNamePrefix);
          return NextResponse.json(
            { error: 'Invalid fileNamePrefix configuration' },
            { status: 400 }
          );
        }
        
        console.log('📹 [CLOUD RECORDING API] Webpage recording config:', {
          hasStorageAccessKey: !!process.env.RECORDING_WEB_STORAGE_ACCESS_KEY,
          hasStorageSecretKey: !!process.env.RECORDING_WEB_STORAGE_SECRET_KEY,
          hasStorageBucket: !!process.env.RECORDING_WEB_STORAGE_BUCKET,
          fileNamePrefix: fileNamePrefix,
          fileNamePrefixLength: fileNamePrefix.length,
          recordingBaseUrl: process.env.RECORDING_WEBPAGE_URL || 'https://broadcastaway.netlify.app'
        });

        // Build the webpage URL - it should automatically join as audience
        // Use environment variable for recording URL, fallback to Netlify URL, then request origin
        const recordingBaseUrl = process.env.RECORDING_WEBPAGE_URL || 'https://broadcastaway.netlify.app';
        const webpageUrl = body.webpageUrl || `${recordingBaseUrl}/watch/${channelName}?name=Recording&uid=${recordingUid}&token=${token}`;
        
        console.log('📹 [CLOUD RECORDING API] Webpage URL:', webpageUrl);

        startBody = {
          cname: channelName,
          uid: recordingUid,
          clientRequest: {
            token: token,
            extensionServiceConfig: {
              errorHandlePolicy: 'error_abort',
              extensionServices: [
                {
                  serviceName: 'web_recorder_service',
                  errorHandlePolicy: 'error_abort',
                  serviceParam: {
                    url: webpageUrl,
                    audioProfile: parseInt(process.env.RECORDING_WEB_AUDIO_PROFILE || '0'),
                    videoWidth: parseInt(process.env.RECORDING_WEB_VIDEO_WIDTH || '1280'),
                    videoHeight: parseInt(process.env.RECORDING_WEB_VIDEO_HEIGHT || '720'),
                    maxRecordingHour: parseInt(process.env.RECORDING_WEB_MAX_RECORDING_HOUR || '3')
                  }
                }
              ]
            },
            storageConfig: {
              accessKey: process.env.RECORDING_WEB_STORAGE_ACCESS_KEY || '',
              secretKey: process.env.RECORDING_WEB_STORAGE_SECRET_KEY || '',
              vendor: parseInt(process.env.RECORDING_WEB_STORAGE_VENDOR || '1'),
              region: parseInt(process.env.RECORDING_WEB_STORAGE_REGION || '0'),
              bucket: process.env.RECORDING_WEB_STORAGE_BUCKET || '',
              fileNamePrefix: fileNamePrefix
            },
            recordingFileConfig: {
              avFileType: ['hls', 'mp4']
            }
          }
        };
        
        console.log('📹 [CLOUD RECORDING API] ============================================');
        console.log('📹 [CLOUD RECORDING API] Webpage Recording Start Body:');
        console.log(JSON.stringify(startBody, null, 2));
        console.log('📹 [CLOUD RECORDING API] ============================================');
      }

      const urlMode = recordingType === 'composite' ? 'mix' : 'web';
      const url = `${baseUrl}/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/mode/${urlMode}/start`;
      console.log('📹 [CLOUD RECORDING API] Starting recording:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(startBody)
      });

      const data = await response.json();
      console.log('📹 [CLOUD RECORDING API] Start response status:', response.status);
      console.log('📹 [CLOUD RECORDING API] Start response data:', JSON.stringify(data, null, 2));

      if (!response.ok) {
        console.error('❌ [CLOUD RECORDING API] Start failed:', {
          status: response.status,
          statusText: response.statusText,
          error: data.message || data.error || data,
          fullResponse: data
        });
        return NextResponse.json(
          { error: data.message || data.error || data.resourceId || 'Failed to start recording' },
          { status: response.status }
        );
      }

      return NextResponse.json(data);
    }

    if (action === 'stop') {
      // Stop recording
      if (!resourceId || !sid) {
        return NextResponse.json(
          { error: 'resourceId and sid are required' },
          { status: 400 }
        );
      }

      const recordingUid = recordingType === 'composite' 
        ? process.env.RECORDING_COMPOSITE_UID || '7777777'
        : process.env.RECORDING_WEBPAGE_UID || '8888888';

      const urlMode = recordingType === 'composite' ? 'mix' : 'web';
      const url = `${baseUrl}/v1/apps/${appId}/cloud_recording/resourceid/${resourceId}/sid/${sid}/mode/${urlMode}/stop`;
      
      const stopBody = {
        cname: channelName,
        uid: recordingUid,
        clientRequest: {}
      };

      console.log('📹 [CLOUD RECORDING API] Stopping recording:', url);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(stopBody)
      });

      const data = await response.json();
      console.log('📹 [CLOUD RECORDING API] Stop response:', data);

      if (!response.ok) {
        return NextResponse.json(
          { error: data.message || 'Failed to stop recording' },
          { status: response.status }
        );
      }

      // Include storage config info in response for URL generation
      // Rebuild fileNamePrefix for stop response - uses same logic as start (with time)
      // Note: We use the same buildFileNamePrefix function to ensure consistency
      const buildFileNamePrefixForStop = (envPrefix: string | undefined): string[] => {
        // Use the same function as start to ensure consistency
        // The time was already included when the recording started
        return buildFileNamePrefix(envPrefix);
      };

      const storageConfig = recordingType === 'composite' ? {
        bucket: process.env.RECORDING_COMPOSITE_STORAGE_BUCKET || '',
        vendor: parseInt(process.env.RECORDING_COMPOSITE_STORAGE_VENDOR || '1'),
        region: parseInt(process.env.RECORDING_COMPOSITE_STORAGE_REGION || '0'),
        fileNamePrefix: buildFileNamePrefixForStop(process.env.RECORDING_COMPOSITE_STORAGE_FILE_NAME_PREFIX)
      } : {
        bucket: process.env.RECORDING_WEB_STORAGE_BUCKET || '',
        vendor: parseInt(process.env.RECORDING_WEB_STORAGE_VENDOR || '1'),
        region: parseInt(process.env.RECORDING_WEB_STORAGE_REGION || '0'),
        fileNamePrefix: buildFileNamePrefixForStop(process.env.RECORDING_WEB_STORAGE_FILE_NAME_PREFIX)
      };

      return NextResponse.json({
        ...data,
        storageConfig
      });
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('❌ [CLOUD RECORDING API] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

