import { SupabaseClient } from '@supabase/supabase-js';
import { Container } from '../config/container';
import { VisionRequest } from '../AI_Skills/llm/interfaces';

/**
 * Service for processing photos with AI vision analysis.
 * Handles SitePhotoAgent integration to analyze uploaded photos and update project_images table.
 */
export class PhotoService { //turn into a strategy pattern later for better flexibility (similar to knowledge service)
    /**
     * Unified method to process one or many photos.
     * Handles fetching context, running AI analysis, and updating the DB.
     * * Usage for single: photoService.analyzePhotos([{ id, url }], client)
     */
    async analyzePhotos(
        images: Array<{ id: string; url: string }>,
        client: SupabaseClient
    ): Promise<void> {
        if (images.length === 0) return;

        console.log(`🔍 [PhotoService] Analyzing ${images.length} photos...`);

        try {
            // 1. Fetch User Descriptions and Storage Paths for ALL images in one query
            // This avoids N+1 database calls.
            const imageIds = images.map(img => img.id);
            const { data: imageDataList, error: fetchError } = await client
                .from('project_images')
                .select('id, description, storage_path')
                .in('id', imageIds);

            if (fetchError) {
                console.warn(`⚠️ [PhotoService] Failed to fetch image data, proceeding without context:`, fetchError);
            }

            // Create Maps for fast lookup
            const descriptionMap = new Map<string, string>();
            const pathMap = new Map<string, string>();

            imageDataList?.forEach((row: any) => {
                if (row.description) descriptionMap.set(row.id, row.description);
                if (row.storage_path) pathMap.set(row.id, row.storage_path);
            });
            // 2. Generate Signed URLs (Parallel)
            // This is the CRITICAL FIX. We don't use the public URL.
            const signedUrlPromises = images.map(async (img) => {
                const storagePath = pathMap.get(img.id);
                if (!storagePath) {
                    console.warn(`⚠️ [PhotoService] No storage_path found for image ${img.id}`);
                    return null;
                }

                // Create a URL valid for 3600 seconds (1 hour) (enough for Gemini to download it)
                const { data, error } = await client
                    .storage
                    .from('project-images') // Ensure this matches your actual bucket name
                    .createSignedUrl(storagePath, 3600);

                if (error || !data) {
                    console.warn(`⚠️ [PhotoService] Could not sign URL for ${img.id} (path: ${storagePath}):`, error);
                    return null;
                }

                return {
                    id: img.id,
                    url: data.signedUrl, // <--- Use this secure URL
                    description: descriptionMap.get(img.id)
                };
            });

            // Filter out any failed signings
            const validRequests = (await Promise.all(signedUrlPromises)).filter(r => r !== null) as VisionRequest[];
            if (validRequests.length === 0) {
                console.warn("⚠️ No valid signed URLs generated. Aborting analysis.");
                return;
            }

            // 3. Run AI Analysis (The Agent handles concurrency internally)
            const analyses = await Container.sitePhotoAgent.analyzeBatch(validRequests);

            // 4. Update Database in Parallel
            // We use Promise.all to blast updates to Supabase simultaneously 
            // instead of waiting for one to finish before starting the next.
            const updatePromises = analyses.map(async (analysis) => {
                const { error: updateError } = await client
                    .from('project_images')
                    .update({
                        ai_description: analysis.description,
                        tags: analysis.tags,
                        severity: analysis.severity
                    })
                    .eq('id', analysis.imageId);

                if (updateError) {
                    console.error(`❌ [PhotoService] Failed DB update for ${analysis.imageId}:`, updateError);
                    // We don't throw here, so other updates can still succeed
                } else {
                    console.log(`✅ [PhotoService] Saved analysis for ${analysis.imageId} (Severity: ${analysis.severity})`);
                }
            });

            await Promise.all(updatePromises);
            console.log(`🏁 [PhotoService] Batch complete.`);

        } catch (error) {
            console.error(`❌ [PhotoService] Critical error in analyzePhotos:`, error);
            // Even if this fails, the photos are safely uploaded. 
            // We just miss the AI metadata.
        }
    }
}

