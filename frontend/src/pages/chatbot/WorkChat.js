
import React, { useRef, useEffect, useState, useContext } from 'react';
import { Card } from 'react-bootstrap';
import { FaComments, FaArrowUp, FaArrowDown, FaPaperclip, FaPaperPlane } from 'react-icons/fa';
import { useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import './WorkChat.css';
import './ChatTableStyles.css';
import { MyContext } from '../../App';
import MessageFeedback from './MessageFeedback';
import { generateCustomUUID } from '../../utils/customUUID';
import rehypeRaw from "rehype-raw";


const linkify = (text) => {
  if (!text) return text;
  // Look for URLs that aren't already part of a markdown link
  return text.replace(/(?<![\[\(])(https?:\/\/[^\s]+)/g, (url) => {
    // Basic check to see if it might be inside a markdown link already
    return `[${url}](${url})`;
  });
};

const WorkChat = () => {
  const [workMessages, setWorkMessages] = useState([
    {
      id: 'initial-assistant-msg',
      role: 'assistant',
      content: 'Hello! I\'m your Project Chat Assistant. I can help you with project-related questions, development guidance, team collaboration, and project management. How can I assist you today?'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isMobile, setIsMobile] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [projectId, setProjectId] = useState('Default');
  const [projectName, setProjectName] = useState('Default Project');
  const [projectInfo, setProjectInfo] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [suggestions, setSuggestions] = useState([]);  //Tanmey added
  const [chatId, setChatId] = useState(null); // ✅ NEW: Track chat_id for history
  const chatEndRef = useRef(null);
  const chatContainerRef = useRef(null);
  // // udit start
  const prevProjectIdRef = useRef(projectId);
  const prevChatHistoryRef = useRef(chatHistory);
  // // udit end

  const context = useContext(MyContext);
  const userEmail = context.userEmail;
  const userName = context.userName || "User";
  // // udit start
  const [isAtBottom, setIsAtBottom] = useState(true); // true = show up arrow, false = show down arrow
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState(null);

  // Clear error function
  const clearError = () => {
    setHistoryError(null);
    // Retry loading history for current project
    loadProjectChatHistory(projectId);
  };

  // Load project-specific chat history from localStorage
  const loadProjectChatHistory = (activeProjectId) => {
    setIsHistoryLoading(true);
    setHistoryError(null);

    try {
      const historyKey = `chatHistory_project_${activeProjectId}`;
      console.log('🔄 Loading chat history for project:', activeProjectId, 'with key:', historyKey);

      const savedHistory = localStorage.getItem(historyKey);
      console.log('📦 Raw localStorage data:', savedHistory ? `Found ${savedHistory.length} chars` : 'No data found');

      if (savedHistory) {
        const parsedHistory = JSON.parse(savedHistory);
        console.log('📋 Parsed history:', parsedHistory);

        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          // // udit start
          // CRITICAL: Set chat history and log the result
          setChatHistory(parsedHistory);
          console.log('✅ SET chatHistory state with', parsedHistory.length, 'sessions for project:', activeProjectId);
          console.log('✅ Sessions loaded:', parsedHistory.map(s => ({ id: s.sessionId, messages: s.messageCount })));

          // Verify the state was actually set
          setTimeout(() => {
            console.log('🔍 Verification: chatHistory state should now have', parsedHistory.length, 'sessions');
          }, 100);
          // // udit end
        } else if (Array.isArray(parsedHistory) && parsedHistory.length === 0) {
          console.log('📭 Empty history array for project:', activeProjectId);
          setChatHistory([]);
        } else {
          console.warn('⚠️ Invalid history format for project:', activeProjectId);
          // // udit start
          // Don't clear history if format is invalid, keep current state
          console.log('⚠️ Keeping current chatHistory state instead of clearing');
          // // udit end
        }
      } else {
        console.log('📭 No chat history found for project:', activeProjectId);
        // // udit start
        // Only clear if we're sure there's no data (not just a load error)
        setChatHistory([]);
        // // udit end
      }
    } catch (error) {
      console.error('❌ Failed to load chat history for project:', activeProjectId, error);
      setHistoryError(error);
      // // udit start
      // Don't clear history on error, keep current state
      console.log('⚠️ Keeping current chatHistory state due to error');
      // // udit end
    } finally {
      setIsHistoryLoading(false);
    }
  };

  // // udit start
  // Safe project switch - saves current before loading new
  const switchToProject = (newProjectId, newProjectName) => {
    // Save current active session to history first (if there is one)
    if (projectId && projectId !== newProjectId && sessionActive && currentSessionId && workMessages.length > 1) {
      console.log('💾 Saving current ACTIVE session to history before project switch');

      // Create session data for current active session
      const currentSessionData = {
        id: currentSessionId,
        sessionId: currentSessionId,
        chatType: 'project',
        projectId: projectId,
        projectName: projectName,
        summary: workMessages.find(msg => msg.role === 'user')?.content || 'Chat Session',
        fullChat: workMessages,
        timestamp: new Date().toISOString(),
        sessionName: `${projectName} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        messageCount: workMessages.length,
        chatId: chatId
      };

      // Add current session to chatHistory and save
      const updatedHistory = [currentSessionData, ...chatHistory];
      saveProjectChatHistory(projectId, updatedHistory);
      setChatHistory(updatedHistory);
    } else if (projectId && projectId !== newProjectId && chatHistory.length > 0) {
      // Save existing chat history if no active session
      console.log('💾 Saving existing project history before switch:', projectId, 'sessions:', chatHistory.length);
      saveProjectChatHistory(projectId, chatHistory);
    }

    // Then load new project's history
    console.log('🔄 Switching to project:', newProjectId);
    setProjectId(newProjectId);
    setProjectName(newProjectName);
    loadProjectChatHistory(newProjectId);
  };

  // Debug function to check all project histories in localStorage
  const debugAllProjectHistories = () => {
    console.log('🔍 DEBUG: All project histories in localStorage:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('chatHistory_project_')) {
        const data = localStorage.getItem(key);
        const parsed = data ? JSON.parse(data) : null;
        console.log(`  ${key}: ${parsed ? parsed.length : 0} sessions`);
      }
    }
  };

  // Verify localStorage integrity - check if data exists
  const verifyProjectHistory = (projectIdToCheck) => {
    const historyKey = `chatHistory_project_${projectIdToCheck}`;
    const data = localStorage.getItem(historyKey);
    console.log(`🔍 Verify project ${projectIdToCheck}:`, data ? 'EXISTS' : 'MISSING');
    if (data) {
      const parsed = JSON.parse(data);
      console.log(`  Sessions: ${parsed.length}`);
    }
    return data !== null;
  };
  // // udit end

  // Save project-specific chat history to localStorage
  const saveProjectChatHistory = (activeProjectId, history) => {
    try {
      const historyKey = `chatHistory_project_${activeProjectId}`;

      // // udit start
      // CRITICAL: Don't save if history is empty and there's existing data
      if (!history || history.length === 0) {
        const existingData = localStorage.getItem(historyKey);
        if (existingData) {
          console.log('⚠️ PREVENTED saving empty history over existing data for project:', activeProjectId);
          return; // Don't overwrite existing data with empty array
        }
      }
      // // udit end

      localStorage.setItem(historyKey, JSON.stringify(history));
      console.log('💾 Saved chat history for project:', activeProjectId, 'sessions:', history.length);
      console.log('💾 Storage key used:', historyKey);
      console.log('💾 Data saved:', history);
    } catch (error) {
      console.error('❌ Failed to save chat history for project:', activeProjectId, error);
    }
  };
  // // udit end

  const location = useLocation();

  // // udit start
  // Detect project changes and load appropriate chat history
  useEffect(() => {
    console.log('🔄 Project change detected. Current projectId:', projectId);

    // Save previous project's history before loading new one
    if (prevProjectIdRef.current && prevProjectIdRef.current !== projectId && prevChatHistoryRef.current.length > 0) {
      const prevHistoryKey = `chatHistory_project_${prevProjectIdRef.current}`;
      localStorage.setItem(prevHistoryKey, JSON.stringify(prevChatHistoryRef.current));
      console.log('💾 Saved PREVIOUS project history:', prevProjectIdRef.current, 'sessions:', prevChatHistoryRef.current.length);
    }

    // Update refs
    prevProjectIdRef.current = projectId;

    // Load new project's history
    if (projectId) {
      loadProjectChatHistory(projectId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Initial load of chat history when component mounts
  useEffect(() => {
    if (projectId) {
      loadProjectChatHistory(projectId);
      // // udit start
      // Debug: Show all project histories
      debugAllProjectHistories();
      // // udit end
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save chat history whenever it changes for the current project
  useEffect(() => {
    // Update ref
    prevChatHistoryRef.current = chatHistory;

    // // udit start
    // DISABLED: Auto-save functionality removed - chat history now only saved during project switches
    console.log('📊 chatHistory changed. Length:', chatHistory.length, 'Project:', projectId);
    console.log('⚠️ Auto-save DISABLED - history will only be saved during project switches');
    // // udit end
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatHistory, projectId]);

  // Save current project's history before component unmounts
  useEffect(() => {
    return () => {
      if (projectId) {
        let historyToSave = [...chatHistory];

        // Add current active session to history if it exists
        if (sessionActive && currentSessionId && workMessages.length > 1) {
          console.log('💾 Component unmounting - saving current ACTIVE session:', currentSessionId);

          const currentSessionData = {
            id: currentSessionId,
            sessionId: currentSessionId,
            chatType: 'project',
            projectId: projectId,
            projectName: projectName,
            summary: workMessages.find(msg => msg.role === 'user')?.content || 'Chat Session',
            fullChat: workMessages,
            timestamp: new Date().toISOString(),
            sessionName: `${projectName} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            messageCount: workMessages.length,
            chatId: chatId
          };

          historyToSave = [currentSessionData, ...chatHistory];
        }

        if (historyToSave.length > 0) {
          console.log('💾 Component unmounting - saving project history:', projectId, 'sessions:', historyToSave.length);
          const historyKey = `chatHistory_project_${projectId}`;
          localStorage.setItem(historyKey, JSON.stringify(historyToSave));
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chatHistory, sessionActive, currentSessionId, workMessages, projectName, chatId]);

  // Save current project's history when window is about to close/refresh
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (projectId) {
        let historyToSave = [...chatHistory];

        // Add current active session to history if it exists
        if (sessionActive && currentSessionId && workMessages.length > 1) {
          console.log('💾 Page unloading - saving current ACTIVE session:', currentSessionId);

          const currentSessionData = {
            id: currentSessionId,
            sessionId: currentSessionId,
            chatType: 'project',
            projectId: projectId,
            projectName: projectName,
            summary: workMessages.find(msg => msg.role === 'user')?.content || 'Chat Session',
            fullChat: workMessages,
            timestamp: new Date().toISOString(),
            sessionName: `${projectName} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
            messageCount: workMessages.length,
            chatId: chatId
          };

          historyToSave = [currentSessionData, ...chatHistory];
        }

        if (historyToSave.length > 0) {
          console.log('💾 Page unloading - saving project history:', projectId, 'sessions:', historyToSave.length);
          const historyKey = `chatHistory_project_${projectId}`;
          localStorage.setItem(historyKey, JSON.stringify(historyToSave));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, chatHistory, sessionActive, currentSessionId, workMessages, projectName, chatId]);
  // // udit end


  // ✅ Always set session on mount (fixes "login first" issue)
  useEffect(() => {
    const setSession = async () => {
      if (!userEmail) return;
      try {
        //  await fetch("https://krishnathummae17-debug-chatbot.hf.space/set_session"
        await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/set_session", {
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

  // ✅ Pick project info from router state (Dashboard -> WorkChat)
  useEffect(() => {
    if (location.state?.projectId) {
      const newProjectId = location.state.projectId;

      // // udit start
      console.log('🔄 ===== PROJECT SWITCH INITIATED =====');
      console.log('🔄 From:', projectId, 'To:', newProjectId);

      // Verify current project data exists BEFORE switch
      if (projectId) {
        console.log('🔍 BEFORE SWITCH - Verifying current project data:');
        verifyProjectHistory(projectId);
        debugAllProjectHistories();
      }

      // CRITICAL: Save current active session to history BEFORE switching projects
      if (projectId && projectId !== newProjectId && sessionActive && currentSessionId && workMessages.length > 1) {
        console.log('💾 Saving current ACTIVE session to history before project switch');

        // Create session data for current active session
        const currentSessionData = {
          id: currentSessionId,
          sessionId: currentSessionId,
          chatType: 'project',
          projectId: projectId,
          projectName: projectName,
          summary: workMessages.find(msg => msg.role === 'user')?.content || 'Chat Session',
          fullChat: workMessages,
          timestamp: new Date().toISOString(),
          sessionName: `${projectName} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
          messageCount: workMessages.length,
          chatId: chatId
        };

        // Add current session to chatHistory
        const updatedHistory = [currentSessionData, ...chatHistory];

        // Save to localStorage
        const currentHistoryKey = `chatHistory_project_${projectId}`;
        localStorage.setItem(currentHistoryKey, JSON.stringify(updatedHistory));
        console.log('💾 SAVED current active session to history:', currentSessionId, 'total sessions:', updatedHistory.length);

        // Update chatHistory state for consistency
        setChatHistory(updatedHistory);
      }

      // CRITICAL: Save existing chatHistory BEFORE any state changes
      if (projectId && projectId !== newProjectId && chatHistory.length > 0) {
        const currentHistoryKey = `chatHistory_project_${projectId}`;
        const dataToSave = JSON.stringify(chatHistory);
        localStorage.setItem(currentHistoryKey, dataToSave);
        console.log('💾 SAVED existing project history BEFORE switch:', projectId, 'sessions:', chatHistory.length);
        console.log('💾 Saved to key:', currentHistoryKey);

        // Verify the save worked
        const verifyData = localStorage.getItem(currentHistoryKey);
        console.log('✅ VERIFY SAVE:', verifyData ? 'SUCCESS' : 'FAILED');
      }

      console.log('🔍 AFTER SAVE - Verifying all project data:');
      debugAllProjectHistories();
      // // udit end

      setProjectId(newProjectId);
      setProjectName(location.state.projectName || 'Unnamed Project');

      // ✅ Restore last used chat_id for this project
      const cachedChatId = localStorage.getItem(`chat_id_${newProjectId}`);
      if (cachedChatId) setChatId(cachedChatId);

      setWorkMessages([
        {
          id: `project-intro-${newProjectId}`,
          role: 'assistant',
          content: `Hello! I'm your Project Chat Assistant for ${location.state.projectName || 'Unnamed Project'}.`
        }
      ]);


      // // udit start
      // IMPORTANT: Reset session state for new project
      // Each project should have its own session context
      setCurrentSessionId(null); // Clear session so new project gets new session
      setSessionActive(false);
      setChatId(cachedChatId || null); // Restore project-specific chat_id

      console.log('🔄 Session reset for new project:', newProjectId);
      console.log('🔄 Previous session cleared, will create new session on first message');

      // Load chat history for the new project immediately
      console.log('🔄 Loading chat history for project:', newProjectId);
      loadProjectChatHistory(newProjectId);

      // // udit start
      // IMPORTANT: Always start fresh conversation when switching projects
      // Previous conversations are saved to history panel, but chat always starts fresh
      console.log('🆕 Starting fresh conversation for project:', newProjectId);
      console.log('� Previous conversations will be available in history panel');
      // // udit end

      // Verify after load
      setTimeout(() => {
        console.log('🔍 AFTER LOAD - Verifying all project data:');
        debugAllProjectHistories();
        console.log('🔄 ===== PROJECT SWITCH COMPLETED =====');
      }, 500);
      // // udit end
    }
  }, [location.state]);

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

  // ✅ Check screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // ✅ Dark mode detection
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.body.classList.contains('dark'));
    };
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ✅ Auto-scroll to bottom on message update
  useEffect(() => {
    if (chatContainerRef.current) {
      const chatContainer = chatContainerRef.current;
      const scrollHeight = chatContainer.scrollHeight;
      const clientHeight = chatContainer.clientHeight;
      if (scrollHeight > clientHeight) {
        setTimeout(() => {
          chatContainer.scrollTo({ top: scrollHeight, behavior: 'smooth' });
        }, 100);
      }
    }
  }, [workMessages]);


  // // udit start
  // NEW LOGIC: Detect scroll position to update button state
  useEffect(() => {
    const chatBox = chatContainerRef.current;
    if (!chatBox) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = chatBox;
      const distanceFromTop = scrollTop;
      const distanceFromBottom = scrollHeight - scrollTop - clientHeight;

      console.log('📍 Scroll Detection (WorkChat):');
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
    console.log('🔄 Initial scroll check on mount (WorkChat)');
    handleScroll();

    chatBox.addEventListener('scroll', handleScroll);

    // Re-check on window resize
    window.addEventListener('resize', handleScroll);

    return () => {
      chatBox.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleScroll);
    };
  }, []);
  // // udit end


  // Storage keys for both project and unified chat history
  const storageKey = `chatHistory_project_${projectId}`;
  const unifiedStorageKey = userEmail
    ? `unified_chatHistory_${userEmail}`
    : 'unified_chatHistory_guest';
  const dualChatKey = userEmail
    ? `chatHistory_dual_${userEmail}`
    : 'chatHistory_dual_guest';

  // Load and sync DualChat messages
  useEffect(() => {
    const loadDualChatMessages = () => {
      try {
        const dualChatData = localStorage.getItem(dualChatKey);
        if (dualChatData) {
          const dualChats = JSON.parse(dualChatData);
          if (Array.isArray(dualChats) && dualChats.length > 0) {
            // Merge with existing chat history, avoiding duplicates
            setChatHistory(prev => {
              const existingIds = new Set(prev.map(chat => chat.id));
              const newChats = dualChats.filter(chat => !existingIds.has(chat.id));
              return [...newChats, ...prev];
            });
          }
        }
      } catch (error) {
        console.error('Failed to load DualChat messages:', error);
      }
    };

    // Initial load
    loadDualChatMessages();

    // Listen for storage events from DualChat
    const handleStorageChange = (e) => {
      if (e.key === dualChatKey) {
        loadDualChatMessages();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [dualChatKey]);

  // // udit start
  // NEW LOGIC: Enhanced unified storage synchronization for WorkChat
  // Save project-specific chat history to both project storage and unified storage
  // This ensures DualChatbot can access all WorkChat project histories
  useEffect(() => {
    if (chatHistory.length > 0) {
      try {
        // Only save project-specific chats to project storage
        const projectChats = chatHistory.filter(chat => chat?.chatType === 'project');
        if (projectChats.length > 0) {
          localStorage.setItem(storageKey, JSON.stringify(projectChats));
          console.log('💾 Saved project chats to project storage:', storageKey, projectChats.length, 'sessions');
        }
        // Save all chats to unified storage
        localStorage.setItem(unifiedStorageKey, JSON.stringify(chatHistory));
        console.log('💾 Saved all chats to unified storage:', unifiedStorageKey, chatHistory.length, 'sessions');

        // Dispatch custom event to notify DualChatbot of updates
        window.dispatchEvent(new CustomEvent('projectChatUpdated', {
          detail: { projectId, projectName, sessionCount: chatHistory.length }
        }));
      } catch (error) {
        console.error('Failed to save chat history:', error);
      }
    }
  }, [chatHistory, storageKey, unifiedStorageKey, projectId, projectName]);

  // Sync unified history to localStorage with deduplication
  // Merges existing unified storage with current chat history to prevent data loss
  useEffect(() => {
    try {
      const existingUnifiedRaw = localStorage.getItem(unifiedStorageKey);
      const existingUnified = existingUnifiedRaw ? JSON.parse(existingUnifiedRaw) : [];
      const mapById = new Map();

      // Add existing sessions to map
      if (Array.isArray(existingUnified)) {
        for (const item of existingUnified) {
          if (item?.id != null) mapById.set(item.id, item);
        }
      }

      // Add/update current sessions to map (overwrites if ID exists)
      if (Array.isArray(chatHistory)) {
        for (const item of chatHistory) {
          if (item?.id != null) mapById.set(item.id, item);
        }
      }

      const merged = Array.from(mapById.values());
      localStorage.setItem(unifiedStorageKey, JSON.stringify(merged));

      // Dispatch event to notify other components
      if (chatHistory.length > 0) {
        window.dispatchEvent(new Event('unifiedChatHistoryUpdated'));
      }
    } catch (e) {
      console.error('Failed to sync unified chat history:', e);
    }
  }, [chatHistory, unifiedStorageKey]);
  // // udit END 
  // // udit start
  // REMOVED: Duplicate save logic - already handled in auto-save useEffect above
  // REMOVED: Duplicate unified sync useEffect - already exists above (line ~570)
  // REMOVED: Old conflicting useEffects that were overwriting project-specific history
  // These were causing the chat history to be erased when switching projects
  // All history loading is now handled by loadProjectChatHistory() function
  // // udit end

  // ✅ Backend project fetch (only if no project is passed from dashboard)
  useEffect(() => {
    if (location.state?.projectId) return; // ✅ skip if project came from Dashboard
    const fetchProject = async () => {
      if (!userEmail) return;
      try {
        const projectResponse = await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/projects/get_user_project", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": "Bearer webugmate123" },
          credentials: "include",
          body: JSON.stringify({ email: userEmail })
        });
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.project_id) {
            const newProjectId = projectData.project_id;
            const newProjectName = projectData.project_name || 'Unknown Project';
            setProjectId(newProjectId);
            setProjectName(newProjectName);
            setProjectInfo(projectData.full_project_info || null);
            // // udit start
            // IMPORTANT: Always start fresh conversation for each project
            // Previous conversations are saved in history, but chat always starts fresh
            console.log('🆕 Starting fresh conversation for project:', newProjectId);
            setWorkMessages([
              {
                id: `project-intro-${newProjectId}`,
                role: 'assistant',
                content: `Hello! I'm your Project Chat Assistant for ${newProjectName}.`
              }
            ]);
            setCurrentSessionId(null);
            setChatId(null);
            setSessionActive(false);
            console.log('📜 Previous conversations will be available in history panel');
            // // udit end

            setSessionActive(false);
            setCurrentSessionId(null);
          }
        }
      } catch (error) {
        console.error("❌ Failed to fetch project:", error);
      }
    };
    fetchProject();
  }, [userEmail, userName, location.state]);

  // ✅ Send message & save session with project info
  //  const sendMessage = async () => {
  //   if (inputText.trim() === '') return;

  //   const newMessage = { role: 'user', content: inputText };
  //   setInputText('');
  //   setIsTyping(true);

  //   let sessionId = currentSessionId;
  //   if (!sessionId) {
  //     sessionId = Date.now();
  //     setCurrentSessionId(sessionId);
  //   }

  //   try {
  //     const response = await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/work", {
  //       method: "POST",
  //       headers: { "Content-Type": "application/json" },
  //       credentials: "include",
  //       body: JSON.stringify({
  //         message: newMessage.content,
  //         chat_type: 'project',
  //         project_id: projectId
  //       }),
  //     });

  //     const data = await response.json();
  //     const botReply = { role: 'assistant', content: data.reply || "⚠ No reply from server" };

  //     // ✅ Use updated messages array
  //     const updatedMessages = [...workMessages, newMessage, botReply];
  //     setWorkMessages(updatedMessages);
  //     setIsTyping(false);
  //     setSessionActive(true);

  //     // ✅ Save to chatHistory
  //     setChatHistory(prev => {
  //       const existing = prev.find(chat => chat.sessionId === sessionId);
  //       if (existing) {
  //         // update existing session
  //         return prev.map(chat =>
  //           chat.sessionId === sessionId
  //             ? { 
  //                 ...chat,
  //                 fullChat: updatedMessages,
  //                 timestamp: new Date().toISOString(),
  //                 messageCount: updatedMessages.length
  //               }
  //             : chat
  //         );
  //       } else {
  //         // create new session
  //         return [
  //           ...prev,
  //           {
  //             id: sessionId,
  //             sessionId: sessionId,
  //             chatType: 'project',
  //             projectId: projectId,
  //             projectName: projectName,
  //             summary: newMessage.content,
  //             fullChat: updatedMessages,
  //             timestamp: new Date().toISOString(),
  //             sessionName: `${projectName} - ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
  //             messageCount: updatedMessages.length
  //           }
  //         ];
  //       }
  //     });

  //   } catch (error) {
  //     console.error("❌ Chat request failed:", error);
  //     setWorkMessages(prev => [...prev, { role: 'assistant', content: 'Error connecting to chatbot.' }]);
  //     setIsTyping(false);
  //   }
  // };
  // // udit start
  // Re-enabled: Load fresh messages for each project
  // This ensures each project switch starts with a clean slate
  useEffect(() => {
    if (!projectId) return;

    // Always start fresh - don't load previous messages
    console.log('🆕 Project changed to:', projectId, '- starting fresh conversation');
  }, [projectId]);
  // // udit end

  // // udit start
  // Re-enabled: Save current conversation state
  // This helps maintain conversation state during the current session
  useEffect(() => {
    if (projectId && workMessages.length > 0) {
      // Save current conversation state (but don't restore it on project switch)
      localStorage.setItem(
        `workMessages_current_${projectId}`,
        JSON.stringify(workMessages)
      );
      console.log('💾 Saved current conversation state for project:', projectId);
    }
  }, [workMessages, projectId]);
  // // udit end

  // const sendMessage = async () => {
  //   if (!inputText.trim()) return;
  const sendMessage = async (altText = null, payload_index = null) => { //Tanmey Start
    // If altText is an event object (from onClick), treat it as null
    const textToSend = (typeof altText === 'string') ? altText : inputText;

    if (!textToSend || !textToSend.trim()) return; //Tanmey End

    const newMessage = {
      id: generateCustomUUID(),
      role: 'user',
      content: textToSend //Tanmey Added
    };
    // setInputText('');
    if (typeof altText !== 'string') setInputText(''); //Tanmey added

    // Append user message immediately
    const updatedMessages = [...workMessages, newMessage];
    setWorkMessages(updatedMessages);

    // // udit start
    // Create session ID for current chat session (but don't save to history yet)
    let sessionId = currentSessionId;
    if (!sessionId) {
      // Create project-specific session ID
      sessionId = `${projectId}_${Date.now()}`;
      setCurrentSessionId(sessionId);
      console.log('🆕 Created new session ID:', sessionId, 'for project:', projectId);
    }
    setSessionActive(true);

    console.log('💬 Message sent - session active but not saved to history yet');
    // // udit end

    setIsTyping(true);
    setSuggestions([]); //Tanmey added

    try {
      const response = await fetch("https://zeelsheta-webugmate-backend-pr-2-1.hf.space/chat/work", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer webugmate123",
          "user_email": userEmail || "dev_user@example.com"
        },
        credentials: "include",
        body: JSON.stringify({
          message: newMessage.content,
          chat_type: 'project',
          project_id: projectId,
          chat_id: chatId // ✅ NEW: Send existing chat_id
        })
      });
      const data = await response.json();

      // ✅ NEW: Update chat_id from response if it changed
      if (data.chat_id && data.chat_id !== chatId) {
        setChatId(data.chat_id);
        localStorage.setItem(`chat_id_${projectId}`, data.chat_id);
      }
      const botReply = {
        id: data.message_ids?.assistant || data.message_id || generateCustomUUID(),
        role: 'assistant',
        content: data.reply || "⚠ No reply from server"
      };

      const newUpdatedMessages = [...updatedMessages, botReply];
      setWorkMessages(newUpdatedMessages);
      //Tanmey Start
      if (data.multi_clarification) {
        setSuggestions(data.clarifications || []);
      }
      //Tanmey End

      // //udit start
      // Don't save to chat history immediately - only update current session in memory
      console.log('💬 Bot reply received - session updated in memory only');
      // // udit end

      // // Update chatHistory with bot reply
      // setChatHistory(prev =>
      //   prev.map(chat =>
      //     chat.sessionId === sessionId
      //       ? {
      //         ...chat,
      //         fullChat: newUpdatedMessages,
      //         timestamp: new Date().toISOString(),
      //         messageCount: newUpdatedMessages.length,
      //         chatId: data.chat_id || chatId // ✅ Keep track of chat_id in history
      //       }
      //       : chat
      //   )
      // );

      setIsTyping(false);

    } catch (error) {
      console.error("❌ Chat request failed:", error);
      setWorkMessages(prev => [...prev, {
        id: generateCustomUUID(),
        role: 'assistant',
        content: 'Error connecting to chatbot.'
      }]);
      setIsTyping(false);
    } finally {   //Tanmey added
      setIsTyping(false);
    }
  };
  //Tanmey Start
  const handleSuggestionClick = (suggestion, index) => {
    // Don't set input text - just send the message directly
    // The message will appear in the chat display as a user message
    sendMessage(suggestion, index);
  }; //Tanmey End


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




  const handleKeyDown = (e) => { if (e.key === 'Enter') sendMessage(); };
  // //udit start
  // NEW LOGIC: Toggle scroll function - scrolls up or down based on current position
  const handleScrollToggle = () => {
    const chatBox = chatContainerRef.current;
    console.log('=== SCROLL BUTTON CLICKED (WorkChat) ===');
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
  // // udit end

  const handleHistoryClick = (chat) => {
    // // udit start
    console.log('🔄 Restoring chat session:', chat.sessionId, 'for project:', chat.projectId);
    setWorkMessages(chat.fullChat);
    setCurrentSessionId(chat.sessionId);
    setChatId(chat.chatId || null); // ✅ Restore chat_id from history
    setSessionActive(true);

    // Ensure we're on the correct project context
    if (chat.projectId && chat.projectId !== projectId) {
      setProjectId(chat.projectId);
      setProjectName(chat.projectName || 'Default Project');
    }
    // // udit end
  };
  // //udit start
  // Enhanced handleHistoryDelete for project-specific storage
  const handleHistoryDelete = (id) => {
    setChatHistory(prev => prev.filter(chat => chat.id !== id));

    // Also remove from project-specific localStorage immediately
    const updatedHistory = chatHistory.filter(chat => chat.id !== id);
    saveProjectChatHistory(projectId, updatedHistory);

    console.log('🗑️ Deleted session from project:', projectId, 'session id:', id);
  };
  // // udit end

  // const handleHistoryDelete = (id) => {
  //   setChatHistory(prev => prev.filter(chat => chat.id !== id));
  //   try {
  //     const existingUnifiedRaw = localStorage.getItem(unifiedStorageKey);
  //     const existingUnified = existingUnifiedRaw ? JSON.parse(existingUnifiedRaw) : [];
  //     if (Array.isArray(existingUnified)) {
  //       const updatedUnified = existingUnified.filter(chat => chat && chat.id !== id);
  //       localStorage.setItem(unifiedStorageKey, JSON.stringify(updatedUnified));
  //     }
  //     const existingProjectRaw = localStorage.getItem(storageKey);
  //     const existingProject = existingProjectRaw ? JSON.parse(existingProjectRaw) : [];
  //     if (Array.isArray(existingProject)) {
  //       const updatedProject = existingProject.filter(chat => chat && chat.id !== id);
  //       localStorage.setItem(storageKey, JSON.stringify(updatedProject));
  //     }
  //   } catch (e) {
  //     console.error('Failed to remove from unified chat history:', e);
  //   }
  // };

  return (
    <div className="work-layout">
      {/* Main Chat Area */}
      <div className={`work-container${historyOpen ? ' with-history' : ' full-width'}`}>
        <Card className="work-card">
          <Card.Header className="d-flex align-items-center">
            <FaComments className="me-2" />
            <span>Project Chat</span>
          </Card.Header>

          <div className="work-banner">
            <strong>{projectName}</strong>
          </div>

          {/* <Card.Body className="work-history" ref={chatContainerRef}>
            {workMessages.map((msg, idx) => (
              <div
                key={msg.id || idx}
                className={`work-bubble ${msg.role}`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
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
          <Card.Body className="work-history" ref={chatContainerRef}>
            {workMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`work-bubble ${msg.role}`}
                style={{ animationDelay: `${idx * 0.1}s` }}
              >
                {/* ✅ UPDATED: allows HTML tables to render */}
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
            {/*Tanmey added */}
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

          {/* // //udit start */}
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
          {/* // udit END */}
          <Card.Footer>
            <div className="work-input-area">
              <div className="input-wrapper">

                <input
                  type="text"
                  placeholder="Ask project-related questions..."
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
          <h3>Project Chat History</h3>
          {/* // udit start */}
          {isHistoryLoading && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              Loading history for {projectName}...
            </div>
          )}
          {historyError && (
            <div style={{ fontSize: '12px', color: '#e74c3c', marginTop: '4px' }}>
              Error loading history
              <button
                onClick={clearError}
                style={{
                  marginLeft: '8px',
                  background: 'none',
                  border: 'none',
                  color: '#e74c3c',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                Retry
              </button>
            </div>
          )}
          {/* // udit end */}
        </div>
        <div className="work-history-list">
          {chatHistory.length === 0 ? (
            <p className="empty-history">
              {/* // udit start */}
              {isHistoryLoading ? 'Loading sessions...' : `No previous sessions for ${projectName}`}
              {/* // udit end */}
            </p>
          ) : (
            // // udit start - Filter to show only chats for current project
            chatHistory
              .filter(chat => chat.projectId === projectId)
              .map((chat) => (
                // // udit end
                <div
                  key={chat.id}
                  className={`work-history-item${workMessages === chat.fullChat ? ' selected' : ''}`}
                  onClick={() => handleHistoryClick(chat)}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <div className="work-history-type-badge">{chat.projectName || 'Project'}</div>
                      <button
                        className="work-history-delete-btn"
                        onClick={e => { e.stopPropagation(); handleHistoryDelete(chat.id); }}
                      >
                        ✕
                      </button>
                    </div>
                    <div className="work-history-summary" style={{ margin: '8px 0', color: '#444' }}>
                      {chat.summary && chat.summary.length > 80 ? `${chat.summary.substring(0, 80)}...` : chat.summary}
                    </div>
                    <div className="work-history-meta">
                      {chat.messageCount && (
                        <small style={{ display: 'inline-block', color: '#666', fontSize: '10px', marginRight: '10px' }}>
                          {chat.messageCount} messages
                        </small>
                      )}
                      {chat.timestamp && (
                        <small style={{ color: '#666', fontSize: '10px' }}>
                          {new Date(chat.timestamp).toLocaleString()}
                        </small>
                      )}
                    </div>
                  </div>
                </div>
              ))
          )}
        </div>
      </div>

      {/* History Toggle Button */}
      <button className="work-history-toggle-btn" onClick={() => setHistoryOpen(prev => !prev)}>
        {historyOpen ? '→' : '←'}
      </button>
    </div>
  );
};

export default WorkChat;