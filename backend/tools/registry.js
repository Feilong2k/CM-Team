const FileSystemTool = require('./FileSystemTool');
// Import the default DatabaseTool instance so tools map to live objects, not the class
const DatabaseTool = require('./DatabaseTool');
const DatabaseToolAgentAdapter = require('./DatabaseToolAgentAdapter');

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
    // DatabaseTool here is the agent-level adapter that understands LLM
    // tool_call argument shapes. The underlying DatabaseTool instance is
    // still exported from ./DatabaseTool for direct use (e.g. migrations,
    // probes) and is also exposed here as DatabaseToolInternal so that
    // OrionAgent can keep using chatMessages.* helpers without going
    // through the adapter.
    
    // Explicitly expose DatabaseTool so it can be called by name "DatabaseTool"
    // AND by its methods. This helps ToolRunner resolve it.
    DatabaseTool: DatabaseToolAgentAdapter,
    
    // Also expose the raw DatabaseTool instance as "DatabaseToolInternal"
    DatabaseToolInternal: DatabaseTool,
    
    // CRITICAL FIX: Expose methods directly on the registry object for ToolRunner
    // to find them if it looks for "DatabaseTool_get_feature_overview" style names.
    // Since DatabaseToolAgentAdapter is the one handling these, we can't easily 
    // flatten it here without instantiating. But ToolRunner logic now handles 
    // the class/instance fallback. 
    
    // Actually, for the PROBE (which uses this registry), we should use the 
    // REAL DatabaseTool instance, not the AgentAdapter which expects 
    // pre-parsed args. The probe is simulating the agent layer.
    // BUT ToolRunner.js logic expects tools to match functionDefinitions.js names.
    // functionDefinitions.js uses names like "DatabaseTool_get_feature_overview".
    // So we should map "DatabaseTool" to the real DatabaseTool instance for the probe?
    // Let's modify getToolsForRole to return the REAL instance for Orion in ACT mode?
    // No, AgentAdapter is designed for LLM interaction.
    // The issue is ToolRunner fallback logic.
    
    // Let's try this: Register the raw instance as "DatabaseTool" as well? 
    // Wait, roleCapabilities['Orion'].DatabaseTool is DatabaseToolAgentAdapter.
    // The probe uses registry.getTools() -> getToolsForRole('Orion').
    // So "DatabaseTool" in the tools map is the AgentAdapter class (not instance).
    // ToolRunner expects an instance or object with methods.
    
    // Fix: Instantiate DatabaseToolAgentAdapter here? No it needs dependencies.
    // Actually, DatabaseToolAgentAdapter is a CLASS. 
    // And ToolRunner does `tools[tool]`. If it gets a class, it can't call methods on it directly 
    // unless they are static.
    
    // Let's look at DatabaseToolAgentAdapter.js content.
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

/**
 * Get default tools for Orion in act mode (legacy compatibility).
 * @returns {Object} Tools map
 */
function getTools() {
  return getToolsForRole('Orion', 'act');
}

module.exports = {
  getToolsForRole,
  getToolDescriptions,
  getTools
};
