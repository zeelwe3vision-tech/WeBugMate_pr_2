import React, { useState, useEffect, useRef } from "react";
import "./project_info.css";
import { Container, Form, Button, Row, Col } from "react-bootstrap";
import projectDatabaseSupabase from '../../services/projectDatabaseSupabase';
import SuccessNotification from './SuccessNotification';
import { useNavigate } from "react-router-dom";
import { usePermissions } from '../../utils/permissionUtils';
import CalendarPicker from '../../components/CalendarPicker';

const roleOptions = [
    { label: "Frontend", value: "frontend" },
    { label: "Backend", value: "backend" },
    { label: "AI Development", value: "ai" },
    { label: "Metaverse", value: "metaverse" },
];

const statusOptions = [
    "Not Started", "In Progress", "Completed", "On Hold"
];
const techStackOptions = [
    "React-js", "Node-js", "MongoDB", "Python", "TensorFlow", "Unity", "Unreal", "Figma", "Photoshop"
];

const teamMembersList = [
];

const EmployeeProjectForm = () => {
    const navigate = useNavigate();
    const { canCreate } = usePermissions();

    const [form, setForm] = useState({
        projectName: "",
        projectDescription: "",
        startDate: "",
        endDate: "",
        status: "",
        assignedRole: "",
        assignedTo: [],
        clientName: "",
        organizationId: null,
        uploadDocuments: null,
        projectScope: "",
        techStack: [],
        techStackCustom: "",
        leaderOfProject: "",
        projectResponsibility: "",
        role: [],
        roleAnswers: {},
        customQuestion: "",
        customAnswer: "",
    });
    const [customTeamMember, setCustomTeamMember] = useState("");
    const [customTeamList, setCustomTeamList] = useState([]);
    const [teamAssignments, setTeamAssignments] = useState([]);
    const [selectedRoles, setSelectedRoles] = useState([]);
    const [isStartCalendarOpen, setIsStartCalendarOpen] = useState(false);
    const [isEndCalendarOpen, setIsEndCalendarOpen] = useState(false);
    // Example: [{ email: "abc@gmail.com", roles: ["web", "uiux"] }]

    const [customRole, setCustomRole] = useState("");
    const [customRoleList, setCustomRoleList] = useState([]);


    const [customTech, setCustomTech] = useState("");
    const [customTechList, setCustomTechList] = useState([]);
    const [customQuestion, setCustomQuestion] = useState("");
    const [customQuestionsList, setCustomQuestionsList] = useState([]);
    const [customAnswers, setCustomAnswers] = useState({});
    const [showSuccess, setShowSuccess] = useState(false);
    const [organizationList, setOrganizationList] = useState([]);
    const [showOrgDropdown, setShowOrgDropdown] = useState(false);

    // udit start 
    // Status Dropdown State
    const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
    const statusDropdownRef = useRef(null);

    // Leader Dropdown State
    const [isLeaderDropdownOpen, setIsLeaderDropdownOpen] = useState(false);
    const leaderDropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (statusDropdownRef.current && !statusDropdownRef.current.contains(event.target)) {
                setIsStatusDropdownOpen(false);
            }
            if (leaderDropdownRef.current && !leaderDropdownRef.current.contains(event.target)) {
                setIsLeaderDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // udit end 

    useEffect(() => {
        const fetchOrganizations = async () => {
            const orgs = await projectDatabaseSupabase.getOrganizations();
            console.log("Fetched orgs for dropdown:", orgs);
            setOrganizationList(orgs);
        };
        fetchOrganizations();
    }, []);

    const handleAddCustomTech = () => {
        const tech = customTech.trim();
        if (tech && !techStackOptions.concat(customTechList).includes(tech)) {
            setCustomTechList(prev => [...prev, tech]);
            setCustomTech("");
        }
    };
    const allRoleOptions = [...roleOptions, ...customRoleList];
    const allTechOptions = [...techStackOptions, ...customTechList];
    // For file upload
    const handleFileChange = (e) => {
        const files = Array.from(e.target.files);
        const fileReaders = files.map(file => {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    resolve({ name: file.name, data: event.target.result });
                };
                reader.onerror = (err) => reject(err);
                reader.readAsDataURL(file);
            });
        });
        Promise.all(fileReaders).then(fileObjs => {
            setForm((prev) => ({ ...prev, uploadDocuments: fileObjs }));
        });
    };

    const handleChange = (e) => {
        const { name, value, type, } = e.target;
        if (type === "checkbox" && name === "assignedTo") {
            setForm((prev) => {
                const arr = prev.assignedTo.includes(value)
                    ? prev.assignedTo.filter((v) => v !== value)
                    : [...prev.assignedTo, value];
                return { ...prev, assignedTo: arr };
            });
        } else if (type === "checkbox" && name === "techStack") {
            setForm((prev) => {
                const arr = prev.techStack.includes(value)
                    ? prev.techStack.filter((v) => v !== value)
                    : [...prev.techStack, value];
                return { ...prev, techStack: arr };
            });
        } else {
            setForm((prev) => ({ ...prev, [name]: value }));
        }
    };



    // const handleCustomAnswer = (value) => {
    //     setForm((prev) => ({ ...prev, customAnswer: value }));
    // };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Check permission before proceeding
        if (!canCreate('Project Form')) {
            alert('You do not have permission to create projects.');
            return;
        }

        try {
            console.log('=== FORM SUBMISSION DEBUG ===');
            console.log('Form data:', form);
            console.log('Team Assignments:', teamAssignments);
            console.log('Custom Questions:', customQuestionsList);
            console.log('Custom Answers:', customAnswers);

            const submissionData = {
                ...form,
                customQuestions: customQuestionsList,
                customAnswers: customAnswers,
                teamAssignments, // <-- include team members here
            };

            console.log('Complete submission data:', submissionData);

            // Save form data to Supabase database
            const result = await projectDatabaseSupabase.saveProject(submissionData);

            console.log('Save project result:', result);

            if (result.success) {
                setShowSuccess(true);
                console.log('Project saved successfully, redirecting to dashboard...');

                // Reset form after successful submission
                setForm({
                    projectName: "",
                    projectDescription: "",
                    startDate: "",
                    endDate: "",
                    status: "",
                    assignedRole: "",
                    assignedTo: [],
                    clientName: "",
                    uploadDocuments: null,
                    projectScope: "",
                    techStack: [],
                    techStackCustom: "",
                    leaderOfProject: "",
                    projectResponsibility: "",
                    role: [],
                    roleAnswers: {},
                    customQuestion: "",
                    customAnswer: "",
                });
                setCustomTeamList([]);
                setTeamAssignments([]); // <-- reset team members
                setCustomRoleList([]);
                setCustomTechList([]);
                setCustomQuestionsList([]);
                setCustomAnswers({});

                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    console.log('Navigating to dashboard with refresh flag...');
                    navigate('/dashboard', { state: { refreshProjects: true } });
                }, 2000);
            } else {
                console.error('Failed to save project:', result.message);
                alert('Failed to save project: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving project:', error);
            alert('Failed to save project. Please try again.');
        }
    };



    // Combine and deduplicate questions for all selected roles


    const handleAddCustomQuestion = () => {
        const question = customQuestion.trim();
        if (question && !customQuestionsList.includes(question)) {
            setCustomQuestionsList(prev => [...prev, question]);
            setCustomQuestion("");
        }
    };

    const handleCustomAnswerChange = (question, value) => {
        setCustomAnswers(prev => ({ ...prev, [question]: value }));
    };

    return (
        <Container className="project-form-container d-flex align-items-center justify-content-center min-vh-99" style={{ flexDirection: 'column' }}>
            <SuccessNotification show={showSuccess} message={`Project "${form.projectName}" has been successfully created! Redirecting to dashboard...`} onClose={() => setShowSuccess(false)} />
            <Form className="project-form-card p-4" onSubmit={handleSubmit}>
                <h3 className="mb-4 text-center">Employee Project Form</h3>
                {/* Default Questions */}
                <Form.Group className="mb-3">
                    <Form.Label>Project Name</Form.Label>
                    <Form.Control
                        type="text"
                        name="projectName"
                        value={form.projectName}
                        onChange={handleChange}
                        required
                        placeholder="Name/title of the project"
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Project Description</Form.Label>
                    <Form.Control
                        as="textarea"
                        name="projectDescription"
                        value={form.projectDescription}
                        onChange={handleChange}
                        rows={3}
                        required
                        placeholder="Summary or purpose of the project"
                    />
                </Form.Group>
                <Row>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>Start Date</Form.Label>
                            <Form.Control
                                type="text"
                                name="startDate"
                                value={form.startDate ? new Date(form.startDate).toLocaleDateString() : ''}
                                onClick={() => setIsStartCalendarOpen(true)}
                                readOnly
                                required
                                placeholder="dd-mm-yyyy"
                                style={{ cursor: 'pointer' }}
                            />
                        </Form.Group>
                    </Col>
                    <Col md={6}>
                        <Form.Group className="mb-3">
                            <Form.Label>End Date</Form.Label>
                            <Form.Control
                                type="text"
                                name="endDate"
                                value={form.endDate ? new Date(form.endDate).toLocaleDateString() : ''}
                                onClick={() => setIsEndCalendarOpen(true)}
                                readOnly
                                required
                                placeholder="dd-mm-yyyy"
                                style={{ cursor: 'pointer' }}
                            />
                        </Form.Group>
                    </Col>
                </Row>

                {/* Calendar Pickers */}
                <CalendarPicker
                    isOpen={isStartCalendarOpen}
                    onClose={() => setIsStartCalendarOpen(false)}
                    onSelect={(date) => {
                        // Format date as YYYY-MM-DD in local timezone
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setForm(prev => ({ ...prev, startDate: `${year}-${month}-${day}` }));
                    }}
                    initialDate={form.startDate ? new Date(form.startDate + 'T00:00:00') : new Date()}
                />

                <CalendarPicker
                    isOpen={isEndCalendarOpen}
                    onClose={() => setIsEndCalendarOpen(false)}
                    onSelect={(date) => {
                        // Format date as YYYY-MM-DD in local timezone
                        const year = date.getFullYear();
                        const month = String(date.getMonth() + 1).padStart(2, '0');
                        const day = String(date.getDate()).padStart(2, '0');
                        setForm(prev => ({ ...prev, endDate: `${year}-${month}-${day}` }));
                    }}
                    initialDate={form.endDate ? new Date(form.endDate + 'T00:00:00') : new Date()}
                    minDate={form.startDate ? new Date(form.startDate + 'T00:00:00') : null}
                />
                {/* //udit start */}
               <Form.Group className="mb-3">
                    <Form.Label>Status</Form.Label>
                    <div style={{ position: 'relative', zIndex: 1002 }}>
                        <ul className="nav-list mb-0" ref={statusDropdownRef} style={{ listStyle: 'none', padding: 0, position: 'relative' }}>
                            <li className={`has-dropdown ${isStatusDropdownOpen ? 'open' : ''}`}>
                                <span 
                                    onClick={() => setIsStatusDropdownOpen(!isStatusDropdownOpen)} 
                                    className="status-dropdown-btn d-flex align-items-center justify-content-center"
                                    style={{ 
                                           cursor: 'pointer', 
                                           border: '1px solid transparent',
                                           borderRadius : '999px',        // This line ensures the background stays the same even when App.css tries to change it on hover
                                           background: 'linear-gradient(135deg, var(--dash-accent), var(--dash-primary))',
                                            opacity: 1,
                                            color: '#ffffff'
      }} 
                                >
                                    {form.status || "Select status"}
                                </span>
                                
                                <ul className="dropdown">
                                    {statusOptions.map((status) => (
                                        <li key={status}>
                                            <a
                                                href="#status"
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    setForm(prev => ({ ...prev, status }));
                                                    setIsStatusDropdownOpen(false);
                                                }}
                                            >
                                                {status}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </li>
                        </ul>
                    </div>
                </Form.Group>
                {/* //udit end */}


                <Form.Group className="mb-3">
                    <Form.Label>Team Members with Roles</Form.Label>

                    {/* Email Input */}
                    <div className="d-flex mb-2">
                        <Form.Control
                            type="email"
                            placeholder="Enter team member email"
                            value={customTeamMember}
                            onChange={(e) => setCustomTeamMember(e.target.value)}
                            className="me-2 ht"
                        />

                        <Button
                            className="ht"
                            variant="outline-primary"
                            type="button"
                            onClick={() => {
                                const email = customTeamMember.trim();
                                if (!email) return;
                                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                                if (!emailRegex.test(email)) {
                                    alert("Please enter a valid email address.");
                                    return;
                                }
                                if (selectedRoles.length === 0) {
                                    alert("Please assign at least one role to this team member.");
                                    return;
                                }

                                setTeamAssignments((prev) => [
                                    ...prev,
                                    { email, roles: [...selectedRoles] }
                                ]);
                                setCustomTeamMember("");
                                setSelectedRoles([]);
                            }}
                            disabled={!customTeamMember.trim() || selectedRoles.length === 0}
                        >
                            Add
                        </Button>
                    </div>

                    {/* Role Checkboxes */}
                    <div className="mb-3">
                        {allRoleOptions.map((opt) => (
                            <Form.Check
                                inline
                                key={opt.value}
                                type="checkbox"
                                id={`role-${opt.value}`}
                                label={opt.label}
                                value={opt.value}
                                checked={selectedRoles.includes(opt.value)}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setSelectedRoles((prev) =>
                                        prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
                                    );
                                }}
                            />
                        ))}
                    </div>

                    {/* Add Custom Role */}
                    <div className="d-flex mb-3">
                        <Form.Control
                            type="text"
                            placeholder="Add custom Role"
                            value={customRole}
                            onChange={(e) => setCustomRole(e.target.value)}
                            className="me-2 ht"
                        />
                        <Button
                            className="ht"
                            variant="outline-success"
                            type="button"
                            onClick={() => {
                                const role = customRole.trim();
                                if (
                                    role &&
                                    !allRoleOptions.some((opt) => opt.label.toLowerCase() === role.toLowerCase())
                                ) {
                                    setCustomRoleList((prev) => [
                                        ...prev,
                                        { label: role, value: role.toLowerCase().replace(/\s+/g, "-") }
                                    ]);
                                    setCustomRole("");
                                }
                            }}
                            disabled={!customRole.trim()}
                        >
                            Add
                        </Button>
                    </div>

                    {/* Show Team Assignments */}
                    {teamAssignments.length > 0 && (
                        <ul className="email-list mt-2">
                            {teamAssignments.map((member, idx) => (
                                <li key={idx} className="email-item fade-in">
                                    <span>{member.email}</span>
                                    <span className="ms-2 badge bg-secondary">
                                        {member.roles.join(", ")}
                                    </span>
                                    <Button
                                        variant="outline-danger"
                                        size="sm"
                                        className="ms-2"
                                        onClick={() =>
                                            setTeamAssignments((prev) => prev.filter((_, i) => i !== idx))
                                        }
                                    >
                                        ✕
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    )}
                </Form.Group>



                <Form.Group className="mb-3">
                    <Form.Label>Organization Name</Form.Label>
                    <div style={{ position: 'relative' }}>
                        <Form.Control
                            type="text"
                            name="clientName"
                            value={form.clientName}
                            onChange={(e) => {
                                handleChange(e);
                                setShowOrgDropdown(true);
                            }}
                            onFocus={() => setShowOrgDropdown(true)}
                            onBlur={() => setTimeout(() => setShowOrgDropdown(false), 200)}
                            placeholder="Add or select organization name"
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
                                    .filter(org => !form.clientName || (org.name && org.name.toLowerCase().includes(form.clientName.toLowerCase())))
                                    .map((org, index) => (
                                        <button
                                            key={index}
                                            type="button"
                                            className="list-group-item list-group-item-action text-start"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                setForm(prev => ({
                                                    ...prev,
                                                    clientName: org.name,
                                                    organizationId: org.id
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
                <Form.Group className="mb-3">
                    <Form.Label>Upload Documents</Form.Label>
                    <Form.Control
                        type="file"
                        name="uploadDocuments"
                        onChange={handleFileChange}
                        multiple
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Project Scope</Form.Label>
                    <Form.Control
                        as="textarea"
                        name="projectScope"
                        value={form.projectScope}
                        onChange={handleChange}
                        rows={2}
                        placeholder="Scope of projects"
                    />
                </Form.Group>
                <Form.Group className="mb-3">
                    <Form.Label>Technology Stack</Form.Label>
                    <div>
                        {allTechOptions.map((tech) => (
                            <Form.Check
                                key={tech}
                                type="checkbox"
                                id={`techStack-${tech}`}
                                label={tech}
                                name="techStack"
                                value={tech}
                                checked={form.techStack.includes(tech)}
                                onChange={handleChange}
                                className="mb-2"
                            />
                        ))}
                        <div className="d-flex mt-2">
                            <Form.Control
                                type="text"
                                value={customTech}
                                onChange={e => setCustomTech(e.target.value)}
                                placeholder="Add custom technology"
                                className="me-2"
                            />
                            <Button variant="outline-primary" type="button" onClick={handleAddCustomTech} disabled={!customTech.trim()}>
                                Add
                            </Button>
                        </div>
                    </div>
                </Form.Group>
                {/* // udit start */}
                <Form.Group className="mb-3">
                    <Form.Label>Leader of Project</Form.Label>
                    <div style={{ position: 'relative', zIndex: 1001 }}>
                        <ul className="nav-list mb-0" ref={leaderDropdownRef} style={{ listStyle: 'none', padding: 0, position: 'relative' }}>
                            <li className={`has-dropdown ${isLeaderDropdownOpen ? 'open' : ''}`}>
                                <span 
                                    onClick={() => {
                                        if (teamAssignments.length > 0) {
                                            setIsLeaderDropdownOpen(!isLeaderDropdownOpen);
                                        }
                                    }}
                                    className="leader-dropdown-btn d-flex align-items-center justify-content-center"
                                    style={{ 
                                        cursor: teamAssignments.length > 0 ? 'pointer' : 'not-allowed', 
                                        border: '1px solid rgba(255, 255, 255, 0.25)',
                                        borderRadius: '0.75rem',
                                        background: teamAssignments.length > 0 ? 'rgba(255, 255, 255, 0.06)' : 'rgba(255, 255, 255, 0.03)',
                                        opacity: teamAssignments.length > 0 ? 1 : 0.5,
                                        color: '#ffffff',
                                        padding: '0.5rem 1.25rem',
                                        minWidth: '200px',
                                        backdropFilter: 'blur(6px)',
                                        WebkitBackdropFilter: 'blur(6px)',
                                    }} 
                                >
                                    {form.leaderOfProject || "Select leader"}
                                </span>
                                
                                {teamAssignments.length > 0 && (
                                    <ul className="dropdown">
                                        {teamAssignments.map((member) => (
                                            <li key={member.email}>
                                                <a
                                                    href="#leader"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        setForm(prev => ({ ...prev, leaderOfProject: member.email }));
                                                        setIsLeaderDropdownOpen(false);
                                                    }}
                                                >
                                                    {member.email}
                                                </a>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </li>
                        </ul>
                    </div>
                </Form.Group>
         {/* // udit end */}

                <Form.Group className="mb-3">
                    <Form.Label>Project Responsibility</Form.Label>
                    <Form.Control
                        type="text"
                        name="projectResponsibility"
                        value={form.projectResponsibility}
                        onChange={handleChange}
                        placeholder="Description of assigned team members"
                    />
                </Form.Group>

                {/* Custom Question */}
                <Form.Group className="mb-3">
                    <Form.Label>Custom Question</Form.Label>
                    <div className="d-flex">
                        <Form.Control
                            type="text"
                            value={customQuestion}
                            onChange={e => setCustomQuestion(e.target.value)}
                            placeholder="Type your custom question"
                            className="me-2"
                        />
                        <Button variant="outline-primary" type="button" onClick={handleAddCustomQuestion} disabled={!customQuestion.trim()}>
                            Add
                        </Button>
                    </div>
                </Form.Group>
                {customQuestionsList.map((q, idx) => (
                    <Form.Group as={Row} className="mb-3" key={q}>
                        <Form.Label column sm={8}>{q}</Form.Label>
                        <Col sm={4}>
                            <Form.Control
                                as="textarea"
                                rows={2}
                                value={customAnswers[q] || ""}
                                onChange={e => handleCustomAnswerChange(q, e.target.value)}
                                required
                                placeholder="Type your answer"
                            />
                        </Col>
                    </Form.Group>
                ))}
                <Button type="submit" className="w-100 mt-3" variant="primary">
                    Submit
                </Button>
            </Form>
        </Container>
    );
};

export default EmployeeProjectForm;
