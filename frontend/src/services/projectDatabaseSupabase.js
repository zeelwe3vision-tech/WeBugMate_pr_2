// Project Database Service with Supabase
// This service handles all database operations for project data using Supabase

import { databaseService } from './supabase';
import { generateCustomUUID, randomString } from '../utils/customUUID';
import { generateStructuredProjectId, getNextSerialNumber, PROJECT_FIELDS } from '../utils/structuredProjectId';

class ProjectDatabaseSupabase {
    constructor() {
        this.storageKey = 'webugmate_projects';
        // Keep localStorage as fallback for offline functionality
        this.initializeLocalStorage();
    }

    // Initialize local storage if empty (for offline fallback)
    initializeLocalStorage() {
        if (!localStorage.getItem(this.storageKey)) {
            localStorage.setItem(this.storageKey, JSON.stringify([]));
        }
    }

    // Clear local cache
    clearCache() {
        try {
            localStorage.removeItem(this.storageKey);
            this.initializeLocalStorage();
            return true;
        } catch (error) {
            console.error('Error clearing cache:', error);
            return false;
        }
    }

    // Get all projects from Supabase
    async getAllProjects() {
        try {
            const { data, error } = await databaseService.getProjects();
            if (error) {
                console.error('Error fetching projects from Supabase:', error);
                // Fallback to localStorage
                return this.getLocalProjects();
            }

            // Always check localStorage as well to ensure we have all projects
            const localProjects = this.getLocalProjects();

            // If Supabase returns data, merge with localStorage
            if (data && data.length > 0) {
                // Normalize data: ensure uuid is set (map from id)
                const supabaseProjects = data.map(p => ({
                    ...p,
                    uuid: p.uuid || p.id, // Ensure uuid exists
                    id: p.id || p.uuid    // Ensure id exists
                }));

                // Combine Supabase and localStorage data, removing duplicates
                const allProjects = [...supabaseProjects];
                localProjects.forEach(localProject => {
                    const exists = allProjects.some(supabaseProject =>
                        supabaseProject.id === localProject.id || supabaseProject.uuid === localProject.uuid
                    );
                    if (!exists) {
                        allProjects.push(localProject);
                    }
                });
                return allProjects;
            } else {
                // If Supabase is empty, use localStorage
                return localProjects;
            }
        } catch (error) {
            console.error('Error in getAllProjects:', error);
            // Fallback to localStorage
            return this.getLocalProjects();
        }
    }

