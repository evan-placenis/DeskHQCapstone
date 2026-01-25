import { useState, useEffect } from 'react';

import { supabase } from "@/frontend/lib/supabaseClient";

export const useSignedUrl = (
  storagePath: string | null | undefined, // Allow null so we can wait for data
  bucket: string = 'project-images'
) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Supabase client (Client-side)
  // We check for the standard key AND the typo version "SUPABSE" just in case
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "").trim();
  const supabaseAnonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "").trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("❌ useSignedUrl: Missing Supabase Environment Variables!");
    console.error(`URL present: ${!!supabaseUrl}, Key present: ${!!supabaseAnonKey}`);
  }


  useEffect(() => {
    // 1. Reset state if path changes or is empty
    if (!storagePath) {
      setSignedUrl(null);
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const fetchUrl = async () => {
      try {
        // 2. Request a Signed URL valid for 1 hour (3600 seconds)
        const { data, error } = await supabase.storage
          .from(bucket)
          .createSignedUrl(storagePath, 3600);

        if (error) throw error;

        // 3. Update state only if component is still mounted
        if (isMounted) {
          setSignedUrl(data.signedUrl);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          console.error('Error signing URL:', err.message);
          setError(err.message);
          setSignedUrl(null); // Fallback logic could go here
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchUrl();

    // Cleanup to prevent setting state on unmounted component
    return () => {
      isMounted = false;
    };
  }, [storagePath, bucket, supabase]);

  return { signedUrl, isLoading, error };
};