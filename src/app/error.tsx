'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCcw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled Application Error:', error);
  }, [error]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-[#0F172A] p-6 text-center">
      <div className="mb-6 rounded-full bg-destructive/10 p-6">
        <AlertCircle className="h-16 w-16 text-destructive" />
      </div>
      <h2 className="text-3xl font-headline font-bold uppercase tracking-tighter text-white">
        Circuit Interrupted
      </h2>
      <p className="mt-2 max-w-md text-muted-foreground">
        We encountered an unexpected error. The tournament directors have been notified.
      </p>
      <Button 
        onClick={() => reset()} 
        variant="outline" 
        className="mt-8 border-primary/20 hover:bg-primary/10"
      >
        <RefreshCcw className="mr-2 h-4 w-4" />
        Retry Connection
      </Button>
    </div>
  );
}