    // Get all projects from Supabase ordered by creation date (no localStorage fallback as requested)
    async getAllProjectsOrdered() {
        try {
            const { data, error } = await databaseService.getProjectsOrdered();
            if (error) {
                console.error('Error fetching ordered projects from Supabase:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('Error in getAllProjectsOrdered:', error);
            return [];
        }
    }

    // Get local projects (fallback)
    getLocalProjects() {
        try {
            const projects = localStorage.getItem(this.storageKey);
            return projects ? JSON.parse(projects) : [];
        } catch (error) {
            console.error('Error retrieving local projects:', error);
            return [];
        }
    }

    // Get project by UUID
    async getProjectById(uuid) {
        // Add debug logging
        console.log('getProjectById called with UUID:', uuid);

        // Validate input
        if (!uuid) {
            const errorMsg = 'Error: No UUID provided to getProjectById';
            console.error(errorMsg, new Error().stack); // Log stack trace
            return { error: errorMsg, from: 'input-validation' };
        }

        try {
            console.log('Attempting to fetch from Supabase...');
            const { data, error } = await databaseService.getProjectById(uuid);

            if (error) {
                console.error('Supabase error:', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint
                });
            } else if (data) {
                console.log('Successfully retrieved from Supabase:', data);
                return data;
            } else {
                console.log('No data returned from Supabase');
            }

            // Fallback to localStorage
            try {
                console.log('Falling back to localStorage...');
                const localProjects = this.getLocalProjects();
                console.log('Local projects:', localProjects);

                const localProject = localProjects.find(project =>
                    project && project.uuid === uuid
                );

                if (localProject) {
                    console.log('Found project in localStorage:', localProject);
                    return localProject;
                }

                console.warn('Project not found in localStorage for UUID:', uuid);
                return {
                    error: 'Project not found',
                    uuid,
                    availableProjects: localProjects.map(p => ({ id: p.id, uuid: p.uuid }))
                };

            } catch (localError) {
                console.error('Error accessing localStorage:', {
                    message: localError.message,
                    stack: localError.stack
                });
                return {
                    error: 'Local storage error',
                    details: localError.message
                };
            }
        } catch (error) {
            console.error('Unexpected error in getProjectById:', {
                message: error.message,
                stack: error.stack,
                uuid
            });
            return {
                error: 'Unexpected error',
                details: error.message
            };
        }
    }

    // No longer needed as we're using standard UUIDv4
    // getNextProjectCode() {
    //     // Deprecated - keeping for backward compatibility
    //     return '';
    // }

    // Helper function to generate random string
    randomString(length, chars) {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Save new project
    async saveProject(projectData) {
        try {
            // Generate a new custom UUID if not provided
            if (!projectData.id) {
                const customUUID = generateCustomUUID();
                // Assign to custom_uuid field, NOT the primary key id
                projectData.custom_uuid = customUUID;
                // Do NOT set projectData.id to the custom string, as DB expects UUID type
            }

            // Transform UI teamAssignments -> team_members [{email, role}]
            console.log('Raw teamAssignments:', projectData.teamAssignments);
            const teamMembers = Array.isArray(projectData.teamAssignments)
                ? projectData.teamAssignments.flatMap(member => {
                    const roles = Array.isArray(member.roles) ? member.roles : [];
                    // If multiple roles selected for same email, create one entry per role
                    return roles.length > 0
                        ? roles.map(role => ({ email: member.email, role }))
                        : [{ email: member.email, role: null }];
                })
                : [];
            console.log('Transformed teamMembers:', teamMembers);

// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----START--------------------------------------------------
            // Extract unique emails from team_members to save in assigned_to_emails
            const teamMemberEmails = teamMembers.length > 0 
                ? [...new Set(teamMembers.map(member => member.email))]
                : [];
            console.log('Extracted team member emails:', teamMemberEmails);
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----END--------------------------------------------------

            // Generate structured ID for the project
            // We construct the payload, then clean it.
            const rawProjectToSave = {
                id: projectData.id,
                project_name: projectData.projectName,
                project_description: projectData.projectDescription,
                start_date: projectData.startDate,
                end_date: projectData.endDate,
                status: projectData.status,
                client_name: projectData.clientName,
                upload_documents: projectData.uploadDocuments,
                project_scope: projectData.projectScope,
                tech_stack: projectData.techStack,
                tech_stack_custom: projectData.techStackCustom,
                leader_of_project: projectData.leaderOfProject,
                project_responsibility: projectData.projectResponsibility,
                assigned_role: projectData.assignedRole || projectData.role,
                role_answers: projectData.roleAnswers,
                custom_questions: projectData.customQuestions,
                custom_answers: projectData.customAnswers,
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----START--------------------------------------------------
                assigned_to_emails: teamMemberEmails.length > 0 ? teamMemberEmails : (projectData.assignedToEmails || projectData.assignedTo),
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----END--------------------------------------------------
                team_members: teamMembers,
                project_field: this.determineProjectField(projectData),
                custom_uuid: projectData.custom_uuid || projectData.uuid,
                organization_id: projectData.organizationId,
            };

            // Clean the object: remove undefined, null, or empty strings
            // This prevents errors like sending "" to a Date column or null to a NOT NULL column
            const projectToSave = {};
            Object.keys(rawProjectToSave).forEach(key => {
                const value = rawProjectToSave[key];
                if (value !== undefined && value !== null && value !== '') {
                    projectToSave[key] = value;
                }
            });

            // Always save to localStorage first as backup
            const localResult = await this.saveProjectLocal(projectData);
// SIDDHARTH------DATA_SENDING_TO_BACKEND_API----START---------------
            console.log('Sending to Backend API:', projectToSave);
            console.log('team_members being sent:', projectToSave.team_members);

            // CHANGED: Call Backend API instead of Supabase directly
            let data = null;
            let error = null;

            try {
                const response = await fetch('http://localhost:8000/records/insert/projects', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer webugmate123'
                    },
                    body: JSON.stringify(projectToSave)
                });

                const resJson = await response.json();

                if (response.ok && resJson.success) {
                    data = resJson.data;
                } else {
                    error = { message: resJson.error || 'Start Backend Server: API Error' };
                }
            } catch (err) {
                error = err;
            }

            if (error) {
                console.error('Error saving project to Backend:', error);
// SIDDHARTH------DATA_SENDING_TO_BACKEND_API----END------------------------
                console.error('Error details:', error.message);
                // Return localStorage result as fallback
                return localResult;
            }

            console.log('Successfully saved to Supabase:', data);

            const newProject = data && data[0] ? data[0] : null;

            if (!newProject || (!newProject.id && !newProject.uuid)) {
                // Fallback to local result if Supabase returns no data
                return localResult;
            }

            // Ensure we have both id and uuid set
            newProject.id = newProject.id || newProject.uuid;
            newProject.uuid = newProject.uuid || newProject.id;

            // Update local storage: find the temporary record and update it with the permanent UUID.
            const localProjects = this.getLocalProjects();
            const projectIndex = localProjects.findIndex(p => p.uuid === localResult.project.uuid);
            if (projectIndex !== -1) {
                localProjects[projectIndex].uuid = newProject.uuid;
                localProjects[projectIndex].createdAt = newProject.created_at;
                localProjects[projectIndex].updatedAt = newProject.updated_at;
                localStorage.setItem(this.storageKey, JSON.stringify(localProjects));
            }

            return {
                success: true,
                project: newProject,
                message: 'Project saved successfully!'
            };
        } catch (error) {
            console.error('Error in saveProject:', error);
            // Fallback to localStorage
            return this.saveProjectLocal(projectData);
        }
    }

