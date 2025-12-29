/**
 * @jest-environment node
 *
 * TOOL-001 – Registry: Orion tool exposure
 *
 * Tests for `backend/tools/registry.js` that verify:
 * 1. Orion ACT tools include DatabaseTool mapped to the Agent Adapter.
 * 2. Plan mode denies tools for all roles.
 * 3. Unknown roles return an empty toolset.
 * 4. Legacy getTools() helper returns the same as getToolsForRole('Orion', 'act').
 */

const { getToolsForRole, getTools } = require('../../../tools/registry');

describe('TOOL-001: Registry tool exposure', () => {
  describe('Orion role in ACT mode', () => {
    test('should include DatabaseTool mapped to the Agent Adapter', () => {
      const tools = getToolsForRole('Orion', 'act');
      // Expect a DatabaseTool property
      expect(tools).toHaveProperty('DatabaseTool');
      // The DatabaseTool should be the DatabaseToolAgentAdapter (or at least have its methods)
      // We can check for a known method of the adapter
      expect(typeof tools.DatabaseTool.get_feature_overview).toBe('function');
      // Also expect FileSystemTool
      expect(tools).toHaveProperty('FileSystemTool');
    });
  });

  describe('Plan mode denies tools for all roles', () => {
    const roles = ['Devon', 'Tara', 'Orion'];
    roles.forEach(role => {
      test(`should return empty object for ${role} in plan mode`, () => {
        const tools = getToolsForRole(role, 'plan');
        expect(tools).toEqual({});
      });
    });
  });

  describe('Unknown roles', () => {
    test('should return empty object for unknown role in act mode', () => {
      const tools = getToolsForRole('UnknownRole', 'act');
      expect(tools).toEqual({});
    });

    test('should return empty object for unknown role in plan mode', () => {
      const tools = getToolsForRole('UnknownRole', 'plan');
      expect(tools).toEqual({});
    });
  });

  describe('Legacy getTools() helper', () => {
    test('should return same object as getToolsForRole("Orion", "act")', () => {
      const toolsViaHelper = getTools();
      const toolsViaRole = getToolsForRole('Orion', 'act');
      expect(toolsViaHelper).toEqual(toolsViaRole);
    });
  });
});
