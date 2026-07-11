import React from 'react';

export default function AnimatedContent({
  as: Tag = 'div',
  children,
  className = '',
  type = 'section',
  repeat = true,
  delay = 0,
}) {
  return (
    <Tag
      className={`rb-animated-content ${className}`.trim()}
      data-animate={type}
      data-animate-repeat={repeat ? 'true' : undefined}
      data-delay={delay}
    >
      {children}
    </Tag>
  );
}
