import React from 'react';

export default function DotGrid({ className = '' }) {
  return (
    <div className={`rb-dot-grid ${className}`.trim()} aria-hidden="true">
      <div className="rb-dot-grid__layer" />
      <div className="rb-dot-grid__orb rb-dot-grid__orb--one" />
      <div className="rb-dot-grid__orb rb-dot-grid__orb--two" />
      <div className="rb-dot-grid__orb rb-dot-grid__orb--three" />
      <div className="rb-dot-grid__veil" />
    </div>
  );
}
