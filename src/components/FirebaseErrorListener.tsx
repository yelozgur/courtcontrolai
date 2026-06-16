
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Show a toast with the contextual error details
      toast({
        variant: 'destructive',
        title: 'Security Rule Denied',
        description: `Operation: ${error.context.operation} on path: ${error.context.path}`,
      });
      
      // Centralized error handling. We don't use console.error here to avoid triggering 
      // multiple error overlays in development, as the error is handled centrally.
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
