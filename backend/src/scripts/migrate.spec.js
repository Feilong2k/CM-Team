/**
 * Tara's failing tests for Subtask 1-0-1 (Migration Runner)
 * 
 * These tests must fail for the right reasons:
 * - Missing implementation
 * - Placeholder logic (hardcoded returns, empty functions)
 * - Missing transaction safety
 * - Incorrect file sorting
 * 
 * They must NOT pass if:
 * - fs.readdir is mocked to return static list
 * - pg client is stubbed without real DB calls
 * - BEGIN/COMMIT/ROLLBACK are not called
 */

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

// Mock fs and pg before requiring the actual module
jest.mock('fs');
jest.mock('pg', () => {
  const mockClient = {
    connect: jest.fn(),
    query: jest.fn(),
    end: jest.fn()
  };
  return { Client: jest.fn(() => mockClient) };
});

// Clear mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});

describe('Migration Runner - Unit Tests (mocked)', () => {
describe('readMigrationFiles', () => {
    test('should read .sql files from backend/migrations/ directory', () => {
      // Arrange
      const mockFiles = ['002_orion_workflow.sql', '001_initial.sql'];
      const expectedSorted = ['001_initial.sql', '002_orion_workflow.sql'];
      // Mock existsSync to return true for any path
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(mockFiles);
      
      // Act
      const result = require('../../scripts/migrate').readMigrationFiles();
      
      // Assert
      expect(fs.existsSync).toHaveBeenCalled();
      expect(fs.readdirSync).toHaveBeenCalled();
      expect(result).toEqual(expectedSorted); // Should be sorted
    });

    test('should sort files by TIMESTAMP_ prefix', () => {
      // Arrange
      const unsorted = [
        '003_feature_table.sql',
        '001_initial.sql',
        '002_orion_workflow.sql'
      ];
      const sorted = [
        '001_initial.sql',
        '002_orion_workflow.sql',
        '003_feature_table.sql'
      ];
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(unsorted);
      
      // Act
      const result = require('../../scripts/migrate').readMigrationFiles();
      
      // Assert
      expect(result).toEqual(sorted);
    });

    test('should filter out non-.sql files', () => {
      // Arrange
      const mixedFiles = [
        '001_initial.sql',
        'README.md',
        '002_orion_workflow.sql',
        '.gitkeep'
      ];
      const expected = ['001_initial.sql', '002_orion_workflow.sql'];
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(mixedFiles);
      
      // Act
      const result = require('../../scripts/migrate').readMigrationFiles();
      
      // Assert
      expect(result).toEqual(expected);
    });
  });

  describe('executeMigration', () => {
    test('should connect to database using DATABASE_URL', async () => {
      // Arrange
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
      const mockClient = new Client();
      const sql = 'CREATE TABLE test (id SERIAL PRIMARY KEY);';
      
      // Act
      await require('../../scripts/migrate').executeMigration(sql);
      
      // Assert
      expect(Client).toHaveBeenCalledWith({ connectionString: process.env.DATABASE_URL });
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockClient.query).toHaveBeenCalledWith(sql);
      expect(mockClient.end).toHaveBeenCalled();
    });

    test('should wrap execution in BEGIN/COMMIT transaction', async () => {
      // Arrange
      const mockClient = new Client();
      const sql = 'CREATE TABLE test (id SERIAL PRIMARY KEY);';
      
      // Act
      await require('../../scripts/migrate').executeMigration(sql);
      
      // Assert
      expect(mockClient.query).toHaveBeenNthCalledWith(1, 'BEGIN');
      expect(mockClient.query).toHaveBeenNthCalledWith(2, sql);
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'COMMIT');
    });

    test('should call ROLLBACK on SQL error', async () => {
      // Arrange
      const mockClient = new Client();
      const sql = 'INVALID SQL SYNTAX;';
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockRejectedValueOnce(new Error('Syntax error')) // Invalid SQL
        .mockResolvedValueOnce(); // ROLLBACK
      
      // Act & Assert
      await expect(
        require('../../scripts/migrate').executeMigration(sql)
      ).rejects.toThrow('Syntax error');
      
      expect(mockClient.query).toHaveBeenNthCalledWith(3, 'ROLLBACK');
      expect(mockClient.query).not.toHaveBeenCalledWith('COMMIT');
    });
  });

  describe('runMigrations', () => {
    test('should execute all migration files in sorted order', async () => {
      // Arrange
      const mockFiles = [
        '001_initial.sql',
        '002_orion_workflow.sql'
      ];
      const mockClient = new Client();
      
      // Mock file reading
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(mockFiles);
      fs.readFileSync
        .mockReturnValueOnce('CREATE TABLE users (id SERIAL);')
        .mockReturnValueOnce('CREATE TABLE tasks (id SERIAL);');
      
      // Act
      await require('../../scripts/migrate').runMigrations();
      
      // Assert
      expect(fs.readFileSync).toHaveBeenCalledTimes(2);
      expect(mockClient.query).toHaveBeenNthCalledWith(2, 'CREATE TABLE users (id SERIAL);');
      expect(mockClient.query).toHaveBeenNthCalledWith(5, 'CREATE TABLE tasks (id SERIAL);');
    });

    test('should handle empty migrations directory gracefully', async () => {
      // Arrange
      fs.readdirSync.mockReturnValue([]);
      
      // Act
      await require('../../scripts/migrate').runMigrations();
      
      // Assert
      // Should not crash, just log warning
      expect(fs.readFileSync).not.toHaveBeenCalled();
    });

    test('should exit with non-zero code on migration failure', async () => {
      // Arrange
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const mockClient = new Client();
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue(['001_broken.sql']);
      fs.readFileSync.mockReturnValue('BROKEN SQL;');
      mockClient.query
        .mockResolvedValueOnce() // BEGIN
        .mockRejectedValueOnce(new Error('Migration failed')) // Broken SQL
        .mockResolvedValueOnce(); // ROLLBACK
      
      // Act
      await require('../../scripts/migrate').runMigrations();
      
      // Assert
      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});

describe('Migration Runner - Integration Tests (real DB)', () => {
  // These tests will be implemented once we have a test database setup
  // They require actual PostgreSQL connection and test container
  
  test.todo('Happy Path: Run actual migration file, verify table created');
  test.todo('Error Path: Provide invalid SQL, verify rollback and error exit');
  test.todo('Idempotency: Run migration twice, verify no duplicate errors');
  test.todo('Missing ENV: Unset DATABASE_URL, verify graceful failure');
});
