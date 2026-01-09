import { ExecutionModeStrategy, AgentExecutionContext, VisionAnalysis } from "../interfaces";
import { visionAgent } from "../VisonAgent/GPT4o";

export class ImageAndTextMode implements ExecutionModeStrategy {
  async prepareInput(context: AgentExecutionContext): Promise<{ analysis: VisionAnalysis[], text: string }> {
    console.log("👁️📝 Mode: Reading TEXT and IMAGES.");

    // 1. Resolve Image IDs to URLs (and Sign them if possible)
    const imagesToAnalyze = await Promise.all(context.selectedImages.map(async id => {
        const img = context.project.images?.find(i => i.imageId === id);
        if (!img?.blobUrl) {
            console.warn(`[ImageAndTextMode] Warning: Image ${id} not found or missing blobUrl.`);
            return null;
        }

        let finalUrl = img.blobUrl;

        // 🔐 If we have a Supabase client, try to sign the URL for private access
        if (context.client) {
            try {
                // Extract path from public URL if possible
                // Expected format: .../storage/v1/object/public/project-images/{PATH}
                const publicMarker = '/object/public/project-images/';
                const pathIndex = img.blobUrl.indexOf(publicMarker);
                
                if (pathIndex !== -1) {
                    const storagePath = img.blobUrl.substring(pathIndex + publicMarker.length);
                    console.log(`[ImageAndTextMode] Attempting to sign URL for path: ${storagePath}`);
                    
                    // Generate signed URL valid for 1 hour
                    const { data, error } = await context.client.storage
                        .from('project-images')
                        .createSignedUrl(storagePath, 3600);

                    if (error) {
                        console.warn(`[ImageAndTextMode] Failed to sign URL for ${id}:`, error.message);
                    } else if (data?.signedUrl) {
                        console.log(`[ImageAndTextMode] ✅ Signed URL generated for ${id}`);
                        finalUrl = data.signedUrl;
                    }
                } else {
                    console.log(`[ImageAndTextMode] URL does not match public pattern: ${img.blobUrl}`);
                }
            } catch (err) {
                console.error(`[ImageAndTextMode] Error signing URL for ${id}:`, err);
            }
        } else {
            console.warn("[ImageAndTextMode] ⚠️ No Supabase client in context. Cannot sign private image URLs.");
        }

        return {
            id: id,
            url: finalUrl 
        };
    }));

    const validImages = imagesToAnalyze.filter((img): img is { id: string; url: string } => img !== null);

    // 2. Call the vision agent to analyze the images
    // Note: If images have already been analyzed (e.g. stored in DB), 
    // we might want to skip this or merge. For now, we re-analyze or analyze on fly.
    let imageAnalysis: VisionAnalysis[] = [];
    if (validImages.length > 0) {
        console.log(`[ImageAndTextMode] Analyzing ${validImages.length} images...`);
        imageAnalysis = await visionAgent.analyzeBatch(validImages);
    } else {
        console.log("[ImageAndTextMode] No valid images found to analyze.");
    }
    
    return {
      text: `Project: ${context.project.name}`,
      analysis: imageAnalysis
    };
  }
}
