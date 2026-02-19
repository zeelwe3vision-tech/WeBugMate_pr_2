import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MyContext } from '../../App';
import logo from '../../assets/images/WeBugMate.png';
import { MdKeyboardArrowDown } from 'react-icons/md';

const MobileSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const context = useContext(MyContext);
  const [openSection, setOpenSection] = useState(null);

  /* udit start - Added all missing pages to mobile menu */
  const sections = [
    {
      key: 'services',
      label: 'Chatbot',
      items: [
        { label: 'ChatDual', to: '/chatbot/dual' },
        { label: 'Feedback', to: '/chatbot/feedback' },
      ],
    },
    {
      key: 'management',
      label: 'Management',
      items: [
        { label: 'Project Form', to: '/EmployeeProjectForm' },
        { label: 'Project Description', to: '/project/DetailsTable' },
        { label: 'Manage Emails', to: '/role-management/createmail' },
        { label: 'Manage Roles', to: '/role-management/chooserole' },
        { label: 'Announcements', to: '/announcements' },
        { label: 'Broadcasts', to: '/broadcasts' },
        { label: 'Organization', to: '/organization' },
        { label: 'Overview', to: '/Overview' },
      ],
    },
  ];
  /* udit end */

  const handleNavigate = (to) => {
    if (typeof onClose === 'function') onClose();
    navigate(to);
  };

  return (
    <div className={`mobile-sidebar-backdrop ${isOpen ? 'open' : ''}`} onClick={onClose}>
      <aside className={`mobile-sidebar-panel ${isOpen ? 'open' : ''}`} onClick={(e) => e.stopPropagation()}>
        <div className="mobile-sidebar-header">
          <div className="mobile-sidebar-brand">
            <img src={logo} alt="logo" />
          </div>
          <button className="mobile-sidebar-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <nav className="mobile-sidebar-nav">
          <ul className="mobile-nav-list">
            <li className="mobile-nav-item" onClick={() => handleNavigate('/dashboard')}>
              <span className="mobile-nav-label">Dashboard</span>
            </li>


            {sections.map((sec) => (
              <li key={sec.key} className={`mobile-nav-section ${openSection === sec.key ? 'open' : ''}`}>
                <button className="mobile-nav-toggle" onClick={() => setOpenSection(openSection === sec.key ? null : sec.key)}>
                  <span>{sec.label}</span>
                  <MdKeyboardArrowDown className="chevron" />
                </button>
                {openSection === sec.key && (
                  <ul className="mobile-sublist">
                    {sec.items.map((item) => (
                      <li key={item.label}>
                        <button onClick={() => handleNavigate(item.to)}>{item.label}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}

          </ul>
        </nav>

        <div className="mobile-sidebar-footer">
          {context?.isSignIn ? (
            <button className="mobile-sidebar-action" onClick={() => { if (onClose) onClose(); navigate('/setting'); }}>Profile</button>
          ) : (
            <button className="mobile-sidebar-action" onClick={() => { if (onClose) onClose(); navigate('/signin'); }}>Sign In</button>
          )}
        </div>
      </aside>
    </div>
  );
};

export default MobileSidebar;
