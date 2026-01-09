import { Container } from '../config/container';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(__dirname, '../../../../.env');
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });

if (result.error) {
    console.error("Error loading .env:", result.error);
}

console.log("SUPABASE_URL:", process.env.NEXT_PUBLIC_SUPABASE_URL ? "Exists" : "Missing");
console.log("SUPABASE_ANON_KEY:", process.env.SUPABASE_ANON_KEY ? "Exists" : "Missing");

async function testSigning() {
    console.log("🧪 Testing Image URL Signing with ANON Client...");

    // 1. Get the Anon Client (Container.supabase)
    const client = Container.supabase;
    console.log("✅ Anon Client Initialized");

    // 2. The failing URL from your logs
    const failingUrl = "https://pbjjkcwknpxnkzggwcvm.supabase.co/storage/v1/object/public/project-images/aa54020a-1b77-4121-b4b0-9c256e8bb260/abaf92bc-0adc-46df-8ad7-61921aa97606/f96ab603-3010-4ddf-9636-7b06943515e0.jpg";
    
    console.log(`\n🎯 Target URL: ${failingUrl}`);

    // 3. Logic from ImageAndTextMode.ts
    const publicMarker = '/object/public/project-images/';
    const pathIndex = failingUrl.indexOf(publicMarker);

    if (pathIndex !== -1) {
        const storagePath = failingUrl.substring(pathIndex + publicMarker.length);
        console.log(`📂 Extracted Path: ${storagePath}`);

        try {
            // Generate signed URL valid for 1 hour
            const { data, error } = await client.storage
                .from('project-images')
                .createSignedUrl(storagePath, 3600);

            if (error) {
                console.error("❌ Signing Failed:", error.message);
                console.error("⚠️ This likely means your RLS policies do not allow the Anon role to sign URLs for this private bucket.");
            } else if (data?.signedUrl) {
                console.log("\n✨ SUCCESS! Signed URL generated:");
                console.log(data.signedUrl);
                console.log("\n👉 Click the link above to verify it opens the image.");
            }
        } catch (e) {
            console.error("❌ Exception during signing:", e);
        }
    } else {
        console.error("❌ Could not extract path. URL pattern mismatch.");
    }
}

testSigning();
