# Coding Team

An opinionated tool built on top of Claude Code that orchestrates a team of AI developers to work on software projects collaboratively.

## Overview

Coding Team creates a virtual development team where each Claude Code instance has a specific role and responsibility. The system manages work distribution, code reviews, quality assurance, and continuous integration through specialized AI agents.

## Architecture

### Team Members

#### Core Development Team
- **Developers Pool**: Multiple Claude Code instances that work on GitHub issues
  - Each developer gets assigned a ticket
  - Creates a git worktree for isolation
  - Implements features/fixes based on specifications

#### Specialized Roles
- **PR Reviewer**: Reviews pull requests for code quality, best practices, and potential issues
  - Triggered when PRs are ready for review
  - Provides feedback and approval/rejection decisions

- **Landing Manager**: Handles merging approved PRs
  - Ensures CI passes before landing
  - Manages merge conflicts if needed

- **CI Health Monitor**: Monitors continuous integration status
  - Responds to CI failures
  - Creates issues for recurring problems

- **Code Quality Manager**: Oversees overall code health
  - Tracks technical debt
  - Suggests refactoring opportunities
  - Monitors code metrics

- **Spec Refiner**: Ensures GitHub issues are clear and actionable
  - Reviews new issues for clarity
  - Adds missing details and acceptance criteria
  - Breaks down large issues into smaller tasks

- **Backlog Manager**: Continuously monitors GitHub issues
  - Computes priority based on dependencies and impact
  - Assigns work to available developers
  - Balances workload across the team

- **QA Engineer**: Tests implemented features
  - Creates test plans
  - Reports bugs
  - Verifies fixes

## Technical Stack

- **Electron**: Desktop application framework
- **TypeScript**: Primary language
- **Claude Code SDK**: For managing Claude instances
- **Playwright**: E2E testing
- **Biome**: Code formatting and linting
- **Git Worktrees**: Isolated development environments

## LLM Integration

The system supports multiple LLM providers:
- Claude API (via Anthropic API key)
- OpenAI models (via OpenAI API key)
- Local models via Ollama
- Bundled models with Transformers.js

## Workflow

1. Issues are created in GitHub
2. Spec Refiner ensures issues are clear
3. Backlog Manager prioritizes and assigns work
4. Developers work in isolated worktrees
5. PR Reviewer checks submitted code
6. Landing Manager merges approved changes
7. CI Health Monitor ensures build stability
8. QA Engineer validates functionality

## Getting Started

1. Clone the repository
2. Install dependencies: `npm install`
3. Configure Claude Code binary path in settings
4. Set up LLM provider credentials
5. Run the application: `npm start`

## Development

See the [GitHub Issues](https://github.com/vdeturckheim/coding-team/issues) for the development roadmap and setup instructions.