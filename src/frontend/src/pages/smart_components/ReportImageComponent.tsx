import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useEffect } from 'react';
import { supabase } from '@/frontend/lib/supabaseClient';
import { SecureImage } from '@/frontend/pages/smart_components/SecureImage';
import { Loader2, ImageOff } from 'lucide-react';

export const ReportImageComponent = (props: NodeViewProps) => {
    const { node, selected } = props;
    const src = node.attrs.src; // The UUID from the AI
    const alt = node.attrs.alt;

    const [storagePath, setStoragePath] = useState<string | null>(null);
    const [publicUrl, setPublicUrl] = useState<string | null>(null);
    const [resolving, setResolving] = useState(true);

    useEffect(() => {
        let isMounted = true;

        // Check if it's already a URL (legacy or user upload)
        if (src.startsWith('http') || src.startsWith('blob:') || src.startsWith('/')) {
            setPublicUrl(src);
            setResolving(false);
            return;
        }

        // It's a UUID. We need to find the storage_path or public_url in the DB.
        const resolveImage = async () => {
            try {
                const { data, error } = await supabase
                    .from('project_images')
                    .select('storage_path, public_url')
                    .eq('id', src)
                    .single();

                if (isMounted) {
                    if (data?.storage_path) {
                        setStoragePath(data.storage_path);
                    } else if (data?.public_url) {
                        setPublicUrl(data.public_url);
                    }
                }
            } catch (err) {
                console.error("Failed to resolve image UUID:", err);
            } finally {
                if (isMounted) setResolving(false);
            }
        };

        resolveImage();
        return () => { isMounted = false; };
    }, [src]);

    return (
        <NodeViewWrapper className="my-4 flex justify-center w-full">
            <div
                className={`
          relative group rounded-lg overflow-hidden border transition-all duration-200
          ${selected ? 'border-theme-primary ring-2 ring-theme-primary/20' : 'border-slate-200'}
          bg-slate-50 min-h-[100px] min-w-[200px] flex items-center justify-center
          w-full
          aspect-video 
        `}
            >
                {resolving ? (
                    <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
                ) : (
                    /* 🟢 REUSE SECURE IMAGE */
                    <SecureImage
                        src={publicUrl || ""}         // Fallback or Direct URL
                        storagePath={storagePath || undefined} // The magic part
                        alt={alt}
                        className="max-h-[500px] w-auto object-contain"
                        fallbackSrc="/images/placeholder-error.png" // Optional
                    />
                )}
            </div>
        </NodeViewWrapper>
    );
};