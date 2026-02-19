// component/AuthenticatedRoute.js
import React, { useContext } from 'react';
import { Navigate } from 'react-router-dom';
import { MyContext } from '../App';

/**
 * Simple authentication check - only verifies user is signed in
 * Does not check specific permissions
 * Use this for pages that should be accessible to all logged-in users
 * but may have data-level filtering (like Dashboard with project RBAC)
 */
const AuthenticatedRoute = ({ children }) => {
  const { isSignIn } = useContext(MyContext);

  if (!isSignIn) {
    return <Navigate to="/signin" replace />;
  }

  return children;
};

export default AuthenticatedRoute;