    // Save project to localStorage (fallback)
    async saveProjectLocal(projectData) {
        try {
            const projects = this.getLocalProjects();
            const newProject = {
                ...projectData,
                // Let the database generate the UUID by default
                id: projectData.id || crypto.randomUUID(),
                uuid: projectData.uuid || projectData.id || crypto.randomUUID(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            projects.push(newProject);
            localStorage.setItem(this.storageKey, JSON.stringify(projects));
            return {
                success: true,
                project: newProject,
                message: 'Project saved locally!'
            };
        } catch (error) {
            console.error('Error saving project locally:', error);
            return {
                success: false,
                message: 'Failed to save project. Please try again.'
            };
        }
    }

    // Update existing project
    async updateProject(uuid, updatedData) {
        try {
            if (!uuid) {
                return { data: null, error: new Error('Project UUID is required for update') };
            }

            // Transform UI teamAssignments -> team_members [{ email, role }]
            const teamMembers = Array.isArray(updatedData?.teamAssignments)
                ? updatedData.teamAssignments.flatMap(member => {
                    const roles = Array.isArray(member.roles) ? member.roles : [];
                    return roles.length > 0
                        ? roles.map(role => ({ email: member.email, role }))
                        : [{ email: member.email, role: null }];
                })
                : (Array.isArray(updatedData?.team_members) ? updatedData.team_members : undefined);

// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----START--------------------------------------------------
            // Extract unique emails from team_members to save in assigned_to_emails
            const teamMemberEmails = teamMembers && teamMembers.length > 0 
                ? [...new Set(teamMembers.map(member => member.email))]
                : undefined;
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----END--------------------------------------------------

            // Map UI fields to DB schema (snake_case) – whitelist known columns
            const update = {
                project_name: updatedData.project_name ?? updatedData.projectName,
                project_description: updatedData.project_description ?? updatedData.projectDescription,
                client_name: updatedData.client_name ?? updatedData.clientName,
                status: updatedData.status,
                start_date: updatedData.start_date ?? updatedData.startDate,
                end_date: updatedData.end_date ?? updatedData.endDate,
                leader_of_project: updatedData.leader_of_project ?? updatedData.leaderOfProject,
                project_scope: updatedData.project_scope ?? updatedData.projectScope,
                project_responsibility: updatedData.project_responsibility ?? updatedData.projectResponsibility,
                organization_id: updatedData.organization_id ?? updatedData.organizationId,
                team_members: teamMembers,
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----START--------------------------------------------------
                assigned_to_emails: teamMemberEmails ?? (updatedData.assigned_to_emails ?? updatedData.assignedToEmails)
// SIDDHARTH-TANMEY------DATA_SENDING_TO_BACKEND_API----END--------------------------------------------------
            };

            // Remove undefined/null/empty-string values
            Object.keys(update).forEach(k => {
                if (update[k] === undefined || update[k] === null || update[k] === '') delete update[k];
            });


// SIDDHARTH------DATA_SENDING_TO_BACKEND_API----START--------------------------------------------------
            // Perform Supabase update by UUID -> Redirect to Backend API
            // const { data, error } = await databaseService.updateProject(uuid, update);

            let data = null;
            let error = null;

            try {
                // We need to use 'id' or 'uuid' for the route. 
                // The backend router is /update/<table_name>/<record_id>
                // Note: 'uuid' arg here is actually the ID used for lookup
                const response = await fetch(`http://localhost:8000/records/update/projects/${uuid}`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer webugmate123'
                    },
                    body: JSON.stringify(update)
                });

                const resJson = await response.json();
                if (response.ok && resJson.success) {
                    data = resJson.data;
                } else {
                    error = { message: resJson.error || 'Backend API Error' };
                }
            } catch (err) {
                error = err;
            }

            if (error) {
                console.warn('Backend update failed, using local fallback:', error);
// SIDDHARTH------DATA_SENDING_TO_BACKEND_API----END--------------------------------------------------
                const localRes = await this.updateProjectLocal(uuid, { ...update, uuid });
                const localData = localRes?.project ? [localRes.project] : (Array.isArray(localRes) ? localRes : [localRes]);
                // IMPORTANT: return non-null error so UI knows DB didn't update
                return {
                    data: localData,
                    error: new Error('Database update failed. Changes saved locally only.'),
                    fromLocal: true
                };
            }

            // Update local cache as well
            await this.updateProjectLocal(uuid, { ...update, uuid });
            return { data, error: null };
        } catch (e) {
            console.error('updateProject error:', e);
            // Last resort: local update
            try {
                const localRes = await this.updateProjectLocal(uuid, { ...updatedData, uuid });
                const localData = localRes?.project ? [localRes.project] : (Array.isArray(localRes) ? localRes : [localRes]);
                // Surface failure to UI as error, even though we saved locally
                return { data: localData, error: new Error('Database update threw. Changes saved locally only.'), fromLocal: true };
            } catch (le) {
                return { data: null, error: le };
            }
        }
    }

