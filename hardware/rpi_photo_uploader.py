#!/usr/bin/env python3
"""
Raspberry Pi Photo Uploader
============================
This script captures photos using the Raspberry Pi camera and uploads them
to your application's backend server.

HOW IT WORKS:
1. Takes a photo with the Raspberry Pi camera
2. Sends the photo to your backend API endpoint (your Next.js app)
3. Uses an API key for authentication (like a password)

The hardware does NOT need to provide an API - it just calls your backend API.

Requirements:
- Raspberry Pi with camera module
- Python 3.7+
- pip install picamera2 requests

Setup:
1. Install dependencies: pip install picamera2 requests
2. Update API_URL (your backend server URL)
3. Update API_KEY (get this from your backend team - it's set in backend .env)
4. Run: python3 rpi_photo_uploader.py

Author: Hardware Team Integration
"""

import os
import sys
import time
import requests
from datetime import datetime
from pathlib import Path

# Try to import picamera2 (Raspberry Pi camera library)
try:
    from picamera2 import Picamera2
    from picamera2.encoders import JpegEncoder
    from picamera2.outputs import FileOutput
    CAMERA_AVAILABLE = True
except ImportError:
    print("Warning: picamera2 not available. Using mock camera mode.")
    CAMERA_AVAILABLE = False

# ============================================================================
# CONFIGURATION - UPDATE THESE VALUES
# ============================================================================

# Your backend application URL (where your Next.js app is hosted)
# Examples:
#   - Production: "https://your-app.com"
#   - Local dev: "http://localhost:3000"
#   - Staging: "https://staging.your-app.com"
API_URL = "https://your-app.com"  # TODO: Update with your actual backend URL

# Hardcoded Project ID and Organization ID
# These are already set - no need to change unless using a different project
PROJECT_ID = "abaf92bc-0adc-46df-8ad7-61921aa97606"
ORG_ID = "aa54020a-1b77-4121-b4b0-9c256e8bb260"

# API Authentication Key (Secret Token)
# This is a password-like token that the hardware uses to authenticate
# with your backend. You need to:
#   1. Set HARDWARE_API_KEY in your backend's .env file
#   2. Put that same value here
# Example: "abc123xyz789secretkey456"
API_KEY = "your-api-key-here"  # TODO: Set this to match HARDWARE_API_KEY in backend .env

# Optional: Folder name for organizing photos
FOLDER_NAME = "Raspberry Pi Photos"

# Optional: Description prefix for photos
DESCRIPTION_PREFIX = "RPi Capture"

# Camera settings
IMAGE_WIDTH = 1920
IMAGE_HEIGHT = 1080
IMAGE_QUALITY = 85  # JPEG quality (1-100)

# ============================================================================
# END CONFIGURATION
# ============================================================================


