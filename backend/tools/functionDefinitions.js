/**
 * Function Definitions for LLM Function Calling
 * 
 * This file defines all available tools as OpenAI-compatible function definitions.
 * The LLM will use these to select and call the appropriate tool.
 * 
 * Format: https://platform.openai.com/docs/guides/function-calling
 */

const functionDefinitions = [
  // ==================== DatabaseTool (Semantic + Safe-SQL) ====================
  {
    type: "function",
    function: {
      name: "DatabaseTool_get_subtask_by_id",
      description: "Get a specific subtask by its ID (e.g., 'F1.1.1', 'F1.2.3').",
      parameters: {
        type: "object",
        properties: {
          subtask_id: { 
            type: "string", 
            description: "The subtask ID (e.g., 'F1.1.1')" 
          }
        },
        required: ["subtask_id"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_list_subtasks_by_status",
      description: "List subtasks filtered by status (e.g., 'pending', 'in_progress', 'completed').",
      parameters: {
        type: "object",
        properties: {
          status: { 
            type: "string", 
            description: "Status to filter by (e.g., 'pending', 'in_progress', 'completed')" 
          },
          limit: { 
            type: "number", 
            description: "Maximum number of results (optional, default: 50)" 
          }
        },
        required: ["status"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_search_subtasks_by_keyword",
      description: "Search subtasks by keyword in title or description. Useful when you don't remember the exact subtask ID but know what it's about.",
      parameters: {
        type: "object",
        properties: {
          keyword: { 
            type: "string", 
            description: "Keyword to search for (e.g., 'database', 'postgres', 'tools')" 
          },
          limit: { 
            type: "number", 
            description: "Maximum number of results (optional, default: 20)" 
          }
        },
        required: ["keyword"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_add_column_to_table",
      description: "Safely add a new column to an existing table. Only allows adding columns, not removing or modifying existing ones.",
      parameters: {
        type: "object",
        properties: {
          table_name: { 
            type: "string", 
            description: "Name of the table to modify" 
          },
          column_name: { 
            type: "string", 
            description: "Name of the new column" 
          },
          column_type: { 
            type: "string", 
            description: "PostgreSQL data type (e.g., 'text', 'integer', 'boolean', 'jsonb')" 
          },
          default_value: { 
            type: "string", 
            description: "Default value for the column (optional)" 
          },
          nullable: { 
            type: "boolean", 
            description: "Whether the column can be NULL (optional, default: true)" 
          }
        },
        required: ["table_name", "column_name", "column_type"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_create_table_from_migration",
      description: "Create a new table using a migration SQL file. Only allows CREATE TABLE, not DROP or ALTER.",
      parameters: {
        type: "object",
        properties: {
          migration_file: { 
            type: "string", 
            description: "Path to the migration SQL file (e.g., 'backend/src/db/migrations/001_create_subtasks.sql')" 
          }
        },
        required: ["migration_file"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_list_tables",
      description: "List all tables in the database.",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "DatabaseTool_safe_query",
      description: "Execute a safe SQL query (SELECT only, no DROP, TRUNCATE, DELETE without WHERE, or other destructive operations).",
      parameters: {
        type: "object",
        properties: {
          sql: { 
            type: "string", 
            description: "The SQL query to execute (must be a SELECT query)" 
          },
          params: { 
            type: "array", 
            items: { type: "string" },
            description: "Query parameters (for parameterized queries)" 
          }
        },
        required: ["sql"]
      }
    }
  },

  // ==================== FileSystemTool ====================
  {
    type: "function",
    function: {
      name: "FileSystemTool_read",
      description: "Read the contents of a file.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Path to the file to read" 
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "FileSystemTool_write",
      description: "Create or write a file. Creates parent directories automatically. Use this for 'create file' requests - no need to list or check first.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Path to the file to create/write" 
          },
          content: { 
            type: "string", 
            description: "Content to write to the file" 
          }
        },
        required: ["path", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "FileSystemTool_list",
      description: "List contents of a directory.",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Path to the directory to list" 
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "FileSystemTool_mkdir",
      description: "Create a directory (creates parent directories if needed).",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Path to the directory to create" 
          }
        },
        required: ["path"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "FileSystemTool_delete",
      description: "Delete a file or directory (recursive for directories).",
      parameters: {
        type: "object",
        properties: {
          path: { 
            type: "string", 
            description: "Path to the file or directory to delete" 
          }
        },
        required: ["path"]
      }
    }
  },

  // ==================== GitTool ====================
  {
    type: "function",
    function: {
      name: "GitTool_status",
      description: "Get the current git status (modified files, branch, etc.).",
      parameters: {
        type: "object",
        properties: {},
        required: []
      }
    }
  },
  {
    type: "function",
    function: {
      name: "GitTool_commit",
      description: "Commit staged changes with a message.",
      parameters: {
        type: "object",
        properties: {
          message: { 
            type: "string", 
            description: "Commit message" 
          }
        },
        required: ["message"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "GitTool_branch",
      description: "List branches or create a new branch.",
      parameters: {
        type: "object",
        properties: {
          name: { 
            type: "string", 
            description: "Branch name to create (omit to list branches)" 
          }
        },
        required: []
      }
    }
  },

  // ==================== ShellTool ====================
  {
    type: "function",
    function: {
      name: "ShellTool_execute",
      description: "Execute a shell command (restricted to safe commands only).",
      parameters: {
        type: "object",
        properties: {
          command: { 
            type: "string", 
            description: "The command to execute" 
          },
          cwd: { 
            type: "string", 
            description: "Working directory (optional)" 
          }
        },
        required: ["command"]
      }
    }
  }
];

/**
 * Parse a function call response into tool/action/params
 * @param {Object} toolCall - The tool_call object from LLM response
 * @returns {Object} { tool, action, params }
 */
function parseFunctionCall(toolCall) {
  const functionName = toolCall.function.name;
  const args = JSON.parse(toolCall.function.arguments || '{}');
  
  // Split ToolName_action into tool and action
  const [tool, action] = functionName.split('_');
  
  return {
    tool,
    action,
    params: args
  };
}

module.exports = functionDefinitions;
module.exports.parseFunctionCall = parseFunctionCall;
