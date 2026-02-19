import React from 'react';
import { usePermissions, PermissionButton, PermissionDiv } from '../utils/permissionUtils';
import { Card, Button, Alert } from 'react-bootstrap';

/**
 * Test component to demonstrate the permission system
 * This component shows how different permissions affect UI rendering
 */
const PermissionTest = () => {
  const {
    canView,
    canCreate,
    canUpdate,
    canDelete,
    hasPermission,
    getUserRole,
    isAdmin
  } = usePermissions();

  return (
    <div className="container mt-4">
      <h2>Permission System Test</h2>

      <Card className="mb-4">
        <Card.Header>
          <h4>Current User Information</h4>
        </Card.Header>
        <Card.Body>
          <p><strong>Role:</strong> {getUserRole()}</p>
          <p><strong>Is Admin:</strong> {isAdmin() ? 'Yes' : 'No'}</p>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <h4>Permission Checks</h4>
        </Card.Header>
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              <h5>Dashboard Permissions</h5>
              <ul>
                <li>View: {canView('Dashboard') ? '✅' : '❌'}</li>
                <li>Create: {canCreate('Dashboard') ? '✅' : '❌'}</li>
                <li>Update: {canUpdate('Dashboard') ? '✅' : '❌'}</li>
                <li>Delete: {canDelete('Dashboard') ? '✅' : '❌'}</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h5>Project Form Permissions</h5>
              <ul>
                <li>View: {canView('Project Form') ? '✅' : '❌'}</li>
                <li>Create: {canCreate('Project Form') ? '✅' : '❌'}</li>
                <li>Update: {canUpdate('Project Form') ? '✅' : '❌'}</li>
                <li>Delete: {canDelete('Project Form') ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <h4>Permission-Based Buttons</h4>
        </Card.Header>
        <Card.Body>
          <div className="d-flex gap-2 flex-wrap">
            <PermissionButton
              page="Dashboard"
              action="View"
              buttonProps={{
                variant: "primary",
                onClick: () => alert('Dashboard view clicked')
              }}
            >
              View Dashboard
            </PermissionButton>

            <PermissionButton
              page="Project Form"
              action="Insert"
              buttonProps={{
                variant: "success",
                onClick: () => alert('Create project clicked')
              }}
            >
              Create Project
            </PermissionButton>

            <PermissionButton
              page="Project Description"
              action="Update"
              buttonProps={{
                variant: "warning",
                onClick: () => alert('Edit project clicked')
              }}
            >
              Edit Project
            </PermissionButton>

            <PermissionButton
              page="Project Description"
              action="Delete"
              buttonProps={{
                variant: "danger",
                onClick: () => alert('Delete project clicked')
              }}
            >
              Delete Project
            </PermissionButton>
          </div>
        </Card.Body>
      </Card>

      <Card className="mb-4">
        <Card.Header>
          <h4>Permission-Based Content</h4>
        </Card.Header>
        <Card.Body>
          <PermissionDiv page="Dashboard" action="View">
            <Alert variant="info">
              This content is only visible if you have View permission for Dashboard.
            </Alert>
          </PermissionDiv>

          <PermissionDiv page="Project Form" action="Insert">
            <Alert variant="success">
              This content is only visible if you have Insert permission for Project Form.
            </Alert>
          </PermissionDiv>

          <PermissionDiv page="Choose Roles" action="Update">
            <Alert variant="warning">
              This content is only visible if you have Update permission for Choose Roles.
            </Alert>
          </PermissionDiv>
        </Card.Body>
      </Card>

      <Card>
        <Card.Header>
          <h4>Specific Permission Checks</h4>
        </Card.Header>
        <Card.Body>
          <div className="row">
            <div className="col-md-6">
              <h6>Choose Roles Permissions</h6>
              <ul>
                <li>View: {hasPermission('Choose Roles', 'View') ? '✅' : '❌'}</li>
                <li>Update: {hasPermission('Choose Roles', 'Update') ? '✅' : '❌'}</li>
                <li>Delete: {hasPermission('Choose Roles', 'Delete') ? '✅' : '❌'}</li>
              </ul>
            </div>
            <div className="col-md-6">
              <h6>Create Mails Permissions</h6>
              <ul>
                <li>View: {hasPermission('Create Mails', 'View') ? '✅' : '❌'}</li>
                <li>Insert: {hasPermission('Create Mails', 'Insert') ? '✅' : '❌'}</li>
                <li>Update: {hasPermission('Create Mails', 'Update') ? '✅' : '❌'}</li>
                <li>Delete: {hasPermission('Create Mails', 'Delete') ? '✅' : '❌'}</li>
              </ul>
            </div>
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default PermissionTest;
