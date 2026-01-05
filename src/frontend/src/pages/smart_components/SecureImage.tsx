"use client";

import { useSignedUrl } from "../hooks/useSignedUrl";
import { ImageWithFallback } from "../figma/ImageWithFallback";
import { Loader2 } from "lucide-react";

interface SecureImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  storagePath?: string;
  fallbackSrc?: string;
}

export function SecureImage({ 
  src, 
  storagePath, 
  alt, 
  className,
  fallbackSrc,
  ...props 
}: SecureImageProps) {
  // Only use hook if we have a storage path
  const { signedUrl, isLoading, error } = useSignedUrl(storagePath);

  // If we have a storage path, we use signedUrl.
  // If not, we fall back to 'src' (public URL).
  const finalSrc = storagePath ? signedUrl : src;

  // While loading, show spinner
  if (storagePath && isLoading) {
     return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  // If we have an error (failed to sign) or no src at all, show fallback directly (or nothing)
  // This prevents passing "" to ImageWithFallback which causes network warning
  if (!finalSrc) {
     return (
       <div className={`flex items-center justify-center bg-slate-100 text-slate-400 ${className}`}>
          {/* You could put an error icon here if error exists */}
          <span className="text-xs text-slate-300">No Image</span>
       </div>
     );
  }

  return (
    <ImageWithFallback
      src={finalSrc}
      alt={alt}
      className={className}
      {...props}
    />
  );
}

