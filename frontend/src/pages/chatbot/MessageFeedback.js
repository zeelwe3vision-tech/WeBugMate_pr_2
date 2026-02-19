import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown } from 'lucide-react';
import './MessageFeedback.css';

/**
 * MessageFeedback Component
 * 
 * Shows 👍 and 👎 icons for LLM messages.
 * Allows selecting only one option.
 * Disables interaction after selection.
 */
const MessageFeedback = ({ messageId, onFeedback }) => {
  const [feedback, setFeedback] = useState(null); // null, true, or false

  const handleFeedback = (type) => {
    const targetValue = type === 'up'; // true for up, false for down

    // If clicking the same button, toggle it off. Otherwise, set to new value.
    const newValue = feedback === targetValue ? null : targetValue;

    setFeedback(newValue);

    // Emit event/callback with requested payload
    if (onFeedback) {
      onFeedback({
        message_id: messageId,
        context_feedback: newValue,
        timestamp: Math.floor(Date.now() / 1000)
      });
    }
  };

  return (
    <div className="message-feedback-container">
      <button
        className={`feedback-btn up ${feedback === true ? 'active' : ''}`}
        onClick={() => handleFeedback('up')}
        title="Helpful"
        aria-label="Thumbs up"
      >
        <ThumbsUp size={16} strokeWidth={2.5} />
      </button>
      <button
        className={`feedback-btn down ${feedback === false ? 'active' : ''}`}
        onClick={() => handleFeedback('down')}
        title="Not helpful"
        aria-label="Thumbs down"
      >
        <ThumbsDown size={16} strokeWidth={2.5} />
      </button>
    </div>
  );
};

export default MessageFeedback;
