import React, { useRef, useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import { FaCode, FaPaperclip } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import './WorkChat.css';
import './ChatTableStyles.css';
import { useContext } from 'react';
import { MyContext } from '../../App';
import { generateCustomUUID } from '../../utils/customUUID';
import MessageFeedback from './MessageFeedback';

const linkify = (text) => {
  if (!text) return text;
  return text.replace(/(?<![\[\(])(https?:\/\/[^\s]+)/g, "[$1]($1)");
};

const getInitialMessages = (projectInfo) => {
  if (projectInfo.projectId) {
    return [
      {
        id: 'initial-bot-msg-dev-project',
        from: 'bot',
        text: `Hello! I'm here to help you with your project "${projectInfo.projectName}". You can ask me questions about development, code review, or upload files for analysis.`
      },
    ];
  }
  return [
    {
      id: 'initial-bot-msg-dev-general',
      from: 'bot',
      text: 'Upload your code file or ask a developer question.'
    },
  ];
};

const DeveloperChat = ({ projectInfo = {} }) => {
  const [messages, setMessages] = useState(getInitialMessages(projectInfo));
  const [input, setInput] = useState('');
  const chatEndRef = useRef(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(true);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [suggestions, setSuggestions] = useState([]); // Tanmey Added
  const [chatId, setChatId] = useState(null); // ✅ NEW: Track chat_id for history
  const context = useContext(MyContext);
  const userEmail = context.userEmail;
  const userName = context.userName || "User";

  // ✅ Restore last used chat_id for this project
  useEffect(() => {
    if (projectInfo?.projectId) {
      const cachedChatId = localStorage.getItem(`chat_id_${projectInfo.projectId}`);
      if (cachedChatId) setChatId(cachedChatId);
    }
  }, [projectInfo?.projectId]);

  // Use unified storage key for both DeveloperChat and WorkChat
  const storageKey = userEmail ? `unified_chatHistory_${userEmail}` : 'unified_chatHistory_guest';

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
    }
  }, [chatHistory, storageKey]);

  // Restore chat history from localStorage when component mounts
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          // Sort by timestamp (newest first)
          const sortedHistory = parsed.sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
          );
          setChatHistory(sortedHistory);
        }
      } catch (e) {
        console.error("Failed to parse chat history", e);
      }
    }
  }, [storageKey]);

  // Set session once component mounts
  useEffect(() => {
    const setSession = async () => {
      if (!userEmail) return;
      try {
        // await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/set_session", {
        await fetch("http://127.0.0.1:8000/set_session", {

          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer webugmate123" },
          credentials: "include",
          body: JSON.stringify({ email: userEmail, name: userName })
        });
      } catch (error) {
        console.error("❌ Failed to set session:", error);
      }
    };
    setSession();
  }, [userEmail, userName]);

  // // Send message to Flask backend
  // const handleSend = async (text = input) => {
  //   if (text.trim() === '') return;
  const handleSend = async (altText = null, payload_index = null) => { // Tanmey Start
    const textToSend = altText || input;
    if (textToSend.trim() === '') return; // Tanmey End

    const newMessages = [...messages, {
      id: generateCustomUUID(),
      from: 'user',
      text: textToSend // Tanmey Added
    }];
    setMessages(newMessages);
    if (!altText) setInput(''); // Tanmey Added
    setSessionActive(true);

    // Generate session ID if this is the first message
    if (!currentSessionId) {
      const sessionId = generateCustomUUID();
      setCurrentSessionId(sessionId);
    }
    setSuggestions([]); // Tanmey Added
    try {
      // const response = await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/dual", {
      const response = await fetch("http://127.0.0.1:8000/chat/dual", {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer webugmate123",
          "user_email": userEmail || "dev_user@example.com"
        },
        credentials: "include",
        body: JSON.stringify({
          message: textToSend, // Tanmey Added
          project_id: projectInfo?.projectId || "default",
          chat_id: chatId, // ✅ NEW: Send existing chat_id
          question_index: payload_index !== null ? payload_index : undefined // Tanmey Added
        }),
      });

      const data = await response.json();

      // ✅ NEW: Update chat_id from response if it changed
      if (data.chat_id && data.chat_id !== chatId) {
        setChatId(data.chat_id);
        if (projectInfo?.projectId) {
          localStorage.setItem(`chat_id_${projectInfo.projectId}`, data.chat_id);
        }
      }
      const botReply = {
        id: data.message_ids?.assistant || data.message_id || generateCustomUUID(),
        from: 'bot',
        text: data.reply || "⚠️ No reply from server"
      };

      const updatedMessages = [...newMessages, botReply];
      setMessages(updatedMessages);
      // Tanmey Start
      if (data.multi_clarification) {
        setSuggestions(data.clarifications || []);
      }
      // Tanmey End

      // Save to unified chat history
      const sessionName = projectInfo.projectName
        ? `Developer - ${projectInfo.projectName}`
        : `Developer Chat - ${new Date().toLocaleDateString()}`;

      if (!sessionActive) {
        // Start new session
        setChatHistory(prev => [
          ...prev,
          {
            id: currentSessionId || Date.now(),
            sessionId: currentSessionId || Date.now(),
            chatType: 'developer',
            projectId: projectInfo?.projectId || 'default',
            projectName: projectInfo?.projectName || 'Default Project',
            summary: textToSend, //Tanmey Added
            fullChat: updatedMessages,
            timestamp: new Date().toISOString(),
            sessionName: sessionName,
            chatId: data.chat_id || chatId // ✅ Store chat_id in history
          },
        ]);
      } else {
        // Update existing session
        setChatHistory(prev =>
          prev.map((chat, idx) =>
            chat.sessionId === currentSessionId
              ? {
                ...chat,
                fullChat: updatedMessages,
                timestamp: new Date().toISOString(),
                chatId: data.chat_id || chatId // ✅ Store chat_id in history
              }
              : chat
          )
        );
      }
    } catch (error) {
      console.error("❌ Chat request failed:", error);
      setMessages(prev => [...prev, {
        id: generateCustomUUID(),
        from: 'bot',
        text: "Error connecting to chatbot."
      }]);
    }
  };
  //Tanmey start
  const handleSuggestionClick = (suggestion, index) => {
    handleSend(suggestion, index);
  };
  //Tanmey end
  const handleFeedback = async (feedbackData) => {
    console.log('Feedback received:', feedbackData);
    window.dispatchEvent(new CustomEvent('messageFeedback', { detail: feedbackData }));

    try {
      // await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/feedback", {
      await fetch("http://127.0.0.1:8000/chat/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer webugmate123",
          "user_email": userEmail || "dev_user@example.com"
        },
        credentials: "include",
        body: JSON.stringify(feedbackData)
      });
      console.log('✅ Feedback synced to server');
    } catch (error) {
      console.error('❌ Failed to sync feedback:', error);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSend();
  };

  const handleHistoryClick = (chat) => {
    setMessages(chat.fullChat);
    setCurrentSessionId(chat.sessionId);
    setChatId(chat.chatId || null); // ✅ Restore chat_id from history
    setSessionActive(true);
  };

  const handleHistoryDelete = (id) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));
  };

  // Clear current chat but keep history
  const clearCurrentChat = () => {
    setMessages(getInitialMessages(projectInfo));
    setSessionActive(false);
    setCurrentSessionId(null);
  };

  // Group chats by date for better organization
  const groupedChats = chatHistory.reduce((groups, chat) => {
    const date = new Date(chat.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(chat);
    return groups;
  }, {});

  return (
    <div className="work-layout">
      {/* Main Chat Area */}
      <div className={`work-container${historyOpen ? ' with-history' : ' full-width'}`}>
        <Card className="work-card">
          <Card.Header className="d-flex align-items-center">
            <FaCode className="me-2" /> <span>Developer Chatbot</span>
            <button
              onClick={clearCurrentChat}
              style={{
                marginLeft: 'auto',
                padding: '4px 8px',
                fontSize: '12px',
                background: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Clear Chat
            </button>
          </Card.Header>

          {projectInfo.projectId && (
            <div className="work-banner" style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              padding: '12px 20px',
              fontSize: '14px',
              borderBottom: '1px solid #e9ecef'
            }}>
              <strong>Project:</strong> {projectInfo.projectName || 'Unknown Project'}
              {projectInfo.projectId && <span style={{ marginLeft: '10px', opacity: 0.8 }}>(ID: {projectInfo.projectId})</span>}
            </div>
          )}

          <Card.Body className="work-history">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`work-bubble ${msg.from === 'user' ? 'user' : 'assistant'}`}>
                <ReactMarkdown>{linkify(msg.text)}</ReactMarkdown>
                {msg.from === 'bot' && (
                  <MessageFeedback
                    messageId={msg.id || `msg-${idx}`}
                    onFeedback={handleFeedback}
                  />
                )}
              </div>
            ))}
            {suggestions.length > 0 && (   //Tanmey Added
              <div className="suggestions-container">
                {suggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    className="suggestion-btn"
                    onClick={() => handleSuggestionClick(suggestion, idx)}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
            <div ref={chatEndRef} />
          </Card.Body>

          <Card.Footer>
            <div className="work-input-area">
              <div className="input-wrapper">

                <input
                  type="text"
                  placeholder="Type your message..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="send-btn" onClick={() => handleSend()}>Send</button>
              </div>
            </div>
          </Card.Footer>
        </Card>
      </div>

      {/* Unified History Panel (Shows ALL chats - both Developer and Project) */}
      <div className={`work-history-panel${historyOpen ? '' : ' closed'}`}>
        <div className="work-panel-header">
          <h3>All Chat History</h3>
          <small style={{ color: '#fff', fontSize: '12px' }}>Developer & Project Chats</small>
        </div>
        <div className="work-history-list">
          {chatHistory.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No chat history yet</p>
          ) : (
            Object.entries(groupedChats).map(([date, chats]) => (
              <div key={date}>
                <div style={{
                  padding: '8px 12px',
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  color: '#e2e8f0',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderBottom: '1px solid rgba(139, 92, 246, 0.2)'
                }}>
                  {date}
                </div>
                {chats.map((chat) => (
                  <div
                    key={chat.id}
                    className={`work-history-item${messages === chat.fullChat ? ' selected' : ''}`}
                    onClick={() => handleHistoryClick(chat)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span className="work-history-type-badge" style={{
                          background: chat.chatType === 'project'
                            ? 'linear-gradient(135deg, #A80C4C, #090939, #421256, #531C9B)'
                            : 'linear-gradient(135deg, #667eea, #764ba2)',
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '10px',
                          fontSize: '10px'
                        }}>
                          {chat.chatType === 'project' ? 'Project' : 'Developer'}
                        </span>
                        <button
                          className="work-history-delete-btn"
                          onClick={e => { e.stopPropagation(); handleHistoryDelete(chat.id); }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#dc3545',
                            cursor: 'pointer',
                            fontSize: '14px'
                          }}
                        >
                          ✕
                        </button>
                      </div>
                      <span className="work-history-summary">{chat.summary}</span>
                      {chat.timestamp && (
                        <small style={{ display: 'block', color: '#666', fontSize: '10px' }}>
                          {new Date(chat.timestamp).toLocaleTimeString()}
                        </small>
                      )}
                      {chat.projectName && chat.projectName !== 'Default Project' && (
                        <small style={{ display: 'block', color: '#888', fontSize: '10px' }}>
                          Project: {chat.projectName}
                        </small>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>

      {/* History Toggle Button */}
      <button
        className="work-history-toggle-btn"
        onClick={() => setHistoryOpen(prev => !prev)}
      >
        {historyOpen ? '→' : '←'}
      </button>
    </div>
  );
};

export default DeveloperChat;