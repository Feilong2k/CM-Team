const express = require('express');
const db = require('../../config/db');

const router = express.Router();

// GET /api/features
// Returns all features with nested tasks and subtasks for the current plan (assumes single plan for MVP)
router.get('/', async (req, res) => {
  try {
    // Get all features
    const featuresRes = await db.query('SELECT * FROM features ORDER BY id');
    const features = featuresRes.rows;

    // Get all tasks
    const tasksRes = await db.query('SELECT * FROM tasks ORDER BY id');
    const tasks = tasksRes.rows;

    // Get all subtasks
    const subtasksRes = await db.query('SELECT * FROM subtasks ORDER BY id');
    const subtasks = subtasksRes.rows;

    // Nest subtasks under tasks
    const taskIdToSubtasks = {};
    for (const subtask of subtasks) {
      if (!taskIdToSubtasks[subtask.task_id]) {
        taskIdToSubtasks[subtask.task_id] = [];
      }
      taskIdToSubtasks[subtask.task_id].push(subtask);
    }

    // Nest tasks under features
    const featureIdToTasks = {};
    for (const task of tasks) {
      // Attach subtasks to each task
      task.subtasks = taskIdToSubtasks[task.id] || [];
      if (!featureIdToTasks[task.feature_id]) {
        featureIdToTasks[task.feature_id] = [];
      }
      featureIdToTasks[task.feature_id].push(task);
    }

    // Attach tasks to each feature
    const featuresWithTasks = features.map(feature => ({
      ...feature,
      tasks: featureIdToTasks[feature.id] || []
    }));

    res.json({ features: featuresWithTasks });
  } catch (err) {
    console.error('Failed to fetch features:', err);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

/**
 * PATCH /api/features/:id
 * Update status or append to activity_log of a feature
 */
router.patch('/:id', async (req, res) => {
  const { status, activity_log_entry } = req.body;
  if (!status && !activity_log_entry) return res.status(400).json({ error: 'Missing status or activity_log_entry' });
  try {
    if (status) {
      await db.query('UPDATE features SET status = $1 WHERE id = $2', [status, req.params.id]);
    }
    if (activity_log_entry) {
      await db.query(
        'UPDATE features SET activity_log = COALESCE(activity_log, \'[]\'::jsonb) || $1::jsonb WHERE id = $2',
        [JSON.stringify([activity_log_entry]), req.params.id]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update feature:', err);
    res.status(500).json({ error: 'Failed to update feature' });
  }
});

/**
 * PATCH /api/features/:featureId/tasks/:taskId
 * Update status or append to activity_log of a task
 */
router.patch('/:featureId/tasks/:taskId', async (req, res) => {
  const { status, activity_log_entry } = req.body;
  if (!status && !activity_log_entry) return res.status(400).json({ error: 'Missing status or activity_log_entry' });
  try {
    if (status) {
      await db.query('UPDATE tasks SET status = $1 WHERE id = $2 AND feature_id = $3', [status, req.params.taskId, req.params.featureId]);
    }
    if (activity_log_entry) {
      await db.query(
        'UPDATE tasks SET activity_log = COALESCE(activity_log, \'[]\'::jsonb) || $1::jsonb WHERE id = $2 AND feature_id = $3',
        [JSON.stringify([activity_log_entry]), req.params.taskId, req.params.featureId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update task:', err);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

/**
 * PATCH /api/features/:featureId/tasks/:taskId/subtasks/:subtaskId
 * Update status, workflow_stage, or append to activity_log of a subtask
 */
router.patch('/:featureId/tasks/:taskId/subtasks/:subtaskId', async (req, res) => {
  const { status, workflow_stage, activity_log_entry } = req.body;
  if (!status && !workflow_stage && !activity_log_entry) return res.status(400).json({ error: 'Missing status, workflow_stage, or activity_log_entry' });
  try {
    if (status && workflow_stage) {
      await db.query(
        'UPDATE subtasks SET status = $1, workflow_stage = $2 WHERE id = $3 AND task_id = $4',
        [status, workflow_stage, req.params.subtaskId, req.params.taskId]
      );
    } else if (status) {
      await db.query(
        'UPDATE subtasks SET status = $1 WHERE id = $2 AND task_id = $3',
        [status, req.params.subtaskId, req.params.taskId]
      );
    } else if (workflow_stage) {
      await db.query(
        'UPDATE subtasks SET workflow_stage = $1 WHERE id = $2 AND task_id = $3',
        [workflow_stage, req.params.subtaskId, req.params.taskId]
      );
    }
    if (activity_log_entry) {
      await db.query(
        'UPDATE subtasks SET activity_log = COALESCE(activity_log, \'[]\'::jsonb) || $1::jsonb WHERE id = $2 AND task_id = $3',
        [JSON.stringify([activity_log_entry]), req.params.subtaskId, req.params.taskId]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Failed to update subtask:', err);
    res.status(500).json({ error: 'Failed to update subtask' });
  }
});

module.exports = router;
