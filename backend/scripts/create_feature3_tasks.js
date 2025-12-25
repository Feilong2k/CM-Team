#!/usr/bin/env node

/**
 * Create Feature 3 and its tasks in the database.
 * Usage: node create_feature3_tasks.js
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const DatabaseTool = require('../tools/DatabaseTool').DatabaseTool;
const dbTool = new DatabaseTool('Orion');

async function createFeature3() {
  console.log('Creating Feature 3 (Two-Stage Protocol & Service Foundation)...');

  const featureData = {
    projectId: 'P1',
    external_id: 'P1-F3',
    title: 'Feature 3: Two-Stage Protocol & Service Foundation (Production-Ready)',
    status: 'pending',
    basic_info: {
      goal: 'Implement production-ready two-stage protocol with strategy pattern and modular services, with design-first approach based on RED v3 analysis',
      area: 'Protocol Architecture',
      notes: [
        'Design phase first → Phased implementation addressing all RED v3 gaps for production readiness',
        'Total Timeline: 14-18 days',
        'Key changes from v2.1: Added Design Phase, Restructured Tasks, Enhanced Security, Added Knowledge Transfer'
      ]
    },
    pcc: {},
    cap: {},
    red: {},
    reason: 'Created based on RED v3 analysis and updated roadmap v2.2'
  };

  try {
    // Check if feature already exists
    const existingFeature = await dbTool.query(
      'SELECT id FROM features WHERE external_id = $1',
      [featureData.external_id]
    );

    if (existingFeature.rows.length > 0) {
      console.log(`Feature ${featureData.external_id} already exists, skipping creation.`);
      return existingFeature.rows[0].id;
    }

    const feature = await dbTool.create_feature(
      featureData.projectId,
      featureData.external_id,
      featureData.title,
      featureData.status,
      featureData.basic_info,
      featureData.pcc,
      featureData.cap,
      featureData.red,
      featureData.reason
    );

    console.log(`Created feature: ${feature.external_id} (ID: ${feature.id})`);
    return feature.id;
  } catch (error) {
    console.error('Error creating feature:', error.message);
    throw error;
  }
}

async function createTasksForFeature3(featureId) {
  const tasks = [
    {
      external_id: 'P1-F3-T0',
      title: 'Task 3.0: Design & Knowledge Foundation',
      status: 'pending',
      basic_info: {
        goal: 'Create design documents and knowledge foundation before implementation',
        timeline: '2-3 days',
        notes: ['Critical design phase identified in RED v3 analysis']
      },
      pcc: {},
      cap: {},
      reason: 'Design phase required before implementation starts'
    },
    {
      external_id: 'P1-F3-T1',
      title: 'Task 3.1: Protocol Strategy Implementation',
      status: 'pending',
      basic_info: {
        goal: 'Implement ProtocolStrategy interface and extract StandardProtocol from OrionAgent',
        timeline: '4-5 days',
        notes: ['Core protocol implementation phase']
      },
      pcc: {},
      cap: {},
      reason: 'Core protocol strategy pattern implementation'
    },
    {
      external_id: 'P1-F3-T2',
      title: 'Task 3.2: ContextService Implementation',
      status: 'pending',
      basic_info: {
        goal: 'Implement ContextService for shared context building across protocols',
        timeline: '3-4 days',
        notes: ['Eliminates duplication between protocols']
      },
      pcc: {},
      cap: {},
      reason: 'Service extraction to eliminate code duplication'
    },
    {
      external_id: 'P1-F3-T3',
      title: 'Task 3.3: Enhanced Service Layer',
      status: 'pending',
      basic_info: {
        goal: 'Extract PlanModeService and ErrorService, create basic AgentFactory',
        timeline: '2-3 days',
        notes: ['Enhanced service layer for clean separation of concerns']
      },
      pcc: {},
      cap: {},
      reason: 'Enhanced service extraction for testable components'
    },
    {
      external_id: 'P1-F3-T4',
      title: 'Task 3.4: Security & Configuration',
      status: 'pending',
      basic_info: {
        goal: 'Implement security redaction patterns, configurable budgets, and phase trace events',
        timeline: '3-4 days',
        notes: ['Security requirement identified in RED v3 analysis']
      },
      pcc: {},
      cap: {},
      reason: 'Security and configuration implementation'
    },
    {
      external_id: 'P1-F3-T5',
      title: 'Task 3.5: Observability & Stabilization',
      status: 'pending',
      basic_info: {
        goal: 'Phase trace event integration, performance testing, backward compatibility',
        timeline: '2-3 days',
        notes: ['Production monitoring and stability']
      },
      pcc: {},
      cap: {},
      reason: 'Observability and stabilization for production'
    },
    {
      external_id: 'P1-F3-T6',
      title: 'Task 3.6: Documentation & Knowledge Transfer',
      status: 'pending',
      basic_info: {
        goal: 'Create protocol pattern documentation, service extraction approach, security guidelines',
        timeline: '1-2 days',
        notes: ['Knowledge transfer to close gaps identified in RED v3']
      },
      pcc: {},
      cap: {},
      reason: 'Knowledge transfer documentation'
    }
  ];

  console.log(`Creating ${tasks.length} tasks for Feature 3...`);

  const createdTasks = [];
  for (const task of tasks) {
    try {
      // Check if task already exists
      const existingTask = await dbTool.query(
        'SELECT id FROM tasks WHERE external_id = $1',
        [task.external_id]
      );

      if (existingTask.rows.length > 0) {
        console.log(`Task ${task.external_id} already exists, skipping creation.`);
        createdTasks.push(existingTask.rows[0]);
        continue;
      }

      const createdTask = await dbTool.create_task(
        featureId,
        task.external_id,
        task.title,
        task.status,
        task.basic_info,
        task.pcc,
        task.cap,
        task.reason
      );

      console.log(`Created task: ${createdTask.external_id} (ID: ${createdTask.id})`);
      createdTasks.push(createdTask);
    } catch (error) {
      console.error(`Error creating task ${task.external_id}:`, error.message);
    }
  }

  return createdTasks;
}

async function main() {
  try {
    // Create Feature 3
    const featureId = await createFeature3();

    // Create tasks for Feature 3
    const tasks = await createTasksForFeature3(featureId);

    console.log('\n=== Summary ===');
    console.log(`Feature 3 created/verified with ID: ${featureId}`);
    console.log(`Created/verified ${tasks.length} tasks:`);
    tasks.forEach(task => {
      console.log(`  - ${task.external_id}: ${task.title}`);
    });

    console.log('\nNext steps:');
    console.log('1. Run the subtask creation script:');
    console.log('   node scripts/create_subtasks_from_json.js template/F3-two_stage_protocol_service_foundation.json');
    console.log('\n2. Feature 3 will be visible in the UI under Plan tab.');

    // Clean up DB connection
    const db = require('../src/db/connection');
    await db.getPool().end();
    
    process.exit(0);
  } catch (error) {
    console.error('Error in main:', error.message);
    process.exit(1);
  }
}

main();
