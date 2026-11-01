export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#2a49cf" />
      <path d="M18 46V18L46 46V18" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="18" cy="18" r="4.5" fill="#fff" /><circle cx="18" cy="46" r="4.5" fill="#fff" />
      <circle cx="46" cy="18" r="4.5" fill="#fff" /><circle cx="46" cy="46" r="4.5" fill="#fff" />
      <circle cx="32" cy="32" r="5" fill="#39d98a" />
    </svg>
  );
}
