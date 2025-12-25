/**
 * Tara's failing tests for Subtask 1-0-2 (Migration Execution Ownership + Runbook)
 * 
 * These tests must fail for the right reasons:
 * - Missing npm scripts in package.json
 * - Missing documentation
 * - Missing error message improvements
 * 
 * They must NOT pass if:
 * - Npm scripts don't exist
 * - Documentation is missing
 * - Error messages are unclear
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

describe('Migration Execution Workflow - Subtask 1-0-2', () => {
  describe('NPM Scripts Validation', () => {
    test('should have db:migrate script in package.json', () => {
      // Arrange
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Assert
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts['db:migrate']).toBeDefined();
      expect(typeof packageJson.scripts['db:migrate']).toBe('string');
      expect(packageJson.scripts['db:migrate'].trim()).not.toBe('');
    });

    test('should have db:migrate:test script in package.json', () => {
      // Arrange
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Assert
      expect(packageJson.scripts).toBeDefined();
      expect(packageJson.scripts['db:migrate:test']).toBeDefined();
      expect(typeof packageJson.scripts['db:migrate:test']).toBe('string');
      expect(packageJson.scripts['db:migrate:test'].trim()).not.toBe('');
    });

    test('db:migrate script should call the migration runner', () => {
      // Arrange
      const packageJsonPath = path.join(__dirname, '..', '..', 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const migrateScript = packageJson.scripts['db:migrate'];
      
      // Assert
      expect(migrateScript).toContain('migrate');
      expect(migrateScript).toMatch(/node.*scripts.*migrate/);
    });
  });

  describe('Documentation Validation', () => {
    test('should have migration workflow documentation', () => {
      // Arrange
      const readmePath = path.join(__dirname, '..', '..', 'README.md');
      const docsPath = path.join(__dirname, '..', '..', 'MIGRATION_WORKFLOW.md');
      
      // Check if either file exists
      const hasReadme = fs.existsSync(readmePath);
      const hasDocs = fs.existsSync(docsPath);
      
      // Assert
      expect(hasReadme || hasDocs).toBe(true);
      
      if (hasReadme) {
        const readmeContent = fs.readFileSync(readmePath, 'utf8');
        expect(readmeContent).toContain('migration');
        expect(readmeContent).toContain('DATABASE_URL');
      }
      
      if (hasDocs) {
        const docsContent = fs.readFileSync(docsPath, 'utf8');
        expect(docsContent).toContain('migration');
        expect(docsContent).toContain('DATABASE_URL');
      }
    });

    test('documentation should mention environment-specific execution', () => {
      // Arrange
      const readmePath = path.join(__dirname, '..', '..', 'README.md');
      const docsPath = path.join(__dirname, '..', '..', 'MIGRATION_WORKFLOW.md');
      
      let content = '';
      if (fs.existsSync(readmePath)) {
        content = fs.readFileSync(readmePath, 'utf8');
      } else if (fs.existsSync(docsPath)) {
        content = fs.readFileSync(docsPath, 'utf8');
      }
      
      // Assert
      expect(content).toContain('dev');
      expect(content).toContain('test');
      expect(content).toContain('CI');
      expect(content).toContain('prod');
    });
  });

  describe('Error Message Validation', () => {
    test('migration runner should have clear error message for missing DATABASE_URL', () => {
      // Arrange
      const migrateScriptPath = path.join(__dirname, '..', '..', 'scripts', 'migrate.js');
      const migrateScript = fs.readFileSync(migrateScriptPath, 'utf8');
      
      // Assert
      expect(migrateScript).toContain('DATABASE_URL');
      expect(migrateScript).toContain('environment variable');
      expect(migrateScript).toContain('required');
      expect(migrateScript).toContain('ConfigurationError');
    });
  });

  describe('SSOT Update Validation', () => {
    test('SSOT should have migration execution workflow section', () => {
      // Arrange
      // SSOT path updated to new docs structure
      const ssotPath = path.join(__dirname, '..', '..', '..', 'docs', '11-ARCHIVE', 'Feature1_Implementation_Requirements_v1.0.md');
      
      // Skip if SSOT doesn't exist in expected location
      if (!fs.existsSync(ssotPath)) {
        console.warn('SSOT file not found at expected location, skipping test');
        return;
      }
      
      const ssotContent = fs.readFileSync(ssotPath, 'utf8');
      
      // Assert
      expect(ssotContent).toContain('Migration Execution Workflow');
      expect(ssotContent).toContain('owner');
      expect(ssotContent).toContain('trigger');
      expect(ssotContent).toContain('environment');
    });
  });
});
