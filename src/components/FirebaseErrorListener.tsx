
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

/**
 * Listens for specialized FirestorePermissionErrors emitted from hooks or mutations.
 * Surfaced as a contextual toast notification to aid in security rule debugging.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Show a toast with the contextual error details as requested
      toast({
        variant: 'destructive',
        title: 'Security Rule Denied',
        description: `Operation: ${error.context.operation} on path: ${error.context.path}`,
      });
      
      // Centralized error handling. We don't use console.error here to avoid triggering 
      // duplicate error overlays in development as requested by the user.
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
