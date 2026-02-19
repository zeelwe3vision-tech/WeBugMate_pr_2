import React, { useEffect, useState } from 'react';
import projectDatabaseSupabase from '../../services/projectDatabaseSupabase';
import { Button, Card, Spinner, Alert, Modal, Form, Row, Col } from 'react-bootstrap';
import { FiArrowUp, FiSave, FiX } from 'react-icons/fi';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { usePermissions, PermissionButton } from '../../utils/permissionUtils';
import './projectDetailsTable.css'

const ProjectDetailsTable = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState({});
  const [organizationList, setOrganizationList] = useState([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);

  // Permission hooks
  const { canView, canUpdate, canDelete, hasPermission, userEmail, userRole } = usePermissions();

  useEffect(() => {
    // Only load projects if user email is available
    if (userEmail) {
      loadProjects();
    }
    const fetchOrgs = async () => {
      const orgs = await projectDatabaseSupabase.getOrganizations();
      setOrganizationList(orgs);
    };
    fetchOrgs();
  }, [userEmail, userRole]);

  // Scroll reveal for cards
  useEffect(() => {
    const cards = document.querySelectorAll('.project-details-container .pd-card-neo, .project-details-container .pd-card');
    cards.forEach(el => el.classList.add('reveal-init'));

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-active');
            io.unobserve(entry.target);
          }
        });
      },
      { root: null, rootMargin: '0px 0px -10% 0px', threshold: 0.15 }
    );

    cards.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [projects]);

  // Handle scroll to top button visibility
  useEffect(() => {
    const handleScroll = () => {
      const tableContainer = document.querySelector('.table_container');
      if (tableContainer && tableContainer.scrollHeight > tableContainer.clientHeight) {
        setShowScrollTop(tableContainer.scrollTop > 300);
      } else {
        setShowScrollTop(window.scrollY > 300);
      }
    };

    const tableContainer = document.querySelector('.table_container');
    if (tableContainer && tableContainer.scrollHeight > tableContainer.clientHeight) {
      tableContainer.addEventListener('scroll', handleScroll);
      return () => tableContainer.removeEventListener('scroll', handleScroll);
    } else {
      window.addEventListener('scroll', handleScroll);
      return () => window.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    const tableContainer = document.querySelector('.table_container');
    if (tableContainer) {
      tableContainer.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  };

  const loadProjects = async () => {
    try {
      setLoading(true);
      const projectsData = await projectDatabaseSupabase.getAllProjects(userEmail, userRole);
      console.log('📊 Loaded projects data:', projectsData);
      console.log('📊 First project sample:', projectsData[0]);
      if (projectsData[0]) {
        console.log('📊 Project name fields:', {
          projectName: projectsData[0].projectName,
          name: projectsData[0].name,
          project_name: projectsData[0].project_name
        });
        console.log('📊 Project description fields:', {
          projectDescription: projectsData[0].projectDescription,
          description: projectsData[0].description,
          project_description: projectsData[0].project_description
        });
      }
      setProjects(projectsData);
      setError(null);
    } catch (err) {
      console.error('Error loading projects:', err);
      setError('Failed to load projects. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (projectId) => {
    // Check permission before proceeding
    if (!canDelete('Project Description')) {
      setError('You do not have permission to delete projects.');
      return;
    }

    // Confirm before deleting
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      setLoading(true);
      const result = await projectDatabaseSupabase.deleteProject(projectId);
      if (result && result.success) {
        // Remove the deleted project from the state
        setProjects(prevProjects =>
          prevProjects.filter(project => project.uuid !== projectId)
        );
        // Show success message
        setError(null);
        // Optional: Show a success toast/message here
      } else {
        const errorMessage = result?.message || 'Failed to delete project. Please try again.';
        setError(errorMessage);
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      setError('An error occurred while deleting the project. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (project) => {
    setEditingProject(project);
    setEditForm({
      project_name: project.projectName || project.project_name || project.name || '',
      project_description: project.projectDescription || project.project_description || project.description || '',
      start_date: project.startDate || project.start_date || '',
      end_date: project.endDate || project.end_date || '',
      status: project.status || '',
      client_name: project.clientName || project.client_name || '',
      tech_stack: Array.isArray(project.tech_stack) ? project.tech_stack.join(', ') : (project.tech_stack || ''),
      project_scope: project.projectScope || project.project_scope || '',
      leader_of_project: project.leaderOfProject || project.leader_of_project || '',
      project_responsibility: project.projectResponsibility || project.project_responsibility || '',
      assigned_role: project.assignedRole || project.assigned_role || project.role || '',
      assigned_to_emails: project.assignedToEmails || project.assigned_to_emails || project.assignedTo || [],
      team_members: project.team_members || [],
      teamAssignments: project.team_members || [],
      custom_questions: project.customQuestions || project.custom_questions || {},
      custom_answers: project.customAnswers || project.custom_answers || {},
      custom_questions: project.customQuestions || project.custom_questions || {},
      custom_answers: project.customAnswers || project.custom_answers || {},
      role_answers: project.roleAnswers || project.role_answers || {},
      organization_id: project.organization_id || project.organizationId || null
    });
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setEditForm({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveEdit = async () => {
    try {
      if (!editingProject) {
        setError('No project selected for editing');
        return;
      }

      // Use uuid if available, otherwise fall back to id for backward compatibility
      const projectId = editingProject.uuid || editingProject.id;

      if (!projectId) {
        setError('Project ID is missing');
        return;
      }

      setSaving(true);

      // Convert tech_stack back to array if it's a string
      const techStack = typeof editForm.tech_stack === 'string'
        ? editForm.tech_stack.split(',').map(tech => tech.trim()).filter(tech => tech)
        : editForm.tech_stack;

      // Build snake_case payload expected by DB
      const updateData = {
        project_name: editForm.project_name,
        project_description: editForm.project_description,
        start_date: editForm.start_date,
        end_date: editForm.end_date,
        status: editForm.status,
        client_name: editForm.client_name,
        leader_of_project: editForm.leader_of_project,
        project_scope: editForm.project_scope,
        project_responsibility: editForm.project_responsibility,
        tech_stack: techStack || [],
        organization_id: editForm.organization_id
      };

      console.log('Saving project with ID:', projectId, 'and data:', updateData);
      const { data, error, fromLocal } = await projectDatabaseSupabase.updateProject(projectId, updateData);

      if (error && !fromLocal) {
        setError(error.message || 'Failed to update project');
        return;
      }

      const updated = Array.isArray(data) ? data[0] : data;

      // Update UI list immediately using uuid/id match
      setProjects(prev => prev.map(p => {
        const pid = p.uuid || p.id;
        if (pid === projectId) {
          return { ...p, ...updated };
        }
        return p;
      }));

      setEditingProject(null);
      setEditForm({});
      setError(fromLocal ? 'Saved locally. Database update failed.' : null);

      // Only refetch when DB actually saved (not local fallback)
      if (!fromLocal) {
        await loadProjects();
      }
    } catch (error) {
      console.error('Error in handleSaveEdit:', error);
      setError(error.message || 'Failed to update project');
    } finally {
      setSaving(false);
    }
  };

  const toggleDescription = (projectId) => {
    setExpandedDescriptions(prev => ({
      ...prev,
      [projectId]: !prev[projectId]
    }));
  };

  const total = projects.length;
  const inProgress = projects.filter(p => (p.status || '').toLowerCase() === 'in progress').length;
  const completed = projects.filter(p => (p.status || '').toLowerCase() === 'completed').length;

  return (
    <div className='table_container project-details-container'>


      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {loading ? (
        <div className='d-flex justify-content-center'>
          <Spinner animation="border" role="status">
            <span className="visually-hidden">Loading...</span>
          </Spinner>
        </div>
      ) : (
        <div className="projects-container-custom">
          {projects.length === 0 ? (
            <div className="text-center">No projects found.</div>
          ) : (
            projects.map((proj, idx) => (
              <Card key={proj.uuid || proj.id || idx} className="mb-3 pd-card-neo">
                <Card.Body className="pd-card-body">
                  <h5 className="project-title mb-2">{proj.project_name || proj.projectName || proj.name || 'Untitled Project'}</h5>
                  <div>
                    <p className={`project-description ${expandedDescriptions[proj.uuid || proj.id] ? 'expanded' : ''}`}>
                      {proj.project_description || proj.projectDescription || proj.description || "No description available"}
                    </p>
                    {(proj.project_description || proj.projectDescription || proj.description) &&
                      (proj.project_description || proj.projectDescription || proj.description).length > 100 && (
                        <button
                          className="read-more-btn pd-link"
                          onClick={() => toggleDescription(proj.uuid || proj.id)}
                        >
                          {expandedDescriptions[proj.uuid || proj.id] ? 'Read Less' : 'Read More'}
                        </button>
                      )}
                  </div>

                  <div className="project-details small text-muted">
                    <div><strong>Start Date:</strong> {proj.start_date || proj.startDate || "Not Set"}</div>
                    <div><strong>End Date:</strong> {proj.end_date || proj.endDate || "Not Set"}</div>
                    <div><strong>Status:</strong> {proj.status || "Not Set"}</div>
                    <div><strong>Priority:</strong> {proj.priority || "Not Set"}</div>
                    <div><strong>Organization:</strong> {proj.client_name || proj.clientName || "Not Set"}</div>
                    <div><strong>Leader:</strong> {proj.leader_of_project || proj.leaderOfProject || "Not Set"}</div>
                    <div><strong>Assigned Role:</strong> {proj.assigned_Role || "Not Set"}</div>

                    {(proj.assignedTo || proj.assigned_to_emails || []).length > 0 && (
                      <div><strong>Team Members:</strong> {(proj.assignedTo || proj.assigned_to_emails).join(", ")}</div>
                    )}

                    {(proj.role || []).length > 0 && (
                      <div><strong>Roles:</strong> {proj.role.join(", ")}</div>
                    )}

                    {(proj.project_responsibility || proj.projectResponsibility) && (
                      <div><strong>Responsibilities:</strong> {proj.project_responsibility || proj.projectResponsibility}</div>
                    )}

                    {(proj.project_scope || proj.projectScope) && (
                      <div><strong>Scope:</strong> {proj.project_scope || proj.projectScope}</div>
                    )}

                    {(proj.customQuestion && proj.customAnswer) && (
                      <div><strong>{proj.customQuestion}:</strong> {proj.customAnswer}</div>
                    )}
                  </div>

                  {(proj.tech_stack || proj.techStack || []).length > 0 && (
                    <div className="mb-3">
                      <strong className="d-block mb-1">Tech Stack:</strong>
                      <div className="d-flex flex-wrap gap-1">
                        {(proj.tech_stack || proj.techStack).map((tech, index) => (
                          <span key={index} className="badge bg-light text-dark small">{tech}</span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(proj.uploadDocuments || proj.upload_documents) &&
                    (proj.uploadDocuments || proj.upload_documents).length > 0 ? (
                    <div className="mb-3">
                      <strong className="d-block mb-1">Documents:</strong>
                      {(proj.uploadDocuments || proj.upload_documents).map((file, i) => (
                        <div key={i}>
                          <a href={file.data} download={file.name} style={{ color: '#007bff', textDecoration: 'underline' }}>
                            {file.name}
                          </a>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mb-3"><strong>Documents:</strong> No files</div>
                  )}

                  <div className="d-flex justify-content-end gap-3 pd-actions-new">
                    <PermissionButton
                      page="Project Description"
                      action="Update"
                      buttonProps={{
                        className: "pd-action-btn pd-btn-edit",
                        onClick: () => handleEditClick(proj),
                        title: "Edit Project"
                      }}
                    >
                      <FaEdit className="me-1" /> Edit
                    </PermissionButton>
                    <PermissionButton
                      page="Project Description"
                      action="Delete"
                      buttonProps={{
                        className: "pd-action-btn pd-btn-delete",
                        onClick: () => handleDelete(proj.uuid || proj.id),
                        disabled: loading,
                        title: "Delete Project"
                      }}
                    >
                      <FaTrash className="me-1" /> {loading ? 'Deleting...' : 'Delete'}
                    </PermissionButton>
                  </div>
                </Card.Body>
              </Card>
            ))
          )}
        </div>
      )}



      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          className="scroll-to-top-btn"
          variant="primary"
          size="sm"
          title="Scroll to top"
        >
          <FiArrowUp />
        </Button>
      )}

      {/* Edit Project Modal */}
      <Modal show={editingProject !== null} onHide={handleCancelEdit} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>Edit Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Project Name</Form.Label>
                  <Form.Control
                    type="text"
                    name="project_name"
                    value={editForm.project_name || ''}
                    onChange={handleInputChange}
                    placeholder="Enter project name"
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    name="status"
                    value={editForm.status || ''}
                    onChange={handleInputChange}
                  >
                    <option value="">Select Status</option>
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Project Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                name="project_description"
                value={editForm.project_description || ''}
                onChange={handleInputChange}
                placeholder="Enter project description"
              />
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Start Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="start_date"
                    value={editForm.start_date || ''}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    name="end_date"
                    value={editForm.end_date || ''}
                    onChange={handleInputChange}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Organization Name</Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type="text"
                      name="client_name"
                      value={editForm.client_name || ''}
                      onChange={(e) => {
                        handleInputChange(e);
                        setShowOrgDropdown(true);
                      }}
                      onFocus={() => setShowOrgDropdown(true)}
                      onBlur={() => setTimeout(() => setShowOrgDropdown(false), 200)}
                      placeholder="Enter organization name"
                      autoComplete="off"
                    />
                    {showOrgDropdown && organizationList.length > 0 && (
                      <div className="list-group shadow-sm" style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        zIndex: 1000,
                        maxHeight: '200px',
                        overflowY: 'auto',
                        backgroundColor: 'white',
                        border: '1px solid rgba(0,0,0,0.15)'
                      }}>
                        {organizationList
                          .filter(org => !editForm.client_name || (org.name && org.name.toLowerCase().includes(editForm.client_name.toLowerCase())))
                          .map((org, index) => (
                            <button
                              key={index}
                              type="button"
                              className="list-group-item list-group-item-action text-start"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditForm(prev => ({
                                  ...prev,
                                  client_name: org.name,
                                  organization_id: org.id
                                }));
                                setShowOrgDropdown(false);
                              }}
                            >
                              {org.name}
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Project Leader</Form.Label>
                  <Form.Control
                    type="text"
                    name="leader_of_project"
                    value={editForm.leader_of_project || ''}
                    onChange={handleInputChange}
                    placeholder="Enter project leader"
                  />
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>Tech Stack (comma-separated)</Form.Label>
              <Form.Control
                type="text"
                name="tech_stack"
                value={editForm.tech_stack || ''}
                onChange={handleInputChange}
                placeholder="e.g., React, Node.js, MongoDB"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Project Scope</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="project_scope"
                value={editForm.project_scope || ''}
                onChange={handleInputChange}
                placeholder="Enter project scope"
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Project Responsibility</Form.Label>
              <Form.Control
                as="textarea"
                rows={2}
                name="project_responsibility"
                value={editForm.project_responsibility || ''}
                onChange={handleInputChange}
                placeholder="Enter project responsibilities"
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={handleCancelEdit}>
            <FiX className="me-2" /> Cancel
          </Button>
          <Button variant="success" onClick={handleSaveEdit} disabled={saving}>
            <FiSave className="me-2" /> {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ProjectDetailsTable;
