// src/hooks/useDelete.ts
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface UseDeleteOptions {
  onSuccess?: () => void; // What to do after success (e.g., refresh list, close modal)
  onError?: (error: string) => void; // Custom error handling
  redirectUrl?: string; // Optional: Redirect after delete (e.g., deleting a project -> go to dashboard)
}

export const useDelete = () => {
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  const deleteItem = async (apiEndpoint: string, options?: UseDeleteOptions) => {
    setIsDeleting(true);
    try {
      const response = await fetch(apiEndpoint, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete item');
      }

      // Success!
      if (options?.onSuccess) options.onSuccess();
      if (options?.redirectUrl) router.push(options.redirectUrl);
      
      // Optional: Trigger a Toast notification here if you use one
      // toast.success("Item deleted");

    } catch (err: any) {
      console.error(err);
      if (options?.onError) options.onError(err.message);
      // toast.error("Could not delete");
    } finally {
      setIsDeleting(false);
    }
  };

  return { deleteItem, isDeleting };
};