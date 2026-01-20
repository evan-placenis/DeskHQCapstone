import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { createClient } from '@supabase/supabase-js';

/**
 * Hardware Device Image Upload Endpoint
 * 
 * This endpoint is specifically designed for hardware devices (e.g., Raspberry Pi)
 * that need to upload photos without browser-based authentication.
 * 
 * Authentication: Uses API key via Authorization header or X-API-Key header
 * 
 * Required Headers:
 * - Authorization: Bearer {API_KEY} OR
 * - X-API-Key: {API_KEY}
 * 
 * Required Body (FormData):
 * - file: Image file (JPEG)
 * - projectId: Project ID (can also be in header)
 * - organizationId: Organization ID (can also be in header)
 * - folderName: (optional) Folder name
 * - description: (optional) Image description
 */

// TODO: Store this in environment variables or a secure key management system
// For production, use a proper API key management solution
const HARDWARE_API_KEY = process.env.HARDWARE_API_KEY || "your-hardware-api-key-change-this";

export async function POST(request: Request) {
    try {
        // 1. Extract API key from headers
        const authHeader = request.headers.get('Authorization');
        const apiKeyHeader = request.headers.get('X-API-Key');

        const providedApiKey = authHeader?.replace('Bearer ', '') || apiKeyHeader;

        if (!providedApiKey || providedApiKey !== HARDWARE_API_KEY) {
            return NextResponse.json(
                { error: "Invalid or missing API key" },
                { status: 401 }
            );
        }

        // 2. Parse form data
        const formData = await request.formData();
        const file = formData.get("file") as File;

        // Get projectId and organizationId from form data or headers
        const projectId = formData.get("projectId") as string ||
            request.headers.get("X-Project-ID") ||
            null;
        const organizationId = formData.get("organizationId") as string ||
            request.headers.get("X-Organization-ID") ||
            null;

        const folderName = formData.get("folderName") as string;
        const description = formData.get("description") as string;

        // 3. Validate required fields
        if (!file) {
            return NextResponse.json(
                { error: "No file uploaded" },
                { status: 400 }
            );
        }

        if (!projectId) {
            return NextResponse.json(
                { error: "Project ID is required (provide in formData as 'projectId' or header as 'X-Project-ID')" },
                { status: 400 }
            );
        }

        if (!organizationId) {
            return NextResponse.json(
                { error: "Organization ID is required (provide in formData as 'organizationId' or header as 'X-Organization-ID')" },
                { status: 400 }
            );
        }

        // 4. Create a service account Supabase client
        // Use service role key for hardware devices (bypasses RLS)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseUrl || !supabaseServiceKey) {
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 5. Use a system user ID for hardware uploads
        // You may want to create a dedicated "hardware" user account
        const hardwareUserId = process.env.HARDWARE_USER_ID || "00000000-0000-0000-0000-000000000000";

        // 6. Upload using StorageService
        console.log(`📤 Hardware upload: Project ${projectId}, Org ${organizationId}`);
        const uploadedImage = await Container.storageService.uploadProjectImage(
            projectId,
            organizationId,
            hardwareUserId,
            file,
            file.name,
            folderName,
            description,
            supabase
        );

        return NextResponse.json({
            success: true,
            image: uploadedImage,
            message: "Photo uploaded successfully from hardware device"
        }, { status: 201 });

    } catch (error: any) {
        console.error("❌ Hardware Image Upload Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to upload image" },
            { status: 500 }
        );
    }
}
