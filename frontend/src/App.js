// App.js
import React, { useState, useEffect, createContext } from 'react';
import './App.css';
import Header from './component/header';
import MobileSidebar from './component/MobileSidebar';
import "bootstrap/dist/css/bootstrap.min.css";
import Communication from './pages/chatbot/Communication';
import Dashboard from './pages/Dashboard';
import Feedback from './pages/chatbot/feedback';
import ChooseRole from './pages/Role-management/chooserole';
import CreateMail from './pages/Role-management/createmail.js';

import ChatbotIcon from './component/ChatbotIcon';
import SignIn from './pages/Signin';
import EmployeeProjectForm from './pages/project/project_info.js';
import ApiManagement from './pages/Api_managment/Api_managment.js';
import Overview from './pages/Overview/Overview.js';
import Organization from './pages/Organization/Organization';
import Setting from './pages/Setting/setting.js';
import ProjectDetailsTable from './pages/project/ProjectDetailsTable';
import ProjectDetails from './pages/project/ProjectDetails';
import WorkChat from './pages/chatbot/WorkChat.js';
import DeveloperChat from './pages/chatbot/DeveloperChat';
import DualChatbot from './pages/chatbot/DualChatbot';
import ProtectedRoute from './component/ProtectedRoute';
import AuthenticatedRoute from './component/AuthenticatedRoute';
import ChatPage from './pages/project/chatpage.js';
import Announcements from './pages/Announcements';
import Broadcasts from './pages/Broadcasts';
import { MessagesProvider } from './contexts/messagecontext.js';

import { HashRouter as Router, useLocation, Routes, Route } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const MyContext = createContext();

// Component to conditionally render ChatbotIcon
const ConditionalChatbotIcon = () => {
  const location = useLocation();
  const shouldHideIcon = location.pathname === '/communication' ||
    location.pathname === '/chatbot/communication' ||
    location.pathname === '/chatbot/dual' ||
    location.pathname === '/chatbot/WorkChat' ||
    location.pathname === '/signin' ||
    location.pathname === '/';

  return shouldHideIcon ? null : <ChatbotIcon />;
};

