import React from 'react';
import { Sparkles, Heart } from 'lucide-react';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200 bg-white py-12 dark:border-white/5 dark:bg-darkbg-base">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          {/* Brand */}
          <div className="flex items-center gap-2 text-gray-800 dark:text-white">
            <Sparkles className="text-brand-light dark:text-brand-accent" size={18} />
            <span className="font-sans font-bold tracking-tight">UniSphere Platform</span>
          </div>

          {/* Details */}
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">
            Powered by MERN Stack (MongoDB, Express, React, Node), ChromaDB vector indexes & Google Gemini AI.
          </p>

          {/* Copy */}
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
            <span>Made with</span>
            <Heart size={12} className="text-red-500 fill-red-500" />
            <span>&copy; {new Date().getFullYear()} UniSphere. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
