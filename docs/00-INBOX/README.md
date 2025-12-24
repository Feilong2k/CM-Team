# INBOX - Document Approval Workflow

This folder serves as a staging area for new documentation before it is reviewed, approved, and moved to its permanent location in the documentation structure.

## Purpose

The INBOX provides a controlled workflow for documentation creation and review:

1. **Staging**: All new documents are created here first
2. **Review**: Documents are reviewed for content, quality, and proper categorization
3. **Approval**: Approved documents are moved to appropriate folders in the main structure
4. **Rejection**: Documents needing revision remain here until fixed

## Workflow

### For Document Creators:
1. Create new documents in `00-INBOX/`
2. Follow naming conventions: `YYYY-MM-DD_Descriptive_Name.md`
3. Include metadata at the top of each document:
   - Author
   - Creation Date
   - Purpose/Summary
   - Target Category (e.g., "03-PROTOCOLS/core", "04-ROADMAP/analysis")
4. Notify reviewers when ready for review

### For Reviewers:
1. Review documents in `00-INBOX/` regularly
2. Check for:
   - Content quality and accuracy
   - Proper formatting and structure
   - Appropriate categorization
   - Compliance with documentation standards
3. Move approved documents to target folders
4. Provide feedback for documents needing revision

### For Maintainers:
1. Monitor `00-INBOX/` for stale documents (>7 days)
2. Follow up on review status
3. Archive or clean up rejected/abandoned documents
4. Ensure workflow is followed consistently

## Naming Conventions

- Use descriptive names: `2025-12-23_New_Protocol_Proposal.md`
- Include date prefix for sorting and tracking
- Use underscores instead of spaces
- Include file extension (.md, .json, .yml, etc.)

## Categories and Target Folders

When moving documents from INBOX, use this mapping:

| Document Type | Target Folder |
|---------------|---------------|
| Agent prompts, system prompts | `01-AGENTS/[agent]/prompts/` |
| Architecture designs, ADRs | `02-ARCHITECTURE/designs/` or `decisions/` |
| Protocol definitions, RED/PCC/CAP | `03-PROTOCOLS/core/` or `specialized/` |
| Roadmap planning, feature definitions | `04-ROADMAP/implementation/` or `analysis/` |
| Test plans, test results | `05-TESTING/plans/` or `results/` |
| Implementation guides, examples | `06-IMPLEMENTATION/` (if created) |
| Operational procedures | `07-OPERATIONS/` (if created) |

## Notes

- The INBOX is not for long-term storage - documents should be processed within 7 days
- Use git commits to track movement of documents from INBOX to target folders
- Maintain a log of document movements for audit purposes
- This workflow ensures documentation quality and proper organization