function App() {
  const [istoggleSidebar, setIstoggleSidebar] = useState(false);
  const [isSignIn, setIsSignIn] = useState(false);
  const [ishideSidebar, setIshideSidebar] = useState(false);
  const [username, setUsername] = useState('');
  const [userId, setUserId] = useState(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPhotoURL, setUserPhotoURL] = useState('');

  const [userRole, setUserRole] = useState('Guest'); // 'Admin'/'Manager'/'Employee'
  const [userPermissions, setUserPermissions] = useState({});

  // ✅ Login persistence
  useEffect(() => {
    let savedUser = sessionStorage.getItem("authUser");
    if (!savedUser) {
      savedUser = localStorage.getItem("authUser");
      if (savedUser) {
        // Restore to session storage for consistency
        sessionStorage.setItem("authUser", savedUser);
      }
    }

    if (savedUser) {
      try {
        const userData = JSON.parse(savedUser);
        setIsSignIn(true);
        setUsername(userData.name);
        setUserId(userData.id || null);
        setUserEmail(userData.email);

        // Set photo URL if available, otherwise use default avatar
        if (userData.photoURL) {
          setUserPhotoURL(userData.photoURL);
        } else {
          // Fallback to default avatar based on user's name/email
          const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.name || userData.email || 'U')}&background=random`;
          setUserPhotoURL(defaultAvatar);
        }

        setUserRole(userData.role || 'Employee');
        setUserPermissions(userData.permissions || {});
      } catch (error) {
        console.error('Error parsing saved user data:', error);
        // Clear invalid session data
        sessionStorage.removeItem('authUser');
      }
    }
  }, []);

  useEffect(() => {
    document.body.classList.remove('dark');
    document.body.classList.add('light');
    try { localStorage.removeItem('theme'); } catch (_) { }
  }, []);

  const values = React.useMemo(() => ({
    istoggleSidebar,
    setIstoggleSidebar,
    isSignIn,
    setIsSignIn,
    ishideSidebar,
    setIshideSidebar,
    // Light theme only: no theme toggling
    username,
    setUsername,
    userId,
    setUserId,
    userEmail,
    setUserEmail,
    userPhotoURL,
    setUserPhotoURL,
    userRole,
    setUserRole,
    userPermissions,
    setUserPermissions,
  }), [
    istoggleSidebar, isSignIn, ishideSidebar, username, userId,
    userEmail, userPhotoURL, userRole, userPermissions
  ]);

  return (
    <Router>
      <MyContext.Provider value={values}>
        {!ishideSidebar && <Header />}
        <div className="main d-flex">


          <div className={`content ${ishideSidebar ? 'full' : ''} ${istoggleSidebar ? 'open' : ''}`}>
            {/* Wrap all routes with MessagesProvider */}
            <MessagesProvider>
              <Routes>
                <Route path="/" element={<SignIn />} />
                <Route path="/signin" element={<SignIn />} />

                {/* Project Form */}
                <Route
                  path="/EmployeeProjectForm"
                  element={
                    <ProtectedRoute requiredPage="Project Form" requiredAction="Insert">
                      <EmployeeProjectForm />
                    </ProtectedRoute>
                  }
                />

                {/* Dashboard - Accessible to all logged-in users, but projects are filtered by RBAC */}
                <Route
                  path="/dashboard"
                  element={
                    <AuthenticatedRoute>
                      <Dashboard />
                    </AuthenticatedRoute>
                  }
                />

                {/* Chat with team - Accessible to all logged-in users */}
                <Route
                  path="/chat/:email"
                  element={
                    <AuthenticatedRoute>
                      <ChatPage />
                    </AuthenticatedRoute>
                  }
                />

                {/* Announcements - Accessible to all logged-in users */}
                <Route
                  path="/announcements"
                  element={
                    <AuthenticatedRoute>
                      <Announcements />
                    </AuthenticatedRoute>
                  }
                />

                {/* Feedback - Accessible to all logged-in users */}
                <Route
                  path="/chatbot/feedback"
                  element={
                    <AuthenticatedRoute>
                      <Feedback />
                    </AuthenticatedRoute>
                  }
                />

                {/* Settings/Profile - Accessible to all logged-in users */}
                <Route
                  path="/setting"
                  element={
                    <AuthenticatedRoute>
                      <Setting />
                    </AuthenticatedRoute>
                  }
                />

                {/* Broadcasts - Accessible to all, projects filtered by RBAC */}
                <Route
                  path="/broadcasts"
                  element={
                    <AuthenticatedRoute>
                      <Broadcasts />
                    </AuthenticatedRoute>
                  }
                />

                {/* Project Details - Accessible to all, but filtered by assigned_to_emails */}
                <Route
                  path="/project/DetailsTable"
                  element={
                    <AuthenticatedRoute>
                      <ProjectDetailsTable />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/project/:id"
                  element={
                    <AuthenticatedRoute>
                      <ProjectDetails />
                    </AuthenticatedRoute>
                  }
                />

                {/* Admin-only pages - Keep permission checks */}
                <Route
                  path="/role-management/chooserole"
                  element={
                    <ProtectedRoute requiredPage="Choose Roles" requiredAction="View">
                      <ChooseRole />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/role-management/createmail"
                  element={
                    <ProtectedRoute requiredPage="Create Mails" requiredAction="View">
                      <CreateMail />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-management"
                  element={
                    <ProtectedRoute requiredPage="API Management" requiredAction="View">
                      <ApiManagement />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/overview"
                  element={
                    <ProtectedRoute requiredPage="Overview" requiredAction="View">
                      <Overview />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/organization"
                  element={
                    <ProtectedRoute requiredPage="Overview" requiredAction="View">
                      <Organization />
                    </ProtectedRoute>
                  }
                />

                {/* Chatbot pages - Accessible to all logged-in users */}
                <Route
                  path="/chatbot"
                  element={
                    <AuthenticatedRoute>
                      <WorkChat />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/chatbot/WorkChat"
                  element={
                    <AuthenticatedRoute>
                      <WorkChat />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/chatbot/communication"
                  element={
                    <AuthenticatedRoute>
                      <Communication />
                    </AuthenticatedRoute>
                  }
                />
                <Route
                  path="/chatbot/dual"
                  element={
                    <AuthenticatedRoute>
                      <DualChatbot />
                    </AuthenticatedRoute>
                  }
                />
              </Routes>

            </MessagesProvider>
          </div>
        </div>
        <MobileSidebar isOpen={istoggleSidebar} onClose={() => setIstoggleSidebar(false)} />
        <ConditionalChatbotIcon />
        <ToastContainer />
      </MyContext.Provider>
    </Router>
  );
}

export default App;
export { MyContext };