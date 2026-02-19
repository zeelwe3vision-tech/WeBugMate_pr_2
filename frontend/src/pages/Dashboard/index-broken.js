import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Button, Card, Alert } from 'react-bootstrap';
import { FiPlus, FiRefreshCw, FiArrowUp, FiMessageSquare } from 'react-icons/fi';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import projectDatabaseSupabase from '../../services/projectDatabaseSupabase';
import { databaseService } from '../../services/supabase';
import { usePermissions, PermissionButton } from '../../utils/permissionUtils';
import './Dashboard.css';

const StatCard = ({ value, title, icon }) => (
  <div className="stat-card-custom d-flex flex-column align-items-center justify-content-center">
    {icon && <div className="mb-2">{icon}</div>}
    <div className="stat-value">{value}</div>
    <div className="stat-title">{title}</div>
  </div>
);

const Dashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { canView, canCreate } = usePermissions();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showSuccessAlert, setShowSuccessAlert] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [stats, setStats] = useState({
    openProjects: 0,
    completedProjects: 0,
    totalHours: 0
  });
  const [projectChats, setProjectChats] = useState({});
  const [chatLoading, setChatLoading] = useState({});
  const [statusFilter, setStatusFilter] = useState('all');
  const [darkMode, setDarkMode] = useState(false);

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => setDarkMode(document.body.classList.contains('dark'));
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const calculateProjectDays = (project) => {
    const start = new Date(project.start_date || project.startDate);
    const end = new Date(project.end_date || project.endDate);
    
    if (isNaN(start) || isNaN(end)) return 0;
    const diffTime = Math.abs(end - start);
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };
  
  const fetchProjects = async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      
      const projectsData = await projectDatabaseSupabase.getAllProjects();
      const uniqueProjectsMap = new Map();
      
      (projectsData || []).forEach(project => {
        if (project.uuid) {
          uniqueProjectsMap.set(project.uuid, project);
        }
      });
      
      const uniqueProjects = Array.from(uniqueProjectsMap.values());
      setProjects(uniqueProjects);

      const openProjects = uniqueProjects.filter(p => (p.status?.toLowerCase() !== 'completed')).length;
      const completedProjects = uniqueProjects.filter(p => (p.status?.toLowerCase() === 'completed')).length;
      const totalDays = uniqueProjects.reduce((acc, proj) => acc + calculateProjectDays(proj), 0);

      setStats({
        openProjects,
        completedProjects,
        totalHours: totalDays
      });
      
    } catch (err) {
      console.error('Error fetching projects:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (location.state?.refreshProjects) {
      projectDatabaseSupabase.clearCache();
      fetchProjects(true);
      setShowSuccessAlert(true);
      window.history.replaceState({}, document.title);
      setTimeout(() => setShowSuccessAlert(false), 5000);
    }
  }, [location.state]);

  useEffect(() => {
    const dashboardContainer = document.querySelector('.dashboard-container');
    const handleScroll = () => {
      if (dashboardContainer) setShowScrollTop(dashboardContainer.scrollTop > 300);
    };
    if (dashboardContainer) {
      dashboardContainer.addEventListener('scroll', handleScroll);
      return () => dashboardContainer.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const scrollToTop = () => {
    const dashboardContainer = document.querySelector('.dashboard-container');
    if (dashboardContainer) dashboardContainer.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCreateChat = async (project) => {
    const projectId = project.uuid || project.id;
    if (!projectId) {
      console.error('Project ID is missing');
      return;
    }

    setChatLoading(prev => ({ ...prev, [projectId]: true }));

    try {
      const { data: chatData, error } = await databaseService.createChatId(projectId);

      if (error) {
        console.error('Failed to create chat:', error);
        return;
      }

      // Update local state to include the new chat
      setProjectChats(prev => ({
        ...prev,
        [projectId]: [
          {
            id: chatData.id,
            chat_id: chatData.chat_id,
            created_at: chatData.created_at,
            project_id: projectId
          },
          ...(prev[projectId] || [])
        ]
      }));

      navigate('/chatbot/WorkChat', {
        state: {
          projectId: projectId,
          projectName: project?.project_name || project?.projectName,
          chatId: chatData.chat_id
        }
      });
    } catch (error) {
      console.error('Error creating chat:', error);
    } finally {
      setChatLoading(prev => ({ ...prev, [projectId]: false }));
    }
  };

  // Load existing chats for a project
  const loadProjectChats = async (projectId) => {
    if (!projectId) return;
    
    try {
      const { data, error } = await databaseService.getProjectChats(projectId);
      if (!error && data) {
        setProjectChats(prev => ({
          ...prev,
          [projectId]: data
        }));
      }
    } catch (error) {
      console.error('Error loading project chats:', error);
    }
  };

  // Load chats when projects are loaded
  useEffect(() => {
    if (projects.length > 0) {
      projects.forEach(project => {
        const projectId = project.uuid || project.id;
        if (projectId) {
          loadProjectChats(projectId);
        }
      });
    }
  }, [projects]);

  // Card colors
  const getRandomCardColor = (index) => {
    if (darkMode) {
      return "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460, #533483)";
    } else {
      const colors = ["#fff9c4", "#bbdefb", "#ffcdd2", "#c8e6c9", "#ffe0b2"];
      return colors[index % colors.length];
    }
  };

  // Date formatter
  const formatProjectDate = (project) => {
    const rawDate = project?.createdAt || project?.created_at || project?.start_date || project?.startDate;
    if (!rawDate) return '';
    const d = new Date(rawDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: '2-digit',
      year: 'numeric'
    });
  };

  // Project filtering
  const filteredProjects = projects.filter(project => {
    if (statusFilter === 'all') return true;
    return (project.status || 'Not Started').toLowerCase() === statusFilter.toLowerCase();
  });

  return (
    <Container fluid className="dashboard-container">
      {showSuccessAlert && (
        <Alert variant="success" onClose={() => setShowSuccessAlert(false)} dismissible className="mb-3">
          <strong>Success!</strong> Your project has been created successfully and is now visible in the dashboard.
        </Alert>
      )}

      {/* Stats Section */}
      <Row className="g-8 mb-4 justify-content-center">
        <Col md={3} sm={6} xs={12}>
          <StatCard value={stats.openProjects.toString()} title="Open Projects" />
        </Col>
        <Col md={3} sm={6} xs={12}>
          <StatCard value={stats.completedProjects.toString()} title="Completed Projects" />
        </Col>
        <Col md={3} sm={6} xs={12}>
          <StatCard value={stats.totalHours.toFixed(2)} title="Total Project Days" />
        </Col>
      </Row>

      {/* Project Cards */}
      <Row>
        {loading ? (
          <div className="text-center py-4">
            <div className="spinner-border" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-4 text-muted">
            No projects found. Create your first project to get started.
            <div className="d-flex justify-content-center gap-2 mt-3">
              <Button variant="outline-primary" onClick={() => fetchProjects(true)} disabled={refreshing}>
                <FiRefreshCw className={refreshing ? 'spinning me-2' : 'me-2'} />
                {refreshing ? 'Refreshing...' : 'Refresh Projects'}
              </Button>
              <PermissionButton
                page="Project Form"
                action="Insert"
                buttonProps={{
                  as: Link,
                  to: "/project",
                  className: "btn btn-primary"
                }}
              >
                <FiPlus className="me-2" />
                Create New Project
              </PermissionButton>
            </div>
          </div>
        ) : (
          <div className="debug-section-card">
            <div className="debug-header d-flex justify-content-between align-items-center mb-3">
              <h6>All Projects ({filteredProjects.length})</h6>
              <div className="d-flex align-items-center gap-3">
                <select 
                  color='white'
                  className="status-dropdown" 
                  value={statusFilter} 
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="not started">Not Started</option>
                  <option value="in progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="on hold">On Hold</option>
                </select>
                <Button
                  page="Project Form"
                  action="Insert"
                  as={Link} 
                  to="/EmployeeProjectForm" 
                  className="btn btn-primary d-flex align-items-center"
                  style={{background: "linear-gradient(135deg, #A80C4C, #090939, #421256, #531C9B)", color: "white"}}
                >
                  <FiPlus className="me-2" />
                  New Project
                </Button>
              </div>
            </div>

            <div className="debug-projects-grid">
              {filteredProjects.map((proj, index) => (
                <Card 
                  key={proj.uuid || index} 
                  className="project-card-custom mb-3"
                  style={{background: getRandomCardColor(index), borderRadius: '12px'}}
                >
                  <Card.Body>
                    <div className="date-tag mb-2">{formatProjectDate(proj)}</div>
                    <Card.Title className="project-title">
                      {proj?.project_name || proj?.projectName || "No Project Name"}
                    </Card.Title>
                    <Card.Text className="project-desc">
                      {proj?.project_description || proj?.projectDescription || "No description available"}
                    </Card.Text>

                    <div className="btn-container">
                      <div className="d-flex justify-content-between align-items-center">
                        <h5 className="card-title mb-1">{proj?.project_name || proj?.projectName || 'Untitled Project'}</h5>
                        <div className="d-flex gap-2">
                          <Button
                            variant="outline-primary"
                            size="sm"
                            onClick={() => handleCreateChat(proj)}
                            disabled={!canCreate('chat') || chatLoading[proj.uuid || proj.id]}
                          >
                            {chatLoading[proj.uuid || proj.id] ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
                                Creating...
                              </>
                            ) : (
                              <><FiMessageSquare className="me-1" /> Chat</>
                            )}
                          </Button>
                        </div>
                      </div>
                      {projectChats[proj.uuid || proj.id]?.length > 0 && (
                        <div className="mt-2">
                          <small className="text-muted d-block mb-1">Recent Chats:</small>
                          <div className="d-flex flex-wrap gap-1">
                            {projectChats[proj.uuid || proj.id].slice(0, 3).map(chat => (
                              <Button
                                key={chat.id}
                                variant="outline-secondary"
                                size="sm"
                                className="text-truncate"
                                style={{ maxWidth: '100px' }}
                                as={Link}
                                to="/chatbot/WorkChat"
                                state={{
                                  projectId: proj.uuid || proj.id,
                                  projectName: proj?.project_name || proj?.projectName,
                                  chatId: chat.chat_id
                                }}
                              >
                                {chat.chat_id}
                              </Button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card.Body>
                </Card>
              ))}
            </div>
          </div>
        )}
      </Row>

      {/* Scroll To Top */}
      {showScrollTop && (
        <Button onClick={scrollToTop} className="scroll-to-top-btn" variant="primary" size="sm" title="Scroll to top">
          <FiArrowUp />
        </Button>
      )}
    </Container>
  );
};

export default Dashboard;
