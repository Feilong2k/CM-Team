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
    type: 'function',
    function: {
      name: 'DatabaseTool_get_subtask_full_context',
      description: 'Get full workflow context for a subtask (basic_info, instruction, pcc, tests, implementations, review, activity_log).',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id (P1-F2-T0-S7), or shorthand (2-0-7).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when subtask_id is already full.'
          }
        },
        required: ['subtask_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_list_subtasks_for_task',
      description: 'List subtasks under a given task, optionally filtered by status and including full details.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id (P1-F2-T0), or shorthand (2-0).'
          },
          status: {
            type: 'string',
            description: 'Optional status filter (pending, in_progress, completed, blocked).'
          },
          include_details: {
            type: 'boolean',
            description: 'When true, include full JSONB sections for each subtask.'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when task_id is already full.'
          }
        },
        required: ['task_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_get_feature_overview',
      description: 'Get a high-level overview of a feature, including its tasks and each task’s subtasks.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id (P1-F2), or shorthand (2).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional when feature_id is already full.'
          }
        },
        required: ['feature_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_list_subtasks_by_status',
      description: 'List subtasks filtered by status across the project.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: "Status to filter by (e.g., 'pending', 'in_progress', 'completed', 'blocked')."
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (optional, default: 50).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional; defaults to P1.'
          }
        },
        required: ['status']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_search_subtasks_by_keyword',
      description: "Search subtasks by keyword in title or basic_info. Useful when you don't remember the exact subtask ID but know what it's about.",
      parameters: {
        type: 'object',
        properties: {
          keyword: {
            type: 'string',
            description: "Keyword to search for (e.g., 'database', 'postgres', 'tools')."
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results (optional, default: 20).'
          },
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1). Optional; defaults to P1.'
          }
        },
        required: ['keyword']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_subtask_sections',
      description: 'Atomically update multiple sections of a subtask (status, workflow_stage, basic_info, instruction, pcc, tests, implementations, review) with logging.',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id, or shorthand (2-0-6).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: workflow_stage, status, basic_info, instruction, pcc, tests, implementation, review).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['subtask_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_feature_sections',
      description: 'Atomically update sections of a feature (status, basic_info, pcc, pvp_analysis, fap_analysis) with logging.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id, or shorthand (2).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: status, basic_info, pcc, pvp_analysis, fap_analysis, activity_log).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['feature_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_update_task_sections',
      description: 'Atomically update sections of a task (status, basic_info, pcc, pvp_analysis) with logging.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id, or shorthand (2-0).'
          },
          changes: {
            type: 'object',
            description: 'Object of sections to update (keys: status, basic_info, pcc, pvp_analysis, activity_log).',
            additionalProperties: true
          },
          reason: {
            type: 'string',
            description: 'Reason for the change for activity logging.'
          }
        },
        required: ['task_id', 'changes']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_feature',
      description: 'Create a new feature under a project, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          project_id: {
            type: 'string',
            description: 'Project external id (e.g., P1).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Feature title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          cap: {
            type: 'object',
            description: 'CAP (pvp_analysis) JSONB payload.'
          },
          red: {
            type: 'object',
            description: 'RED (fap_analysis) JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['project_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_task',
      description: 'Create a new task under a feature, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          feature_id: {
            type: 'string',
            description: 'Feature ID: numeric id, full external_id, or shorthand (2).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Task title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          cap: {
            type: 'object',
            description: 'CAP (pvp_analysis) JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['feature_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_create_subtask',
      description: 'Create a new subtask under a task, with optional explicit external_id.',
      parameters: {
        type: 'object',
        properties: {
          task_id: {
            type: 'string',
            description: 'Task ID: numeric id, full external_id, or shorthand (2-0).'
          },
          external_id: {
            type: 'string',
            description: 'Optional explicit external_id; if omitted, one is auto-generated.'
          },
          title: {
            type: 'string',
            description: 'Subtask title.'
          },
          status: {
            type: 'string',
            description: 'Initial status (default: pending).'
          },
          workflow_stage: {
            type: 'string',
            description: 'Workflow stage (default: orion_planning).'
          },
          basic_info: {
            type: 'object',
            description: 'Basic info JSONB payload.'
          },
          instruction: {
            type: 'object',
            description: 'Instruction JSONB payload.'
          },
          pcc: {
            type: 'object',
            description: 'PCC JSONB payload.'
          },
          tests: {
            type: 'object',
            description: 'Tests JSONB payload.'
          },
          implementation: {
            type: 'object',
            description: 'Implementation JSONB payload.'
          },
          review: {
            type: 'object',
            description: 'Review JSONB payload.'
          },
          reason: {
            type: 'string',
            description: 'Reason for creation (for logging).'
          }
        },
        required: ['task_id', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_delete_subtask',
      description: 'Delete a subtask by ID. Use with caution.',
      parameters: {
        type: 'object',
        properties: {
          subtask_id: {
            type: 'string',
            description: 'Subtask ID: numeric id, full external_id, or shorthand.'
          },
          reason: {
            type: 'string',
            description: 'Reason for deletion (for logging).'
          }
        },
        required: ['subtask_id']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'DatabaseTool_safe_query',
      description: 'Execute a safe SQL query (subject to safety checks). Backed by DatabaseTool.query().',
      parameters: {
        type: 'object',
        properties: {
          sql: {
            type: 'string',
            description: 'The SQL query to execute. Must pass safety checks (no DROP/TRUNCATE, etc.).'
          },
          params: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional stringified query parameters.'
          }
        },
        required: ['sql']
      }
    }
  },

  // ==================== FileSystemTool ====================
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_read_file',
      description: 'Read the contents of a file within the project workspace (text only).',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to read, relative to project root.'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_write_to_file',
      description: 'Create or overwrite a file. Parents are created automatically.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the file to create/write, relative to project root.'
          },
          content: {
            type: 'string',
            description: 'Content to write to the file.'
          }
        },
        required: ['path', 'content']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_list_files',
      description: 'List contents of a directory (optionally recursive). Respects .gitignore by default.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Path to the directory to list, relative to project root.'
          },
          recursive: {
            type: 'boolean',
            description: 'Whether to list recursively (default: true). Set false for a single directory level.'
          },
          no_ignore: {
            type: 'boolean',
            description: 'When true, do NOT apply .gitignore/default ignore rules (debug use only).'
          }
        },
        required: ['path']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'FileSystemTool_search_files',
      description: 'Search for a regex pattern across files in a directory tree. Respects .gitignore by default.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Root directory to search in, relative to project root.'
          },
          regex: {
            type: 'string',
            description: 'JavaScript RegExp pattern (string) to search for. The server compiles this with new RegExp(regex, "i").'
          },
          file_pattern: {
            type: 'string',
            description: 'Optional glob (e.g., *.js) to limit searched files. (May be ignored if not implemented server-side yet.)'
          },
          no_ignore: {
            type: 'boolean',
            description: 'When true, do NOT apply .gitignore/default ignore rules (debug use only).'
          }
        },
        required: ['path', 'regex']
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
  const functionName = toolCall.function?.name || toolCall.name;
  const rawArgs = toolCall.function?.arguments ?? toolCall.arguments ?? '{}';
  const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : rawArgs;

  if (!functionName) {
    throw new Error('Missing function name in tool call');
  }

  const parts = functionName.split('_');
  const tool = parts[0];
  const action = parts.slice(1).join('_');

  return {
    tool,
    action,
    params: args,
  };
}

module.exports = functionDefinitions;
module.exports.parseFunctionCall = parseFunctionCall;
