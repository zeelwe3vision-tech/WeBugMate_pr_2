import React, { useState, useContext, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import logo from "../../assets/images/WeBugMate.png";
import Button from '@mui/material/Button';
import { MdMenuOpen } from "react-icons/md";
import { MdOutlineMenu } from "react-icons/md";
import 'bootstrap/dist/css/bootstrap.min.css';
import { FaUserCircle } from "react-icons/fa";
import { IoMdInformationCircleOutline } from "react-icons/io";
import { MyContext } from "../../App";
import { databaseService } from '../../services/supabase';

import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import Divider from '@mui/material/Divider';
import PersonAdd from '@mui/icons-material/PersonAdd';
import Settings from '@mui/icons-material/Settings';
import Logout from '@mui/icons-material/Logout';
import Avatar from '@mui/material/Avatar';
import { toast } from 'react-toastify';

const Header = ({ onToggleSidebar }) => {
  const [openMenu, setOpenMenu] = useState(null); // 'chatbot' | 'management' | null
  const navRef = useRef(null);
  const context = useContext(MyContext);
  const navigate = useNavigate();





  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!openMenu) return;
      const n = navRef.current;
      if (n && !n.contains(e.target)) setOpenMenu(null);
    };
    const handleEsc = (e) => {
      if (e.key === 'Escape') setOpenMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [openMenu]);

  const handleLogout = async () => {
    if (context.setIsSignIn) context.setIsSignIn(false);
    if (context.setUsername) context.setUsername('');
    if (context.setUserEmail) context.setUserEmail('');
    if (context.setUserRole) context.setUserRole('Guest');
    if (context.setUserPermissions) context.setUserPermissions({});
    try { sessionStorage.removeItem('authUser'); } catch (_) { }
    try { localStorage.removeItem('authUser'); } catch (_) { }
    // Log employee logout event
    if (context.username && context.username !== '' && context.userEmail) {
      await databaseService.logEmployeeLogout({ email: context.userEmail });
    }

    navigate('/');
  };
  const { userRole, userPermissions } = context;

  const hasAccess = (pageName) => {
    if (userRole === 'Admin') return true;
    if (!pageName) return true;
    if (!userPermissions) return false;
    const pagePerms = userPermissions[pageName];
    if (!pagePerms) return false;
    return pagePerms['All'] || pagePerms['View'];
  };

  const chatbotItems = [
    { label: 'ChatDual', to: '/chatbot/dual', pageName: 'ChatDual' },
    { label: 'Feedback', to: '/chatbot/feedback', pageName: 'Feedback' },
  ].filter(item => hasAccess(item.pageName));

  const managementItems = [
    { label: 'Project Form', to: '/EmployeeProjectForm', pageName: 'Project Form' },
    { label: 'Project Description', to: '/project/DetailsTable', pageName: 'Project Description' },
    { label: 'Manage Emails', to: '/role-management/createmail', pageName: 'Create Mails' },
    { label: 'Manage Roles', to: '/role-management/chooserole', pageName: 'Choose Roles' },
    { label: 'Announcements', to: '/announcements', pageName: 'Announcements' },
    { label: 'Broadcasts', to: '/broadcasts', pageName: 'Communication' },
    // { label: 'Organization', to: '/organization', pageName: 'Overview' },
  ].filter(item => hasAccess(item.pageName));

  return (
    <header className="d-flex align-items-center" style={{ paddingTop: "30px" }}>
      <div className="header-bar header-bar-mobile">
        {/* Left: Logo */}
        <div className="header-left">
          <Link to={"/dashboard"} className="d-flex align-items-center">
            <img src={logo} alt="logo" width={130} style={{ background: 'transparent' }} />
          </Link>
        </div>

        {/* Center: Nav */}
        <nav className="header-center" ref={navRef}>
          <ul className="nav-list">
            <li><Link to="/dashboard" style={{ fontWeight: "100" }}>Dashboard</Link></li>

            {chatbotItems.length > 0 && (
              <li className={`has-dropdown ${openMenu === 'chatbot' ? 'open' : ''}`}>
                <span onClick={() => setOpenMenu(openMenu === 'chatbot' ? null : 'chatbot')} style={{ fontWeight: "100" }}>Chatbot</span>
                <ul className="dropdown">
                  {chatbotItems.map(item => (
                    <li key={item.label}><Link to={item.to} style={{ fontWeight: "100" }} onClick={() => setOpenMenu(null)}>{item.label}</Link></li>
                  ))}
                </ul>
              </li>
            )}

            {managementItems.length > 0 && (
              <li className={`has-dropdown ${openMenu === 'management' ? 'open' : ''}`}>
                <span onClick={() => setOpenMenu(openMenu === 'management' ? null : 'management')} style={{ fontWeight: "100" }}>Management</span>
                <ul className="dropdown">
                  {managementItems.map(item => (
                    <li key={item.label}><Link to={item.to} style={{ fontWeight: "100" }} onClick={() => setOpenMenu(null)}>{item.label}</Link></li>
                  ))}
                </ul>
              </li>
            )}
          </ul>
        </nav>

        {/* Right: Controls */}
        <div className="header-right">
          <div className="d-flex align-items-center gap-2">
            <Button
              className="rounded-circle hamburger-btn"
              onClick={() => {
                if (typeof onToggleSidebar === 'function') {
                  onToggleSidebar(true);
                }
                if (context.setIstoggleSidebar) {
                  context.setIstoggleSidebar(true);
                }
              }}
              aria-label="Open menu"
            >
              <MdOutlineMenu />
            </Button>
            {/* <Button className="rounded-circle menu-btn" onClick={() => context.setIstoggleSidebar(!context.istoggleSidebar)}>
              {context.istoggleSidebar === false ? <MdMenuOpen /> : <MdOutlineMenu />}
            </Button> */}


            {/* Info (Overview) Button */}
            <div className="notification-button-container">
              <Button
                className="rounded-circle notification-button"
                onClick={() => navigate('/Overview')}
                title="Overview"
                sx={{
                  minWidth: 40,
                  width: 40,
                  height: 40,
                  p: 0,
                  color: '#fff',
                  backgroundColor: 'rgba(255,255,255,0.06)',

                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.12)',
                    borderColor: 'rgba(255,255,255,0.45)'
                  }
                }}
              >
                <IoMdInformationCircleOutline />
              </Button>
            </div>
            {
              context.isSignIn !== true ? (
                <Link to={`/signin`}><Button className="signin-btn btn-rounded">Sign In</Button></Link>
              ) : (
                <div className="myacc-wrapper">
                  <div className="d-flex align-items-center myacc">
                    <div className="userImg">
                      <div
                        className="rounded-circle profile"
                        onClick={() => navigate('/setting')}
                        style={{
                          width: '40px',
                          height: '40px',
                          cursor: 'pointer',
                          overflow: 'hidden',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: '50%',
                          border: '1px solid rgba(255,255,255,0.2)'
                        }}
                      >
                        {context.userPhotoURL ? (
                          <img
                            src={context.userPhotoURL}
                            alt={context.username || 'User'}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <FaUserCircle style={{ width: '100%', height: '100%', color: '#fff' }} />
                        )}
                      </div>
                    </div>
                    <div className="userInfo">
                    </div>
                  </div>
                </div>
              )
            }
          </div>
        </div>



      </div>
    </header>
  )
}

export default Header;
