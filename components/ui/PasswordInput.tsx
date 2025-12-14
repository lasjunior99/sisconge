import React, { useState } from 'react';

interface PasswordInputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export const PasswordInput: React.FC<PasswordInputProps> = (props) => {
  const [show, setShow] = useState(false);

  return (
    <div className="relative w-full">
      <input 
        {...props} 
        type={show ? "text" : "password"} 
        className={`w-full p-2 border rounded pr-10 ${props.className || ''}`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(!show)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <i className={`ph ph-${show ? 'eye-slash' : 'eye'} text-lg`}></i>
      </button>
    </div>
  );
};