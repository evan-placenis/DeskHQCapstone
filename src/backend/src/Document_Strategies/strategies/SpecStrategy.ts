import { DocumentStrategy } from './interfaces';
import mammoth from 'mammoth';
import { Container } from '../../config/container';
import { v4 as uuidv4 } from 'uuid';
import { SupabaseClient } from '@supabase/supabase-js'; // authenticated client
interface PendingImage {
    id: string;
    buffer: Buffer;
    contentType: string;
  }

const CHUNK_SIZE_LIMIT = 2000;

export class SpecStrategy implements DocumentStrategy {

    /**
     * EXTRACT TEXT
     * Validates DOCX signature and extracts raw text for regex parsing.
     */
    async extractText(buffer: Buffer, projectId: string, organizationId: string, client: SupabaseClient, kId?: string, fileName?: string): Promise<string> {
        // 1. Validation: Check magic bytes to ensure it's a real DOCX
        if (!this.isValidDocx(buffer)) {
             throw new Error('Invalid file signature: This does not appear to be a valid DOCX file.');
        }

        // We will store images here as Mammoth finds them
        const pendingImages: PendingImage[] = [];

        // 🚀 THE MAGIC: Custom Image Handler
        const options = {
            convertImage: mammoth.images.imgElement(async (image) => {
                try {
                  const imageBuffer = await image.read();
                  const imageId = uuidv4();
                  
                  // Store for batch processing later
                  pendingImages.push({
                    id: imageId,
                    buffer: imageBuffer,
                    contentType: image.contentType,
                  });
        
                  // Insert a UNIQUE placeholder that we can easily find and replace later
                  // We use a simplified alt tag that cleanHtmlToText will preserve
                  return { 
                    src: "", 
                    alt: `[[PENDING_IMAGE_ID:${imageId}]]` 
                  };
                } catch (err) {
                  console.warn("Failed to extract image buffer", err);
                  return { src: "", alt: "[[IMAGE: Extraction Failed]]" };
                }
              })
            };

        // We use convertToHtml because extractRawText ignores images completely
        const result = await mammoth.convertToHtml({ buffer }, options);

        let documentText = this.cleanHtmlToText(result.value);

        if (fileName && fileName.toLowerCase().includes("scope of work")) {
            console.log(`🚫 Skipping image analysis for "${fileName}" (Hardcoded Rule)`);
            pendingImages.length = 0;
        }

        // --- PHASE 2: BATCH PROCESSING ---
        if (pendingImages.length > 0) {
        console.log(`👁️ Found ${pendingImages.length} images. Starting batch analysis...`);
        
        // A. Parallel Upload to Supabase Storage bucket and get URLs
        const uploadPromises = pendingImages.map(async (img) => {
            const path = `${organizationId}/${projectId}/spec-images/${img.id}.${img.contentType.split('/')[1]}`;
            const signedUrl = await this.uploadAndSign(img.buffer, img.contentType, path, client);

            return { 
            id: img.id, 
            url: signedUrl, 
            path: path 
            };
        });

        // Wait for uploads
        const allUploads = await Promise.all(uploadPromises);

        // 🟢 CRITICAL FIX: Remove failed uploads (where url is "") BEFORE sending to Vision Agent
        const uploadedImages = allUploads.filter(img => img.url && img.url.length > 0);

        // B. Analyze Batch (Using your VisionAgent)
        // Note: We use 'specImageAnalysis' to trigger the specific system prompt
        // analyzeBatch expects { id, url }
        const analyses = await Container.visionAgent.analyzeBatch(uploadedImages, 'specImageAnalysis');


            // C. Save Metadata to SQL (Standalone Table); link to knowledge item for cascade delete
        const imageRecords = analyses.map((analysis) => {
            const uploadData = uploadedImages.find(u => u.id === analysis.imageId);
            return {
                id: analysis.imageId,
                project_id: projectId,
                ...(kId && { k_id: kId }),
                url: uploadData?.url || "",
                storage_path: uploadData?.path || "",
                description: analysis.description 
            };
        });

        // Save to DB using authenticated client so RLS allows the insert
        await Container.storageService.saveSpecImages(imageRecords, client);

        // --- PHASE 3: STITCHING ---
        console.log(`📝 Stitching ${analyses.length} descriptions back into document...`);
        
        for (const analysis of analyses) {
            const placeholder = `[[PENDING_IMAGE_ID:${analysis.imageId}]]`;
            
            // Create the final format intended for your database/LLM
            // We wrap it clearly so downstream parsers know this is visual context
            const finalDescription = `\n\n[IMAGE CONTEXT START]\n${analysis.description}\n[IMAGE CONTEXT END]\n\n`;
            console.log(finalDescription);
            
            // Replace the placeholder in the main text
            documentText = documentText.replace(placeholder, finalDescription);
        }
    }

        // Clean the HTML but preserve our special image descriptions
        return documentText
    }

