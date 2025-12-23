# Agora REST API URLs Reference

This document lists all the correct Agora REST API endpoints used in BroadCastaway.

**IMPORTANT**: Each Agora product has DIFFERENT URL patterns. Do NOT assume they all use the same format!

## Channel Management

### Query Channel List
- **Endpoint**: `GET https://api.agora.io/dev/v1/channel/{appid}?page_no={page}&page_size={size}`
- **Used in**: `app/api/channels/route.ts`
- **Example**: `https://api.agora.io/dev/v1/channel/b82bc2839fec4413bd6f2d4c4b60d70a?page_no=1&page_size=50`
- **Pattern**: `/dev/v1/channel/{appid}`

### Query Channel Users
- **Endpoint**: `GET https://api.agora.io/dev/v1/channel/user/{appid}/{channelName}`
- **Used in**: `app/api/channels/route.ts`
- **Example**: `https://api.agora.io/dev/v1/channel/user/b82bc2839fec4413bd6f2d4c4b60d70a/summer-deals`
- **Pattern**: `/dev/v1/channel/user/{appid}/{channelName}`

## Media Services

### Media Pull (Cloud Player)

#### Create Player
- **Endpoint**: `POST https://api.agora.io/v1/projects/{appid}/cloud-player/players`
- **Used in**: `src/services/agoraService.js` → `startMediaPull()`
- **Pattern**: `/v1/projects/{appid}/cloud-player/players` (NOT `/dev/v1/`)

#### Update Player
- **Endpoint**: `PATCH https://api.agora.io/v1/projects/{appid}/cloud-player/players/{playerId}?sequence={seq}`
- **Used in**: `src/services/agoraService.js` → `updateMediaPull()`
- **Pattern**: `/v1/projects/{appid}/cloud-player/players/{playerId}?sequence={seq}`

#### Delete Player
- **Endpoint**: `DELETE https://api.agora.io/v1/projects/{appid}/cloud-player/players/{playerId}`
- **Used in**: `src/services/agoraService.js` → `deleteMediaPull()`
- **Pattern**: `/v1/projects/{appid}/cloud-player/players/{playerId}`

### Media Push (RTMP Converter)

#### Create Converter
- **Endpoint**: `POST https://api.agora.io/v1/projects/{appid}/rtmp-converters`
- **Used in**: `src/services/agoraService.js` → `startMediaPush()`
- **Pattern**: `/v1/projects/{appid}/rtmp-converters` (NOT `/dev/v1/`)

### Media Gateway

#### Create Gateway Stream Key
- **Endpoint**: `POST https://api.agora.io/v1/projects/{appid}/rtls/ingress/streamkeys`
- **Used in**: `src/services/agoraService.js` → `startMediaGateway()`
- **Pattern**: `/v1/projects/{appid}/rtls/ingress/streamkeys` (NOT `/dev/v1/`)
- **Body**: `{ channel: "{channelName}", uid: {uid} }`

## Conversational AI

### Join Agent to Channel
- **Endpoint**: `POST https://api.agora.io/api/conversational-ai-agent/v2/projects/{appId}/join`
- **Used in**: `app/api/agora-agents/route.ts`
- **Pattern**: `/api/conversational-ai-agent/v2/projects/{appId}/join` (NOT `/dev/v1/`)

## URL Pattern Summary

| Product | Pattern | Example |
|---------|---------|---------|
| Channel List | `/dev/v1/channel/{appid}` | `/dev/v1/channel/b82bc283...` |
| Media Pull | `/v1/projects/{appid}/cloud-player/players` | `/v1/projects/b82bc283.../cloud-player/players` |
| Media Push | `/v1/projects/{appid}/rtmp-converters` | `/v1/projects/b82bc283.../rtmp-converters` |
| Media Gateway | `/v1/projects/{appid}/rtls/ingress/streamkeys` | `/v1/projects/b82bc283.../rtls/ingress/streamkeys` |
| Conversational AI | `/api/conversational-ai-agent/v2/projects/{appId}/join` | `/api/conversational-ai-agent/v2/projects/b82bc283.../join` |

## Important Notes

1. **Base URL**: All endpoints use `https://api.agora.io` (or value from `AGORA_BASE_URL` env var)
2. **Different Patterns**: Each product uses a DIFFERENT URL pattern - do not assume they're the same!
3. **Authentication**: All requests use Basic Auth with Customer ID and Secret
4. **App ID**: App ID is included in the URL path where required

## References

- [Agora REST API Documentation](https://docs.agora.io/en/api-reference)
- Check specific product documentation for exact endpoint formats
- Media Services demo: `../media_services/`
- Conversational AI demo: `../convo_ai/`

