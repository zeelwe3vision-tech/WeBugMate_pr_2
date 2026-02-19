// component/ProtectedRoute.js
import React, { useContext, useEffect, useState } from 'react';
import { MyContext } from '../App';

/**
 * Usage:
 * <ProtectedRoute requiredPage="Create Mails" requiredAction="View">
 *   <CreateMail />
 * </ProtectedRoute>
 *
 * If requiredAction is omitted, checks for 'View' or 'All'.
 * Admin role bypasses checks (full access).
 */

const NotAuthorized = () => (
  <div style={{padding: 40, textAlign: 'center',paddingTop:"120px"}}>
    <h2>Not authorized</h2>
    <p>You don't have permission to view this page. Contact your administrator.</p>
  </div>
);

const ProtectedRoute = ({ children, requiredPage, requiredAction = 'View' }) => {
  const { userRole, userPermissions, isSignIn } = useContext(MyContext);
  const [permissionsLoaded, setPermissionsLoaded] = useState(false);

  // Wait for permissions to load on initial mount if user is signed in
  useEffect(() => {
    if (isSignIn) {
      // Give a brief moment for permissions to load from sessionStorage
      const timer = setTimeout(() => {
        setPermissionsLoaded(true);
      }, 100);
      return () => clearTimeout(timer);
    } else {
      setPermissionsLoaded(true);
    }
  }, [isSignIn]);

  // Admin bypass
  if (userRole === 'Admin') return children;

  // If user is signed in but permissions haven't loaded yet, wait
  if (isSignIn && !permissionsLoaded) {
    return <div style={{padding: 40, textAlign: 'center',paddingTop:"120px"}}>Loading...</div>;
  }

  // No permissions loaded and user is signed in -> deny
  // But if user is not signed in, that's handled by the route itself
  if (!userPermissions || Object.keys(userPermissions).length === 0) {
    return <NotAuthorized />;
  }

  // Permission structure expected:
  // { "Create Mails": { "All": true, "View": true, "Insert": false, ... }, ... }
  const pagePerms = userPermissions[requiredPage];
  if (!pagePerms) return <NotAuthorized />;

  // If 'All' true -> allow
  if (pagePerms['All']) return children;

  // Check requiredAction
  if (pagePerms[requiredAction]) return children;

  // else deny
  return <NotAuthorized />;
};

export default ProtectedRoute;