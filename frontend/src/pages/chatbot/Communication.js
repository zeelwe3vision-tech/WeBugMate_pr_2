import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Card } from 'react-bootstrap';
import { FaComments, FaArrowUp, FaArrowDown, FaPaperclip, FaPaperPlane } from 'react-icons/fa';
import { MyContext } from '../../App';
import './WorkChat.css';
import './ChatTableStyles.css';
import { generateCustomUUID } from '../../utils/customUUID';
import MessageFeedback from './MessageFeedback';

const linkify = (text) => {
  if (!text) return text;
  return text.replace(/(?<![\[\(])(https?:\/\/[^\s]+)/g, "[$1]($1)");
};

function Communication() {
  const [messages, setMessages] = useState([
    {
      id: 'initial-assistant-msg-comm',
      role: 'assistant',
      content: 'Hello! I\'m your Communication Assistant. I can help you with general questions, discussions, and provide information on various topics. How can I assist you today?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [chatId, setChatId] = useState(null); // ✅ NEW: Track chat_id for history
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);  //Tanmey added

  const navigate = useNavigate();
  const context = useContext(MyContext);
  const userEmail = context.userEmail;
  const userName = context.userName || "User"; // fallback if name not available
  // udit start
  const [isAtBottom, setIsAtBottom] = useState(true); // true = show up arrow, false = show down arrow
  // udit end

  // ✅ Auto scroll to bottom when messages change
  useEffect(() => {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [messages]);
  // udit start
  useEffect(() => {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatBox;
      const distanceFromTop = scrollTop;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      console.log('📍 Scroll Detection (Communication):');
      console.log('  - scrollTop (distanceFromTop):', distanceFromTop);
      console.log('  - distanceFromBottom:', distanceFromBottom);
      console.log('  - scrollHeight:', scrollHeight);
      console.log('  - clientHeight:', clientHeight);

      // Check if content is scrollable
      const isScrollable = scrollHeight > clientHeight;

      if (!isScrollable) {
        // No scrollable content, default to show down arrow
        console.log('  - Not scrollable, setting isAtBottom = false (DOWN arrow)');
        setIsAtBottom(false);
        return;
      }

      // Update button state based on position
      // Show DOWN arrow when at TOP or MIDDLE
      // Show UP arrow ONLY when at BOTTOM (within 50px from bottom)
      if (distanceFromBottom < 50) {
        console.log('  - ✅ At BOTTOM (distanceFromBottom < 50px), setting isAtBottom = true → UP arrow ⬆️');
        setIsAtBottom(true); // At bottom, show up arrow to scroll to top
      } else {
        console.log('  - ✅ At top/middle, setting isAtBottom = false → DOWN arrow ⬇️');
        setIsAtBottom(false); // Top or middle, show down arrow to scroll to bottom
      }

      console.log('  - Final isAtBottom state:', distanceFromBottom < 50 ? true : false);
      console.log('  - Arrow shown:', distanceFromBottom < 50 ? '⬆️ UP' : '⬇️ DOWN');
    };

    // Check initial scroll position
    console.log('🔄 Initial scroll check on mount (Communication)');
    handleScroll();

    chatBox.addEventListener('scroll', handleScroll);

    // Re-check on window resize
    window.addEventListener('resize', handleScroll);

    return () => {
      chatBox.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);
  // udit end



  // Check screen size for responsive design
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Save to localStorage for communication chat
  const storageKey = 'chatHistory_communication';

  // Save chat history to localStorage whenever it changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));
      console.log('💾 Communication chat history saved to localStorage:', storageKey, chatHistory.length, 'items');
    }
  }, [chatHistory, storageKey]);

  // Restore chat history from localStorage when component mounts
  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setChatHistory(parsed);
          console.log('🔄 Communication chat history restored:', parsed.length, 'items');
        }
      } catch (e) {
        console.error("Failed to parse communication chat history", e);
      }
    } else {
      console.log('🔍 No saved communication chat history found for key:', storageKey);
    }
  }, [storageKey]);

  // Redirect if no user email
  useEffect(() => {
    if (!userEmail) {
      navigate('/login');
    }
  }, [userEmail, navigate]);

  useEffect(() => {
    const checkScreenSize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (mobile) {
        setHistoryOpen(false); // 👈 start closed on mobile
      } else {
        setHistoryOpen(true); // 👈 keep open on desktop
      }
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);
  useEffect(() => {
    const cachedChatId = localStorage.getItem('chat_id_communication');
    if (cachedChatId) setChatId(cachedChatId);
  }, []);

  // ✅ Call /set_session when component mounts or when userEmail changes
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
        console.log("✅ Session set successfully in Flask");
      } catch (error) {
        console.error("❌ Failed to set session:", error);
      }
    };
    setSession();
  }, [userEmail, userName]);

  // // Send message
  // const sendMessage = async () => {
  //   if (inputText.trim() === '') return;
  const sendMessage = async (altText = null, payload_index = null) => {  //Tanmey Start
    const textToSend = altText || inputText;
    if (textToSend.trim() === '') return;   //Tanmey End

    const newMessage = {
      id: generateCustomUUID(),
      role: 'user',
      content: textToSend   //Tanmey Added
    };
    setInputText('');
    if (!altText) setInputText('');  //Tanmey added

    // Append user message immediately
    const updatedMessages = [...messages, newMessage];
    setMessages(updatedMessages);

    // Generate session ID if this is the first message
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = generateCustomUUID();
      setCurrentSessionId(sessionId);
    }
    setSessionActive(true);

    setIsTyping(true);
    setSuggestions([]); //Tanmey added
    try {
      // const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/common', {
      const response = await fetch('http://127.0.0.1:8000/chat/common', {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": "Bearer webugmate123",
          "user_email": userEmail
        },
        credentials: 'include',
        body: JSON.stringify({  //Tanmey Start
          query: newMessage.content,
          question_index: payload_index !== undefined ? payload_index : null
        })
      });  //Tanmey End

      const data = await response.json();

      // ✅ Update chat_id from response if it changed
      if (data.chat_id && data.chat_id !== chatId) {
        setChatId(data.chat_id);
        localStorage.setItem('chat_id_communication', data.chat_id);
      }
      const botReply = {
        id: data.message_id || generateCustomUUID(),
        role: 'assistant',
        content: data.reply || "⚠️ No reply from server"
      };

      // Append bot reply to messages
      const messagesWithBot = [...updatedMessages, botReply];
      setMessages(messagesWithBot);
      //Tanmey Start
      if (data.suggestions && data.suggestions.length > 0) {
        setSuggestions(data.suggestions);
      }
      //Tanmey End

      // Save chat history
      setChatHistory(prev => {
        const existing = prev.find(chat => chat.sessionId === sessionId);
        if (existing) {
          return prev.map(chat =>
            chat.sessionId === sessionId
              ? {
                ...chat,
                fullChat: messagesWithBot,
                timestamp: new Date().toISOString(),
                messageCount: messagesWithBot.length,
                chatId: data.chat_id || chatId // ✅ Store chat_id in history
              }
              : chat
          );
        } else {
          return [
            ...prev,
            {
              id: sessionId,
              sessionId: sessionId,
              chatType: 'communication',
              summary: newMessage.content,
              fullChat: messagesWithBot,
              timestamp: new Date().toISOString(),
              sessionName: `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
              messageCount: messagesWithBot.length,
              chatId: data.chat_id || chatId // ✅ Store chat_id in history
            }
          ];
        }
      });

    } catch (error) {
      console.error("❌ Chat request failed:", error);
      setMessages(prev => [...prev, {
        id: generateCustomUUID(),
        role: 'assistant',
        content: 'Error connecting to chatbot.'
      }]);
    } finally {
      setIsTyping(false);
    }
  };
  //Tanmey Start
  const handleSuggestionClick = (suggestion, index) => {
    // Don't set input text - just send the message directly
    // The message will appear in the chat display as a user message
    sendMessage(suggestion, index);
  };
  //Tanmey End

  const handleFeedback = async (feedbackData) => {
    console.log('Feedback received:', feedbackData);
    window.dispatchEvent(new CustomEvent('messageFeedback', { detail: feedbackData }));

    try {
      // await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/feedback", {
      await fetch("http://127.0.0.1:8000/chat/feedback", {

        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer webugmate123"
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
    if (e.key === 'Enter') sendMessage();
  };
  //udit start
  // NEW LOGIC: Toggle scroll function - scrolls up or down based on current position
  const handleScrollToggle = () => {
    const chatBox = document.getElementById("chatBox");
    console.log('=== SCROLL BUTTON CLICKED (Communication) ===');
    console.log('Button clicked! chatBox:', chatBox);

    if (!chatBox) {
      console.error('❌ Chat box not found!');
      return;
    }

    const { scrollTop, scrollHeight, clientHeight } = chatBox;
    const maxScroll = scrollHeight - clientHeight;

    console.log('📊 Scroll Info:');
    console.log('  - Current state (isAtBottom):', isAtBottom);
    console.log('  - Current scroll position:', scrollTop);
    console.log('  - Scroll height:', scrollHeight);
    console.log('  - Client height:', clientHeight);
    console.log('  - Max scroll:', maxScroll);
    console.log('  - Is scrollable?:', maxScroll > 0);

    // Check if content is scrollable
    if (maxScroll <= 0) {
      console.warn('⚠️ No scrollable content - maxScroll:', maxScroll);
      console.log('Content fits in viewport, no scrolling needed');
      return;
    }

    if (isAtBottom) {
      // Currently at bottom, scroll to top
      console.log('⬆️ Scrolling to TOP');
      chatBox.scrollTop = 0;
      chatBox.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        console.log('✅ After scroll - scrollTop:', chatBox.scrollTop);
        setIsAtBottom(false);
      }, 100);
    } else {
      // Currently at top or middle, scroll to bottom
      console.log('⬇️ Scrolling to BOTTOM');
      chatBox.scrollTop = maxScroll;
      chatBox.scrollTo({ top: maxScroll, behavior: 'smooth' });
      setTimeout(() => {
        console.log('✅ After scroll - scrollTop:', chatBox.scrollTop);
        setIsAtBottom(true);
      }, 100);
    }
  };
  // udit end





  const handleHistoryClick = (chat) => {
    setMessages(chat.fullChat);
    setCurrentSessionId(chat.sessionId);
    setChatId(chat.chatId || null); // ✅ Restore chat_id from history
    setSessionActive(true);
  };

  const handleHistoryDelete = (id) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));
  };

  return (
    <div className="work-layout">
      {/* Main Chat Area */}
      <div className={`work-container${historyOpen ? ' with-history' : ' full-width'}`}>
        <Card className="work-card">
          <Card.Header className="d-flex align-items-center">
            <FaComments className="me-2" />
            <span>Communication Assistant</span>
          </Card.Header>

          <div className="work-banner" style={{
            background: 'linear-gradient(135deg, #A80C4C, #090939, #421256, #531C9B)',
            color: 'white',
            padding: '12px 20px',
            fontSize: '14px',
          }}>
            <strong>Communication Assistant</strong>
            <span style={{ marginLeft: '10px', opacity: 0.8 }}>
              General questions, discussions, and information
            </span>
          </div>

          {/* <Card.Body id="chatBox" className="work-history">
            {messages.map((msg, idx) => (
              <div key={msg.id || idx} className={`work-bubble ${msg.role}`}>
                <ReactMarkdown>{linkify(msg.content)}</ReactMarkdown>
                {msg.role === 'assistant' && (
                  <MessageFeedback
                    messageId={msg.id || `msg-${idx}`}
                    onFeedback={handleFeedback}
                  />
                )}
              </div>
            ))}
            {isTyping && (
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}
          </Card.Body> */}


          <Card.Body id="chatBox" className="work-history">
            {messages.map((msg, idx) => (
              <div key={idx} className={`work-bubble ${msg.role}`}>
                {/* ✅ If reply contains table HTML → render as HTML */}
                {msg.content && msg.content.includes("<table") ? (
                  <div dangerouslySetInnerHTML={{ __html: msg.content }} />
                ) : (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                )}
                {msg.role === 'assistant' && (
                  <MessageFeedback
                    messageId={msg.id || `msg-${idx}`}
                    onFeedback={handleFeedback}
                  />
                )}
              </div>
            ))}

            {isTyping && (
              <div className="typing-indicator">
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
                <span className="typing-dot"></span>
              </div>
            )}
            {/*Tanmey added*/}
            {suggestions.length > 0 && (
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
          </Card.Body>
          {/* // udit start */}
          {/* NEW LOGIC: Scroll Button - OUTSIDE Card.Body, INSIDE Card */}
          <button
            className="scroll-toggle-btn-fixed"
            onClick={handleScrollToggle}
            title={isAtBottom ? "Scroll to top" : "Scroll to bottom"}
            aria-label={isAtBottom ? "Scroll to top" : "Scroll to bottom"}
            style={{
              position: 'absolute',
              bottom: '100px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(139, 92, 246, 0.5)',
              fontSize: '16px',
              transition: 'all 0.3s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1.15)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(139, 92, 246, 0.7)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateX(-50%) scale(1)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.5)';
            }}
          >
            {isAtBottom ? <FaArrowUp /> : <FaArrowDown />}
          </button>
          {/*udit end  */}
          <Card.Footer>
            <div className="work-input-area">
              <div className="input-wrapper">

                <input
                  type="text"
                  placeholder="Ask general questions..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                />
                <button className="send-btn" onClick={sendMessage} aria-label="Send message" title="Send">
                  <FaPaperPlane />
                </button>
              </div>
            </div>
          </Card.Footer>
        </Card>
      </div>

      {/* History Panel */}
      <div className={`work-history-panel${historyOpen ? '' : ' closed'}`}>
        <div className="work-panel-header">
          <h3>Communication History</h3>
        </div>
        <div className="work-history-list">
          {chatHistory.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No previous sessions</p>
          ) : (
            chatHistory.map((chat) => (
              <div
                key={chat.id}
                className={`work-history-item${messages === chat.fullChat ? ' selected' : ''}`}
                onClick={() => handleHistoryClick(chat)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div className="work-history-type-badge">
                      Session
                    </div>
                    <button
                      className="work-history-delete-btn"
                      onClick={e => { e.stopPropagation(); handleHistoryDelete(chat.id); }}
                      style={{ marginLeft: '8px', marginTop: '-6px' }}
                    >
                      ✕
                    </button>
                  </div>
                  <div className="work-history-session-name">
                    {chat.sessionName || `Session ${new Date(chat.timestamp).toLocaleDateString()}`}
                  </div>
                  <span className="work-history-summary">{chat.summary}</span>
                  <div className="work-history-meta">
                    {chat.messageCount && (
                      <small style={{ display: 'inline-block', color: '#666', fontSize: '10px', marginRight: '10px' }}>
                        {chat.messageCount} messages
                      </small>
                    )}
                    <small style={{ color: '#666', fontSize: '10px' }}>
                      {new Date(chat.timestamp).toLocaleString()}
                    </small>
                  </div>
                </div>
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
}

export default Communication;
