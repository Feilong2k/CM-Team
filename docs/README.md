# Documentation Index

**Last Updated**: 2025-12-23  
**Status**: Active - New Structure Implementation

## Overview

This is the central index for all CM-TEAM documentation. The documentation has been reorganized into a logical, numbered structure for better discoverability and maintenance.

## Quick Navigation

### 00-INBOX/
Document staging and approval workflow
- **Purpose**: Staging area for new documents before review and categorization
- **Workflow**: All new documents are created here first, then moved to appropriate folders after approval
- **Process**: See `00-INBOX/README.md` for detailed workflow instructions

### 01. Agents
- **01-Orion**: System prompts and role definitions for Orion
- **02-Adam**: Architect prompts and role definitions  
- **03-Tara**: Tester prompts and role definitions
- **04-Devon**: Developer prompts and role definitions

### 02. Architecture
- **decisions**: Architecture Decision Records (ADRs)
- **designs**: System design documents
- **specifications**: Technical specifications and models

### 03. Protocols
- **core**: Core execution protocols (Fractal Analysis, Constraint Discovery, etc.)
- **specialized**: Specialized protocols (Agent Handover, Safety Gates)
- **two-stage**: Two-stage protocol documentation and analysis

### 04. Roadmap
- **features**: Feature definitions and requirements
- **implementation**: Implementation requirements and planning
- **analysis**: Roadmap analysis and findings

### 05. Implementation
- **prompts**: Task-specific implementation prompts
- **tasks**: Task specifications and instructions

### 06. Testing
- **tara-tests**: Tara test specifications (CDP files)
- **results**: Test results and failure summaries

### 07. Worklogs
- **2025-12**: Daily work tracking for December 2025
- **templates**: Worklog templates

### 08. Bugs
Bug reports and tracking

### 09. Context
Context transfer files between sessions

### 10. Tools
Tool documentation and guides

### 11. Archive
Historical and deprecated documents

### 12. Templates
Document templates for consistent formatting

## Migration Status

**Current Phase**: File Migration in Progress  
**Source Folders**: `.Docs/` and old `docs/`  
**Target Folder**: New `docs/` structure  
**Last Migration**: 2025-12-23

## How to Use This Structure

1. **Find Documents**: Use the numbered folders for logical navigation
2. **Update README**: Keep this file updated with major changes
3. **Follow Templates**: Use templates from `12-TEMPLATES/` for consistency

## Usage

1. **For Development**: Reference implementation guides and architecture documents
2. **For Testing**: Use testing documentation for test planning and execution
3. **For Operations**: Follow operational guides for deployment and monitoring
4. **For Planning**: Consult roadmap and protocol documents for project planning

## Naming Conventions

- **Protocols**: Use engineering-aligned names (RED, PCC, CAP) instead of abstract terms
- **Files**: Use descriptive names with version suffixes when applicable
- **Folders**: Follow the numbered structure for logical organization

## Document Creation Workflow

1. **Create**: All new documents are created in `00-INBOX/` first
2. **Review**: Documents are reviewed for content, quality, and proper categorization
3. **Approve**: Approved documents are moved to appropriate folders in the main structure
4. **Maintain**: Documents are updated and maintained in their target locations

## Maintenance

- Documentation is a living resource that should be updated as the system evolves
- All changes should maintain backward compatibility where possible
- Use ADRs to document significant architectural changes
- Keep protocol documents updated with latest practices and learnings
- Follow the INBOX workflow for all new document creation


## Recent Changes

- **2025-12-23**: Complete reorganization into new structure
- **2025-12-23**: Created unified documentation proposal
- **2025-12-23**: Updated roadmap based on database analysis

## Notes

- This structure replaces the previous dual `.Docs/` and `docs/` folders
- All new documentation should follow this structure
- Archive old versions in `11-ARCHIVE/` when updating documents

---

*For questions or suggestions about documentation structure, contact the Architect (Adam).*
