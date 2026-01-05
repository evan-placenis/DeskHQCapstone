import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export class StorageService {
    /**
     * Uploads an image to Supabase Storage and records it in the database.
     */
    async uploadProjectImage(
        projectId: string, 
        organizationId: string, 
        userId: string,
        file: File | Blob, 
        fileName: string,
        folderName: string,
        client: SupabaseClient
    ): Promise<any> {

        // 1. Prepare the file
        const arrayBuffer = await file.arrayBuffer();




        // 3. Prepare Paths
        // Force .jpg extension since frontend sends JPEGs
        const fileExt = 'jpg';
        const uniqueFileName = `${uuidv4()}.${fileExt}`;
        const filePath = `${organizationId}/${projectId}/${uniqueFileName}`;

        const { error: uploadError } = await client
            .storage
            .from('project-images')
            .upload(filePath, arrayBuffer, {
                contentType: 'image/jpeg',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Storage Upload Error: ${uploadError.message}`);
        }

        // 3. Get Public URL
        const { data: { publicUrl } } = client
            .storage
            .from('project-images')
            .getPublicUrl(filePath);

        // 4. Save Metadata to DB (project_images table)
        const { data: dbData, error: dbError } = await client
            .from('project_images')
            .insert({
                project_id: projectId,
                organization_id: organizationId,
                storage_path: filePath,
                public_url: publicUrl,
                file_name: uniqueFileName, // Store the new JPEG name
                mime_type: 'image/jpeg',
                size_bytes: arrayBuffer.byteLength,
                folder_name: folderName || null, // Store folder name
                uploaded_by: userId
            })
            .select()
            .single();

        if (dbError) {
            // Cleanup: If DB insert fails, try to delete the uploaded file to keep state consistent
            await client.storage.from('project-images').remove([filePath]);
            throw new Error(`DB Insert Error: ${dbError.message}`);
        }

        return dbData;
    }

    /**
     * List images for a project
     */
    async getProjectImages(projectId: string, client: SupabaseClient): Promise<any[]> {
        const supabase = client;
        const { data, error } = await supabase
            .from('project_images')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        return data || [];
    }
}

