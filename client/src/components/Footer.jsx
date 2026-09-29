import { GraduationCap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-background py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
              <GraduationCap size={14} className="text-background" />
            </span>
            <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">UniSphere</span>
          </div>

          {/* Details */}
          <p className="text-center text-xs font-normal text-muted">
            MERN · ChromaDB vector indexes · Google Gemini — every answer grounded in verified data.
          </p>

          {/* Copy */}
          <p className="font-mono text-[11px] uppercase tracking-wider text-faint">
            © {new Date().getFullYear()} UniSphere
          </p>
        </div>
      </div>
    </footer>
  );
}
