import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { SpecImageRecord } from '../domain/storage/spec';

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
        description: string | undefined,
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
                description: description || null, // Store description
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

    async saveSpecImages(images: SpecImageRecord[], client: SupabaseClient): Promise<void> {
        if (images.length === 0) return;
    
        const { error } = await client
          .from('spec_images') 
          .insert(images);
    
        if (error) {
          console.error("❌ Failed to save spec images:", error);
          // We log but don't throw, so the text extraction doesn't fail entirely
        } else {
          console.log(`✅ Saved ${images.length} spec images to DB.`);
        }
    }

    /**
     * Deletes all spec images linked to a knowledge document: removes DB rows and their files from storage.
     * Call this when deleting a knowledge item so extracted spec images are cleaned up.
     */
    async deleteSpecImagesByKnowledgeId(kId: string, client: SupabaseClient): Promise<void> {
        const { data: rows, error: selectError } = await client
            .from('spec_images')
            .select('id, storage_path')
            .eq('k_id', kId);

        if (selectError) {
            console.warn(`⚠️ Could not fetch spec images for k_id ${kId}:`, selectError.message);
            return;
        }
        if (!rows || rows.length === 0) return;

        const paths = rows.map((r: { storage_path: string }) => r.storage_path).filter(Boolean);
        if (paths.length > 0) {
            const { error: storageError } = await client.storage
                .from('project-images')
                .remove(paths);
            if (storageError) {
                console.warn(`⚠️ Could not delete spec image files from storage:`, storageError.message);
            }
        }

        const { error: deleteError } = await client
            .from('spec_images')
            .delete()
            .eq('k_id', kId);

        if (deleteError) {
            console.warn(`⚠️ Could not delete spec_images rows for k_id ${kId}:`, deleteError.message);
            return;
        }
        console.log(`✅ Deleted ${rows.length} spec image(s) for document ${kId}.`);
    }

    /**
     * Uploads audio to the project-audio bucket (capture session audio).
     * Does NOT write to DB; caller should update capture_sessions.audio_storage_path etc.
     * Path format: {organizationId}/{projectId}/{folderName}/{fileName}
     */
    async uploadProjectAudio(
        projectId: string,
        organizationId: string,
        _userId: string,
        audioFile: File | Blob,
        fileName: string,
        folderName: string,
        client: SupabaseClient
    ): Promise<{ storage_path: string; public_url: string; file_name: string; mime_type: string; size_bytes: number }> {
        const arrayBuffer = await audioFile.arrayBuffer();
        const safeFolder = folderName.replace(/\//g, '-');
        const filePath = `${organizationId}/${projectId}/${safeFolder}/${fileName}`;

        const mimeType = audioFile instanceof File ? audioFile.type : 'audio/webm';
        const { error: uploadError } = await client
            .storage
            .from('project-audio')
            .upload(filePath, arrayBuffer, {
                contentType: mimeType || 'audio/webm',
                upsert: false
            });

        if (uploadError) {
            throw new Error(`Storage Upload Error (audio): ${uploadError.message}`);
        }

        const { data: { publicUrl } } = client
            .storage
            .from('project-audio')
            .getPublicUrl(filePath);

        return {
            storage_path: filePath,
            public_url: publicUrl,
            file_name: fileName,
            mime_type: mimeType || 'audio/webm',
            size_bytes: arrayBuffer.byteLength
        };
    }
}

