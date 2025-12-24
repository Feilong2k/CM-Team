5. The Integration Pattern (Why It Works)
Orion → Aider Communication:
{
  "task": "Implement user authentication",
  "constraints": ["Use JWT", "Follow existing patterns"],
  "context_files": ["models/User.js", "routes/auth.js"],
  "acceptance_criteria": ["Tests pass", "No breaking changes"],
  "rollback_plan": "Revert to commit XYZ"
}
Aider → Orion Response:
{
  "status": "completed",
  "files_changed": ["routes/auth.js", "test/auth.test.js"],
  "tests_passed": true,
  "git_commit": "abc123",
  "next_steps": ["Deploy to staging", "Run integration tests"]
}