    // Update project in localStorage (fallback)
    updateProjectLocal(uuid, updatedData) {
        try {
            const projects = this.getLocalProjects();
            const projectIndex = projects.findIndex(project => project.uuid === uuid);

            if (projectIndex === -1) {
                return {
                    success: false,
                    message: 'Project not found'
                };
            }

            const updatedProject = {
                ...projects[projectIndex],
                ...updatedData
            };

            // Ensure uuid is preserved
            if (!updatedProject.uuid) {
                updatedProject.uuid = uuid;
            }

            projects[projectIndex] = updatedProject;
            localStorage.setItem(this.storageKey, JSON.stringify(projects));

            return {
                success: true,
                project: updatedProject,
                message: 'Project updated locally!'
            };
        } catch (error) {
            console.error('Error updating project locally:', error);
            return {
                success: false,
                message: 'Failed to update project. Please try again.'
            };
        }
    }

    // Delete project
    async deleteProject(uuid) {
        try {
            const { error } = await databaseService.deleteProject(uuid);

            if (error) {
                console.error('Error deleting project from Supabase:', error);
                // Fallback to localStorage
                return this.deleteProjectLocal(uuid);
            }

            // Also delete from localStorage
            this.deleteProjectLocal(uuid);

            return {
                success: true,
                message: 'Project deleted successfully!'
            };
        } catch (error) {
            console.error('Error in deleteProject:', error);
            // Fallback to localStorage
            return this.deleteProjectLocal(uuid);
        }
    }