class RaspberryPiPhotoUploader:
    """Handles photo capture and upload from Raspberry Pi"""
    
    def __init__(self):
        self.api_url = API_URL.rstrip('/')
        self.project_id = PROJECT_ID
        self.org_id = ORG_ID
        self.api_key = API_KEY
        self.folder_name = FOLDER_NAME
        self.camera = None
        
        # Validate configuration
        if self.api_url == "https://your-app.com" or not self.api_url:
            raise ValueError("Please update API_URL in the configuration")
        if self.project_id == "your-project-id-here" or not self.project_id:
            raise ValueError("Please update PROJECT_ID in the configuration")
        if self.org_id == "your-org-id-here" or not self.org_id:
            raise ValueError("Please update ORG_ID in the configuration")
        if self.api_key == "your-api-key-here" or not self.api_key:
            raise ValueError("Please update API_KEY in the configuration")
    
    def initialize_camera(self):
        """Initialize the Raspberry Pi camera"""
        if not CAMERA_AVAILABLE:
            print("Camera not available. Using mock mode.")
            return False
        
        try:
            self.camera = Picamera2()
            # Configure camera
            camera_config = self.camera.create_still_configuration(
                main={"size": (IMAGE_WIDTH, IMAGE_HEIGHT)}
            )
            self.camera.configure(camera_config)
            self.camera.start()
            time.sleep(2)  # Allow camera to warm up
            print("✓ Camera initialized successfully")
            return True
        except Exception as e:
            print(f"✗ Failed to initialize camera: {e}")
            return False
    
    def capture_photo(self, output_path=None):
        """
        Capture a photo using the Raspberry Pi camera
        
        Args:
            output_path: Optional path to save the photo locally
            
        Returns:
            Path to the captured image file, or None if failed
        """
        if not CAMERA_AVAILABLE or not self.camera:
            # Mock mode: create a dummy file for testing
            if output_path is None:
                output_path = f"/tmp/rpi_photo_{int(time.time())}.jpg"
            print(f"Mock mode: Creating dummy photo at {output_path}")
            # Create a minimal valid JPEG file
            with open(output_path, 'wb') as f:
                f.write(b'\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00H\x00H\x00\x00\xff\xd9')
            return output_path
        
        try:
            if output_path is None:
                output_path = f"/tmp/rpi_photo_{int(time.time())}.jpg"
            
            # Capture photo
            print(f"Capturing photo...")
            self.camera.capture_file(output_path)
            print(f"✓ Photo captured: {output_path}")
            return output_path
        except Exception as e:
            print(f"✗ Failed to capture photo: {e}")
            return None
    
    def upload_photo(self, image_path):
        """
        Upload a photo to the backend API using the hardware endpoint
        
        Args:
            image_path: Path to the image file to upload
            
        Returns:
            True if upload successful, False otherwise
        """
        if not os.path.exists(image_path):
            print(f"✗ Image file not found: {image_path}")
            return False
        
        # Use the hardware-specific endpoint
        upload_url = f"{self.api_url}/api/hardware/images"
        
        # Generate description with timestamp
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        description = f"{DESCRIPTION_PREFIX} - {timestamp}"
        
        # Prepare form data
        try:
            with open(image_path, 'rb') as image_file:
                files = {
                    'file': (os.path.basename(image_path), image_file, 'image/jpeg')
                }
                data = {
                    'projectId': self.project_id,
                    'organizationId': self.org_id,
                    'folderName': self.folder_name,
                    'description': description
                }
                
                # Set up headers with authentication
                # Can use either Authorization header or X-API-Key header
                headers = {
                    'X-API-Key': self.api_key,
                    # Alternative: 'Authorization': f'Bearer {self.api_key}',
                }
                
                print(f"Uploading photo to {upload_url}...")
                print(f"  Project ID: {self.project_id}")
                print(f"  Organization ID: {self.org_id}")
                print(f"  Folder: {self.folder_name}")
                print(f"  Description: {description}")
                
                response = requests.post(
                    upload_url,
                    files=files,
                    data=data,
                    headers=headers,
                    timeout=30
                )
                
                if response.status_code == 201:
                    result = response.json()
                    print(f"✓ Photo uploaded successfully!")
                    print(f"  Image ID: {result.get('image', {}).get('id', 'N/A')}")
                    print(f"  Public URL: {result.get('image', {}).get('public_url', 'N/A')}")
                    return True
                else:
                    print(f"✗ Upload failed with status {response.status_code}")
                    print(f"  Response: {response.text}")
                    return False
                    
        except requests.exceptions.RequestException as e:
            print(f"✗ Network error during upload: {e}")
            return False
        except Exception as e:
            print(f"✗ Unexpected error during upload: {e}")
            return False
    
    def capture_and_upload(self, cleanup=True):
        """
        Capture a photo and upload it to the backend
        
        Args:
            cleanup: If True, delete the local file after successful upload
            
        Returns:
            True if successful, False otherwise
        """
        # Capture photo
        image_path = self.capture_photo()
        if not image_path:
            return False
        
        # Upload photo
        success = self.upload_photo(image_path)
        
        # Cleanup
        if cleanup and success and os.path.exists(image_path):
            try:
                os.remove(image_path)
                print(f"✓ Cleaned up local file: {image_path}")
            except Exception as e:
                print(f"Warning: Could not delete local file: {e}")
        
        return success
    
    def cleanup(self):
        """Clean up camera resources"""
        if self.camera:
            try:
                self.camera.stop()
                print("✓ Camera stopped")
            except Exception as e:
                print(f"Warning: Error stopping camera: {e}")


def main():
    """Main function"""
    print("=" * 60)
    print("Raspberry Pi Photo Uploader")
    print("=" * 60)
    print()
    
    try:
        # Initialize uploader
        uploader = RaspberryPiPhotoUploader()
        
        # Initialize camera
        uploader.initialize_camera()
        
        # Capture and upload
        print("\n" + "-" * 60)
        print("Starting photo capture and upload...")
        print("-" * 60)
        
        success = uploader.capture_and_upload()
        
        if success:
            print("\n✓ Process completed successfully!")
            return 0
        else:
            print("\n✗ Process failed. Check errors above.")
            return 1
            
    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        return 1
    except Exception as e:
        print(f"\n✗ Fatal error: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        if 'uploader' in locals():
            uploader.cleanup()


if __name__ == "__main__":
    sys.exit(main())
