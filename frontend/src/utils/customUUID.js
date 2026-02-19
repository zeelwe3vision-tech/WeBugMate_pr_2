/**
 * Custom UUID Generator
 * Generates UUIDs in the format: AAAA-AA00-AA00-32randomchars
 * Where:
 * - AAAA: Company code (AAAA-ZZZZ)
 * - AA00: Project ID (AA00-ZZ99, then aa00-zz99)
 * - AA00: Chat ID (AA00-ZZ99)
 * - 32randomchars: 32 random alphanumeric characters
 */

// Character sets
const UPPERCASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const DIGITS = '0123456789';
const ALPHANUMERIC = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Counters (in-memory, consider persisting these in production)
let companyCounter = 0;            // For AAAA-ZZZZ (0 to 456,975)
let projectCounter = 0;            // For AA00-zz99 (0 to 1,679,615)
let chatCounters = new Map();      // Track chat counters per project
let lastProjectId = null;          // Track last used project ID
// New cascading project ID counters (AA00 ranges)
let projectId1Counter = 0;         // AA00..ZZ99 (0..67599)
let projectId2Counter = 0;         // AA00..ZZ99 (0..67599)

// Load counters from localStorage if available
if (typeof window !== 'undefined') {
  try {
    // Load main counters
    const savedCounters = localStorage.getItem('webugmate_counters');
    if (savedCounters) {
      const { company, project } = JSON.parse(savedCounters);
      companyCounter = company || 0;
      projectCounter = project || 0;
    }
    // Load cascading project ID counters
    const savedProjCounters = localStorage.getItem('webugmate_project_id_counters');
    if (savedProjCounters) {
      const { proj1, proj2 } = JSON.parse(savedProjCounters);
      projectId1Counter = typeof proj1 === 'number' ? proj1 : 0;
      projectId2Counter = typeof proj2 === 'number' ? proj2 : 0;
    }

    // Load chat counters
    const savedChatCounters = localStorage.getItem('webugmate_chat_counters');
    if (savedChatCounters) {
      const chatCountersData = JSON.parse(savedChatCounters);
      for (const [projectId, counter] of Object.entries(chatCountersData)) {
        chatCounters.set(projectId, counter);
      }
    }
  } catch (e) {
    console.error('Failed to load counters from localStorage', e);
  }
}

/**
 * Save counters to localStorage
 */
const saveCounters = () => {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('webugmate_counters', JSON.stringify({
        company: companyCounter,
        project: projectCounter
      }));
      localStorage.setItem('webugmate_project_id_counters', JSON.stringify({
        proj1: projectId1Counter,
        proj2: projectId2Counter
      }));
    } catch (e) {
      console.error('Failed to save counters to localStorage', e);
    }
  }
};

/**
 * Get or initialize chat counter for a project
 * @param {string} projectId - Project ID
 * @returns {number} Current chat count for the project
 */
const getChatCounter = (projectId = 'default') => {
  if (!chatCounters.has(projectId)) {
    // Try to load from localStorage first
    if (typeof window !== 'undefined') {
      try {
        const chatCountersData = JSON.parse(localStorage.getItem('webugmate_chat_counters') || '{}');
        if (projectId in chatCountersData) {
          chatCounters.set(projectId, chatCountersData[projectId]);
          return chatCountersData[projectId];
        }
      } catch (e) {
        console.error('Failed to load chat counter from localStorage', e);
      }
    }
    // Initialize to 0 if not found
    chatCounters.set(projectId, 0);
  }
  return chatCounters.get(projectId);
};

/**
 * Increment chat counter for a project
 * @param {string} projectId - Project ID
 * @returns {number} New chat count
 */
const incrementChatCounter = (projectId = 'default') => {
  const currentCount = getChatCounter(projectId);
  const newCount = currentCount + 1;
  chatCounters.set(projectId, newCount);
  return newCount;
};

/**
 * Generate a random string with given length and character set
 * @param {number} length - Length of the string to generate
 * @param {string} chars - Character set to use
 * @returns {string} Random string
 */
const randomString = (length, chars) => {
  let result = '';
  const charsLength = chars.length;
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * charsLength));
  }
  return result;
};

// Convert a numeric index (0..67599) to AA00..ZZ99
const indexToAA00 = (index) => {
  const MAX = 26 * 26 * 100; // 67,600
  const v = ((index % MAX) + MAX) % MAX;
  const first = Math.floor(v / (26 * 100)) % 26;
  const second = Math.floor(v / 100) % 26;
  const num = v % 100;
  const a = UPPERCASE[first];
  const b = UPPERCASE[second];
  const digits = String(num).padStart(2, '0');
  return `${a}${b}${digits}`;
};

// Generate cascading project IDs: proj2 increments first; on rollover, proj1 increments
const generateCascadingProjectIds = () => {
  const MAX = 26 * 26 * 100; // 67,600 combinations AA00..ZZ99
  projectId2Counter += 1;
  if (projectId2Counter >= MAX) {
    projectId2Counter = 0;
    projectId1Counter = (projectId1Counter + 1) % MAX;
  }
  saveCounters();
  const proj1 = indexToAA00(projectId1Counter);
  const proj2 = indexToAA00(projectId2Counter);
  return { proj1, proj2 };
};

/**
 * Generate a sequential code in A-Z format
 * @param {number} value - The sequential value
 * @param {number} length - Length of the code
 * @param {string} chars - Character set to use
 * @returns {string} Generated code
 */
const generateSequentialCode = (value, length, chars) => {
  let result = '';
  let remaining = value;
  const base = chars.length;

  for (let i = 0; i < length; i++) {
    const pos = remaining % base;
    result = chars.charAt(pos) + result;
    remaining = Math.floor(remaining / base);
  }

  return result;
};

