// Utility for hydrating Markdown images with real URLs from Supabase
// Used to resolve image IDs/UUIDs in Markdown to actual public URLs

import { SupabaseClient } from "@supabase/supabase-js";

export class MarkdownBuilder {
    /**
     * Resolves image IDs to URLs by querying the database
     * Returns a Map of imageId -> public_url
     */
    static async resolveImageUrls(
        imageIds: string[],
        client: SupabaseClient
    ): Promise<Map<string, string>> {
        if (imageIds.length === 0) return new Map();

        const { data: images, error } = await client
            .from('project_images')
            .select('id, public_url')
            .in('id', imageIds);

        if (error || !images) {
            console.warn(`[MarkdownBuilder] Failed to resolve image URLs:`, error);
            return new Map();
        }

        const urlMap = new Map<string, string>();
        images.forEach(img => {
            if (img.public_url) {
                urlMap.set(img.id, img.public_url);
            }
        });

        return urlMap;
    }

    /**
     * Hydrates Markdown image tags by replacing UUIDs with real URLs
     * 
     * Finds all standard Markdown image tags: ![alt text](url)
     * If the URL is a UUID (not a valid HTTP link), resolves it to a real public URL
     * 
     * @param markdown - The Markdown string potentially containing image UUIDs
     * @param client - Supabase client for querying image URLs
     * @returns Fully hydrated Markdown with real image URLs
     */
    static async hydrateMarkdownImages(
        markdown: string,
        client: SupabaseClient
    ): Promise<string> {
        // Regex to find all Markdown image tags: ![alt text](url)
        const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
        
        // Extract all image tags and their URLs
        const imageMatches: Array<{ fullMatch: string; alt: string; url: string; index: number }> = [];
        let match;
        
        while ((match = imageRegex.exec(markdown)) !== null) {
            imageMatches.push({
                fullMatch: match[0],
                alt: match[1],
                url: match[2],
                index: match.index
            });
        }

        if (imageMatches.length === 0) {
            return markdown; // No images to hydrate
        }

        // Filter for URLs that are UUIDs (not already valid HTTP links)
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const isHttpLink = /^https?:\/\//i;
        
        const imageIdsToResolve: string[] = [];
        const imageMap = new Map<string, { alt: string; originalUrl: string }>();
        
        imageMatches.forEach(({ url, alt }) => {
            // Check if it's a UUID (not a placeholder or HTTP link)
            if (uuidPattern.test(url) && !isHttpLink.test(url) && url !== 'placeholder') {
                imageIdsToResolve.push(url);
                imageMap.set(url, { alt, originalUrl: url });
            }
        });

        if (imageIdsToResolve.length === 0) {
            return markdown; // No UUIDs to resolve
        }

        // Resolve UUIDs to real URLs
        const urlMap = await this.resolveImageUrls(imageIdsToResolve, client);

        // Replace UUIDs in the Markdown string with real URLs
        let hydratedMarkdown = markdown;
        
        // Process in reverse order to maintain correct indices
        for (let i = imageMatches.length - 1; i >= 0; i--) {
            const { fullMatch, url, alt } = imageMatches[i];
            
            // Only replace if it's a UUID we resolved
            if (imageMap.has(url)) {
                const resolvedUrl = urlMap.get(url);
                if (resolvedUrl) {
                    // Replace the full image tag with the resolved URL
                    const newImageTag = `![${alt}](${resolvedUrl})`;
                    hydratedMarkdown = hydratedMarkdown.replace(fullMatch, newImageTag);
                }
            }
        }

        return hydratedMarkdown;
    }
}
