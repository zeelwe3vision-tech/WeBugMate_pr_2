import { useEffect, useState, useContext } from 'react';
import {
  Alert,
  Badge, Button,
  Card,
  Col,
  Container,
  FloatingLabel,
  Form,
  ListGroup,
  Modal,
  Row,
  Table
} from 'react-bootstrap';
import {
  FiArrowLeft, FiArrowUp,
  FiCalendar, FiClock,
  FiCode,
  FiSave,
  FiUser,
  FiUsers
} from 'react-icons/fi';
import { Link, useNavigate, useParams } from 'react-router-dom';
import projectDatabaseSupabase from '../../services/projectDatabaseSupabase';
import { MyContext } from '../../App';
import './projectDetailsTable.css';

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userEmail, userRole } = useContext(MyContext);
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [accessDenied, setAccessDenied] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState({ loading: false, error: null });
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    project_name: '',
    project_description: '',
    start_date: '',
    end_date: '',
    status: '',
    client_name: '',
    leader_of_project: '',
    project_scope: '',
    project_responsibility: ''
  });
  const [editStatus, setEditStatus] = useState({ loading: false, error: null, success: false });
  const roleAnswers = project?.role_answers ?? project?.roleAnswers ?? {};
  const customQuestions = project?.custom_questions ?? project?.customQuestions ?? [];
  const customAnswers = project?.custom_answers ?? project?.customAnswers ?? {};
  const [organizationList, setOrganizationList] = useState([]);
  const [showOrgDropdown, setShowOrgDropdown] = useState(false);


  useEffect(() => {
    fetchProjectDetails();
    const fetchOrgs = async () => {
      const orgs = await projectDatabaseSupabase.getOrganizations();
      setOrganizationList(orgs);
    };
    fetchOrgs();
    const handleScroll = () => setShowScrollTop(window.scrollY > 300);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [id]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });

  const fetchProjectDetails = async () => {
    try {
      console.log('🔍 ProjectDetails fetching project:', id, 'for user:', userEmail, 'role:', userRole);

      setLoading(true);
      const projectData = await projectDatabaseSupabase.getProjectById(id);

      if (projectData && !projectData.error) {
        console.log('✅ Project data loaded:', projectData.project_name || projectData.projectName);

        // Check if user has access to this project
        const assignedEmails = projectData.assigned_to_emails || projectData.assignedToEmails || [];
        console.log('👥 Assigned emails:', assignedEmails);

        const isAdmin = userRole && userRole.toLowerCase() === 'admin';
        const hasAccess = isAdmin || assignedEmails.includes(userEmail);

        console.log('🔐 Access check:', { isAdmin, hasAccess, userEmail });

        if (!hasAccess) {
          console.log('🚫 Access DENIED to project');
          setAccessDenied(true);
          setError('You do not have access to view this project');
          setProject(null);
        } else {
          console.log('✅ Access GRANTED to project');
          setProject(projectData);
          setAccessDenied(false);

          // Initialize edit form data with current project data
          setEditFormData({
            project_name: projectData.project_name || projectData.projectName || '',
            project_description: projectData.project_description || projectData.projectDescription || '',
            start_date: projectData.start_date || projectData.startDate || '',
            end_date: projectData.end_date || projectData.endDate || '',
            status: projectData.status || 'Not Started',
            client_name: projectData.client_name || projectData.clientName || '',
            leader_of_project: projectData.leader_of_project || projectData.leaderOfProject || '',
            project_scope: projectData.project_scope || projectData.projectScope || '',
            project_responsibility: projectData.project_responsibility || projectData.projectResponsibility || '',
            organization_id: projectData.organization_id || projectData.organizationId || null
          });
        }
      } else {
        console.log('❌ Project not found or error:', projectData?.error);
        setError('Project not found');
        setProject(null);
      }
    } catch (error) {
      console.error('❌ Error fetching project:', error);
      setError('Failed to load project details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'completed': return 'success';
      case 'in progress': return 'primary';
      case 'on hold': return 'warning';
      case 'not started': return 'secondary';
      default: return 'info';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'No date set';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-US', {
      weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
    });
  };

  const calculateDaysLeft = (endDate) => {
    if (!endDate) return 'No deadline';
    const end = new Date(endDate);
    const today = new Date();
    const diffDays = Math.ceil((end - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'Overdue';
    if (diffDays === 0) return 'Due today';
    return `${diffDays} days left`;
  };

  if (loading) {
    return (
      <div className="project-details-container text-center mt-5">
        <div className="spinner-border" role="status"></div>
        <p className="text-muted mt-2">Loading project...</p>
      </div>
    );
  }

  if (error || !project) {
    return (
      <Container className="text-center mt-5">
        <Card className="p-4 shadow-sm">
          <h3 className="mb-2">Project Not Found</h3>
          <p className="text-muted">{error}</p>
          <Link to="/dashboard" className="btn btn-primary">
            <FiArrowLeft className="me-2" /> Back to Dashboard
          </Link>
        </Card>
      </Container>
    );
  }

  // Extract project details safely
  const projectName = project.project_name || project.projectName || 'Untitled Project';
  const projectDescription = project.project_description || project.projectDescription || '';
  const startDate = project.start_date || project.startDate;
  const endDate = project.end_date || project.endDate;
  const status = project.status || 'Not Started';
  const techStack = project.tech_stack || project.techStack || [];
  const clientName = project.client_name || project.clientName || '';
  const leaderOfProject = project.leader_of_project || project.leaderOfProject || '';
  const projectScope = project.project_scope || project.projectScope || '';
  const projectResponsibility = project.project_responsibility || project.projectResponsibility || '';

  // Use teamAssignments stored in the project

  let teamMembers = [];

  // ✅ New format (camelCase or snake_case)
  if ((project.teamAssignments && project.teamAssignments.length > 0) ||
    (project.team_assignments && project.team_assignments.length > 0)) {

    const assignments = project.teamAssignments || project.team_assignments;

    teamMembers = assignments.map(m => ({
      email: m.email,
      roles: m.roles || []
    }));
  }
  // ✅ Old format fallback
  else if (project.assigned_to_emails && project.assigned_role) {
    teamMembers = project.assigned_to_emails.map((email, idx) => ({
      email,
      roles: Array.isArray(project.assigned_role[idx])
        ? project.assigned_role[idx]
        : [project.assigned_role[idx]]
    }));
  }



  return (
    <div className="project-details-container">
      <Container className="mt-4 mb-5">

        {/* Header */}
        <div className="d-flex justify-content-between align-items-center mb-4 project-details-header">
          <Link to="/dashboard" className="btn btn-outline-secondary pd-back-btn">
            <FiArrowLeft className="me-2" /> Back
          </Link>
          <div className="d-flex align-items-center gap-2">
            <Badge className="px-3 py-2 fs-6 status-badge">{status}</Badge>
          </div>
        </div>

        <Row>
          {/* Left: Project Info */}
          <Col lg={8}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h2 className="fw-bold mb-3">{projectName}</h2>
                {projectDescription && <p className="text-muted">{projectDescription}</p>} {/* udit */}
                {projectScope && <p className="text-muted">{projectScope}</p>} {/*udit */}

                <hr />
                <Row>
                  <Col md={6} className="mb-3">
                    <FiCalendar className="me-2 text-primary" />
                    <strong>Start:</strong> {formatDate(startDate)}
                  </Col>
                  <Col md={6} className="mb-3">
                    <FiCalendar className="me-2 text-danger" />
                    <strong>End:</strong> {formatDate(endDate)}
                  </Col>
                  <Col md={6} className="mb-3">
                    <FiClock className="me-2 text-warning" />
                    <strong>Deadline:</strong> {calculateDaysLeft(endDate)}
                  </Col>
                  {clientName && (
                    <Col md={6} className="mb-3">
                      <FiUser className="me-2 text-info" />
                      <strong>Organization:</strong> {clientName}
                    </Col>
                  )}
                </Row>
              </Card.Body>
            </Card>
          </Col>

          {/* Right: Team & Tech */}
          <Col lg={4}>
            <Card className="shadow-sm mb-4">
              <Card.Body>
                <h5><FiUsers className="me-2" /> Team</h5>
                {leaderOfProject && <p><strong>Leader:</strong> {leaderOfProject}</p>}
                <div>
                  {project.team_members && project.team_members.length > 0 ? (
                    project.team_members.slice(0, 3).map((member, idx) => (
                      <p key={idx} className="text-muted small mb-1">
                        👤 {member.email} ({member.role || "No role"})
                      </p>
                    ))
                  ) : (
                    <p className="text-muted small">No team members assigned</p>
                  )}
                  {project.team_members && project.team_members.length > 3 && (
                    <p className="small text-muted">
                      +{project.team_members.length - 3} more...
                    </p>
                  )}
                </div>

                <Button size="sm" variant="outline-primary" className="pd-view-details mt-2" onClick={() => setShowTable(true)}>
                  View Details
                </Button>
              </Card.Body>
            </Card>
          </Col>

        </Row>

        {/* Tech Stack Section */}
        {techStack && techStack.length > 0 && (
          <Card className="shadow-sm mt-3">
            <Card.Body>
              <h5><FiCode className="me-2" /> Tech Stack</h5>
              <div className="d-flex flex-wrap gap-2">
                {techStack.map((tech, index) => (
                  <Badge key={index} bg="light" text="dark">
                    {tech}
                  </Badge>
                ))}
              </div>
            </Card.Body>
          </Card>
        )}

      </Container>

      {customQuestions.length > 0 && (
        <Row className='mb-10'>
          <Col>
            <Card>
              <Card.Body>
                <h5 className="mb-3">Project Q&A</h5>

                <div>
                  <h6>Custom Questions</h6>
                  <ListGroup variant="flush">
                    {customQuestions.map((question, index) => (
                      <ListGroup.Item key={index} className="px-0">
                        <div className="text-muted"><b>{question}</b></div> {/* udit */}
                        <div className="text-muted">
                          {customAnswers[question] || 'No answer provided'}
                        </div>
                      </ListGroup.Item>
                    ))}
                  </ListGroup>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}



      {/* Team Modal */}
      <Modal show={showTable} onHide={() => setShowTable(false)} size="lg" centered>
        <Modal.Header closeButton className="btn-close-white"> {/* udit */}
          <Modal.Title>Team Members & Roles</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>#</th>
                <th>Email</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {project.team_members && project.team_members.length > 0 ? (
                project.team_members.map((member, idx) => (
                  <tr key={idx}>
                    <td>{idx + 1}</td>
                    <td>{member.email}</td>
                    <td>{member.role || "No role"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center text-muted">
                    No team members assigned
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Modal.Body>
      </Modal>




      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Delete Project</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {deleteStatus.error && (
            <Alert variant="danger" className="mb-3">
              {deleteStatus.error}
            </Alert>
          )}
          <p>Are you sure you want to delete this project? This action cannot be undone.</p>
          <p className="text-muted">Project: <strong>{projectName}</strong></p>
        </Modal.Body>
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => setShowDeleteModal(false)}
            disabled={deleteStatus.loading}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={async () => {
              setDeleteStatus({ loading: true, error: null });
              try {
                const { error } = await projectDatabaseSupabase.deleteProject(id);
                if (error) throw error;

                setShowDeleteModal(false);
                navigate('/dashboard', {
                  state: {
                    message: 'Project deleted successfully',
                    variant: 'success'
                  }
                });
              } catch (error) {
                console.error('Error deleting project:', error);
                setDeleteStatus({
                  loading: false,
                  error: error.message || 'Failed to delete project. Please try again.'
                });
              }
            }}
            disabled={deleteStatus.loading}
          >
            {deleteStatus.loading ? 'Deleting...' : 'Delete Project'}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Edit Project Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Edit Project</Modal.Title>
        </Modal.Header>
        <Form onSubmit={async (e) => {
          e.preventDefault();
          setEditStatus({ loading: true, error: null, success: false });

          try {
            const projectId = project.uuid || project.id;
            if (!projectId) throw new Error('Project UUID is required');

            // Build snake_case payload expected by DB
            const updateData = {
              project_name: editFormData.project_name,
              project_description: editFormData.project_description,
              start_date: editFormData.start_date,
              end_date: editFormData.end_date,
              status: editFormData.status,
              client_name: editFormData.client_name,
              leader_of_project: editFormData.leader_of_project,
              project_scope: editFormData.project_scope,
              project_responsibility: editFormData.project_responsibility,
              organization_id: editFormData.organization_id
            };

            // Update via service and use its response
            const { data, error, fromLocal } = await projectDatabaseSupabase.updateProject(
              projectId,
              updateData
            );

            if (error && !fromLocal) {
              throw error;
            }

            const updated = Array.isArray(data) ? data[0] : data;

            // Update local UI immediately from authoritative response
            setProject(prev => ({ ...prev, ...updated }));

            setEditStatus({ loading: false, success: true, error: null });

            // Close the modal after a short delay
            setTimeout(() => {
              setShowEditModal(false);
              // Only refetch if DB actually updated (not local fallback)
              if (!fromLocal) {
                fetchProjectDetails();
              }
            }, 1000);

          } catch (error) {
            console.error('Error updating project:', error);
            setEditStatus({
              loading: false,
              success: false,
              error: error.message || 'Failed to update project. Please try again.'
            });
          }
        }}>
          <Modal.Body>
            {editStatus.error && (
              <Alert variant="danger" onClose={() => setEditStatus(prev => ({ ...prev, error: null }))} dismissible>
                {editStatus.error}
              </Alert>
            )}
            {editStatus.success && (
              <Alert variant="success">
                Project updated successfully!
              </Alert>
            )}

            <FloatingLabel controlId="projectName" label="Project Name" className="mb-3">
              <Form.Control
                type="text"
                placeholder="Enter project name"
                value={editFormData.project_name}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  project_name: e.target.value
                }))}
                required
              />
            </FloatingLabel>

            <FloatingLabel controlId="projectDescription" label="Project Description" className="mb-3">
              <Form.Control
                as="textarea"
                placeholder="Enter project description"
                style={{ height: '100px' }}
                value={editFormData.project_description}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  project_description: e.target.value
                }))}
              />
            </FloatingLabel>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="startDate" className="mb-3">
                  <Form.Label>  </Form.Label>
                  <Form.Control
                    type="date"
                    value={editFormData.start_date?.split('T')[0] || ''}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      start_date: e.target.value
                    }))}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="endDate" className="mb-3">
                  <Form.Label>End Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={editFormData.end_date?.split('T')[0] || ''}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      end_date: e.target.value
                    }))}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row className="mb-3">
              <Col md={6}>
                <Form.Group controlId="status">
                  <Form.Label>Status</Form.Label>
                  <Form.Select
                    value={editFormData.status}
                    onChange={(e) => setEditFormData(prev => ({
                      ...prev,
                      status: e.target.value
                    }))}
                  >
                    <option value="Not Started">Not Started</option>
                    <option value="In Progress">In Progress</option>
                    <option value="On Hold">On Hold</option>
                    <option value="Completed">Completed</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Organization Name</Form.Label>
                  <div style={{ position: 'relative' }}>
                    <Form.Control
                      type="text"
                      placeholder="Enter organization name"
                      value={editFormData.client_name || ''}
                      onChange={(e) => {
                        setEditFormData(prev => ({ ...prev, client_name: e.target.value }));
                        setShowOrgDropdown(true);
                      }}
                      onFocus={() => setShowOrgDropdown(true)}
                      onBlur={() => setTimeout(() => setShowOrgDropdown(false), 200)}
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
                          .filter(org => !editFormData.client_name || (org.name && org.name.toLowerCase().includes(editFormData.client_name.toLowerCase())))
                          .map((org, index) => (
                            <button
                              key={index}
                              type="button"
                              className="list-group-item list-group-item-action text-start"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setEditFormData(prev => ({
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
            </Row>

            <FloatingLabel controlId="leaderOfProject" label="Project Leader" className="mb-3">
              <Form.Control
                type="text"
                placeholder="Enter project leader name"
                value={editFormData.leader_of_project}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  leader_of_project: e.target.value
                }))}
              />
            </FloatingLabel>

            <FloatingLabel controlId="projectScope" label="Project Scope" className="mb-3">
              <Form.Control
                as="textarea"
                placeholder="Enter project scope"
                style={{ height: '80px' }}
                value={editFormData.project_scope}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  project_scope: e.target.value
                }))}
              />
            </FloatingLabel>

            <FloatingLabel controlId="projectResponsibility" label="Project Responsibility">
              <Form.Control
                as="textarea"
                placeholder="Enter project responsibilities"
                style={{ height: '80px' }}
                value={editFormData.project_responsibility}
                onChange={(e) => setEditFormData(prev => ({
                  ...prev,
                  project_responsibility: e.target.value
                }))}
              />
            </FloatingLabel>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowEditModal(false)}
              disabled={editStatus.loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              disabled={editStatus.loading}
            >
              {editStatus.loading ? 'Saving...' : (
                <>
                  <FiSave className="me-1" /> Save Changes
                </>
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Scroll to Top */}
      <button
        className={`scroll-to-top-btn ${showScrollTop ? 'show' : ''}`}
        onClick={scrollToTop}
      >
        <FiArrowUp />
      </button>
    </div>
  );
};

export default ProjectDetails;
