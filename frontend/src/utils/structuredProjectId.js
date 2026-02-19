/**
 * Structured Project ID Generator
 * Format: WV-A01-AIA01AA-0001
 * Where:
 * - WV = Company Name (fixed)
 * - A01 = Project Field Code
 * - AIA01AA = Custom 16-character UUID
 * - 0001 = Serial Number (incremental per project field)
 */

// import { generateCustomUUID } from './customUUID';

// Project field mappings
const PROJECT_FIELDS = {
    'AI': 'A01',
    'UI/UX': 'U02',
    'WEB_DEV': 'W03',
    'MOBILE_DEV': 'M04',
    'DATA_SCIENCE': 'D05',
    'CYBERSECURITY': 'C06',
    'CLOUD_COMPUTING': 'L07',
    'BLOCKCHAIN': 'B08',
    'IOT': 'I09',
    'GAME_DEV': 'G10',
    'DEVOPS': 'O11',
    'QA_TESTING': 'Q12',
    'DATABASE': 'T13',
    'NETWORKING': 'N14',
    'OTHER': 'X15'
};

// Company prefix (can be made configurable)
const COMPANY_PREFIX = 'WV';

/**
 * Generate a structured project ID with complex serial number system
 * @param {string} projectField - The project field (e.g., 'AI', 'UI/UX', 'WEB_DEV')
 * @param {number} chatNumber - The chat number (incremental)
 * @param {number} projectNumber - The project number for this type
 * @param {string} serialAlpha - The alpha part of serial (AA, AB, AC, etc.)
 * @param {number} serialNumeric - The numeric part of serial (0001, 0002, etc.)
 * @returns {string} Structured project ID in format WV-A01-AIA01AA-0001
 */
export const generateStructuredProjectId = (projectField, chatNumber = 1, projectNumber = 1, serialAlpha = 'AA', serialNumeric = 1) => {
    // Fixed components
    const companyPrefix = 'WV';

    // Get project type code
    const projectTypeCode = getProjectTypeCode(projectField);

    // Format components
    const formattedChatNumber = chatNumber.toString().padStart(2, '0');
    const formattedProjectNumber = projectNumber.toString().padStart(2, '0');
    const formattedSerialNumeric = serialNumeric.toString().padStart(4, '0');

    // Construct the structured ID
    // Format: WV-A01-AIA01AA-0001
    return `${companyPrefix}-${formattedChatNumber}-${projectTypeCode}${formattedProjectNumber}${serialAlpha}-${formattedSerialNumeric}`;
};

/**
 * Get project type code from project field
 * @param {string} projectField - The project field
 * @returns {string} Project type code
 */
const getProjectTypeCode = (projectField) => {
    const typeMapping = {
        'AI': 'AI',
        'UI/UX': 'UI',
        'WEB_DEV': 'WD',
        'MOBILE_DEV': 'MD',
        'DATA_SCIENCE': 'DS',
        'CYBERSECURITY': 'CS',
        'CLOUD_COMPUTING': 'CC',
        'BLOCKCHAIN': 'BC',
        'IOT': 'IO',
        'GAME_DEV': 'GD',
        'DEVOPS': 'DV',
        'QA_TESTING': 'QA',
        'DATABASE': 'DB',
        'NETWORKING': 'NW',
        'OTHER': 'OT'
    };

    return typeMapping[projectField] || 'OT';
};

/**
 * Parse a structured project ID to extract components
 * @param {string} projectId - The structured project ID
 * @returns {object} Parsed components of the project ID
 */
export const parseStructuredProjectId = (projectId) => {
    const parts = projectId.split('-');

    if (parts.length !== 4) {
        throw new Error('Invalid project ID format');
    }

    const [company, fieldCode, uuid, serial] = parts;

    // Find project field from code
    const projectField = Object.keys(PROJECT_FIELDS).find(
        field => PROJECT_FIELDS[field] === fieldCode
    );

    return {
        company,
        fieldCode,
        projectField,
        uuid,
        serialNumber: parseInt(serial, 10)
    };
};

/**
 * Get the next serial number for a project field
 * @param {string} projectField - The project field
 * @param {Array} existingProjects - Array of existing projects
 * @returns {number} Next serial number for the project field
 */
export const getNextSerialNumber = (projectField, existingProjects = []) => {
    const fieldCode = PROJECT_FIELDS[projectField] || PROJECT_FIELDS['OTHER'];

    // Filter projects by field code
    const fieldProjects = existingProjects.filter(project => {
        if (typeof project.id === 'string' && project.id.includes('-')) {
            const parts = project.id.split('-');
            return parts.length === 4 && parts[1] === fieldCode;
        }
        return false;
    });

    if (fieldProjects.length === 0) {
        return 1;
    }

    // Extract serial numbers and find the maximum
    const serialNumbers = fieldProjects.map(project => {
        const parts = project.id.split('-');
        return parts.length === 4 ? parseInt(parts[3], 10) : 0;
    });

    return Math.max(...serialNumbers) + 1;
};

/**
 * Validate if a project ID follows the structured format
 * @param {string} projectId - The project ID to validate
 * @returns {boolean} True if valid format
 */
export const validateStructuredProjectId = (projectId) => {
    try {
        const parsed = parseStructuredProjectId(projectId);
        return (
            parsed.company === COMPANY_PREFIX &&
            parsed.projectField !== undefined &&
            parsed.uuid.length === 16 &&
            parsed.serialNumber > 0
        );
    } catch (error) {
        return false;
    }
};

/**
 * Get all available project fields
 * @returns {Array} Array of project field objects
 */
export const getAvailableProjectFields = () => {
    return Object.keys(PROJECT_FIELDS).map(field => ({
        field,
        code: PROJECT_FIELDS[field],
        displayName: field.replace('_', ' ').replace('/', '/')
    }));
};

/**
 * Generate multiple structured project IDs for the same field
 * @param {string} projectField - The project field
 * @param {number} count - Number of IDs to generate
 * @param {Array} existingProjects - Array of existing projects
 * @returns {Array} Array of structured project IDs
 */
export const generateMultipleStructuredIds = (projectField, count = 1, existingProjects = []) => {
    const ids = [];
    let currentSerial = getNextSerialNumber(projectField, existingProjects);

    for (let i = 0; i < count; i++) {
        ids.push(generateStructuredProjectId(projectField, currentSerial + i));
    }

    return ids;
};

export default generateStructuredProjectId;
