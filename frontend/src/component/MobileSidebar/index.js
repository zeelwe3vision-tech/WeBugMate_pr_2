import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MyContext } from '../../App';
import logo from '../../assets/images/WeBugMate.png';
import { MdKeyboardArrowDown } from 'react-icons/md';

const MobileSidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const context = useContext(MyContext);
  const [openSection, setOpenSection] = useState(null);

  const { userRole, userPermissions, isSignIn } = context;

  // Strict page visibility check
  const hasAccess = (pageName) => {
    if (userRole === 'Admin') return true;
    if (!pageName) return true; // Items without a specific pageName are visible to all authenticated users
    if (!userPermissions) return false;
    const pagePerms = userPermissions[pageName];
    if (!pagePerms) return false;
    return pagePerms['All'] || pagePerms['View'];
  };

  /* udit start - Added all missing pages to mobile menu */
  const sectionsConfig = [
    {
      key: 'services',
      label: 'Chatbot',
      items: [
        { label: 'ChatDual', to: '/chatbot/dual', pageName: 'ChatDual' },
        { label: 'Feedback', to: '/chatbot/feedback', pageName: 'Feedback' },
      ],
    },
    {
      key: 'management',
      label: 'Management',
      items: [
        { label: 'Project Form', to: '/EmployeeProjectForm', pageName: 'Project Form' },
        { label: 'Project Description', to: '/project/DetailsTable', pageName: 'Project Description' },
        { label: 'Manage Emails', to: '/role-management/createmail', pageName: 'Create Mails' },
        { label: 'Manage Roles', to: '/role-management/chooserole', pageName: 'Choose Roles' },
        { label: 'Announcements', to: '/announcements', pageName: 'Announcements' },
        { label: 'Broadcasts', to: '/broadcasts', pageName: 'Communication' },
        // { label: 'Organization', to: '/organization', pageName: 'Overview' },
      ],
    },
  ];
  /* udit end */

  // Filter sections dynamically based on access permissions
  const sections = sectionsConfig
    .map((sec) => ({
      ...sec,
      items: sec.items.filter((item) => hasAccess(item.pageName)),
    }))
    .filter((sec) => sec.items.length > 0);

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
