# Permission System Documentation

## Overview

The application implements a comprehensive granular permission system that allows fine-grained control over user access to different pages and actions. Users can be granted specific permissions like View, Insert, Update, and Delete for each page/module.

## Permission Structure

### Pages/Modules
- **Dashboard**: Main dashboard view
- **Project Form**: Create new projects
- **Project Description**: View and manage existing projects
- **ChatDual**: Access to chatbot features
- **Feedback**: Submit and view feedback
- **Create Mails**: Manage employee accounts
- **Choose Roles**: Manage user permissions
- **Overview**: System overview page
- **Profile Setting**: User settings
- **API Management**: API configuration
- **Announcements**: Company announcements
- **Communication**: Team communication

### Actions
- **View**: Can view/read the page content
- **Insert**: Can create new records/items
- **Update**: Can modify existing records
- **Delete**: Can remove records
- **All**: Has all permissions for the page

## Implementation

### 1. Permission Utility (`src/utils/permissionUtils.js`)

The `usePermissions` hook provides easy access to permission checks:

```javascript
import { usePermissions } from '../../utils/permissionUtils';

const MyComponent = () => {
  const { canView, canCreate, canUpdate, canDelete, hasPermission } = usePermissions();
  
  // Check specific permissions
  if (canView('Dashboard')) {
    // Show dashboard content
  }
  
  if (canCreate('Project Form')) {
    // Show create project button
  }
};
```

### 2. Permission-Based Components

#### PermissionButton
Renders a button only if the user has the required permission:

```javascript
import { PermissionButton } from '../../utils/permissionUtils';

<PermissionButton
  page="Project Description"
  action="Delete"
  buttonProps={{
    variant: "danger",
    size: "sm",
    onClick: () => handleDelete(id)
  }}
>
  Delete Project
</PermissionButton>
```

#### PermissionDiv
Renders content only if the user has the required permission:

```javascript
import { PermissionDiv } from '../../utils/permissionUtils';

<PermissionDiv page="Dashboard" action="View">
  <h1>Dashboard Content</h1>
</PermissionDiv>
```

### 3. Route Protection

Routes are protected using the `ProtectedRoute` component:

```javascript
<Route
  path="/dashboard"
  element={
    <ProtectedRoute requiredPage="Dashboard" requiredAction="View">
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### 4. CRUD Operation Protection

All CRUD operations include permission checks:

```javascript
const handleDelete = async (id) => {
  // Check permission before proceeding
  if (!canDelete('Project Description')) {
    setError('You do not have permission to delete projects.');
    return;
  }
  
  // Proceed with deletion
  try {
    await deleteProject(id);
  } catch (error) {
    // Handle error
  }
};
```

## Permission Management

### Setting Permissions

Permissions are managed through the "Choose Roles" page where administrators can:

1. **View Users**: See all employees and their current permissions
2. **Edit Permissions**: Click the settings icon to modify user permissions
3. **Granular Control**: Set specific permissions for each page:
   - ✅ View: User can see the page
   - ✅ Insert: User can create new items
   - ✅ Update: User can modify existing items
   - ✅ Delete: User can remove items
   - ✅ All: User has all permissions

### Permission Examples

#### Example 1: Employee with View-only access
```json
{
  "Dashboard": { "View": true },
  "Project Description": { "View": true }
}
```
This user can only view the dashboard and project details but cannot create, edit, or delete.

#### Example 2: Project Manager with full project access
```json
{
  "Dashboard": { "All": true },
  "Project Form": { "All": true },
  "Project Description": { "All": true }
}
```
This user has complete access to all project-related functionality.

#### Example 3: HR Manager with user management access
```json
{
  "Dashboard": { "View": true },
  "Create Mails": { "All": true },
  "Choose Roles": { "All": true }
}
```
This user can manage employee accounts and permissions but has limited project access.

## Usage Examples

### 1. Conditional Rendering
```javascript
const Dashboard = () => {
  const { canCreate } = usePermissions();
  
  return (
    <div>
      <h1>Dashboard</h1>
      {canCreate('Project Form') && (
        <button onClick={createProject}>Create Project</button>
      )}
    </div>
  );
};
```

### 2. Form Submission Protection
```javascript
const handleSubmit = async (formData) => {
  if (!canCreate('Project Form')) {
    alert('You do not have permission to create projects.');
    return;
  }
  
  // Proceed with form submission
  await createProject(formData);
};
```

### 3. Table Actions
```javascript
const ProjectTable = () => {
  return (
    <table>
      {projects.map(project => (
        <tr key={project.id}>
          <td>{project.name}</td>
          <td>
            <PermissionButton
              page="Project Description"
              action="Update"
              buttonProps={{ onClick: () => editProject(project.id) }}
            >
              Edit
            </PermissionButton>
            <PermissionButton
              page="Project Description"
              action="Delete"
              buttonProps={{ onClick: () => deleteProject(project.id) }}
            >
              Delete
            </PermissionButton>
          </td>
        </tr>
      ))}
    </table>
  );
};
```

## Best Practices

1. **Always Check Permissions**: Never assume a user has permission. Always check before performing actions.

2. **Use Permission Components**: Use `PermissionButton` and `PermissionDiv` for consistent permission handling.

3. **Provide Clear Feedback**: When users don't have permission, provide clear error messages.

4. **Test Different Roles**: Test the application with different user roles to ensure permissions work correctly.

5. **Document Permissions**: Keep track of which permissions are required for each feature.

## Security Notes

- All permission checks are performed on the client side for UI purposes
- Server-side validation should also be implemented for security
- Admin users bypass all permission checks
- Users without permissions see "Not authorized" messages instead of protected content

## Troubleshooting

### Common Issues

1. **Buttons Not Showing**: Check if the user has the required permission for the page and action.

2. **"Not authorized" Messages**: Verify the user has at least "View" permission for the page.

3. **Permission Not Updating**: Ensure the user's permissions are properly saved and the context is updated.

### Debugging

Use the browser console to check current permissions:

```javascript
// In browser console
console.log('User Role:', userRole);
console.log('User Permissions:', userPermissions);
```

This permission system provides fine-grained control over user access, ensuring that users can only perform actions they are authorized for, creating a secure and organized application environment.
