import { ObservationState } from "../../../state/report/ObservationState";

export const fetchContextNode = async (state: typeof ObservationState.State) => {
  const { selectedImageIds, client } = state;
  console.log("🔄 [FetchNode] Hydrating state for images:", selectedImageIds);

  if (!selectedImageIds || selectedImageIds.length === 0) {
     return { imageList: [] };
  }

  // 1. Database Call
  const { data: images, error } = await client
    .from('project_images')
    .select('*') // Grab everything: ai_description, tags, severity, description
    .in('id', selectedImageIds);

  if (error) {
    throw new Error(`Failed to fetch context: ${error.message}`);
  }

  // 2. Generate Signed URLs (Parallel)
  // We cannot just map() because createSignedUrl is async. 
  // We use Promise.all to do them all at once.
  
  const enrichedImages = await Promise.all(images.map(async (img: any) => {
    
    const BUCKET_NAME = 'project-images'; 
    const filePath = img.storage_path; // Adjust based on your DB schema

    let signedUrl = "";
    
    if (filePath) {
        try {
            // Sign the URL for 1 hour (3600 seconds)
            // This ensures the link works while the AI is analyzing it
            const { data: signData, error: signError } = await client
                .storage
                .from(BUCKET_NAME)
                .createSignedUrl(filePath, 3600);

            if (signData?.signedUrl) {
                signedUrl = signData.signedUrl;
            } else {
                console.warn(`⚠️ [FetchNode] Failed to sign image ${img.id}:`, signError);
            }
        } catch (err) {
            console.warn(`⚠️ [FetchNode] Exception signing image ${img.id}`, err);
        }
    }

    return {
      id: img.id,
      url: signedUrl, // <--- The AI uses this secure link
      tags: img.tags || [],
      severity: img.severity || 'None',
      aiDescription: img.ai_description || "No analysis available.",
      userNote: img.description || "" 
    };
  }));

  // // 2. Format for State
  // // We map the raw DB columns to our clean ImageContext interface
  // const enrichedImages = images.map((img: any) => ({
  //   id: img.id,
  //   url: img.public_url,
  //   tags: img.tags || [],
  //   severity: img.severity || 'None',
  //   aiDescription: img.ai_description || "No analysis available.",
  //   userNote: img.description || "" // This is the user's manual caption
  // }));

  console.log(`✅ [FetchNode] Loaded ${enrichedImages.length} images into State.`);
  
  // 3. Return the update (this merges into State automatically)
  return {
    imageList: enrichedImages
  };
};