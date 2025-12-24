# Protocols Documentation

This folder contains execution protocols for the CM-TEAM system.

## Structure

- **core/**: Core execution protocols (RED, PCC, CAP, etc.)
- **specialized/**: Specialized protocols (Agent Handover, Safety Gates)
- **two-stage/**: Two-stage protocol documentation and analysis

## Protocol Naming Convention

### Core Protocols
| Old Name | New Name | Acronym | Purpose |
|----------|----------|---------|---------|
| Constraint Discovery Protocol | Preflight Constraint Check | PCC | Validate constraints before execution |
| Fractal Analysis Protocol | Recursive Execution Decomposition | RED | Break down features into atomic tasks |
| Constraint-Aware Planning | Constraint-Aware Planning | CAP | Core system name for constraint-aware planning |

### Specialized Protocols
- **Agent Handover Protocol**: Transfer context between agents
- **Operational Safety Rollback Gate**: Safety checks for operations
- **Observability Debuggability Gate**: Monitoring and debugging protocols

## Usage

1. **For Planning**: Reference RED for task decomposition
2. **For Validation**: Use PCC for constraint checking
3. **For Safety**: Apply specialized protocols for risky operations
4. **For Analysis**: Review two-stage protocol for A/B testing patterns

## Notes

- Protocol names follow engineering-aligned terminology (no "AI woo")
- Each protocol includes clear acceptance criteria and test points
- Protocols are designed to be composable and testable
- Updates to protocols should maintain backward compatibility
