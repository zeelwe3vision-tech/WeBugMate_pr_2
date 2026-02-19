import React, { createContext, useState, useContext } from "react";

const MessagesContext = createContext();

export const MessagesProvider = ({ children }) => {
  // Store messages per email
  const [messages, setMessages] = useState({});

  const sendMessage = (email, message) => {
    const msg = {
      sender: "Leader", // Or dynamic logged-in user
      text: message,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages(prev => ({
      ...prev,
      [email]: prev[email] ? [msg, ...prev[email]] : [msg]
    }));
  };
  const getConversationMessages = (email) => {
    return messages[email] || [];
  };

  return (
    <MessagesContext.Provider value={{ messages, sendMessage, getConversationMessages }}>
      {children}
    </MessagesContext.Provider>
  );
};

// Hook to use messages context
export const useMessages = () => useContext(MessagesContext);
