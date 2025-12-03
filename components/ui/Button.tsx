import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  size?: 'sm' | 'md';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md',
  className = '', 
  ...props 
}) => {
  const baseStyle = "font-medium rounded focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors";
  
  const variants = {
    primary: "bg-blue-700 hover:bg-blue-800 text-white focus:ring-blue-500",
    secondary: "bg-slate-200 hover:bg-slate-300 text-slate-800 focus:ring-slate-400",
    danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500",
  };

  const sizes = {
    sm: "px-3 py-1 text-xs",
    md: "px-4 py-2 text-sm",
  };

  return (
    <button 
      className={`${baseStyle} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
};