import { GraduationCap } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-line bg-background py-10">
      <div className="mx-auto flex max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-foreground">
            <GraduationCap size={14} className="text-background" />
          </span>
          <span className="text-sm font-semibold tracking-[-0.01em] text-foreground">UniSphere</span>
        </div>
      </div>
    </footer>
  );
}
