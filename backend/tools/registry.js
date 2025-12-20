const FileSystemTool = require('./FileSystemTool');
const { DatabaseTool } = require('./DatabaseTool'); // Import the class, not instance

/**
 * Role-based tool registry.
 * Maps agent roles to the tools they are allowed to use.
 * In Plan mode, no tools are allowed (empty object).
 */
const roleCapabilities = {
  Devon: {
    FileSystemTool,
  },
  Tara: {
    FileSystemTool,
  },
  Orion: {
    FileSystemTool,
    DatabaseTool,
  }
};

/**
 * Get list of all available tools with descriptions
 */
function getToolDescriptions() {
  return {
    FileSystemTool: 'Read/write files with path traversal protection',
    DatabaseTool: 'Direct database queries (Orion-only)'
  };
}

/**
 * Get the tools allowed for a given role and mode.
 * @param {string} role - The agent role (Devon, Tara, Orion)
 * @param {string} mode - The current mode ('plan' or 'act')
 * @returns {Object} An object mapping tool names to tool classes/instances
 */
function getToolsForRole(role, mode = 'act') {
  // In Plan mode, no tools are allowed for any role (like Cline)
  if (mode.toLowerCase() === 'plan') {
    return {};
  }
  
  // Normalize role name (capitalize first letter)
  const normalizedRole = role.charAt(0).toUpperCase() + role.slice(1);
  
  if (!roleCapabilities[normalizedRole]) {
    // Return empty object for unknown roles (as per test expectation)
    return {};
  }
  
  return roleCapabilities[normalizedRole];
}

module.exports = {
  getToolsForRole,
  getToolDescriptions
};
