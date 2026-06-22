import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0F172A]">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground animate-pulse">
          Initializing Engine...
        </p>
      </div>
    </div>
  );
}