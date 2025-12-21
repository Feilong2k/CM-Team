# FileSystemTool Integration Gap Analysis

## Current State (Historical; pre-F2-T1)

This document describes the state **before** FileSystemTool was fully implemented and registered for Orion. As of F2-T1:
- `FileSystemTool_read_file`, `FileSystemTool_write_to_file`, `FileSystemTool_list_files`, and `FileSystemTool_search_files` are implemented in `backend/tools/FileSystemTool.js`.
- These tools are exposed to Orion via the role-based registry in `backend/tools/registry.js` and available for LLM tool-calls.

The sections below are kept for historical context but no longer reflect the current implementation status.

Previously, **Orion could not use `list_files` and `search_files` directly as tool calls** inside the app because they were not registered in the tool registry. Here's the historical state:

## Current Integration Status:

1. **As CLI Utilities**: Both tools exist as standalone Node.js scripts in `backend/tools/` and can be executed via command line:

   ```bash
   node backend/tools/list_files.js [directory] [--json] [--no-ignore]
   node backend/tools/search_files.js [directory] [pattern] [--json] [--no-ignore]
   ```

2. **Tool Registry Gap**: The tool registry (`backend/tools/registry.js`) references a `FileSystemTool` module that doesn't exist. The function definitions include `FileSystemTool_list`, `FileSystemTool_read`, etc., but the actual implementation is missing.

3. **Orion's Current Capabilities**: Orion can:

   - Use `ShellTool_execute` to run these CLI commands indirectly
   - Use database tools (via `DatabaseTool_*`)
   - Use other registered tools (GitTool, etc.)

## What Would Be Needed for Direct Integration:

To make these tools directly callable by Orion, you would need to:

1. **Implement `FileSystemTool.js`** that wraps `list_files` and `search_files` functionality
2. **Register the tools** in the function definitions with proper parameters
3. **Update the tool registry** to load the implementation

## Alternative: ContextBuilder Integration

These tools were created for **ContextBuilder** - a component that analyzes codebases for Orion. The intended usage might be:

- ContextBuilder calls these tools during codebase analysis
- Orion receives analyzed context via the planning workflow
- Not directly as tool calls during planning/execution

## Recommendation:

If you want Orion to use these tools directly, the next step would be to:

1. Create `FileSystemTool.js` implementing the missing methods
2. Integrate the `.gitignore` support we just built into that implementation
3. Test that Orion can call `FileSystemTool_list` and potentially add a `FileSystemTool_search` method

The `.gitignore` support we implemented will work regardless of integration path since it's built into the core utilities.

---
*Document generated based on analysis of tool integration gaps in the CM-TEAM project.*