    /**
     * CHUNK TEXT
     * Uses "Intelligent Chunking" to preserve complete sections/ideas.
     */
    chunkText(text: string): string[] {
        // Use updated parsing logic that handles sizing and hierarchies
        const sectionChunks = this.parseTechnicalSections(text);

        if (sectionChunks.length <= 1) {
            console.warn("⚠️ Header parsing found limited sections. Fallback to paragraph chunking.");
            // Fallback for safety
            return this.createParagraphChunks(text, "Document Content"); 
        }
        
        return sectionChunks;
    }

    // =================================================================
    // 🧠 CORE PARSING LOGIC
    // =================================================================

    private parseTechnicalSections(text: string): string[] {
        const lines = text.split('\n');
        const chunks: string[] = [];
        
        let activeParent = "";
        let activeHeader = "";
        let activeContent: string[] = [];

        for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;

            // 1. Detect Parent (PART 1, GENERAL)
            if (this.isParentHeader(cleanLine)) {
                // Save previous work
                this.saveCurrentSection(chunks, activeParent, activeHeader, activeContent);
                
                // Reset
                activeParent = cleanLine; 
                activeHeader = ""; 
                activeContent = [];
            }
            // 2. Detect Subsection (1.1, General Requirements)
            else if (this.isSubsectionHeader(cleanLine)) {
                this.saveCurrentSection(chunks, activeParent, activeHeader, activeContent);
                
                activeHeader = cleanLine;
                activeContent = [];
            } 
            else {
                activeContent.push(cleanLine);
            }
        }

        // Save last bit
        this.saveCurrentSection(chunks, activeParent, activeHeader, activeContent);

        return chunks;
    }

    /**
     * Processes a single section. 
     * If it's too big, it splits it recursively.
     * If it's normal size, it returns it as one chunk.
     */
    private saveCurrentSection(chunks: string[], parent: string, header: string, content: string[]) {
        if (content.length === 0) return;

        // If we have content but NO header, it's probably "Intro" text
        const finalHeader = header || "Introduction";
        const combinedTitle = parent ? `${parent} > ${finalHeader}` : finalHeader;
        const body = content.join('\n');

        // 1. Get the array of valid text blocks (recursively split)
        const textParts = this.splitTextRecursively(body, CHUNK_SIZE_LIMIT);

        // 2. Process the parts
        if (textParts.length === 1) {
            // Scenario A: It fit in one go
            chunks.push(`Section: ${combinedTitle}\n\n${textParts[0]}`);
        } else {
            // Scenario B: It was too large and was split into multiple parts
            textParts.forEach((part, index) => {
                const partTitle = `${combinedTitle} (Part ${index + 1})`;
                chunks.push(`Section: ${partTitle}\n\n${part}`);
            });
        }
    }

    private createParagraphChunks(text: string, titlePrefix: string): string[] {
        const chunks: string[] = [];
        const paragraphs = text.split(/\n\s*\n/);
        let currentChunk = "";
        
        for (const para of paragraphs) {
            const clean = para.trim();
            if (!clean) continue;
            
            if ((currentChunk.length + clean.length) > 2000) {
                chunks.push(`Section: ${titlePrefix}\n\n${currentChunk}`);
                currentChunk = clean;
            } else {
                currentChunk += (currentChunk ? '\n\n' : '') + clean;
            }
        }
        if (currentChunk) chunks.push(`Section: ${titlePrefix}\n\n${currentChunk}`);
        return chunks;
    }

    // =================================================================
    // 🛠️ HELPERS
    // =================================================================

    private isParentHeader(line: string): boolean {
        // Strict: "PART 1" or "SECTION 01"
        if (/^(PART|SECTION)\s+\d+/i.test(line)) return true;
        // Strict: "GENERAL" (All Caps, Short)
        if (/^[A-Z\s-]{3,30}$/.test(line) && !/[a-z]/.test(line)) return true;
        return false;
    }

    private isSubsectionHeader(line: string): boolean {
        // 1. Numbered: "1.1 Scope"
        if (/^\d+(\.\d+)*\s+/.test(line)) return true;

        // 2. Title Case: "General Requirements"
        if (
            /^[A-Z]/.test(line) &&           // Starts with Capital
            line.length < 60 &&              // Short enough to be a header
            line.length > 3 &&               // Not just "A" or "The"
            !/[.?!:]$/.test(line)            // Does NOT end like a sentence
        ) {
            return true;
        }
        return false;
    }

    private cleanHtmlToText(html: string): string {
        let text = html;

        // 🟢 UPDATED FIX: Preserve our specific PENDING placeholders
        // This finds <img ... alt="[[PENDING_IMAGE_ID:...]]" ...> 
        // and extracts just the alt text part to be part of the plain text.
        text = text.replace(/<img[^>]*alt="(\[\[PENDING_IMAGE_ID:[^"]+\]\])"[^>]*\/?>/gi, '\n$1\n');

        // 1. Force Newlines on BLOCK boundaries
        const blockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'li', 'ol', 'ul', 'br'];
        blockTags.forEach(tag => {
            const openTagRegex = new RegExp(`<${tag}[^>]*>`, 'gi');
            text = text.replace(openTagRegex, '\n');
            
            const closeTagRegex = new RegExp(`<\/${tag}>`, 'gi');
            text = text.replace(closeTagRegex, '\n');
        });

        // 2. Strip Metadata/Anchor Tags
        text = text.replace(/<a[^>]*>.*?<\/a>/g, ''); 

        // 3. Strip all remaining tags (Now safe, because images are already converted to text)
        text = text.replace(/<[^>]+>/g, ' '); 

        // 4. Collapse Whitespace
        return text
            .replace(/\n\s+\n/g, '\n\n') // Collapse multiple empty lines
            .replace(/[ \t]+/g, ' ')     // Collapse spaces within a line
            .replace(/\n\s+/g, '\n')     // Trim start of lines
            .trim();
    }

    private isValidDocx(buffer: Buffer): boolean {
        return buffer.length >= 4 && 
               buffer[0] === 0x50 && 
               buffer[1] === 0x4B && 
               buffer[2] === 0x03 && 
               buffer[3] === 0x04;
    }

    /**
     * Recursively splits a string into chunks smaller than the limit.
     */
    private splitTextRecursively(text: string, limit = 2000): string[] {
        if (text.length <= limit) {
            return [text];
        }

        const middle = Math.floor(text.length / 2);
        let splitIndex = text.lastIndexOf(' ', middle);

        if (splitIndex === -1) {
            splitIndex = text.indexOf(' ', middle);
        }
        if (splitIndex === -1) {
            splitIndex = middle; 
        }

        const firstHalf = text.substring(0, splitIndex).trim();
        const secondHalf = text.substring(splitIndex).trim();

        return [
            ...this.splitTextRecursively(firstHalf, limit),
            ...this.splitTextRecursively(secondHalf, limit)
        ];
    }

  

    //HELPER: Upload + Create Signed URL
    private async uploadAndSign(
        buffer: Buffer, 
        contentType: string, 
        path: string, 
        client: SupabaseClient
    ): Promise<string> {
        try {
            // 1. Upload (Standard)
            const { error: uploadError } = await client.storage 
                .from('project-images') 
                .upload(path, buffer, {
                    contentType: contentType,
                    upsert: true
                });

            if (uploadError) throw uploadError;

            // 2. Create Signed URL (The Fix)
            // We set expiry to 3600 seconds (1 hour) - plenty of time for Gemini to read it
            const { data, error: signError } = await client.storage
                .from('project-images')
                .createSignedUrl(path, 3600);

            if (signError) throw signError;

            return data.signedUrl; // This URL works for 1 hour
        } catch (error) {
            console.error("Upload/Sign failed:", error);
            return "";
        }
    }
}

