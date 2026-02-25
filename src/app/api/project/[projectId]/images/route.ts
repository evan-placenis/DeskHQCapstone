import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

//This is the API endpoint for the ProjectDetailPage.tsx to upload photos for a project.
// app/api/projects/[projectId]/images/route.ts

export async function POST(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const formData = await request.formData();
        
        // 1. GET ALL FILES (Not just the first one)
        const files = formData.getAll("file") as File[]; // <--- KEY CHANGE
        const folderName = formData.get("folderName") as string;
        const descriptionsJson = formData.get("descriptions") as string;


        let descriptions: string[] = [];
        
        try {
            if (descriptionsJson) {
                descriptions = JSON.parse(descriptionsJson);
            }
        } catch (e) {
            console.warn("⚠️ Failed to parse descriptions JSON, falling back to empty strings.");
        }

        // Fallback: If descriptions array is missing or length mismatch, fill with empty strings
        if (descriptions.length !== files.length) {
            const singleDesc = formData.get("description") as string || "";
            // If we have a single description but multiple files (old behavior), fill array with it
            descriptions = new Array(files.length).fill(singleDesc);
        }
        
        const resolvedParams = await params;
        const projectId = resolvedParams.projectId;

        // ... Authentication Checks (Same as before) ...
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) return NextResponse.json({ error: "Auth error" }, { status: 401 });
        const userId = user.id;

        if (!files || files.length === 0) {
            return NextResponse.json({ error: "No files uploaded" }, { status: 400 });
        }

        // ... Get Organization ID (Same as before) ...
        const userProfile = await Container.userService.getUserProfile(userId, supabase);
        const organizationId = userProfile?.organization_id;
        if (!organizationId) return NextResponse.json({ error: "No Org ID" }, { status: 403 });

        console.log(`📤 Uploading ${files.length} images for Project ${projectId}...`);

        // 2. PARALLEL STORAGE UPLOAD
        // Upload all files to Supabase Storage simultaneously
        const uploadPromises = files.map((file, i) => 
            Container.storageService.uploadProjectImage(
                projectId,
                organizationId,
                userId,
                file,
                file.name,
                folderName,
                descriptions[i] || "", // Note: They will all share the same generic description initially
                supabase
            )
        );

        const uploadedImages = await Promise.all(uploadPromises);

        // 3. BATCH AI ANALYSIS
        // Prepare the array for our new PhotoService
        const analysisRequests = uploadedImages.map(img => ({
            id: img.id,
            url: img.public_url
        }));

        // Send the entire batch to the AI service (Fire-and-Forget)
        Container.photoService.analyzePhotos(analysisRequests, supabase)
            .catch((error) => {
                console.error(`❌ [API] Batch processing failed:`, error);
            });

        return NextResponse.json({
            success: true,
            count: uploadedImages.length,
            images: uploadedImages,
            processing: true
        }, { status: 201 });

    } catch (error: any) {
        console.error("❌ Batch Upload Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to upload images" },
            { status: 500 }
        );
    }
}

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const resolvedParams = await params;
        const projectId = resolvedParams.projectId;

        // Create a user-scoped Supabase client for GET request as well
        const { supabase, user } = await createAuthenticatedClient();
        
        if (!user) {
             console.error("❌ Auth Error: No valid session found.");
             return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const images = await Container.storageService.getProjectImages(projectId, supabase);
        
        return NextResponse.json({
            success: true,
            images
        }, { status: 200 });
    } catch (error: any) {
        // Fallback for when "Invalid API key" occurs due to missing client/key
        if (error.message.includes('Invalid API key') || error.message.includes('supabaseKey is required')) {
             console.error("❌ Auth Error: No valid session or API key found. User might be logged out.");
             return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        console.error("❌ Fetch Images Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch images" },
            { status: 500 }
        );
    }
}

export async function DELETE( //delete images or folders
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        const { searchParams } = new URL(request.url);
        const imageId = searchParams.get('imageId');
        const folderName = searchParams.get('folderName');

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (imageId) {
            // --- DELETE SINGLE IMAGE ---
            
            // 1. Get image path from DB
            const { data: image, error: fetchError } = await supabase
                .from('project_images')
                .select('storage_path')
                .eq('id', imageId)
                .single();

            if (fetchError || !image) {
                 return NextResponse.json({ error: "Image not found" }, { status: 404 });
            }

            // 2. Delete from Storage
            const { error: storageError } = await supabase
                .storage
                .from('project-images')
                .remove([image.storage_path]);

            if (storageError) {
                console.error("Storage delete error:", storageError);
                return NextResponse.json({ error: `Storage delete failed: ${storageError.message}` }, { status: 500 });
            }

            // 3. Delete from DB
            const { error: dbError } = await supabase
                .from('project_images')
                .delete()
                .eq('id', imageId);

            if (dbError) throw new Error(dbError.message);

            return NextResponse.json({ success: true, message: `Deleted image ${imageId}` });

        } else if (folderName) {
            // --- DELETE FOLDER (BULK) ---
            
            // 1. Fetch images in folder
            const { data: images, error: fetchError } = await supabase
                .from('project_images')
                .select('storage_path')
                .eq('project_id', projectId)
                .eq('folder_name', folderName);

            if (fetchError) throw new Error(`Failed to fetch images: ${fetchError.message}`);

            if (images && images.length > 0) {
                // 2. Batch Delete from Storage
                const pathsToDelete = images.map(img => img.storage_path);
                const { error: storageError } = await supabase
                    .storage
                    .from('project-images')
                    .remove(pathsToDelete);

                if (storageError) {
                    console.error("Storage batch delete error:", storageError);
                    return NextResponse.json({ error: `Storage batch delete failed: ${storageError.message}` }, { status: 500 });
                }

                // 3. Delete from DB
                const { error: dbError } = await supabase
                    .from('project_images')
                    .delete()
                    .eq('project_id', projectId)
                    .eq('folder_name', folderName);

                if (dbError) throw new Error(`DB delete error: ${dbError.message}`);
            }

            return NextResponse.json({ 
                success: true, 
                message: `Deleted folder "${folderName}" and ${images?.length || 0} images.` 
            });

        } else {
            return NextResponse.json({ error: "Missing 'imageId' or 'folderName' query parameter" }, { status: 400 });
        }

    } catch (error: any) {
        console.error("❌ Delete Error:", error);
        return NextResponse.json(
            { error: error.message || "Delete operation failed" },
            { status: 500 }
        );
    }
}