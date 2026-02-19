// chooserole.js
import React, { useState, useEffect, useContext } from 'react';
import { FaSearch, FaTrash, FaCogs } from 'react-icons/fa';
import './chooserole.css';
import { databaseService } from '../../services/supabase';
import { MyContext } from '../../App';
import { usePermissions, PermissionButton } from '../../utils/permissionUtils';

const RoleList = () => {
  const { userRole, userPermissions } = useContext(MyContext);
  const { canView, canUpdate, canDelete } = usePermissions();

  const [users, setUsers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [notice, setNotice] = useState(null);
  const [noticeType, setNoticeType] = useState('success');
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);

  // Example pages and actions
  const pages = [
    'Dashboard',
    'Project Form',
    'Project Description',
    'ChatDual',
    'Feedback',
    'Create Mails',
    'Choose Roles',
    'Overview',
    'Profile Setting',
    'API Management',
    'Announcements',
    "Communication",
  ];
  const actions = ['All', 'View', 'Insert', 'Update', 'Delete'];

  // check if current logged-in user has permission
  const hasPermission = (page, action = 'View') => {
    if (userRole === 'Admin') return true;
    if (!userPermissions) return false;
    const pagePerms = userPermissions[page];
    if (!pagePerms) return false;
    if (pagePerms['All']) return true;
    return !!pagePerms[action];
  };

  // fetch all employees with roles
  const fetchUsers = async () => {
    const { data, error } = await databaseService.getAllUserLogins();
    if (error) {
      setNotice('Failed to load employees: ' + (error.message || 'Unknown error'));
      setNoticeType('error');
      return;
    }
    setUsers(data || []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (email) => {
    if (!hasPermission('Choose Roles', 'Delete')) return;
    if (window.confirm('Are you sure you want to delete this user?')) {
      const { error } = await databaseService.deleteUserLoginByEmail(email);
      if (error) {
        setNotice('Delete failed: ' + error.message);
        setNoticeType('error');
      } else {
        setNotice('User deleted');
        setNoticeType('success');
        fetchUsers();
      }
    }
  };

  const handlePermissions = (user) => {
    setSelectedUser(user);

    const initialPermissions = {};
    pages.forEach((page) => {
      initialPermissions[page] = {};
      actions.forEach((action) => {
        initialPermissions[page][action] = false;
      });
    });

    // if user already has permissions, merge them
    if (user.permission_roles) {
      Object.keys(user.permission_roles).forEach((page) => {
        initialPermissions[page] = {
          ...initialPermissions[page],
          ...user.permission_roles[page],
        };
      });
    }

    setPermissions(initialPermissions);
    setShowPermissionModal(true);
  };


  // ✅ Improved togglePermission with "All" handling
  const togglePermission = (page, action) => {
    setPermissions((prev) => {
      const updatedPage = { ...prev[page] };

      if (action === 'All') {
        const newVal = !updatedPage['All'];
        // Toggle all actions at once
        actions.forEach((act) => {
          updatedPage[act] = newVal;
        });
      } else {
        updatedPage[action] = !updatedPage[action];

        // auto-manage "All" if everything else is checked
        const allChecked = actions
          .filter((a) => a !== 'All')
          .every((a) => updatedPage[a]);
        updatedPage['All'] = allChecked;
      }

      return {
        ...prev,
        [page]: updatedPage,
      };
    });
  };

  const handleSavePermissions = async () => {
    if (!selectedUser) return;

    // Build a compact object that only contains checked permissions
    const selectedOnly = {};
    Object.keys(permissions || {}).forEach((page) => {
      const pagePerms = permissions[page] || {};
      const selectedActions = {};

      Object.keys(pagePerms).forEach((action) => {
        if (pagePerms[action]) {
          selectedActions[action] = true;
        }
      });

      // Only persist pages that have at least one checked action
      if (Object.keys(selectedActions).length > 0) {
        selectedOnly[page] = selectedActions;
      }
    });

    try {
      const { error } = await databaseService.updateEmailPermissions(
        selectedUser.email,
        selectedOnly
      );
      if (error) throw error;
      setNotice('Permissions updated successfully');
      setNoticeType('success');
      setShowPermissionModal(false);
      fetchUsers();
    } catch (err) {
      setNotice('Failed to update permissions: ' + err.message);
      setNoticeType('error');
    }
  };



  return (
    <div className="role-list-container">
      {notice && (
        <div className={`notice ${noticeType === 'error' ? 'error' : 'success'}`}>{notice}</div>
      )}

      <div className="role-header">
        <div className="header-content">
          <h1 className="page-title">Employee Roles</h1>
          <div className="header-actions">
            <div className="search-container">
              <FaSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search by name, email or role"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Employee Role Table */}
      <div className="table-container">
        <div className="table-wrapper">
          <table className="role-table">
            <thead>
              <tr>
                <th>Sr No.</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user.email}>
                  <td>{index + 1}</td>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>
                    <div className="action-buttons">
                      <PermissionButton
                        page="Choose Roles"
                        action="Update"
                        buttonProps={{
                          className: "edit-btn",
                          title: "Permissions",
                          onClick: () => handlePermissions(user)
                        }}
                      >
                        <FaCogs />
                      </PermissionButton>
                      <PermissionButton
                        page="Choose Roles"
                        action="Delete"
                        buttonProps={{
                          className: "delete-btn",
                          onClick: () => handleDelete(user.email),
                          title: "Delete"
                        }}
                      >
                        <FaTrash />
                      </PermissionButton>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '20px' }}>
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Permission Modal */}
      {showPermissionModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowPermissionModal(false)}>
          <div className="modal-content large" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Update Permissions for {selectedUser.email}</h2>
              <button className="close-btn" onClick={() => setShowPermissionModal(false)}>×</button>
            </div>
            <div className="permission-table-wrapper">
              <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={showSelectedOnly}
                    onChange={(e) => setShowSelectedOnly(e.target.checked)}
                  />
                  Show selected only
                </label>
              </div>
              <table className="permission-table">
                <thead>
                  <tr>
                    <th>Page</th>
                    {actions.map((action) => (
                      <th key={action}>{action}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(showSelectedOnly
                    ? pages.filter((page) => {
                      const p = permissions[page] || {};
                      return Object.keys(p).some((k) => p[k] === true);
                    })
                    : pages
                  ).map((page) => (
                    <tr key={page}>
                      <td>{page}</td>
                      {actions.map((action) => (
                        <td key={action}>
                          <input
                            type="checkbox"
                            checked={permissions[page]?.[action] || false}
                            onChange={() => togglePermission(page, action)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="form-actions">
              <button className="cancel-btn" onClick={() => setShowPermissionModal(false)}>Close</button>
              <button className="save-btn" onClick={handleSavePermissions}>Update</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoleList;