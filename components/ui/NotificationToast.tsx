import React, { useEffect } from 'react';

export type NotificationType = 'success' | 'error' | 'loading' | 'info';

interface NotificationToastProps {
  message: string;
  type: NotificationType;
  onClose: () => void;
}

export const NotificationToast: React.FC<NotificationToastProps> = ({ message, type, onClose }) => {
  useEffect(() => {
    if (type !== 'loading') {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [type, onClose]);

  const bgColors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    loading: 'bg-blue-600',
    info: 'bg-slate-700'
  };

  const icons = {
    success: 'check-circle',
    error: 'warning-circle',
    loading: 'spinner',
    info: 'info'
  };

  return (
    <div className={`fixed bottom-4 right-4 ${bgColors[type]} text-white px-6 py-3 rounded-lg shadow-xl flex items-center gap-3 z-50 animate-bounce-in transition-all max-w-sm`}>
      <i className={`ph ph-${icons[type]} ${type === 'loading' ? 'animate-spin' : ''} text-xl`}></i>
      <div className="flex-1 text-sm font-medium">{message}</div>
      {type !== 'loading' && (
        <button onClick={onClose} className="opacity-70 hover:opacity-100">
           <i className="ph ph-x"></i>
        </button>
      )}
    </div>
  );
};