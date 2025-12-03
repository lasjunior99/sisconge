import React from 'react';

export const Logo: React.FC<{ className?: string }> = ({ className = "w-8 h-8" }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5l4-4L10 13l4-4 7 7" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21H3V3" />
    <circle cx="14" cy="9" r="2" className="fill-current" />
  </svg>
);