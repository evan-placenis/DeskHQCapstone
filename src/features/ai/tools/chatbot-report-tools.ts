import { tool } from 'ai';
import { z } from 'zod/v3';
import { Container } from '@/lib/container';
import { SupabaseClient } from '@supabase/supabase-js';

export const reportTools = (
  projectId: string,
  _userId: string,
  client: SupabaseClient,
  selectedImageIds: string[] = [],
) => ({
  getProjectImageIDS: tool({
    description: 'List all available images IDS for this project. Call this FIRST to get the Image IDs needed for other tools.',
    inputSchema: z.object({
      unused: z.string().optional(),
      reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
    }),
    execute: async () => {
      try {
        console.log(`📂 [Tool: ListImages] Listing images for project ${projectId}`);

        const adminClient = await Container.adminClient;

        let query = adminClient
          .from('project_images')
          .select('id, file_name, description, created_at')
          .eq('project_id', projectId);

        if (selectedImageIds && selectedImageIds.length > 0) {
          query = query.in('id', selectedImageIds);
        }

        const { data, error } = await query;

        if (error) {
          console.error('❌ [Tool: ListImages] DB Error:', error.message);
          return { status: 'ERROR', message: error.message };
        }

        if (!data || data.length === 0) {
          return { status: 'EMPTY', message: 'No images found.' };
        }

        return {
          status: 'SUCCESS',
          count: data.length,
          images: data.map((img) => ({
            id: img.id,
            filename: img.file_name,
            description: img.description || 'No description',
          })),
        };
      } catch (error) {
        console.error('💥 [Tool: ListImages] Critical Exception:', error);
        return { status: 'ERROR', message: error instanceof Error ? error.message : 'Failed to list project images.' };
      }
    },
  }),

  getProjectImageURLsWithIDS: tool({
    description: 'Get signed, accessible image URLs for selected images. Mandatory step before vision analysis.',
    inputSchema: z.object({
      imageIds: z.array(z.string()).describe('Array of image IDs to get URLs for'),
      reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
    }),
    execute: async ({ imageIds }) => {
      try {
        const adminClient = await Container.adminClient;

        const { data: projectData, error: projError } = await adminClient
          .from('projects')
          .select('organization_id')
          .eq('id', projectId)
          .single();

        if (projError || !projectData?.organization_id) {
          console.error('❌ [Tool: GetImages] Could not find Organization ID for project:', projError);
          return { status: 'ERROR', message: 'Failed to resolve Organization ID internally.' };
        }

        const organizationId = projectData.organization_id;
        console.log(`🔍 [Tool: GetImages] Fetching ${imageIds.length} images. Path Structure: ${organizationId}/${projectId}/...`);

        const { data: images, error } = await adminClient
          .from('project_images')
          .select('id, file_name, storage_path, description')
          .in('id', imageIds)
          .eq('project_id', projectId);

        if (error) {
          console.error('❌ [Tool: GetImages] DB Error:', error);
          return { status: 'ERROR', message: `Database error: ${error.message}` };
        }

        if (!images || images.length === 0) {
          return { status: 'NOT_FOUND', message: 'No images found in database for provided IDs.' };
        }

        const imagesWithSignedUrls = await Promise.all(
          images.map(async (img) => {
            let finalPath = img.storage_path;

            if (finalPath && !finalPath.includes('/')) {
              finalPath = `${organizationId}/${projectId}/${finalPath}`;
            }

            if (!finalPath) {
              return { id: img.id, url: null, error: 'Missing storage path' };
            }

            console.log(`🔑 [Tool: GetImages] Signing path: ${finalPath}`);
            const BUCKET_NAME = 'project-images';

            const { data: signedData, error: signError } = await adminClient.storage
              .from(BUCKET_NAME)
              .createSignedUrl(finalPath, 3600);

            if (signError || !signedData?.signedUrl) {
              console.error(`❌ [Tool: GetImages] Signing failed for ${finalPath}:`, signError);
              return {
                id: img.id,
                url: null,
                error: 'Could not generate signed URL. Check bucket permissions.',
              };
            }

            return {
              id: img.id,
              url: signedData.signedUrl,
              description: img.description || '',
            };
          }),
        );

        const validImages = imagesWithSignedUrls.filter((i) => i.url !== null);

        if (validImages.length === 0) {
          return { status: 'ERROR', message: 'Found image records but failed to generate access URLs (Check bucket paths).' };
        }

        return {
          status: 'SUCCESS',
          images: validImages,
        };
      } catch (error) {
        console.error('💥 [Tool: GetImages] Critical Exception:', error);
        return { status: 'ERROR', message: 'Internal server error while fetching images' };
      }
    },
  }),

  getProjectSpecs: tool({
    description: 'Get project details, specifications, and context. Use this to understand the project before writing the report.',
    inputSchema: z.object({
      reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
    }),
    execute: async () => {
      try {
        const project = await Container.projectRepo.getById(projectId, client);
        if (!project) {
          return { status: 'NOT_FOUND', message: 'Project not found' };
        }

        return {
          status: 'SUCCESS',
          project: {
            id: project.projectId,
            name: project.name || 'Unnamed Project',
            status: project.status,
            siteAddress: project.jobInfo?.siteAddress || '',
            clientName: project.jobInfo?.clientName || '',
            metadata: project.metadata || {},
            additionalInfo: project.jobInfo?.parsedData || {},
          },
        };
      } catch (error) {
        console.error('Error fetching project specs:', error);
        return { status: 'ERROR', message: 'Failed to fetch project details' };
      }
    },
  }),

  getReportStructure: tool({
    description: 'Get the current report structure and sections. Use this to understand what sections already exist.',
    inputSchema: z.object({
      reportId: z.string().optional().describe('The report ID if available'),
      reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
    }),
    execute: async ({ reportId }) => {
      try {
        if (reportId) {
          const report = await Container.reportService.getReportById(reportId, client);
          if (report) {
            return {
              status: 'FOUND',
              reportId,
              sections: report.reportContent.map((s) => ({
                id: s.id,
                title: s.title,
                hasContent: !!s.description,
              })),
            };
          }
        }

        return {
          status: 'NEW',
          message: 'This is a new report. You can create sections using updateSection.',
        };
      } catch (error) {
        return {
          status: 'ERROR',
          message: `Error getting report structure: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),

  updateSection: tool({
    description:
      'Write or update a report section with markdown content. Use this to build sections incrementally as you write the report. The section will be saved to the database immediately so you can reference it later. You can call this multiple times for different sections.',
    inputSchema: z.object({
      reportId: z.string().describe('The report ID (get it from getReportStructure or it was provided in context)'),
      sectionId: z.string().describe('Unique ID for this section (e.g., "executive-summary", "observations-1")'),
      heading: z.string().describe('The section heading/title'),
      description: z.string().optional().describe('Optional description or intro text for the section'),
      content: z.string().describe('The markdown content for this section'),
      order: z.number().optional().describe('Order/position of this section (0-based)'),
      reasoning: z.string().optional().describe('A "scratchpad" to think out loud and let the user know what you are thinking.'),
    }),
    execute: async ({ reportId, sectionId, heading, content, order }) => {
      try {
        console.log(`📝 [Report Tool] Writing section: ${sectionId} (${heading}) to report ${reportId}`);

        await Container.reportService.updateSectionInReport(reportId, sectionId, heading, content, order ?? 0, client);

        return {
          status: 'SUCCESS',
          reportId,
          sectionId,
          heading,
          message: `Section "${heading}" written and saved to database. You can reference it later using getReportStructure.`,
          preview: content.substring(0, 200) + (content.length > 200 ? '...' : ''),
          order: order ?? 0,
        };
      } catch (error) {
        console.error('Error writing section:', error);
        return {
          status: 'ERROR',
          message: `Failed to write section: ${error instanceof Error ? error.message : 'Unknown error'}`,
        };
      }
    },
  }),
});
