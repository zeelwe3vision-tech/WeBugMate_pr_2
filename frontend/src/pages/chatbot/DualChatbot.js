import React, { useRef, useEffect, useState, useContext, useMemo } from 'react';
import { Card } from 'react-bootstrap';
import { FaComments, FaPaperclip, FaArrowDown, FaArrowUp, FaPaperPlane } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';
import './WorkChat.css';
import './ChatTableStyles.css';
import { MyContext } from '../../App';
import { generateCustomUUID } from '../../utils/customUUID';
import MessageFeedback from './MessageFeedback';
import rehypeRaw from "rehype-raw";


const linkify = (text) => {
  if (!text) return text;
  return text.replace(/(?<![\[\(])(https?:\/\/[^\s]+)/g, "[$1]($1)");
};

const DualChatbot = () => {
  const [generalMessages, setGeneralMessages] = useState([
    {
      id: 'initial-assistant-msg-dual',
      role: 'assistant',
      content: 'Hello! I\'m your Dual Chat Assistant. I can help you with both general development questions and project-specific guidance. How can I assist you today?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSession, setCurrentSession] = useState({
    id: null,
    projectId: null,
    projectName: null
  });
  const chatEndRef = useRef(null);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState(null);
  const [suggestions, setSuggestions] = useState([]); //Tanmey added
  const [chatId, setChatId] = useState(null); // ✅ NEW: Track chat_id for history
  // NEW LOGIC: State for toggle scroll button
  //udit start
  const [isAtBottom, setIsAtBottom] = useState(true); // true = show up arrow, false = show down arrow
  //udit END 

  const context = useContext(MyContext);
  const userEmail = context.userEmail;
  const userName = context.userName || "User";

  // Get project chats from both WorkChat and current chat history
  const projectChats = useMemo(() => {
    // Create a map to store the most recent chat for each project
    const projectMap = new Map();

    // 1. Get project chats from WorkChat component
    const allKeys = Object.keys(localStorage);
    // Filter chats by user's email
    const userPrefix = userEmail ? `chatHistory_${userEmail}_` : 'chatHistory_';
    const projectChatKeys = allKeys.filter(key =>
      key.startsWith(userPrefix + 'project_')
    );

    // Process WorkChat project chats
    projectChatKeys.forEach(key => {
      try {
        const chats = JSON.parse(localStorage.getItem(key) || '[]');
        chats.forEach(chat => {
          if (chat?.projectId && chat.projectId !== 'Default' && chat.projectId !== 'default') {
            const existingChat = projectMap.get(chat.projectId);
            if (!existingChat || new Date(chat.timestamp) > new Date(existingChat.timestamp)) {
              projectMap.set(chat.projectId, {
                ...chat,
                // Ensure we have all required fields
                id: chat.id || `workchat_${chat.projectId}_${chat.timestamp}`,
                sessionId: chat.sessionId || chat.id,
                chatType: 'project',
                projectName: chat.projectName || chat.sessionName || 'Unnamed Project'
              });
            }
          }
        });
      } catch (e) {
        console.error(`Error parsing chat from ${key}:`, e);
      }
    });

    // 2. Process current chat history
    chatHistory.forEach(chat => {
      if (chat?.projectId && chat.projectId !== 'Default' && chat.projectId !== 'default') {
        const existingChat = projectMap.get(chat.projectId);
        if (!existingChat || new Date(chat.timestamp) > new Date(existingChat.timestamp)) {
          projectMap.set(chat.projectId, chat);
        }
      }
    });

    // Convert map values to array and sort by timestamp (newest first)
    return Array.from(projectMap.values()).sort((a, b) =>
      new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
    );
  }, [chatHistory, userEmail]);
  // Responsive design: detect mobile screen
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

  // Responsive design: detect mobile screen
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Use unified localStorage key for chat history shared with WorkChat
  const storageKey = userEmail ? `unified_chatHistory_${userEmail}` : 'unified_chatHistory_guest';

  // Load all chat histories (unified + project-specific)
  useEffect(() => {
    const loadAllChatHistories = () => {
      // NEW LOGIC: Enhanced error handling for localStorage operations
      //udit start
      try {
        // Get all project chat history keys
        const allKeys = Object.keys(localStorage);
        const projectChatKeys = allKeys.filter(key =>
          key.startsWith(userEmail ? `unified_chatHistory_${userEmail}_` : 'unified_chatHistory_guest_')
        );

        // Add the main unified storage key
        const allStorageKeys = [...projectChatKeys, storageKey];

        // NEW LOGIC: Load WorkChat project histories from chatHistory_project_{projectId} keys
        // This ensures all project chats created in WorkChat are visible in DualChatbot sidebar
        const workChatProjectKeys = allKeys.filter(key =>
          key.startsWith('chatHistory_project_') && !key.includes('Default') && !key.includes('default')
        );

        // Add WorkChat project storage keys to the list
        allStorageKeys.push(...workChatProjectKeys);

        console.log('📂 Loading chat histories from keys:', allStorageKeys.length, 'storage locations');
        // END NEW LOGIC

        // Collect all unique chat sessions
        const allChats = [];
        const seenIds = new Set();

        allStorageKeys.forEach(key => {
          try {
            const saved = localStorage.getItem(key);
            if (saved) {
              const parsed = JSON.parse(saved);

              // Validate data format
              if (!Array.isArray(parsed)) {
                console.warn(`Invalid data format in ${key}, expected array`);
                return;
              }

              parsed.forEach(chat => {
                // Validate chat session has required fields
                if (chat?.id && !seenIds.has(chat.id)) {
                  seenIds.add(chat.id);
                  // NEW LOGIC: Ensure WorkChat sessions have proper structure for DualChatbot
                  const normalizedChat = {
                    ...chat,
                    sessionId: chat.sessionId || chat.id,
                    chatType: chat.chatType || 'project',
                    projectName: chat.projectName || chat.sessionName || 'Unnamed Project'
                  };
                  allChats.push(normalizedChat);
                  // udit end
                }
              });
            }

          } catch (e) {
            console.error(`Error loading chat from ${key}:`, e);
          }
        });

        // Sort by timestamp (newest first)
        allChats.sort((a, b) =>
          new Date(b.timestamp || 0) - new Date(a.timestamp || 0)
        );

        setChatHistory(allChats);

        // Auto-open the most recent chat if available
        if (allChats.length > 0) {
          const mostRecentChat = allChats[0];
          if (mostRecentChat.fullChat) {
            setGeneralMessages(mostRecentChat.fullChat);
            setChatId(mostRecentChat.chatId || null); // ✅ Restore chatId from history
            setCurrentSession(prev => ({
              ...prev,
              id: mostRecentChat.id,
              projectId: mostRecentChat.projectId || null,
              projectName: mostRecentChat.projectName || null
            }));
            setSessionActive(true);
          }
        }

        console.log(' Loaded chat history from all projects:', allChats.length, 'sessions');

      } catch (e) {
        console.error('Failed to load chat histories:', e);
      }
    };

    loadAllChatHistories();

    // Listen for storage changes to update the list
    const handleStorageChange = (e) => {
      if (e.key && (e.key.startsWith('unified_chatHistory_') || e.key === storageKey)) {
        loadAllChatHistories();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [storageKey, userEmail]);

  // Save chat history to localStorage on changes
  useEffect(() => {
    if (chatHistory.length > 0) {
      // Save to dual chat storage
      const dualChatKey = userEmail ? `chatHistory_dual_${userEmail}` : 'chatHistory_dual_guest';
      localStorage.setItem(dualChatKey, JSON.stringify(chatHistory));

      // Also save to unified storage
      localStorage.setItem(storageKey, JSON.stringify(chatHistory));

      // Trigger storage event for other tabs/windows
      window.dispatchEvent(new StorageEvent('storage', {
        key: dualChatKey,
        newValue: JSON.stringify(chatHistory),
        storageArea: localStorage,
        url: window.location.href
      }));

      console.log('💾 Dual chat history saved and synced:', storageKey, chatHistory.length, 'items');
    }
  }, [chatHistory, storageKey, userEmail]);

  // Listen for history updates from other components/tabs and refresh
  useEffect(() => {
    const refreshAllHistories = () => {
      // This will trigger the main effect to reload all histories
      const event = new Event('storage');
      window.dispatchEvent(event);
    };

    window.addEventListener('unifiedChatHistoryUpdated', refreshAllHistories);
    window.addEventListener('projectChatUpdated', refreshAllHistories);

    return () => {
      window.removeEventListener('unifiedChatHistoryUpdated', refreshAllHistories);
      window.removeEventListener('projectChatUpdated', refreshAllHistories);
    };
  }, []);

  // Set session on mount
  useEffect(() => {
    const setSession = async () => {
      if (!userEmail) return;
      try {
        await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/set_session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', "Authorization": "Bearer webugmate123" },
          credentials: 'include',
          body: JSON.stringify({ email: userEmail, name: userName }),
        });
        console.log('✅ Session set for Dual Chatbot');
      } catch (error) {
        console.error('❌ Failed to set session:', error);
      }
    };
    setSession();
  }, [userEmail, userName]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    const chatBox = document.getElementById("chatBox");
    if (chatBox) {
      chatBox.scrollTop = chatBox.scrollHeight;
    }
  }, [generalMessages]);
  //udit start
  // NEW LOGIC: Detect scroll position to update button state
  useEffect(() => {
    const chatBox = document.getElementById("chatBox");
    if (!chatBox) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatBox;
      const distanceFromTop = scrollTop;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      console.log('📍 Scroll Detection:');
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
    console.log('🔄 Initial scroll check on mount');
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

  // // Send message logic
  // const sendMessage = async () => {
  //   if (inputText.trim() === '') return;
  // Send message logic //Tanmey Start
  const sendMessage = async (altText = null, payload_index = null) => {
    const textToSend = altText || inputText;
    if (textToSend.trim() === '') return; //Tanmey End

    const newMessage = {
      id: generateCustomUUID(),
      role: 'user',
      content: textToSend   //Tanmey Added
    };
    setInputText('');
    if (!altText) setInputText(''); //Tanmey Added

    // Append user message immediately
    const updatedMessages = [...generalMessages, newMessage];
    setGeneralMessages(updatedMessages);

    // Generate session ID if this is the first message
    const sessionId = currentSession.id || `chat_${Date.now()}`;
    setCurrentSession(prev => ({
      ...prev,
      id: sessionId
    }));
    setSessionActive(true);
    setIsTyping(true);
    setSuggestions([]); //Tanmey added

    try {


      const response = await fetch('https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/dual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          "Authorization": "Bearer webugmate123",
          "user_email": userEmail || "dev_user@example.com"
        },
        credentials: 'include',
        body: JSON.stringify({
          message: newMessage.content,
          chat_type: currentSession.projectId ? 'project' : 'general',
          project_id: currentSession.projectId || 'general',
          chat_id: chatId, // ✅ Use es ished chatId instead of manual string
          model: selectedModel, //Tanmey Start
          question_index: payload_index !== null ? payload_index : undefined
        }), //Tanmey End
      });

      const data = await response.json();

      // ✅ NEW: Update chat_id from response if it changed
      if (data.chat_id && data.chat_id !== chatId) {
        setChatId(data.chat_id);
        if (currentSession.projectId) {
          localStorage.setItem(`chat_id_${currentSession.projectId}`, data.chat_id);
        }
      }
      const botReply = {
        id: data.message_ids?.assistant || data.message_id || generateCustomUUID(),
        role: 'assistant',
        content: data.reply || ' No reply from server'
      };

      // Add bot reply to messages
      const messagesWithBot = [...updatedMessages, botReply];
      setGeneralMessages(messagesWithBot);
      //Tanmey Start
      if (data.multi_clarification) {
        setSuggestions(data.clarifications || []);
      }
      //Tanmey End
      setIsTyping(false);
      //udit start'
      // NEW LOGIC: Save chat to history with validated messageCount
      // Save chat to history
      const sessionName = `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      setChatHistory(prev => {
        const existing = prev.find(chat => chat.id === sessionId);
        if (existing) {
          return prev.map(chat =>
            chat.id === sessionId
              ? {
                ...chat,
                fullChat: messagesWithBot,
                timestamp: new Date().toISOString(),
                messageCount: messagesWithBot.length // Validated to match fullChat.length
              }
              : chat
          );
        } else {
          return [
            ...prev,
            {
              id: sessionId,
              sessionId: sessionId,
              chatType: 'dual',
              summary: newMessage.content,
              fullChat: messagesWithBot,
              timestamp: new Date().toISOString(),
              sessionName: sessionName,
              messageCount: messagesWithBot.length, // Validated to match fullChat.length
            },
          ];
        }
      });
      // udit end
      // udit commmneted start
      // Save chat to history
      // const sessionName = `Session ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      // setChatHistory(prev => {
      //   const existing = prev.find(chat => chat.id === sessionId);
      //   if (existing) {
      //     return prev.map(chat =>
      //       chat.id === sessionId
      //         ? {
      //           ...chat,
      //           fullChat: messagesWithBot,
      //           timestamp: new Date().toISOString(),
      //           messageCount: messagesWithBot.length,
      //           chatId: data.chat_id || chatId, // ✅ Store chat_id in history
      //           projectId: currentSession.projectId,
      //           projectName: currentSession.projectName
      //         }
      //         : chat
      //     );
      //   } else {
      //     return [
      //       ...prev,
      //       {
      //         id: sessionId,
      //         sessionId: sessionId,
      //         chatType: 'dual',
      //         summary: newMessage.content,
      //         fullChat: messagesWithBot,
      //         timestamp: new Date().toISOString(),
      //         sessionName: sessionName,
      //         messageCount: messagesWithBot.length,
      //         chatId: data.chat_id || chatId, // ✅ Store chat_id in history
      //         projectId: currentSession.projectId,
      //         projectName: currentSession.projectName
      //       },
      //     ];
      //   }
      // });
      //udit commmneted end

    } catch (error) {
      console.error(' Chat request failed:', error);
      setIsTyping(false);
      const errorMessage = {
        id: generateCustomUUID(),
        role: 'assistant',
        content: 'Error connecting to chatbot.'
      };
      setGeneralMessages(prev => [...prev, errorMessage]);
    } finally {  //Tanmey Start
      setIsTyping(false);
    }
  };
  const handleSuggestionClick = (suggestion, index) => {
    // Don't set input text - just send the message directly
    // The message will appear in the chat display as a user message
    sendMessage(suggestion, index);
  };//Tanmey End

  const handleFeedback = async (feedbackData) => {
    console.log('Feedback received:', feedbackData);
    window.dispatchEvent(new CustomEvent('messageFeedback', { detail: feedbackData }));

    try {
      await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/feedback", {
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
    if (e.key === 'Enter') sendMessage();
  };
  //udit start
  // NEW LOGIC: Toggle scroll function - scrolls up or down based on current position
  const handleScrollToggle = () => {
    const chatBox = document.getElementById("chatBox");
    console.log('=== SCROLL BUTTON CLICKED ===');
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

  const clearChat = () => {
    setGeneralMessages([
      {
        id: 'initial-assistant-msg-dual-reset',
        role: 'assistant',
        content: 'Hello! I\'m your Dual Chat Assistant. How can I help you today?'
      }
    ]);
    setSessionActive(false);
    setCurrentSession({
      id: null,
      projectId: null,
      projectName: null
    });
  };

  const handleNewChat = () => {
    clearChat();
  };

  const handleHistoryClick = (chat) => {
    setGeneralMessages(chat.fullChat);
    setChatId(chat.chatId || null); // ✅ Restore chat_id from history
    setCurrentSession({
      id: chat.sessionId,
      projectId: chat.projectId || chat.projectID || 'N/A',
      projectName: chat.projectName || 'Dual Chat Assistant'
    });
    setSessionActive(true);
  };
  //udit start
  // NEW LOGIC: Enhanced handleHistoryDelete to remove from all storage locations
  // This ensures deleted sessions are removed from unified storage, project storage, and dual storage
  const handleHistoryDelete = (id) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));

    try {
      // Remove from unified storage
      const unifiedKey = userEmail ? `unified_chatHistory_${userEmail}` : 'unified_chatHistory_guest';
      const existingUnifiedRaw = localStorage.getItem(unifiedKey);
      if (existingUnifiedRaw) {
        const existingUnified = JSON.parse(existingUnifiedRaw);
        if (Array.isArray(existingUnified)) {
          const updatedUnified = existingUnified.filter(chat => chat && chat.id !== id);
          localStorage.setItem(unifiedKey, JSON.stringify(updatedUnified));
          console.log('🗑️ Removed session from unified storage:', id);
        }
      }

      // Remove from dual chat storage
      const dualChatKey = userEmail ? `chatHistory_dual_${userEmail}` : 'chatHistory_dual_guest';
      const existingDualRaw = localStorage.getItem(dualChatKey);
      if (existingDualRaw) {
        const existingDual = JSON.parse(existingDualRaw);
        if (Array.isArray(existingDual)) {
          const updatedDual = existingDual.filter(chat => chat && chat.id !== id);
          localStorage.setItem(dualChatKey, JSON.stringify(updatedDual));
          console.log('🗑️ Removed session from dual chat storage:', id);
        }
      }

      // Remove from project-specific storage (scan all project keys)
      const allKeys = Object.keys(localStorage);
      const projectKeys = allKeys.filter(key => key.startsWith('chatHistory_project_'));
      projectKeys.forEach(key => {
        try {
          const projectData = localStorage.getItem(key);
          if (projectData) {
            const projectChats = JSON.parse(projectData);
            if (Array.isArray(projectChats)) {
              const updatedProjectChats = projectChats.filter(chat => chat && chat.id !== id);
              if (updatedProjectChats.length !== projectChats.length) {
                localStorage.setItem(key, JSON.stringify(updatedProjectChats));
                console.log('🗑️ Removed session from project storage:', key, id);
              }
            }
          }
        } catch (e) {
          console.error(`Error removing from ${key}:`, e);
        }
      });

      // Dispatch event to notify other components
      window.dispatchEvent(new CustomEvent('chatHistoryDeleted', { detail: { id } }));

    } catch (e) {
      console.error('Failed to remove from all storage locations:', e);
    }
  };
  // udit end
  // udit commmneted start
  // const handleHistoryDelete = (id) => {
  //   setChatHistory(prev => prev.filter(chat => chat.id !== id));
  // };
  //udit commmneted end
  return (
    <div className={`work-layout`}>
      {/* Main Chat Area */}
      <div className={`work-container${historyOpen ? ' with-history' : ' full-width'}`}>
        <Card className="work-card">
          <Card.Header
            className="d-flex align-items-center"
            style={{
              backgroundColor: 'transparent',
              borderBottom: 'none',
              padding: '1rem 1.25rem 0'
            }}
          >
            <FaComments className="me-2" />
            <span>Dual Chat Assistant</span>
          </Card.Header>

          <div className="work-banner" style={{
            background: 'linear-gradient(135deg, #A80C4C, #090939, #421256, #531C9B)',
            color: 'white',
            padding: '12px 20px',
            fontSize: '14px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            <span style={{
              fontWeight: 'bold',
              marginRight: '10px'
            }}>
              {currentSession?.projectName || 'Dual Chat Assistant'}
            </span>
          </div>

          {/* <Card.Body className="work-history" id="chatBox">
            {generalMessages.map((msg, idx) => (
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
            <div ref={chatEndRef} />
          </Card.Body> */}
          {/* //udit start */}
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
          {/*  udit END  */}

          <Card.Body className="work-history" id="chatBox">
            {generalMessages.map((msg, idx) => (
              <div key={idx} className={`work-bubble ${msg.role}`}>
                <ReactMarkdown rehypePlugins={[rehypeRaw]}>
                  {msg.content}
                </ReactMarkdown>
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
            <div ref={chatEndRef} />
          </Card.Body>
          <Card.Footer>
            <div className="work-input-area">
              <div className="input-wrapper">


                <input
                  type="text"
                  placeholder="Ask development questions..."
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
          <h3>All Chats</h3>
        </div>
        <div className="work-history-list">
          {chatHistory.length === 0 ? (
            <p style={{ color: '#888', fontStyle: 'italic' }}>No project chats found</p>
          ) : (
            chatHistory.map(chat => (
              <div
                key={chat.id}
                className={`work-history-item${generalMessages === chat.fullChat ? ' selected' : ''}`}
                onClick={() => handleHistoryClick(chat)}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <div className="d-flex align-items-center" style={{ flex: 1, minWidth: 0, marginTop: '-2px' }}>
                      <div
                        className="work-history-type-badge"
                        style={{
                          color: 'rgb(51, 51, 51)',
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          flex: '1 1 0%',
                          lineHeight: '1.2',
                          fontSize: '11px',
                          letterSpacing: '0.2px'
                        }}
                      >
                        {chat.projectName || 'Unnamed Project'}
                      </div>
                      <button
                        className="work-history-delete-btn"
                        onClick={e => { e.stopPropagation(); handleHistoryDelete(chat.id); }}
                        style={{
                          marginLeft: '8px',
                          flexShrink: 0,
                          position: 'relative',
                          top: '-2px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                  {/* ID display removed */}
                  {chat.summary && (
                    <div className="work-history-summary" style={{ margin: '8px 0', color: '#444' }}>
                      {chat.summary.length > 80 ? `${chat.summary.substring(0, 80)}...` : chat.summary}
                    </div>
                  )}
                  <div className="work-history-meta">
                    {chat.messageCount && (
                      <small style={{
                        display: 'inline-block',
                        color: '#666',
                        fontSize: '10px',
                        marginRight: '10px'
                      }}>
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
};

export default DualChatbot;
