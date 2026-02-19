import React from 'react';
import './ChatbotIcon.css';
import { Link, useLocation } from 'react-router-dom';
import { TbMessageChatbot } from "react-icons/tb";

const ChatbotIcon = () => {
  const location = useLocation();

  // Don't render the icon if we are on the chatbot page
  if (location.pathname === '/chatbot/communication'||location.pathname==='/signin') {
    return null;
  }

  return (
    <Link to="/chatbot/communication" className="chatbot-icon">
      <TbMessageChatbot />
    </Link>
  );
};

export default ChatbotIcon; 