/**
 * Custom UUID Generator
 * Format: AAAA-XX##-YY##-32randomchars
 * - AAAA: Organization/company name (fixed, uppercase, 4 chars)
 * - XX##: First project ID part (AA00 to ZZ99, increments when YY## rolls over)
 * - YY##: Second project ID part (AA00 to ZZ99, increments with each new project)
 * - 32randomchars: Random alphanumeric characters (like UUID v4)
 */

class CustomUUIDGenerator {
  constructor(orgName = 'AAAA') {
    this.orgName = orgName.slice(0, 4).toUpperCase().padEnd(4, 'A');
    this.projectId1 = 'AA00';
    this.projectId2 = 'AA00';
    this.loadCounters();
  }

  // Load counters from localStorage
  loadCounters() {
    try {
      const saved = localStorage.getItem('customUUIDGenerator');
      if (saved) {
        const { projectId1, projectId2 } = JSON.parse(saved);
        if (this.isValidProjectId(projectId1) && this.isValidProjectId(projectId2)) {
          this.projectId1 = projectId1;
          this.projectId2 = projectId2;
        }
      }
    } catch (e) {
      console.error('Error loading counters:', e);
    }
  }

  // Save counters to localStorage
  saveCounters() {
    try {
      localStorage.setItem('customUUIDGenerator', JSON.stringify({
        projectId1: this.projectId1,
        projectId2: this.projectId2
      }));
    } catch (e) {
      console.error('Error saving counters:', e);
    }
  }

  // Validate project ID format (AA00-ZZ99)
  isValidProjectId(id) {
    return /^[A-Z]{2}\d{2}$/.test(id);
  }

  // Generate next project ID part (AA00 to ZZ99)
  static nextId(currentId) {
    if (!/^[A-Z]{2}\d{2}$/.test(currentId)) {
      throw new Error('Invalid ID format. Must be in format AA00');
    }

    let chars = currentId.slice(0, 2);
    let nums = parseInt(currentId.slice(2), 10);

    if (nums < 99) {
      nums++;
      return chars + nums.toString().padStart(2, '0');
    } else {
      // Increment letters
      let firstChar = chars.charCodeAt(0);
      let secondChar = chars.charCodeAt(1);

      if (secondChar < 90) { // 'Z' is 90
        secondChar++;
      } else if (firstChar < 90) {
        firstChar++;
        secondChar = 65; // 'A'
      } else {
        // Reset to AA if we reach ZZ
        firstChar = 65; // 'A'
        secondChar = 65; // 'A'
      }

      return String.fromCharCode(firstChar, secondChar) + '00';
    }
  }

  // Generate random 32 character string (like UUID v4)
  static generateRandomString() {
    return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Generate the next UUID
  generate() {
    // Increment projectId2 first
    this.projectId2 = CustomUUIDGenerator.nextId(this.projectId2);

    // If projectId2 rolls over, increment projectId1
    if (this.projectId2 === 'AA00') {
      this.projectId1 = CustomUUIDGenerator.nextId(this.projectId1);
    }

    this.saveCounters();
    const randomPart = CustomUUIDGenerator.generateRandomString();
    return `${this.orgName}-${this.projectId1}-${this.projectId2}-${randomPart}`;
  }

  // Static method for backward compatibility
  static generate(orgName = 'AAAA') {
    const generator = new CustomUUIDGenerator(orgName);
    return generator.generate();
  }
}

// Backward compatible functions
const generator = new CustomUUIDGenerator();

function generateCustomUUID(projectId = 'default', incrementChat = false) {
  return generator.generate();
}

function generateRandomUUID() {
  return CustomUUIDGenerator.generateRandomString();
}

function generateCustomUUIDWithPrefix(prefix = '') {
  const uuid = generateCustomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}

function generateMultipleCustomUUIDs(count = 1) {
  const uuids = [];
  for (let i = 0; i < count; i++) {
    uuids.push(generateCustomUUID());
  }
  return uuids;
}

function generateLegacyCustomUUID(companyCode = 'AAAA', projectType = 'AA', projectNumber = '00') {
  companyCode = (companyCode || 'AAAA').toUpperCase().padEnd(4, 'A').substring(0, 4);
  projectType = (projectType || 'AA').toUpperCase().padEnd(2, 'A').substring(0, 2);
  projectNumber = (projectNumber || '00').toString().toUpperCase().padStart(2, '0').substring(0, 2);
  const randomPart = generateRandomUUID();
  return `${companyCode}-${projectType}${projectNumber}-${randomPart}`;
}

function isValidCustomUUID(uuid) {
  if (typeof uuid !== 'string') return false;
  const parts = uuid.split('-');
  if (parts.length !== 4) return false;
  if (parts[0].length !== 4 || !/^[A-Z]{4}$/.test(parts[0])) return false;
  if (parts[1].length !== 4 || !/^[A-Z]{2}\d{2}$/.test(parts[1])) return false;
  if (parts[2].length !== 4 || !/^[A-Z]{2}\d{2}$/.test(parts[2])) return false;
  if (parts[3].length !== 32 || !/^[a-z0-9]{32}$/.test(parts[3])) return false;
  return true;
}

// Dummy functions to maintain compatibility
function generateChatId() { return 'AA00'; }
function generateNewChatId() { return 'AA00'; }
//function incrementChatCounter() { return 0; }
//function getChatCounter() { return 0; }

// Export all functions
export {
  generateCustomUUID as default,
  generateCustomUUID,
  generateRandomUUID,
  generateCustomUUIDWithPrefix,
  generateMultipleCustomUUIDs,
  generateLegacyCustomUUID,
  isValidCustomUUID,
  generateChatId,
  generateNewChatId,
  incrementChatCounter,
  getChatCounter,
  CustomUUIDGenerator
};
