import React, { useState, useEffect, useContext } from "react";
import { Container, Card, Button, Tab, Tabs, Modal, Form, Table, Badge, Row, Col, Alert, ProgressBar, InputGroup, OverlayTrigger, Tooltip } from "react-bootstrap";
import { MyContext } from "../../App";
import "./Broadcasts.css";
import "../Dashboard/Dashboard.css";
import { toast } from 'react-toastify';
import projectDatabaseSupabase from "../../services/projectDatabaseSupabase";
import { databaseService } from "../../services/supabase";
import CalendarPicker from '../../components/CalendarPicker';


const API_BASE_URL = "https://zeelsheta-webugmate-backend-pr-2-1.hf.space/api";

const Broadcasts = () => {
    const { userEmail, userRole, username } = useContext(MyContext);
    const [key, setKey] = useState('updates');

    // Data State
    const [broadcasts, setBroadcasts] = useState([]);
    const [myTasks, setMyTasks] = useState([]);
    const [projects, setProjects] = useState([]);
    const [dashboardMetrics, setDashboardMetrics] = useState(null);
    const [users, setUsers] = useState([]);

    // UI State
    const [loading, setLoading] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showTaskModal, setShowTaskModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showViewTasksModal, setShowViewTasksModal] = useState(false);

    // Form State
    const [selectedBroadcast, setSelectedBroadcast] = useState(null);
    const [selectedTask, setSelectedTask] = useState(null);
    const [formData, setFormData] = useState({});
    const [assignData, setAssignData] = useState({ user_ids: [] });
    const [broadcastTasks, setBroadcastTasks] = useState([]);
    const [assignableTasks, setAssignableTasks] = useState([]);
    const [assignNote, setAssignNote] = useState("");
    const [selectedProject, setSelectedProject] = useState(null);

    // Projects Tab State
    const [projectList, setProjectList] = useState([]);
    const [projectLoading, setProjectLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
    const [fieldFilter, setFieldFilter] = useState("All");

    // Dropdown State
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const [isFieldOpen, setIsFieldOpen] = useState(false);
    const [isPriorityOpen, setIsPriorityOpen] = useState(false);
    const statusDropdownRef = React.useRef(null);
    const fieldDropdownRef = React.useRef(null);
    const priorityDropdownRef = React.useRef(null);

    // udit start - Calendar State
    const [isDeadlineCalendarOpen, setIsDeadlineCalendarOpen] = useState(false);
    // udit end

    // Status Options for Dropdown
    const statusOptions = [
        { value: "All", label: "All Status" },
        { value: "active", label: "Active" },
        { value: "completed", label: "Completed" },
        { value: "hold", label: "Hold" },
        { value: "suspended", label: "Suspended" },
        { value: "internal", label: "Internal" }
    ];

    // Tech Field Options for Dropdown
    const fieldOptions = [
        { value: "All", label: "All Tech Fields" },
        { value: "WEB_DEV", label: "Web Dev" },
        { value: "MOBILE_DEV", label: "Mobile Dev" },
        { value: "UI/UX", label: "UI/UX" },
        { value: "AI", label: "AI" },
        { value: "OTHER", label: "Other" }
    ];

    // Priority Options for Dropdown
    const priorityOptions = [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" }
    ];


    // Fetch Utilities
    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer webugmate123',
        'user_email': userEmail
    };

    const fetchBroadcasts = async () => {
        try {
            setLoading(true);
            const res = await fetch(`${API_BASE_URL}/project-broadcast?user_email=${encodeURIComponent(userEmail)}`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) setBroadcasts(data);
        } catch (error) {
            console.error("Error fetching broadcasts:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchProjects = async () => {
        try {
            const projectsData = await projectDatabaseSupabase.getAllProjects(userEmail, userRole);
            const uniqueProjectsMap = new Map();
            (projectsData || []).forEach(project => {
                const id = project.uuid || project.id;
                if (id) {
                    uniqueProjectsMap.set(id, { ...project, uuid: id });
                }
            });
            setProjects(Array.from(uniqueProjectsMap.values()));
        } catch (error) {
            console.error("Error fetching projects:", error);
        }
    };

    const fetchMyTasks = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/my-tasks?user_email=${encodeURIComponent(userEmail)}`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) setMyTasks(data);
        } catch (error) {
            console.error("Error fetching tasks:", error);
        }
    };

    const fetchDashboard = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/manager/dashboard?user_email=${encodeURIComponent(userEmail)}`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) setDashboardMetrics(data);
        } catch (error) {
            console.error("Error fetching dashboard:", error);
        }
    };

    const fetchUsers = async () => {
        try {
            const res = await fetch(`${API_BASE_URL}/users-list`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) setUsers(data);
        } catch (error) {
            console.error("Error fetching users:", error);
        }
    };

    const fetchProjectList = async () => {
        setProjectLoading(true);
        try {
            // Fetch directly from Supabase with RBAC filtering
            const data = await projectDatabaseSupabase.getAllProjectsOrdered(userEmail, userRole);
            setProjectList(data);
        } catch (error) {
            console.error("Error fetching project list:", error);
            toast.error("Failed to load projects");
        } finally {
            setProjectLoading(false);
        }
    };


    useEffect(() => {
        fetchBroadcasts();
        fetchUsers();
        fetchProjects();
        fetchMyTasks();
        fetchDashboard();
    }, [userEmail]);

    useEffect(() => {
        if (key === 'my-tasks') fetchMyTasks();
        if (key === 'dashboard') fetchDashboard();
        if (key === 'updates') {
            fetchBroadcasts();
            fetchProjectList();
        }
    }, [key, userEmail]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
                setIsStatusOpen(false);
            }
            if (fieldDropdownRef.current && !fieldDropdownRef.current.contains(event.target)) {
                setIsFieldOpen(false);
            }
            if (priorityDropdownRef.current && !priorityDropdownRef.current.contains(event.target)) {
                setIsPriorityOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const filteredProjects = projectList.filter(p => {
        const term = searchQuery.toLowerCase();
        const matchesSearch = (p.project_name?.toLowerCase().includes(term) ||
            p.client_name?.toLowerCase().includes(term));
        const matchesStatus = statusFilter === "All" || p.status === statusFilter;
        const matchesField = fieldFilter === "All" || p.project_field === fieldFilter;
        return matchesSearch && matchesStatus && matchesField;
    });

    const getProjectStatusBadge = (s) => {
        const map = {
            active: 'primary',
            completed: 'success',
            hold: 'warning',
            suspended: 'danger',
            internal: 'info'
        };
        return <Badge bg={map[s?.toLowerCase()] || 'secondary'}>{s}</Badge>;
    };


    // Handlers
    const handleViewTasks = async (broadcast) => {
        setSelectedBroadcast(broadcast);
        setSelectedProject(null);
        try {
            const res = await fetch(`${API_BASE_URL}/project-broadcast/${broadcast.id}/tasks`, { headers: authHeaders });
            const data = await res.json();
            if (res.ok) {
                setBroadcastTasks(data);
                setShowViewTasksModal(true);
            }
        } catch (error) {
            toast.error("Error fetching tasks");
        }
    };

    const handleViewProjectTasks = async (project) => {
        setSelectedProject(project);
        setSelectedBroadcast(null);
        const pid = project.uuid || project.id;
        try {
            // Re-use aggregation logic to find tasks for this project
            const allTasksPromises = broadcasts.map(b =>
                fetch(`${API_BASE_URL}/project-broadcast/${b.id}/tasks`, { headers: authHeaders })
                    .then(res => res.json())
                    .then(data => Array.isArray(data) ? data : [])
            );

            const results = await Promise.all(allTasksPromises);
            const allTasks = results.flat();

            const projectTasks = allTasks.filter(t =>
                t.project_id === pid ||
                t.project_uuid === pid ||
                (t.description && t.description.includes(`[Project:${pid}]`))
            );

            setBroadcastTasks(projectTasks);
            setShowViewTasksModal(true);
        } catch (error) {
            console.error(error);
            toast.error("Error fetching project tasks");
        }
    };

    const handleCreateBroadcast = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_BASE_URL}/project-broadcast`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({ ...formData, created_by_email: userEmail })
            });
            if (res.ok) {
                toast.success("Broadcast created!");
                setShowCreateModal(false);
                fetchBroadcasts();
                setFormData({});
            } else {
                const errData = await res.json();
                toast.error(`Failed: ${errData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error(error);
            toast.error(`Error creating broadcast: ${error.message}`);
        }
    };

    const handleCreateTask = async (e) => {
        e.preventDefault();
        // Default to first broadcast if none selected, effectively hiding the concept from the user
        let broadcastId = selectedBroadcast?.id || formData.broadcast_id || broadcasts[0]?.id;

        if (!broadcastId) {
            try {
                // Auto-create a default broadcast container if none exists
                const createRes = await fetch(`${API_BASE_URL}/project-broadcast`, {
                    method: 'POST',
                    headers: authHeaders,
                    body: JSON.stringify({
                        title: "General Tasks",
                        description: "System created container for tasks",
                        type: "general",
                        created_by_email: userEmail
                    })
                });

                if (createRes.ok) {
                    const data = await createRes.json();
                    broadcastId = data.id || (data.data && data.data[0]?.id);

                    // If we still don't have an ID, try fetching the list immediately
                    if (!broadcastId) {
                        const listRes = await fetch(`${API_BASE_URL}/project-broadcast?user_email=${encodeURIComponent(userEmail)}`, { headers: authHeaders });
                        const listData = await listRes.json();
                        if (listData && listData.length > 0) {
                            broadcastId = listData[0].id;
                        }
                    }

                    // Refresh the main list in background
                    fetchBroadcasts();
                }
            } catch (err) {
                console.error("Auto-create broadcast failed", err);
            }
        }

        if (!broadcastId) {
            toast.error("System error: Could not initialize task container. Please try again.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/project-broadcast/${broadcastId}/task`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify(formData)
            });
            if (res.ok) {
                toast.success("Task added!");
                setShowTaskModal(false);
                setFormData({});
                // Only refresh tasks if we were viewing a specific broadcast's tasks
                if (showViewTasksModal && selectedBroadcast) handleViewTasks(selectedBroadcast);
                // Always refresh broadcasts to update counts if applicable
                fetchBroadcasts();
            } else {
                const errData = await res.json();
                console.error("Task creation failed:", errData);
                toast.error(`Failed to create task: ${errData.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error("Error adding task:", error);
            toast.error("Error adding task: " + error.message);
        }
    };

    const fetchProjectTasks = async (projectId) => {
        setLoading(true);
        try {
            // Aggregate tasks from all broadcasts to find ones for this project
            // This is a client-side workaround since we don't have a direct /project/{id}/tasks endpoint
            const allTasksPromises = broadcasts.map(b =>
                fetch(`${API_BASE_URL}/project-broadcast/${b.id}/tasks`, { headers: authHeaders })
                    .then(res => res.json())
                    .then(data => Array.isArray(data) ? data : [])
            );

            const results = await Promise.all(allTasksPromises);
            const allTasks = results.flat();

            // Filter tasks that belong to this project using both direct field and meta-tag fallback
            const projectTasks = allTasks.filter(t =>
                t.project_id === projectId ||
                t.project_uuid === projectId ||
                (t.description && t.description.includes(`[Project:${projectId}]`))
            );

            // Remove duplicates if any (based on id)
            const uniqueTasks = Array.from(new Map(projectTasks.map(item => [item.id, item])).values());

            setAssignableTasks(uniqueTasks);
        } catch (error) {
            console.error("Error fetching project tasks:", error);
            toast.error("Failed to load project tasks");
        } finally {
            setLoading(false);
        }
    };

    const handleToggleUser = (userId) => {
        const currentIds = assignData.user_ids || [];
        if (currentIds.includes(userId)) {
            setAssignData({ ...assignData, user_ids: currentIds.filter(id => id !== userId) });
        } else {
            setAssignData({ ...assignData, user_ids: [...currentIds, userId] });
        }
    };

    const handleAssignTask = async (e) => {
        e.preventDefault();
        if (!selectedTask) return;
        if (!assignData.user_ids || assignData.user_ids.length === 0) {
            toast.error("Please select at least one developer.");
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/task/${selectedTask.id}/assign`, {
                method: 'POST',
                headers: authHeaders,
                body: JSON.stringify({
                    user_ids: assignData.user_ids,
                    assigned_by_email: userEmail,
                    note: assignNote
                })
            });
            if (res.ok) {
                toast.success(`Task assigned to ${assignData.user_ids.length} developers!`);
                setShowAssignModal(false);
                setAssignData({ user_ids: [] });
                setAssignNote("");
            } else {
                const err = await res.json();
                toast.error(err.error || "Assignment failed");
            }
        } catch (error) {
            toast.error("Error assigning task");
        }
    };

    const handleStatusUpdate = async (assignmentId, newStatus) => {
        try {
            const res = await fetch(`${API_BASE_URL}/task-assignment/${assignmentId}/status`, {
                method: 'PATCH',
                headers: authHeaders,
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                toast.success("Status updated!");
                fetchMyTasks();
            }
        } catch (error) {
            toast.error("Error updating status");
        }
    };

    const getPriorityBadge = (p) => {
        const map = { high: 'danger', medium: 'warning', low: 'success' };
        return <Badge bg={map[p] || 'secondary'}>{p}</Badge>;
    };

    const getStatusBadge = (s) => {
        const map = { completed: 'success', in_progress: 'primary', pending: 'secondary' };
        return <Badge bg={map[s] || 'dark'}>{s}</Badge>;
    };

    return (
        <Container fluid className="broadcasts-container" style={{ paddingTop: "120px" }}>
            <div className="ann-hero glass-surface">
                <div className="ann-hero-left">
                    <h1 className="page-title mb-1">Project Missions</h1>
                    <p className="ann-hero-sub">Manage Missions, tasks, and assignments.</p>
                </div>
                <div className="ann-hero-right">
                    {/* Header button removed */}
                </div>
            </div>

            {/* Tabs Navigation */}
            <Tabs
                id="broadcasts-tabs"
                activeKey={key}
                onSelect={(k) => setKey(k)}
                className="glass-tabs mb-4"
            >
                <Tab eventKey="updates" title="📢 Missions" classname="btn btn-sm pill-action-btn d-flex align-items-center">
                    {/* Project Directory Section */}
                    <div className="glass-surface p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-2 border-bottom border-white-10">
                            <h4 className="text-white mb-0 ps-2 border-start border-4 border-warning">Project Directory</h4>
                            <Button size="sm" variant="outline-secondary" className="view-details-pill btn-sm">
                                Total Projects: {filteredProjects.length}
                            </Button>
                        </div>

                        <Row className="mb-4 g-3 align-items-center">
                            <Col md={5}>
                                <InputGroup className="glass-input-group">
                                    <InputGroup.Text className="bg-transparent text-white border-white-50">🔍</InputGroup.Text>
                                    <Form.Control
                                        placeholder="Search by Project or Client..."
                                        className="bg-transparent text-white border-white-50"
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                    />
                                </InputGroup>
                            </Col>
                            <Col md={3}>
                                {/* Status Dropdown with styled nav-list */}
                                <ul className="nav-list mb-0" ref={statusDropdownRef} style={{ listStyle: 'none', padding: 0 }}>
                                    <li className={`has-dropdown ${isStatusOpen ? 'open' : ''}`}>
                                        <span
                                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                                            className="status-dropdown d-flex align-items-center justify-content-center"
                                            style={{
                                                cursor: 'pointer',
                                                border: '1px solid transparent',
                                                borderRadius: '999px',
                                                background: 'linear-gradient(135deg, var(--dash-accent), var(--dash-primary))',
                                                opacity: 1,
                                                color: '#ffffff',
                                                width: '100%',
                                                padding: '0.5rem 1.25rem',
                                                fontWeight: 700,
                                                fontSize: '0.875rem'
                                            }}
                                        >
                                            {statusOptions.find(opt => opt.value === statusFilter)?.label}
                                        </span>

                                        <ul className="dropdown">
                                            {statusOptions.map((option) => (
                                                <li key={option.value}>
                                                    <a
                                                        href="#filter"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setStatusFilter(option.value);
                                                            setIsStatusOpen(false);
                                                        }}
                                                    >
                                                        {option.label}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                </ul>
                            </Col>
                            <Col md={4}>
                                {/* Tech Field Dropdown with styled nav-list */}
                                <ul className="nav-list mb-0" ref={fieldDropdownRef} style={{ listStyle: 'none', padding: 0 }}>
                                    <li className={`has-dropdown ${isFieldOpen ? 'open' : ''}`}>
                                        <span
                                            onClick={() => setIsFieldOpen(!isFieldOpen)}
                                            className="status-dropdown d-flex align-items-center justify-content-center"
                                            style={{
                                                cursor: 'pointer',
                                                border: '1px solid transparent',
                                                borderRadius: '999px',
                                                background: 'linear-gradient(135deg, var(--dash-accent), var(--dash-primary))',
                                                opacity: 1,
                                                color: '#ffffff',
                                                width: '100%',
                                                padding: '0.5rem 1.25rem',
                                                fontWeight: 700,
                                                fontSize: '0.875rem',

                                            }}
                                        >
                                            {fieldOptions.find(opt => opt.value === fieldFilter)?.label}
                                        </span>

                                        <ul className="dropdown">
                                            {fieldOptions.map((option) => (
                                                <li key={option.value}>
                                                    <a
                                                        href="#filter"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            setFieldFilter(option.value);
                                                            setIsFieldOpen(false);
                                                        }}
                                                    >
                                                        {option.label}
                                                    </a>
                                                </li>
                                            ))}
                                        </ul>
                                    </li>
                                </ul>
                            </Col>
                        </Row>

                        {projectLoading ? (
                            <div className="text-center p-5"><div className="spinner-border text-primary"></div><p className="text-white mt-3">Loading Projects...</p></div>
                        ) : filteredProjects.length === 0 ? (
                            <div className="text-center p-5 glass-surface border-white-10">
                                <h4 className="text-white opacity-50">No projects found matching your filters</h4>
                            </div>
                        ) : (
                            <Row>
                                {filteredProjects.map(project => (
                                    <Col lg={12} key={project.uuid || project.id} className="mb-4">
                                        <Card className="glass-surface border-0 p-3 position-relative overflow-hidden project-card-v2">
                                            <div className="card-subtle-glow" />
                                            <Card.Body className="position-relative" style={{ zIndex: 1 }}>
                                                <div className="d-flex justify-content-between align-items-start mb-4">
                                                    <div>
                                                        <div className="d-flex align-items-center gap-3 flex-wrap">
                                                            <h3 className="mb-0 text-white fw-bold">{project.project_name}</h3>
                                                            {getProjectStatusBadge(project.status)}
                                                            <Badge bg="dark" className="border border-secondary text-info fw-normal">{project.project_field}</Badge>
                                                        </div>
                                                        <div className="d-flex align-items-center gap-2 mt-2 text-white">
                                                            <span className="material-icons" style={{ fontSize: '18px', opacity: 0.7 }}>business</span>
                                                            <small className="opacity-75">{project.client_name || 'No Client'}</small>
                                                        </div>
                                                    </div>
                                                    <div className="text-end">
                                                        <div className="timeline-box">
                                                            <small className="timeline-label">Timeline</small>
                                                            <span className="timeline-date">
                                                                {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'TBD'}
                                                                <span className="timeline-arrow">→</span>
                                                                {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'TBD'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <Row className="g-4">
                                                    <Col md={7}>
                                                        <div className="mb-4">
                                                            <h6 className="section-title">Description</h6>
                                                            <p className="project-desc-small">
                                                                {project.project_description ?
                                                                    (project.project_description.length > 250 ? project.project_description.substring(0, 250) + '...' : project.project_description)
                                                                    : "No description provided."}
                                                            </p>
                                                        </div>

                                                        <div>
                                                            <h6 className="section-title">Tech Stack</h6>
                                                            <div className="d-flex flex-wrap gap-2">
                                                                {(project.tech_stack || []).map((t, i) => (
                                                                    <Badge key={i} className="tech-tag">
                                                                        {t}
                                                                    </Badge>
                                                                ))}
                                                                {(!project.tech_stack || project.tech_stack.length === 0) && <small className="text-muted">No tech stack specified</small>}
                                                            </div>
                                                        </div>
                                                    </Col>

                                                    <Col md={5} className="d-flex flex-column gap-4 border-start border-white-10 ps-md-4">
                                                        <div>
                                                            <h6 className="section-title">Project Leader</h6>
                                                            <div className="leader-box">
                                                                <div className="leader-avatar">
                                                                    {project.leader_of_project ? project.leader_of_project.substring(0, 2).toUpperCase() : 'PL'}
                                                                </div>
                                                                <div>
                                                                    <span className="leader-name">{project.leader_of_project || "Unassigned"}</span>
                                                                    <small className="leader-role">Team Lead</small>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div>
                                                            <h6 className="section-title">Team Members ({project.assigned_to_emails?.length || 0})</h6>
                                                            <div className="d-flex flex-wrap gap-2 align-items-center">
                                                                {(project.assigned_to_emails || []).slice(0, 8).map((email, i) => (
                                                                    <OverlayTrigger key={i} placement="top" overlay={<Tooltip>{email}</Tooltip>}>
                                                                        <div className="member-avatar">
                                                                            {email.substring(0, 2).toUpperCase()}
                                                                        </div>
                                                                    </OverlayTrigger>
                                                                ))}
                                                                {(project.assigned_to_emails || []).length > 8 && (
                                                                    <div className="member-avatar-more">
                                                                        +{project.assigned_to_emails.length - 8}
                                                                    </div>
                                                                )}
                                                                {(!project.assigned_to_emails || project.assigned_to_emails.length === 0) && <small className="text-muted">No members assigned</small>}
                                                            </div>
                                                        </div>
                                                    </Col>
                                                </Row>

                                                <div className="card-footer-v2">
                                                    <div className="d-flex gap-2">
                                                        <Button size="sm" variant="primary" className="create-chat-btn btn-sm"
                                                            onClick={() => handleViewProjectTasks(project)}
                                                        >

                                                            View & Assign Tasks
                                                        </Button>
                                                        <Button size="sm" variant="outline-secondary" className="view-details-pill btn-sm"

                                                            onClick={() => {
                                                                setSelectedProject(project);
                                                                setSelectedBroadcast(null);
                                                                setFormData({ project_id: project.uuid || project.id, priority: 'low' });
                                                                setShowTaskModal(true);
                                                            }}
                                                        >

                                                            Add Task
                                                        </Button>
                                                    </div>
                                                    <div className="creation-date">Created on {new Date(project.created_at).toLocaleDateString()}</div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>
                </Tab>

                <Tab eventKey="my-tasks" title="📋 My Missions" classname="btn btn-sm pill-action-btn d-flex align-items-center">
                    <div className="glass-surface p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-white-10">
                            <h4 className="text-white mb-0 ps-2 border-start border-4 border-info">My Assigned Tasks</h4>
                            <Badge bg="info" className="p-2 shadow-sm">Total: {myTasks.length}</Badge>
                        </div>

                        {/* Task Stats */}
                        <Row className="g-4 mb-4">
                            <Col md={4}>
                                <div className="stat-card-custom">
                                    <div className="stat-value text-warning">{myTasks.filter(t => t.status === 'pending').length}</div>
                                    <div className="stat-title">Pending Tasks</div>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="stat-card-custom">
                                    <div className="stat-value text-primary">{myTasks.filter(t => t.status === 'in_progress').length}</div>
                                    <div className="stat-title">In Progress</div>
                                </div>
                            </Col>
                            <Col md={4}>
                                <div className="stat-card-custom">
                                    <div className="stat-value text-success">{myTasks.filter(t => t.status === 'completed').length}</div>
                                    <div className="stat-title">Completed</div>
                                </div>
                            </Col>
                        </Row>

                        {myTasks.length === 0 ? (
                            <div className="text-center p-5 glass-surface-light rounded">
                                <span className="material-icons mb-3" style={{ fontSize: '64px', opacity: 0.3 }}>assignment</span>
                                <h5 className="text-white opacity-50">No tasks assigned to you yet</h5>
                                <p className="text-muted">Tasks will appear here when they are assigned to you</p>
                            </div>
                        ) : (
                            <div className="tasks-grid">
                                {myTasks.map(task => (
                                    <Card key={task.assignment_id} className="task-card-custom glass-surface border-0 mb-3">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-start mb-3">
                                                <div className="flex-grow-1">
                                                    <h5 className="text-white mb-2">{task.task_title}</h5>
                                                    <p className="text-muted small mb-0">{task.task_description || 'No description provided'}</p>
                                                </div>
                                                <div className="ms-3">
                                                    {getPriorityBadge(task.priority)}
                                                </div>
                                            </div>

                                            <div className="d-flex justify-content-between align-items-center pt-3 border-top border-white-10">
                                                <div className="d-flex align-items-center gap-3">
                                                    <div>
                                                        <small className="text-muted d-block">Status</small>
                                                        {getStatusBadge(task.status)}
                                                    </div>
                                                    <div>
                                                        <small className="text-muted d-block">Deadline</small>
                                                        <span className="text-white small">{task.deadline ? new Date(task.deadline).toLocaleDateString() : 'N/A'}</span>
                                                    </div>
                                                </div>
                                                <Form.Select
                                                    size="sm"
                                                    value={task.status}
                                                    onChange={(e) => handleStatusUpdate(task.assignment_id, e.target.value)}
                                                    className="glass-select"
                                                    style={{ width: '150px' }}
                                                >
                                                    <option value="pending">Pending</option>
                                                    <option value="in_progress">In Progress</option>
                                                    <option value="completed">Completed</option>
                                                </Form.Select>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>
                </Tab>

                <Tab eventKey="dashboard" title="📊 Manager Dashboard" classname="btn btn-sm pill-action-btn ">
                    <div className="glass-surface p-4">
                        <div className="d-flex justify-content-between align-items-center mb-4 pb-3 border-bottom border-white-10">
                            <h4 className="text-white mb-0 ps-2 border-start border-4 border-success">Manager Dashboard</h4>
                            <Badge bg="success" className="p-2 shadow-sm">Overview</Badge>
                        </div>

                        {!dashboardMetrics ? (
                            <div className="text-center p-5">
                                <div className="spinner-border text-primary"></div>
                                <p className="text-white mt-3">Loading dashboard...</p>
                            </div>
                        ) : (
                            <>
                                {/* Stats Cards */}
                                <Row className="g-4 mb-4">
                                    <Col md={3} sm={6}>
                                        <div className="stat-card-custom">
                                            <div className="mb-2">
                                                <span className="material-icons" style={{ fontSize: '32px', color: 'var(--dash-primary)' }}>campaign</span>
                                            </div>
                                            <div className="stat-value">{dashboardMetrics.total_broadcasts || 0}</div>
                                            <div className="stat-title">Total Broadcasts</div>
                                        </div>
                                    </Col>
                                    <Col md={3} sm={6}>
                                        <div className="stat-card-custom">
                                            <div className="mb-2">
                                                <span className="material-icons" style={{ fontSize: '32px', color: 'var(--dash-accent)' }}>assignment</span>
                                            </div>
                                            <div className="stat-value">{dashboardMetrics.total_tasks || 0}</div>
                                            <div className="stat-title">Total Tasks</div>
                                        </div>
                                    </Col>
                                    <Col md={3} sm={6}>
                                        <div className="stat-card-custom">
                                            <div className="mb-2">
                                                <span className="material-icons" style={{ fontSize: '32px', color: '#fbbf24' }}>pending_actions</span>
                                            </div>
                                            <div className="stat-value text-warning">{dashboardMetrics.pending_tasks || 0}</div>
                                            <div className="stat-title">Pending Tasks</div>
                                        </div>
                                    </Col>
                                    <Col md={3} sm={6}>
                                        <div className="stat-card-custom">
                                            <div className="mb-2">
                                                <span className="material-icons" style={{ fontSize: '32px', color: '#10b981' }}>check_circle</span>
                                            </div>
                                            <div className="stat-value text-success">{dashboardMetrics.completed_tasks || 0}</div>
                                            <div className="stat-title">Completed Tasks</div>
                                        </div>
                                    </Col>
                                </Row>

                                {/* Progress Section */}
                                {dashboardMetrics.task_completion_rate !== undefined && (
                                    <Card className="glass-surface border-0 p-4 mb-4">
                                        <Card.Body>
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <h6 className="text-white mb-0">Task Completion Rate</h6>
                                                <Badge bg="success" className="px-3 py-2">{dashboardMetrics.task_completion_rate}%</Badge>
                                            </div>
                                            <ProgressBar
                                                now={dashboardMetrics.task_completion_rate}
                                                variant="success"
                                                style={{ height: '20px', borderRadius: '10px' }}
                                                className="progress-custom"
                                            />
                                            <div className="d-flex justify-content-between mt-2">
                                                <small className="text-muted">0%</small>
                                                <small className="text-muted">100%</small>
                                            </div>
                                        </Card.Body>
                                    </Card>
                                )}

                                {/* Additional Metrics */}
                                <Row className="g-4">
                                    <Col md={6}>
                                        <Card className="glass-surface border-0 p-3">
                                            <Card.Body>
                                                <h6 className="text-white mb-3 d-flex align-items-center gap-2">
                                                    <span className="material-icons" style={{ fontSize: '20px' }}>trending_up</span>
                                                    Task Distribution
                                                </h6>
                                                <div className="d-flex flex-column gap-2">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">Pending</span>
                                                        <Badge bg="warning">{dashboardMetrics.pending_tasks || 0}</Badge>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">In Progress</span>
                                                        <Badge bg="primary">{(dashboardMetrics.total_tasks || 0) - (dashboardMetrics.pending_tasks || 0) - (dashboardMetrics.completed_tasks || 0)}</Badge>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">Completed</span>
                                                        <Badge bg="success">{dashboardMetrics.completed_tasks || 0}</Badge>
                                                    </div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                    <Col md={6}>
                                        <Card className="glass-surface border-0 p-3">
                                            <Card.Body>
                                                <h6 className="text-white mb-3 d-flex align-items-center gap-2">
                                                    <span className="material-icons" style={{ fontSize: '20px' }}>insights</span>
                                                    Quick Stats
                                                </h6>
                                                <div className="d-flex flex-column gap-2">
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">Active Broadcasts</span>
                                                        <span className="text-white fw-bold">{dashboardMetrics.total_broadcasts || 0}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">Total Tasks</span>
                                                        <span className="text-white fw-bold">{dashboardMetrics.total_tasks || 0}</span>
                                                    </div>
                                                    <div className="d-flex justify-content-between align-items-center">
                                                        <span className="text-muted">Completion Rate</span>
                                                        <span className="text-success fw-bold">{dashboardMetrics.task_completion_rate || 0}%</span>
                                                    </div>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                </Row>
                            </>
                        )}
                    </div>
                </Tab>
            </Tabs>

            <Modal show={showCreateModal} onHide={() => setShowCreateModal(false)} centered dialogClassName="glass-modal">
                <Modal.Header closeButton closeVariant="white">
                    <Modal.Title>Create New Broadcast</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleCreateBroadcast}>
                        <Form.Group className="mb-3">
                            <Form.Label>Title</Form.Label>
                            <Form.Control required onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description</Form.Label>
                            <Form.Control as="textarea" required onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Type</Form.Label>
                            <Form.Select onChange={e => setFormData({ ...formData, type: e.target.value })}>
                                <option value="general">General</option>
                                <option value="urgent">Urgent</option>
                                <option value="project">Project Update</option>
                            </Form.Select>
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100">Create Broadcast</Button>
                    </Form>
                </Modal.Body>
            </Modal>

            <Modal show={showTaskModal} onHide={() => setShowTaskModal(false)} centered dialogClassName="project-form-modal">
                <Modal.Header closeButton closeVariant="white">
                    <Modal.Title>{selectedBroadcast ? `Add Task to ${selectedBroadcast.title}` : 'Assign New Task'}</Modal.Title>
                </Modal.Header>
                <Modal.Body className="project-form-card">
                    <Form onSubmit={handleCreateTask}>
                        {!selectedProject && (
                            <Form.Group className="mb-3">
                                <Form.Label>Link Project</Form.Label>
                                <Form.Select
                                    required
                                    value={formData.project_id || ''}
                                    onChange={e => setFormData({ ...formData, project_id: e.target.value })}
                                >
                                    <option value="">-- Select Project --</option>
                                    {projects.map(p => (
                                        <option key={p.uuid} value={p.uuid}>
                                            {p.project_name} {p.id ? `(${p.id})` : ''}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Form.Group>
                        )}
                        <Form.Group className="mb-3">
                            <Form.Label>Task Title</Form.Label>
                            <Form.Control required onChange={e => setFormData({ ...formData, title: e.target.value })} />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Description (Optional)</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                placeholder="e.g. Implement JWT login + validation"
                                onChange={e => setFormData({ ...formData, description: e.target.value })}
                            />
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Priority (Required)</Form.Label>
                            {/* Priority Dropdown with styled nav-list */}
                            <ul className="nav-list mb-0" ref={priorityDropdownRef} style={{ listStyle: 'none', padding: 0 }}>
                                <li className={`has-dropdown ${isPriorityOpen ? 'open' : ''}`}>
                                    <span
                                        onClick={() => setIsPriorityOpen(!isPriorityOpen)}
                                        className="status-dropdown d-flex align-items-center justify-content-center"
                                        style={{
                                            cursor: 'pointer',
                                            border: '1px solid transparent',
                                            borderRadius: '999px',
                                            background: 'linear-gradient(135deg, var(--dash-accent), var(--dash-primary))',
                                            opacity: 1,
                                            color: '#ffffff',
                                            width: '100%',
                                            padding: '0.5rem 1.25rem',
                                            fontWeight: 700,
                                            fontSize: '0.875rem'
                                        }}
                                    >
                                        {priorityOptions.find(opt => opt.value === (formData.priority || 'low'))?.label || 'Select Priority'}
                                    </span>

                                    <ul className="dropdown">
                                        {priorityOptions.map((option) => (
                                            <li key={option.value}>
                                                <a
                                                    href="#priority"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setFormData({ ...formData, priority: option.value });
                                                        setIsPriorityOpen(false);
                                                    }}
                                                >
                                                    {option.label}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                </li>
                            </ul>
                        </Form.Group>

                        <Form.Group className="mb-3">
                            <Form.Label>Deadline (Optional)</Form.Label>
                            {/* udit start */}
                            <Form.Control
                                type="text"
                                value={formData.deadline ? new Date(formData.deadline).toLocaleDateString() : ''}
                                onClick={() => setIsDeadlineCalendarOpen(true)}
                                placeholder="Select deadline"
                                readOnly
                                style={{ cursor: 'pointer' }}
                            />
                            {/* udit end */}
                        </Form.Group>
                        <Button type="submit" size="sm" variant="outline-light" className=".action-btn-sub">Save / Add Task</Button>
                    </Form>
                </Modal.Body>

                {/* udit start - Calendar Picker */}
                <CalendarPicker
                    isOpen={isDeadlineCalendarOpen}
                    onClose={() => setIsDeadlineCalendarOpen(false)}
                    onSelect={(date) => {
                        // Format date as YYYY-MM-DD
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        const formattedDate = `${year}-${month}-${day}`;
                        setFormData({ ...formData, deadline: formattedDate });
                        setIsDeadlineCalendarOpen(false);
                    }}
                    initialDate={formData.deadline ? new Date(formData.deadline) : new Date()}
                />
                {/* udit end */}
            </Modal>

            <Modal show={showViewTasksModal} onHide={() => setShowViewTasksModal(false)} size="lg" centered dialogClassName="glass-modal">
                <Modal.Header closeButton closeVariant="white">
                    <Modal.Title>Tasks for {selectedBroadcast ? `Broadcast: ${selectedBroadcast.title}` : `Project: ${selectedProject?.project_name}`}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    {broadcastTasks.length === 0 ? <p>No tasks found.</p> : (
                        <Table variant="dark" hover className="bg-transparent">
                            <thead>
                                <tr>
                                    <th>Title</th>
                                    <th>Priority</th>
                                    <th>Deadline</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {broadcastTasks.map(task => (
                                    <tr key={task.id}>
                                        <td>
                                            <div>{task.title}</div>
                                            <small className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                {task.description?.replace(/\[Project:[^\]]+\]/g, '').trim()}
                                            </small>
                                        </td>
                                        <td>{getPriorityBadge(task.priority)}</td>
                                        <td>{new Date(task.deadline).toLocaleDateString()}</td>
                                        <td>
                                            <Button size="sm" variant="success" onClick={() => {
                                                setSelectedTask(task);
                                                setAssignData({ user_ids: [] });
                                                setShowAssignModal(true);
                                            }}>Assign Developers</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </Table>
                    )}
                </Modal.Body>
            </Modal>

            <Modal show={showAssignModal} onHide={() => setShowAssignModal(false)} centered dialogClassName="glass-modal">
                <Modal.Header closeButton closeVariant="white">
                    <Modal.Title>{selectedTask ? `Assign: ${selectedTask.title}` : 'Assign Task to Users'}</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form onSubmit={handleAssignTask}>
                        {!selectedTask && (
                            <Form.Group className="mb-3">
                                <Form.Label>Select Task (Required)</Form.Label>
                                <Form.Select
                                    required
                                    onChange={e => {
                                        const t = assignableTasks.find(task => task.id.toString() === e.target.value);
                                        setSelectedTask(t);
                                    }}
                                >
                                    <option value="">-- Choose a Task --</option>
                                    {assignableTasks.map(t => (
                                        <option key={t.id} value={t.id}>{t.title} ({getPriorityBadge(t.priority)})</option>
                                    ))}
                                </Form.Select>
                                {assignableTasks.length === 0 && !loading && <span className="text-muted small">No tasks found for this project. Add one first.</span>}
                            </Form.Group>
                        )}

                        <Form.Label>Select Users / Team Members (Required)</Form.Label>
                        <div className="user-selection-list mb-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                            {users.map(u => (
                                <div key={u.user_id} className="d-flex align-items-center mb-2 p-2 glass-surface-light rounded">
                                    <Form.Check
                                        type="checkbox"
                                        checked={assignData.user_ids?.includes(u.user_id)}
                                        onChange={() => handleToggleUser(u.user_id)}
                                        label={
                                            <span className="ms-2">
                                                <strong>{u.name || u.email}</strong>
                                                <br />
                                                <small className="text-muted">{u.role}</small>
                                            </span>
                                        }
                                    />
                                </div>
                            ))}
                        </div>

                        <Form.Group className="mb-3">
                            <Form.Label>Instruction / Note (Optional)</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                placeholder="e.g. Complete before demo"
                                value={assignNote}
                                onChange={e => setAssignNote(e.target.value)}
                            />
                        </Form.Group>
                        <Button variant="primary" type="submit" className="w-100 mt-3">
                            Confirm Assignment ({assignData.user_ids?.length || 0})
                        </Button>
                    </Form>
                </Modal.Body>
            </Modal>
        </Container >
    );
};

export default Broadcasts;
