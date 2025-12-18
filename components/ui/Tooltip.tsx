import React from 'react';

interface TooltipProps {
  text: string;
}

export const Tooltip: React.FC<TooltipProps> = ({ text }) => {
  return (
    <span className="group relative inline-block ml-1 align-middle cursor-help">
      <i className="ph ph-question text-slate-400 hover:text-blue-600 transition-colors text-sm"></i>
      <div className="invisible group-hover:visible absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-slate-800 text-white text-[10px] rounded shadow-xl z-[9999] pointer-events-none text-center font-normal leading-tight normal-case">
        {text}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-800"></div>
      </div>
    </span>
  );
};
