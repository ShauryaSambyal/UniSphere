import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { dropdownVariants } from '../lib/motion';

/**
 * A drop-in replacement for a native <select>.
 *
 * Native <select> popups are painted by the OS, so they can't be styled and
 * always read as a grey system menu on top of the warm page. This renders the
 * list itself, so it inherits the site's ivory/ink palette and motion.
 *
 * options: array of strings, or of { value, label }
 */

const DEFAULT_TRIGGER =
  'flex w-full cursor-pointer items-center justify-between gap-2 rounded-xl border border-line bg-card px-3.5 py-2.5 text-left text-sm text-foreground transition-colors duration-150 hover:border-line-strong';

const toItems = (options) =>
  options.map((o) => (typeof o === 'string' ? { value: o, label: o } : o));

export default function Dropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Any',
  triggerClassName,
  panelClassName = '',
  id,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef(null);

  const items = toItems(options);
  const selectedIndex = items.findIndex((o) => o.value === value);
  const selected = selectedIndex >= 0 ? items[selectedIndex] : null;

  // Close when the pointer lands anywhere outside this control.
  useEffect(() => {
    if (!isOpen) return undefined;
    const handlePointerDown = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen]);

  // Opening highlights the chosen row. Seeding this in the handler (rather
  // than an effect) keeps arrow-key navigation from being reset by a
  // cascading re-render.
  const openPanel = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setIsOpen(true);
  };

  const togglePanel = () => {
    if (isOpen) setIsOpen(false);
    else openPanel();
  };

  const commit = (next) => {
    onChange(next);
    setIsOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      setIsOpen(false);
      return;
    }

    if (!isOpen) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault();
        openPanel();
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const item = items[activeIndex];
      if (item) commit(item.value);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={togglePanel}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className={triggerClassName || DEFAULT_TRIGGER}
      >
        <span className={`truncate ${selected ? '' : 'text-faint'}`}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={15}
          className={`shrink-0 text-faint transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence>
        {isOpen && items.length > 0 && (
          <motion.ul
            variants={dropdownVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            role="listbox"
            className={`custom-scrollbar absolute left-0 top-full z-50 mt-2 max-h-64 w-max min-w-full max-w-[19rem] overflow-y-auto rounded-xl border border-line bg-card p-1.5 shadow-[0_20px_44px_-22px_rgba(26,26,26,0.3)] ${panelClassName}`}
          >
            {items.map((item, index) => {
              const isSelected = item.value === value;
              const isActive = index === activeIndex;
              return (
                <li key={item.value} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => commit(item.value)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-100 ${
                      isActive ? 'bg-subtle' : ''
                    } ${isSelected ? 'font-medium text-foreground' : 'text-muted'}`}
                  >
                    <span className="truncate">{item.label}</span>
                    {isSelected && <Check size={13} className="shrink-0 text-foreground" />}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
