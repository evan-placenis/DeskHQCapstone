import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";
import { Container } from "@/lib/container";

const ALLOWED_BUCKETS = new Set(["project-images", "project-audio"]);

/**
 * Creates a short-lived signed URL for private storage objects.
 * Runs on the server so the browser does not call Supabase Storage's sign endpoint directly
 * (avoids CORS noise when upstream returns non-2xx, e.g. 502 without Access-Control-Allow-Origin).
 */
export async function POST(request: Request) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const bucket =
            typeof body.bucket === "string" && body.bucket.trim()
                ? body.bucket.trim()
                : "project-images";
        const path = typeof body.path === "string" ? body.path.trim() : "";

        if (!path) {
            return NextResponse.json({ error: "path is required" }, { status: 400 });
        }

        if (!ALLOWED_BUCKETS.has(bucket)) {
            return NextResponse.json({ error: "Bucket not allowed" }, { status: 400 });
        }

        const userProfile = await Container.userService.getUserProfile(user.id, supabase);
        const orgId = userProfile?.organization_id;
        if (!orgId) {
            return NextResponse.json({ error: "No organization" }, { status: 403 });
        }

        const prefix = `${orgId}/`;
        if (!path.startsWith(prefix)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);

        if (error) {
            console.error("Storage signed URL:", error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json({ signedUrl: data.signedUrl });
    } catch (e) {
        console.error("POST /api/storage/signed-url:", e);
        return NextResponse.json(
            { error: e instanceof Error ? e.message : "Internal error" },
            { status: 500 }
        );
    }
}