    // Delete project from localStorage (fallback)
    deleteProjectLocal(uuid) {
        try {
            const projects = this.getLocalProjects();
            const filteredProjects = projects.filter(project =>
                project.uuid !== uuid
            );

            if (filteredProjects.length === projects.length) {
                return {
                    success: false,
                    message: 'Project not found'
                };
            }

            localStorage.setItem(this.storageKey, JSON.stringify(filteredProjects));

            return {
                success: true,
                message: 'Project deleted locally!'
            };
        } catch (error) {
            console.error('Error deleting project locally:', error);
            return {
                success: false,
                message: 'Failed to delete project. Please try again.'
            };
        }
    }
    
// SIDDHARTH------PROJECT_FIELDS_BASE_ON_TECH_STACK_AND_TEAM_ROLES----START---------------


    // Determine Project Field based on Tech Stack AND Team Roles
    determineProjectField(projectData) {
        const { techStack, teamAssignments, team_members } = projectData;

        let roles = [];

        // Extract roles from teamAssignments (UI format)
        if (Array.isArray(teamAssignments)) {
            teamAssignments.forEach(member => {
                if (member.role) roles.push(member.role.toLowerCase());
                if (Array.isArray(member.roles)) member.roles.forEach(r => roles.push(r.toLowerCase()));
            });
        }

        // Extract roles from team_members (DB format)
        if (Array.isArray(team_members)) {
            team_members.forEach(member => {
                if (member.role) roles.push(member.role.toLowerCase());
            });
        }

        const techStackArr = Array.isArray(techStack) ? techStack.map(t => t.toLowerCase()) : [];
        const techStackStr = techStackArr.join(' ');

        // 1. PRIORITY: Check Roles for AI/ML/Data
        // If a human is assigned as "AI Engineer", the project is likely AI.
        const aiRoles = ['ai', 'ai engineer', 'ml', 'machine learning', 'data scientist', 'nlp'];
        if (roles.some(r => aiRoles.some(ai => r.includes(ai)))) {
            return 'AI';
        }

        // 2. Check Tech Stack using strict word matching (avoid 'Tailwind' matching 'ai')
        const contains = (arr, keywords) => {
            return arr.some(item => keywords.some(k => item.includes(k)));
        };

        // AI/ML related
        if (contains(techStackArr, ['ai', 'machine learning', 'tensorflow', 'pytorch', 'neural', 'deep learning', 'openai', 'llm', 'bert', 'gpt'])) {
            return 'AI';
        }

        // Data Science
        if (contains(techStackArr, ['python', 'pandas', 'numpy', 'jupyter', 'scikit', 'r language', 'big data'])) {
            return 'DATA_SCIENCE';
        }

        // Mobile Development
        if (contains(techStackArr, ['react native', 'flutter', 'ios', 'android', 'swift', 'kotlin', 'expo'])) {
            return 'MOBILE_DEV';
        }

        // DevOps
        if (contains(techStackArr, ['jenkins', 'gitlab', 'ci/cd', 'devops', 'kubernetes', 'docker', 'terraform', 'aws', 'azure'])) {
            return 'DEVOPS';
        }

        // UI/UX related (Design tools)
        if (contains(techStackArr, ['figma', 'adobe', 'sketch', 'ui/ux', 'design'])) {
            return 'UI/UX';
        }

        // Web Development (Default fallback if React/Node etc are present)
        if (contains(techStackArr, ['react', 'angular', 'vue', 'html', 'css', 'javascript', 'typescript', 'node', 'express', 'next.js'])) {
            return 'WEB_DEV';
        }

        // Cloud Computing (Generic)
        if (contains(techStackArr, ['cloud', 'gcp', 'serverless'])) {
            return 'CLOUD_COMPUTING';
        }

        return 'OTHER';
    }

    // Generate structured project ID with fixed format: WV-A01-AIA01AA-0001
    async generateId(projectData = {}) {
        // Determine project field from tech stack (for tracking purposes only)
        // CHANGED: Use new logic
        const projectField = this.determineProjectField(projectData);

        try {
            // Try to get serial number from database first
            const { data: serialData, error: serialError } = await databaseService.getNextSerialNumber();

            if (serialError) {
                console.warn('Database serial number fetch failed, using local fallback:', serialError);
                // Fallback to local calculation
                const existingProjects = this.getLocalProjects();
                const serialNumber = existingProjects.length + 1;
                return generateStructuredProjectId(projectField, serialNumber);
            }

            // Use database-provided serial number
            const serialNumber = serialData || 1;
            return generateStructuredProjectId(projectField, serialNumber);

        } catch (error) {
            console.warn('Database operation failed, using local fallback:', error);
            // Fallback to local calculation
            const existingProjects = this.getLocalProjects();
            const serialNumber = existingProjects.length + 1;
            return generateStructuredProjectId(projectField, serialNumber);
        }
    }

