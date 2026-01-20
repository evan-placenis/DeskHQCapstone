# Raspberry Pi Hardware Integration

This directory contains the code and documentation for integrating Raspberry Pi hardware with the application backend.

## Files

- `rpi_photo_uploader.py` - Main Python script for capturing and uploading photos
- `README.md` - This file

## Setup Instructions

### 1. Install Dependencies

On your Raspberry Pi, install the required Python packages:

```bash
# Update package list
sudo apt update

# Install Python and pip if not already installed
sudo apt install python3 python3-pip -y

# Install camera library
sudo apt install python3-picamera2 -y

# Install HTTP library
pip3 install requests
```

### 2. Configure the Script

Edit `rpi_photo_uploader.py` and update the following configuration variables:

```python
API_URL = "https://your-app.com"  # Your application's base URL
PROJECT_ID = "your-project-id-here"  # Your project ID
ORG_ID = "your-org-id-here"  # Your organization ID
API_KEY = "your-api-key-here"  # API key for authentication
```

### 3. Get API Credentials

You'll need to obtain:
- **Project ID**: Found in your application's project settings
- **Organization ID**: Found in your user profile or organization settings
- **API Key**: Contact your backend team to generate a hardware device API key

### 4. Test the Script

Run the script to test:

```bash
python3 rpi_photo_uploader.py
```

## Usage

### Single Photo Capture and Upload

Simply run the script:

```bash
python3 rpi_photo_uploader.py
```

### Automated Scheduled Uploads

To run the script periodically (e.g., every hour), add a cron job:

```bash
# Edit crontab
crontab -e

# Add this line to run every hour
0 * * * * /usr/bin/python3 /path/to/rpi_photo_uploader.py >> /var/log/rpi_uploader.log 2>&1
```

### Continuous Monitoring Mode

You can modify the script to run in a loop for continuous monitoring:

```python
import time

while True:
    uploader.capture_and_upload()
    time.sleep(3600)  # Wait 1 hour between captures
```

## Troubleshooting

### Camera Not Detected

- Ensure the camera module is properly connected
- Enable camera in Raspberry Pi configuration: `sudo raspi-config` → Interface Options → Camera → Enable
- Reboot the Pi after enabling the camera

### Upload Fails

- Check your internet connection
- Verify API_URL is correct and accessible
- Ensure API_KEY is valid and not expired
- Check that PROJECT_ID and ORG_ID are correct

### Permission Errors

- Ensure the script has write permissions in `/tmp` directory
- Run with appropriate user permissions

## API Endpoint

The script uploads photos to the hardware-specific endpoint:
```
POST {API_URL}/api/hardware/images
```

With the following:
- **Headers:**
  - `X-API-Key`: Your hardware API key (or `Authorization: Bearer {API_KEY}`)
- **Form Data:**
  - `file`: The image file (JPEG)
  - `projectId`: Your project ID
  - `organizationId`: Your organization ID
  - `folderName`: (optional) Folder name for organization
  - `description`: (optional) Description of the photo

## Security Notes

- **Never commit API keys to version control**
- Store API keys securely on the Raspberry Pi
- Consider using environment variables for sensitive configuration
- Rotate API keys periodically

## Support

For issues or questions, contact the backend development team.
