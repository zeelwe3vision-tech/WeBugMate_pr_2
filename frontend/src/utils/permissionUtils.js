// Permission utility for granular access control
import { useContext } from 'react';
import { MyContext } from '../App';

/**
 * Custom hook for permission management
 * @returns {Object} Permission utilities and checks
 */
export const usePermissions = () => {
  const { userRole, userPermissions, userEmail } = useContext(MyContext);

  /**
   * Check if user has permission for a specific page and action
   * @param {string} page - The page name (e.g., 'Dashboard', 'Project Form')
   * @param {string} action - The action (e.g., 'View', 'Insert', 'Update', 'Delete')
   * @returns {boolean} True if user has permission
   */
  const hasPermission = (page, action = 'View') => {
    // Admin has all permissions
    if (userRole === 'Admin') return true;

    // No permissions loaded -> deny
    if (!userPermissions || Object.keys(userPermissions).length === 0) {
      return false;
    }

    const pagePerms = userPermissions[page];
    if (!pagePerms) return false;

    // If 'All' is true -> allow
    if (pagePerms['All']) return true;

    // Check specific action
    return !!pagePerms[action];
  };

  /**
   * Check if user can view a page
   * @param {string} page - The page name
   * @returns {boolean} True if user can view
   */
  const canView = (page) => hasPermission(page, 'View');

  /**
   * Check if user can create/insert
   * @param {string} page - The page name
   * @returns {boolean} True if user can create
   */
  const canCreate = (page) => hasPermission(page, 'Insert');

  /**
   * Check if user can update/edit
   * @param {string} page - The page name
   * @returns {boolean} True if user can update
   */
  const canUpdate = (page) => hasPermission(page, 'Update');

  /**
   * Check if user can delete
   * @param {string} page - The page name
   * @returns {boolean} True if user can delete
   */
  const canDelete = (page) => hasPermission(page, 'Delete');

  /**
   * Get all permissions for a specific page
   * @param {string} page - The page name
   * @returns {Object} Permission object for the page
   */
  const getPagePermissions = (page) => {
    if (userRole === 'Admin') {
      return { All: true, View: true, Insert: true, Update: true, Delete: true };
    }
    return userPermissions[page] || {};
  };

  /**
   * Check if user has any permission for a page
   * @param {string} page - The page name
   * @returns {boolean} True if user has any permission
   */
  const hasAnyPermission = (page) => {
    if (userRole === 'Admin') return true;
    const pagePerms = userPermissions[page];
    if (!pagePerms) return false;
    return Object.values(pagePerms).some(perm => perm === true);
  };

  /**
   * Get user's role
   * @returns {string} User role
   */
  const getUserRole = () => userRole;

  /**
   * Check if user is admin
   * @returns {boolean} True if user is admin
   */
  const isAdmin = () => userRole === 'Admin';

  return {
    hasPermission,
    canView,
    canCreate,
    canUpdate,
    canDelete,
    getPagePermissions,
    hasAnyPermission,
    getUserRole,
    isAdmin,
    userRole,
    userPermissions,
    userEmail
  };
};

/**
 * Higher-order component for permission-based rendering
 * @param {React.Component} Component - Component to wrap
 * @param {string} requiredPage - Required page permission
 * @param {string} requiredAction - Required action permission
 * @returns {React.Component} Wrapped component
 */
export const withPermission = (Component, requiredPage, requiredAction = 'View') => {
  return (props) => {
    const { hasPermission } = usePermissions();

    if (!hasPermission(requiredPage, requiredAction)) {
      return (
        <div style={{ padding: 40, textAlign: 'center', paddingTop: "120px" }}>
          <h2>Not authorized</h2>
          <p>You don't have permission to access this resource.</p>
        </div>
      );
    }

    return <Component {...props} />;
  };
};

/**
 * Permission-based button component
 * @param {Object} props - Component props
 * @param {string} props.page - Page name for permission check
 * @param {string} props.action - Action for permission check
 * @param {React.ReactNode} props.children - Button content
 * @param {Object} props.buttonProps - Additional button props
 * @returns {React.Component} Permission-based button
 */
export const PermissionButton = ({ page, action = 'View', children, buttonProps = {}, ...props }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(page, action)) {
    return null;
  }

  return (
    <button {...buttonProps} {...props}>
      {children}
    </button>
  );
};

/**
 * Permission-based div component
 * @param {Object} props - Component props
 * @param {string} props.page - Page name for permission check
 * @param {string} props.action - Action for permission check
 * @param {React.ReactNode} props.children - Content to render
 * @param {Object} props.divProps - Additional div props
 * @returns {React.Component} Permission-based div
 */
export const PermissionDiv = ({ page, action = 'View', children, divProps = {}, ...props }) => {
  const { hasPermission } = usePermissions();

  if (!hasPermission(page, action)) {
    return null;
  }

  return (
    <div {...divProps} {...props}>
      {children}
    </div>
  );
};

export default usePermissions;
