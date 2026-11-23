// Phones / tablets get a lighter render path (no post-processing, DPR 1, no outline pass, fewer enemies).
export const isMobile = matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
