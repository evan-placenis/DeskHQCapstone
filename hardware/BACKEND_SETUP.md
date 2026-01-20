# Backend Setup for Hardware Integration

This document explains how to configure the backend to accept photo uploads from hardware devices (Raspberry Pi).

## Environment Variables

Add the following environment variables to your `.env` file:

```env
# Hardware API Key (generate a secure random string)
HARDWARE_API_KEY=your-secure-random-api-key-here

# Optional: Dedicated user ID for hardware uploads
# If not set, uses a default UUID
HARDWARE_USER_ID=00000000-0000-0000-0000-000000000000

# Required: Supabase Service Role Key (for bypassing RLS)
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

## Generating a Secure API Key

You can generate a secure API key using:

```bash
# Using OpenSSL
openssl rand -hex 32

# Using Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Using Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

## API Endpoint

The hardware endpoint is available at:
```
POST /api/hardware/images
```

### Authentication

The endpoint accepts API key authentication via:
- Header: `X-API-Key: {API_KEY}`
- Header: `Authorization: Bearer {API_KEY}`

### Request Format

**Headers:**
```
X-API-Key: {HARDWARE_API_KEY}
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: Image file (JPEG)
- `projectId`: Project ID (required)
- `organizationId`: Organization ID (required)
- `folderName`: (optional) Folder name
- `description`: (optional) Image description

### Response

**Success (201):**
```json
{
  "success": true,
  "image": {
    "id": "image-id",
    "public_url": "https://...",
    "storage_path": "...",
    ...
  },
  "message": "Photo uploaded successfully from hardware device"
}
```

**Error (400/401/500):**
```json
{
  "error": "Error message"
}
```

## Security Considerations

1. **API Key Security:**
   - Store the API key securely in environment variables
   - Never commit API keys to version control
   - Rotate keys periodically
   - Use different keys for different hardware devices if needed

2. **Service Role Key:**
   - The endpoint uses Supabase Service Role Key to bypass RLS
   - This is necessary for hardware devices that don't have user sessions
   - Keep this key extremely secure

3. **Rate Limiting:**
   - Consider implementing rate limiting for the hardware endpoint
   - Monitor for unusual upload patterns

4. **Validation:**
   - The endpoint validates projectId and organizationId
   - Ensure these IDs are correct before sharing with hardware team

## Testing

You can test the endpoint using curl:

```bash
curl -X POST \
  -H "X-API-Key: your-hardware-api-key" \
  -F "file=@/path/to/image.jpg" \
  -F "projectId=your-project-id" \
  -F "organizationId=your-org-id" \
  -F "folderName=Test Photos" \
  -F "description=Test upload" \
  https://your-app.com/api/hardware/images
```

## Providing Credentials to Hardware Team

Share the following with your hardware team:
1. **API URL**: Your application's base URL
2. **Project ID**: The project ID to upload to
3. **Organization ID**: The organization ID
4. **API Key**: The hardware API key (HARDWARE_API_KEY)

**Important:** Share these securely (e.g., encrypted email, secure messaging, or password manager).
