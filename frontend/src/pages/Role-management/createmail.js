// createmail.js
import React, { useState, useEffect, useContext } from 'react';
import { FaPlus, FaSearch, FaEdit, FaTrash, FaUser, FaEnvelope, FaLock, FaUserTag, FaEye, FaEyeSlash } from 'react-icons/fa';
import './createmail.css';
import { databaseService } from '../../services/supabase';
import { MyContext } from '../../App';
import { usePermissions, PermissionButton } from '../../utils/permissionUtils';

const EmployeeList = () => {
    const { userRole, userPermissions } = useContext(MyContext);
    const { canView, canCreate, canUpdate, canDelete } = usePermissions();

    const [employees, setEmployees] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'Employee',
        customRole: ''
    });
    const [isLoading, setIsLoading] = useState(false);
    const [visiblePasswords, setVisiblePasswords] = useState({});
    const [notice, setNotice] = useState(null);
    const [noticeType, setNoticeType] = useState('success');
    const [showCustomRoleInput, setShowCustomRoleInput] = useState(false);

    // helper: check permission for 'Create Mails' page
    const hasPermission = (action = 'View') => {
        if (userRole === 'Admin') return true;
        if (!userPermissions) return false;
        const pagePerms = userPermissions['Create Mails'];
        if (!pagePerms) return false;
        if (pagePerms['All']) return true;
        return !!pagePerms[action];
    };

    const fetchEmployees = async () => {
        const { data, error } = await databaseService.getAllUserLogins();
        if (error) {
            setNotice('Failed to load users: ' + (error.message || 'Unknown error'));
            setNoticeType('error');
            return;
        }
        const mapped = (data || []).map((u, idx) => ({
            id: u.id || idx + 1,
            name: u.name || '',
            email: u.email || '',
            password: u.password || '', // Store actual password
            maskedPassword: '********', // Store masked version
            role: u.role || 'Employee',
        }));
        setEmployees(mapped);
    };

    useEffect(() => {
        if (hasPermission('View')) {
            fetchEmployees();
        } else {
            setEmployees([]); // clear if not allowed
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [userPermissions, userRole]);

    const filteredEmployees = employees.filter(employee =>
        employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.role.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'role') {
            if (value === 'Custom') {
                setShowCustomRoleInput(true);
                setFormData(prev => ({
                    ...prev,
                    [name]: value
                }));
            } else {
                setShowCustomRoleInput(false);
                setFormData(prev => ({
                    ...prev,
                    [name]: value,
                    customRole: ''
                }));
            }
        } else {
            setFormData(prev => ({
                ...prev,
                [name]: value
            }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (!hasPermission(editingEmployee ? 'Update' : 'Insert')) {
                setNotice('You do not have permission to perform this action.');
                setNoticeType('error');
                return;
            }

            // Determine the final role
            const finalRole = formData.role === 'Custom' ? formData.customRole : formData.role;

            if (!finalRole || finalRole.trim() === '') {
                setNotice('Please enter a valid role');
                setNoticeType('error');
                return;
            }

            if (editingEmployee) {
                const updates = { name: formData.name, role: finalRole };
                if (formData.password && formData.password.trim().length > 0) {
                    updates.password = formData.password;
                }
                const { error } = await databaseService.updateUserLoginByEmail(editingEmployee.email, updates);
                if (error) throw error;
                setNotice('Employee updated successfully');
                setNoticeType('success');
            } else {
                const payload = {
                    name: formData.name,
                    email: formData.email,
                    password: formData.password,
                    role: finalRole,
                    permission_roles: {},
                };
                const { error } = await databaseService.createUserLogin(payload);
                if (error) throw error;
                setNotice('Employee created successfully');
                setNoticeType('success');
            }
            await fetchEmployees();
            setFormData({ name: '', email: '', password: '', role: 'Employee', customRole: '' });
            setShowCustomRoleInput(false);
            setEditingEmployee(null);
            setShowModal(false);
        } catch (err) {
            setNotice('Save failed: ' + (err.message || 'Unknown error'));
            setNoticeType('error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleEdit = (employee) => {
        if (!hasPermission('Update')) {
            setNotice('You do not have permission to edit employees.');
            setNoticeType('error');
            return;
        }
        setEditingEmployee(employee);
        setFormData({
            name: employee.name,
            email: employee.email,
            password: '',
            role: employee.role,
            customRole: ''
        });
        setShowCustomRoleInput(false);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const employee = employees.find(e => e.id === id);
        if (!employee) return;
        if (!hasPermission('Delete')) {
            setNotice('You do not have permission to delete employees.');
            setNoticeType('error');
            return;
        }
        if (window.confirm('Are you sure you want to delete this employee?')) {
            try {
                const { error } = await databaseService.deleteUserLoginByEmail(employee.email);
                if (error) throw error;
                setNotice('Employee deleted');
                setNoticeType('success');
                await fetchEmployees();
            } catch (err) {
                setNotice('Delete failed: ' + (err.message || 'Unknown error'));
                setNoticeType('error');
            }
        }
    };

    const handleAddNew = () => {
        if (!hasPermission('Insert')) {
            setNotice('You do not have permission to add employees.');
            setNoticeType('error');
            return;
        }
        setEditingEmployee(null);
        setFormData({ name: '', email: '', password: '', role: 'Employee', customRole: '' });
        setShowCustomRoleInput(false);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setEditingEmployee(null);
        setFormData({ name: '', email: '', password: '', role: 'Employee', customRole: '' });
        setShowCustomRoleInput(false);
    };

    const togglePasswordVisibility = (employeeId) => {
        setVisiblePasswords(prev => ({
            ...prev,
            [employeeId]: !prev[employeeId]
        }));
    };

    const getActualPassword = (employee) => {
        // Admin can see actual passwords, others see masked
        if (userRole === 'Admin') {
            return employee.password || 'No password';
        }
        return employee.maskedPassword || '********';
    };

    return (
        <div className="employee-list-container">
            {notice && (
                <div className={`notice ${noticeType === 'error' ? 'error' : 'success'}`}>{notice}</div>
            )}

            {/* Header Section */}
            <div className="employee-header">
                <div className="header-content">
                    <h1 className="page-title">Employee List</h1>
                    <div className="header-actions">
                        {/* Show add button only if user has Insert */}
                        {hasPermission('Insert') && (
                            <button
                                className="add-employee-btn"
                                onClick={handleAddNew}
                            >
                                <FaPlus className="btn-icon" />
                                New Employee
                            </button>
                        )}

                        <div className="search-container">
                            <FaSearch className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="search-input"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Employee Table */}
            <div className="table-container">
                <div className="table-wrapper">
                    <table className="employee-table ">
                        <thead>
                            <tr>
                                <th>NO.</th>
                                <th>NAME</th>
                                <th>EMAIL-ID</th>
                                <th>PASSWORD</th>
                                <th>ROLE</th>
                                <th>EDIT</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredEmployees.map((employee, index) => (
                                <tr key={employee.id} className="table-row">
                                    <td className="employee-number">{index + 1}</td>
                                    <td className="employee-name">
                                        <div className="name-cell">
                                            <FaUser className="name-icon" />
                                            {employee.name}
                                        </div>
                                    </td>
                                    <td className="employee-email">
                                        <div className="email-cell">
                                            <FaEnvelope className="email-icon" />
                                            {employee.email}
                                        </div>
                                    </td>
                                    <td className="employee-password">
                                        <div className="password-cell">
                                            <FaLock className="password-icon" />
                                            <span className="password-text">
                                                {visiblePasswords[employee.id]
                                                    ? getActualPassword(employee)
                                                    : employee.maskedPassword
                                                }
                                            </span>
                                            {userRole === 'Admin' && (
                                                <span className="admin-indicator" title={visiblePasswords[employee.id] ? "Admin view - actual password visible" : "Admin view - click to show actual password"}>

                                                </span>
                                            )}
                                            <button
                                                className="password-toggle-btn"
                                                onClick={() => togglePasswordVisibility(employee.id)}
                                                title={visiblePasswords[employee.id] ? "Hide password" : "Show password"}
                                            >
                                                {visiblePasswords[employee.id] ? <FaEye /> : <FaEyeSlash />}
                                            </button>
                                        </div>
                                    </td>
                                    <td className="employee-role">
                                        <span className={`role-badge ${employee.role.toLowerCase().replace(" ", "-")}`}>
                                            <FaUserTag className="role-icon" />
                                            {employee.role}
                                        </span>
                                    </td>
                                    <td className="employee-actions">
                                        <div className="action-buttons">
                                            {/* Edit button appears only if Update permission */}
                                            {hasPermission('Update') && (
                                                <button
                                                    className="edit-btn"
                                                    onClick={() => handleEdit(employee)}
                                                    title="Edit Employee"
                                                >
                                                    <FaEdit />
                                                </button>
                                            )}
                                            {/* Delete button appears only if Delete permission */}
                                            {hasPermission('Delete') && (
                                                <button
                                                    className="delete-btn"
                                                    onClick={() => handleDelete(employee.id)}
                                                    title="Delete Employee"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredEmployees.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '20px' }}>
                                        {hasPermission('View') ? 'No employees found.' : 'You do not have permission to view employees.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal for Add/Edit Employee */}
            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
                            <button className="close-btn" onClick={closeModal}>×</button>
                        </div>

                        <form onSubmit={handleSubmit} className="employee-form">
                            <div className="form-group">
                                <label htmlFor="name">
                                    <FaUser className="form-icon" />
                                    Full Name
                                </label>
                                <input
                                    type="text"
                                    id="name"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter full name"
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">
                                    <FaEnvelope className="form-icon" />
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    required
                                    placeholder="Enter email address"
                                    disabled={!!editingEmployee}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="password">
                                    <FaLock className="form-icon" />
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    required={!editingEmployee}
                                    placeholder={editingEmployee ? "Leave blank to keep current" : "Enter password"}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="role">
                                    <FaUserTag className="form-icon" />
                                    Role
                                </label>
                                <select
                                    id="role"
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="Employee">Employee</option>
                                    <option value="Admin">Admin</option>
                                    <option value="Manager">Manager</option>
                                    <option value="Project Manager">Project Manager</option>
                                    <option value="Custom">Custom Role</option>
                                </select>
                            </div>

                            {/* Custom Role Input - Only show when Custom is selected */}
                            {showCustomRoleInput && (
                                <div className="form-group">
                                    <label htmlFor="customRole">
                                        <FaUserTag className="form-icon" />
                                        Custom Role Name
                                    </label>
                                    <input
                                        type="text"
                                        id="customRole"
                                        name="customRole"
                                        value={formData.customRole}
                                        onChange={handleInputChange}
                                        required={formData.role === 'Custom'}
                                        placeholder="Enter custom role name"
                                        className="custom-role-input"
                                    />
                                </div>
                            )}

                            <div className="form-actions">
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={closeModal}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="save-btn"
                                    disabled={isLoading}
                                >
                                    {isLoading ? 'Saving...' : (editingEmployee ? 'Update' : 'Add Employee')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmployeeList;