
import React from 'react';

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

const Card: React.FC<CardProps> = ({ title, children, className = '' }) => {
  return (
    <div className={`bg-white shadow-md rounded-lg overflow-hidden ${className}`}>
      {title && <h3 className="text-lg leading-6 font-medium text-gray-900 p-4 border-b border-gray-200">{title}</h3>}
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

export default Card;
