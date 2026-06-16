'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';

export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // In a real app, you might show a specialized dialog or log to a service.
      // For development, we'll throw it to trigger the Next.js error overlay
      // if it's a contextual error, or show a toast.
      toast({
        variant: 'destructive',
        title: 'Security Rule Denied',
        description: `Operation: ${error.context.operation} on path: ${error.context.path}`,
      });
      
      // We throw to ensure the error is visible in development
      if (process.env.NODE_ENV === 'development') {
         console.error('Firebase Permission Error Context:', error.context);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => {
      errorEmitter.off('permission-error', handlePermissionError);
    };
  }, [toast]);

  return null;
}
