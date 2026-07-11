import React, { useRef } from 'react';

export default function SpotlightCard({ href, children, className = '', ...props }) {
  const cardRef = useRef(null);

  const handlePointerMove = event => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    card.style.setProperty('--spotlight-x', `${event.clientX - rect.left}px`);
    card.style.setProperty('--spotlight-y', `${event.clientY - rect.top}px`);
  };

  return (
    <a
      ref={cardRef}
      className={`rb-spotlight-card ${className}`.trim()}
      href={href}
      onPointerMove={handlePointerMove}
      target="_blank"
      rel="noreferrer"
      {...props}
    >
      {children}
    </a>
  );
}