    // Search projects
    async searchProjects(query) {
        try {
            const projects = await this.getAllProjects();
            const searchTerm = query.toLowerCase();

            return projects.filter(project =>
                project.project_name?.toLowerCase().includes(searchTerm) ||
                project.project_description?.toLowerCase().includes(searchTerm) ||
                project.client_name?.toLowerCase().includes(searchTerm) ||
                project.tech_stack?.some(tech => tech.toLowerCase().includes(searchTerm))
            );
        } catch (error) {
            console.error('Error in searchProjects:', error);
            // Fallback to localStorage
            const localProjects = this.getLocalProjects();
            const searchTerm = query.toLowerCase();

            return localProjects.filter(project =>
                project.projectName?.toLowerCase().includes(searchTerm) ||
                project.projectDescription?.toLowerCase().includes(searchTerm) ||
                project.clientName?.toLowerCase().includes(searchTerm) ||
                project.techStack?.some(tech => tech.toLowerCase().includes(searchTerm))
            );
        }
    }

    // Get projects by status
    async getProjectsByStatus(status) {
        try {
            const projects = await this.getAllProjects();
            return projects.filter(project => project.status === status);
        } catch (error) {
            console.error('Error in getProjectsByStatus:', error);
            // Fallback to localStorage
            const localProjects = this.getLocalProjects();
            return localProjects.filter(project => project.status === status);
        }
    }

    // Get projects by date range
    async getProjectsByDateRange(startDate, endDate) {
        try {
            const projects = await this.getAllProjects();
            return projects.filter(project =>
                project.start_date >= startDate && project.end_date <= endDate
            );
        } catch (error) {
            console.error('Error in getProjectsByDateRange:', error);
            // Fallback to localStorage
            const localProjects = this.getLocalProjects();
            return localProjects.filter(project =>
                project.startDate >= startDate && project.endDate <= endDate
            );
        }
    }

    // Get all organizations
    async getOrganizations() {
        try {
            const { data, error } = await databaseService.getOrganizations();
            if (error) {
                console.error('Error fetching organizations:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('Error in getOrganizations:', error);
            return [];
        }
    }

    // Export data
    async exportData() {
        try {
            const projects = await this.getAllProjects();
            const dataStr = JSON.stringify(projects, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `webugmate_projects_${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Error in exportData:', error);
            // Fallback to localStorage
            const localProjects = this.getLocalProjects();
            const dataStr = JSON.stringify(localProjects, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `webugmate_projects_local_${new Date().toISOString().split('T')[0]}.json`;
            link.click();

            URL.revokeObjectURL(url);
        }
    }

    // Import data
    async importData(jsonData) {
        try {
            const projects = JSON.parse(jsonData);
            if (Array.isArray(projects)) {
                // Import to Supabase
                for (const project of projects) {
                    await this.saveProject(project);
                }
                return {
                    success: true,
                    message: `Successfully imported ${projects.length} projects`
                };
            } else {
                return {
                    success: false,
                    message: 'Invalid data format'
                };
            }
        } catch (error) {
            console.error('Error in importData:', error);
            return {
                success: false,
                message: 'Failed to parse JSON data'
            };
        }
    }

    // Clear all data
    async clearAllData() {
        try {
            // Clear from Supabase (this would need a bulk delete function)
            // For now, just clear localStorage
            localStorage.removeItem(this.storageKey);
            this.initializeLocalStorage();
            return {
                success: true,
                message: 'Local data cleared successfully'
            };
        } catch (error) {
            console.error('Error in clearAllData:', error);
            return {
                success: false,
                message: 'Failed to clear data'
            };
        }
    }
}
// SIDDHARTH------PROJECT_FIELDS_BASE_ON_TECH_STACK_AND_TEAM_ROLES----END-------------------------

// Create and export a singleton instance
const projectDatabaseSupabase = new ProjectDatabaseSupabase();
export default projectDatabaseSupabase;
