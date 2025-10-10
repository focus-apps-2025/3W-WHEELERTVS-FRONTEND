import React from 'react';

interface GridProps {
  children: React.ReactNode;
  cols?: {
    mobile?: number;
    tablet?: number;
    desktop?: number;
  };
  gap?: number;
  className?: string;
}

export default function Grid({ 
  children, 
  cols = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 6,
  className = ''
}: GridProps) {
  const getColsClass = () => {
    const { mobile = 1, tablet = 2, desktop = 3 } = cols;
    return `grid-cols-${mobile} sm:grid-cols-${tablet} lg:grid-cols-${desktop}`;
  };

  return (
    <div className={`grid ${getColsClass()} gap-${gap} ${className}`}>
      {children}
    </div>
  );
}