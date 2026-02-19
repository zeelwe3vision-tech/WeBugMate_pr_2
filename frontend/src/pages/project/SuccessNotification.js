import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import './successNotification.css';

const SuccessNotification = ({ show, message, onClose }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [show, onClose]);

  if (!show) return null;

  return (
    <div className="success-popup">
      <div className="tick-animation">
        <svg width="50" height="50" viewBox="0 0 50 50">
          <circle cx="25" cy="25" r="24" fill="#e6ffe6" stroke="#4BB543" strokeWidth="2" />
          <polyline points="15,27 23,35 37,17" fill="none" stroke="#4BB543" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="success-message">{message}</div>
      <div className="success-actions">
        <Link to="/dashboard" className="btn btn-primary btn-sm">
          View Dashboard
        </Link>
      </div>
    </div>
  );
};

export default SuccessNotification; 
