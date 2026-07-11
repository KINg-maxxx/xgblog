import React from 'react';

export default function BlurText({ text, as: Tag = 'span', className = '', delay = 45, ...rest }) {
  return (
    <Tag className={`rb-blur-text ${className}`.trim()} aria-label={text} {...rest}>
      {Array.from(text).map((char, index) => (
        <span
          aria-hidden="true"
          key={`${char}-${index}`}
          style={{ '--blur-delay': `${index * delay}ms` }}
        >
          {char === ' ' ? '\u00a0' : char}
        </span>
      ))}
    </Tag>
  );
}
