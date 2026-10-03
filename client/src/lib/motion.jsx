
export const EASE = [0.22, 1, 0.36, 1];

export const fadeUp = (delay = 0, distance = 18) => ({
  initial: { opacity: 0, y: distance },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.7, ease: EASE, delay },
});

export const fadeIn = (delay = 0) => ({
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.7, ease: EASE, delay },
});

export const staggerContainer = (stagger = 0.08, delayChildren = 0) => ({
  hidden: {},
  show: {
    transition: { staggerChildren: stagger, delayChildren },
  },
});

export const staggerItem = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
};

export const dropdownVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.22, ease: EASE, staggerChildren: 0.035 },
  },
  exit: {
    opacity: 0,
    y: 6,
    scale: 0.99,
    transition: { duration: 0.15, ease: 'easeOut' },
  },
};

export const dropdownItem = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: EASE } },
};

export const modalVariants = {
  hidden: { opacity: 0, y: 16, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: EASE } },
  exit: { opacity: 0, y: 10, scale: 0.98, transition: { duration: 0.2, ease: 'easeIn' } },
};
