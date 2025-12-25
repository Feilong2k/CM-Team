// Zod schemas for JSON Plan Schema v1.1
// Based on docs/03-PROTOCOLS/core/JSON_Plan_Schema_v1.1.md

const { z } = require('zod');

// External ID pattern: P{project}-F{feature}-T{task}-S{subtask}
const externalIdPattern = /^P\d+(-F\d+(-T\d+(-S\d+)?)?)?$/;

// Status enum - accept both "in progress" and "in_progress"
const statusEnum = z.string()
  .refine(val => ['pending', 'in_progress', 'done', 'in progress'].includes(val), {
    message: 'Status must be one of: pending, in_progress, done'
  })
  .transform(val => val.toLowerCase().replace(/\s+/g, '_'));

// Workflow stage enum (for subtasks only)
const workflowStageEnum = z.enum([
  'planning',
  'Orion_PCC',
  'Tara_PCC',
  'Tara_Tests',
  'Devon_PCC',
  'Devon_Impl',
  'Devon_Refactor',
  'Adam_Review'
]);

// JSONB field schema - flexible but with recommended shape
const jsonbFieldSchema = z.record(z.any()).default({});

// Basic info schema (common structure)
const basicInfoSchema = z.object({
  owner: z.string().optional(),
  purpose: z.string().optional(),
  estimate: z.string().optional(),
  priority: z.string().optional(),
  notes: z.string().optional()
}).passthrough().default({}); // Allow additional fields

// Activity log entry schema
const activityLogEntrySchema = z.object({
  timestamp: z.string().datetime().optional(),
  action: z.string(),
  details: z.record(z.any()).optional()
});

// PCC schema
const pccSchema = z.object({
  checks: z.array(z.union([z.string(), z.object({
    id: z.string(),
    description: z.string(),
    passed: z.boolean()
  })])).default([]),
  risks: z.array(z.union([z.string(), z.object({
    severity: z.string(),
    description: z.string(),
    mitigation: z.string().optional()
  })])).default([]),
  questions: z.array(z.string()).default([])
}).default({});

// CAP schema
const capSchema = z.object({
  summary: z.string().default(''),
  risks: z.array(z.string()).default([]),
  questions: z.array(z.string()).default([])
}).default({});

// RED schema
const redSchema = z.object({
  summary: z.string().default(''),
  decomposition: z.array(z.string()).default([]),
  external_decisions: z.array(z.string()).default([])
}).default({});

// Instruction schema
const instructionSchema = z.object({
  steps: z.array(z.string()).default([])
}).default({});

// Tests schema
const testsSchema = z.object({
  tara: z.array(z.string()).default([])
}).default({});

// Implementations schema
const implementationsSchema = z.object({
  devon: z.array(z.string()).default([])
}).default({});

// Review schema
const reviewSchema = z.object({
  notes: z.string().default('')
}).default({});

// Subtask schema (recursive)
const subtaskSchema = z.lazy(() => z.object({
  externalId: z.string().regex(externalIdPattern, {
    message: 'Subtask externalId must match pattern P{project}-F{feature}-T{task}-S{subtask}'
  }),
  title: z.string(),
  status: statusEnum.default('pending'),
  workflow_stage: workflowStageEnum.default('planning'),
  basic_info: basicInfoSchema,
  instruction: instructionSchema,
  activity_log: z.array(activityLogEntrySchema).default([]),
  pcc: pccSchema,
  tests: testsSchema,
  implementations: implementationsSchema,
  review: reviewSchema,
  subtasks: z.array(subtaskSchema).default([])
}));

// Task schema
const taskSchema = z.object({
  externalId: z.string().regex(externalIdPattern, {
    message: 'Task externalId must match pattern P{project}-F{feature}-T{task}'
  }),
  title: z.string(),
  status: statusEnum.default('pending'),
  linked_plan_externalId: z.string().optional(),
  basic_info: basicInfoSchema,
  activity_log: z.array(activityLogEntrySchema).default([]),
  pcc: pccSchema,
  cap: capSchema,
  subtasks: z.array(subtaskSchema).default([])
});

// Feature schema
const featureSchema = z.object({
  externalId: z.string().regex(externalIdPattern, {
    message: 'Feature externalId must match pattern P{project}-F{feature}'
  }),
  title: z.string(),
  status: statusEnum.default('pending'),
  basic_info: basicInfoSchema,
  activity_log: z.array(activityLogEntrySchema).default([]),
  pcc: pccSchema,
  cap: capSchema,
  red: redSchema,
  tasks: z.array(taskSchema).default([])
});

// Plan schema
const planSchema = z.object({
  externalId: z.string().regex(externalIdPattern, {
    message: 'Plan externalId must match pattern P{project}'
  }),
  projectId: z.string(),
  title: z.string(),
  type: z.string().default('implementation_requirements'),
  status: statusEnum.default('pending'),
  revision: z.number().int().positive().default(1),
  contentMd: z.string().optional(),
  features: z.array(featureSchema).default([])
});

// Top-level schema with version
const jsonPlanSchema = z.object({
  schemaVersion: z.literal('1.1'),
  plan: planSchema
});

// Helper function to normalize status (convert "in progress" to "in_progress")
function normalizeStatus(status) {
  if (typeof status !== 'string') return status;
  const normalized = status.toLowerCase().replace(/\s+/g, '_');
  // Ensure it matches one of the valid statuses
  if (['pending', 'in_progress', 'done'].includes(normalized)) {
    return normalized;
  }
  return status; // Return original if not valid
}

// Helper function to parse externalId into components
function parseExternalId(externalId) {
  const parts = externalId.split('-');
  const result = {
    project: null,
    feature: null,
    task: null,
    subtask: null
  };
  
  parts.forEach((part, index) => {
    const type = part.charAt(0);
    const id = part.substring(1);
    
    switch (type) {
      case 'P':
        result.project = id;
        break;
      case 'F':
        result.feature = id;
        break;
      case 'T':
        result.task = id;
        break;
      case 'S':
        result.subtask = id;
        break;
    }
  });
  
  return result;
}

// Export schemas and helpers
module.exports = {
  jsonPlanSchema,
  planSchema,
  featureSchema,
  taskSchema,
  subtaskSchema,
  normalizeStatus,
  parseExternalId,
  externalIdPattern,
  statusEnum,
  workflowStageEnum
};
