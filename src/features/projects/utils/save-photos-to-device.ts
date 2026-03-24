import { supabase } from "@/lib/supabase-browser-client";
import type { Photo } from "@/lib/types";

const BUCKET = "project-images";

function extFromMime(mime: string): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "jpg";
}

function fileNameForPhoto(photo: Photo, index: number, blobType: string): string {
  const raw = String(photo.name || "").trim();
  if (raw && /\.(jpe?g|png|gif|webp)$/i.test(raw)) {
    return raw.replace(/[^a-zA-Z0-9._\- ]/g, "_");
  }
  return `photo-${index + 1}.${extFromMime(blobType || "image/jpeg")}`;
}

async function resolveFetchableImageUrl(photo: Photo): Promise<string> {
  if (photo.storagePath) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(photo.storagePath, 3600);
    if (!error && data?.signedUrl) return data.signedUrl;
  }
  if (!photo.url) {
    throw new Error("No image URL available for this photo.");
  }
  return photo.url;
}

/**
 * Opens the native share sheet with image files (Save to Photos / Camera Roll on iOS).
 * Requires HTTPS and a browser that supports `navigator.share` with files.
 */
export async function savePhotosToDeviceViaShare(photos: Photo[]): Promise<void> {
  if (photos.length === 0) return;

  if (typeof navigator === "undefined" || typeof navigator.share !== "function") {
    alert("Sharing is not supported in this browser.");
    return;
  }

  const filePromises = photos.map(async (photo, index) => {
    const url = await resolveFetchableImageUrl(photo);
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Could not load image ${index + 1} (${response.status}).`);
    }
    const blob = await response.blob();
    const type = blob.type || "image/jpeg";
    const name = fileNameForPhoto(photo, index, type);
    return new File([blob], name, { type });
  });

  const filesArray = await Promise.all(filePromises);

  if (!navigator.canShare || !navigator.canShare({ files: filesArray })) {
    alert("Your browser doesn't support saving multiple images at once. Try Safari on iPhone or Chrome on Android.");
    return;
  }

  await navigator.share({
    files: filesArray,
    title: "Project photos",
    text:
      filesArray.length === 1
        ? "Save this photo to your library."
        : `Save ${filesArray.length} photos to your library.`,
  });
}
