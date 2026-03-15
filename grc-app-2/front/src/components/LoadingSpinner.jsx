import React from 'react';

export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-overlay">
      <div className="spinner"></div>
      <p className="text-muted">{message}</p>
    </div>
  );
}
