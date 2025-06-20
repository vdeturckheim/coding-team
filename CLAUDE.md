# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Coding Team is an opinionated tool built on top of Claude Code that orchestrates a team of AI developers to work collaboratively on software projects. It creates specialized AI agents (team members) each with specific roles like PR reviewing, CI monitoring, and development.

## Architecture

The system uses:
- **Electron** for the desktop application
- **TypeScript** as the primary language
- **Claude Code SDK** for managing Claude instances
- **Git worktrees** for isolated development environments (each Claude instance works in its own worktree)
- **Biome** for linting/formatting (configured for semicolons and single quotes)
- **Playwright** for E2E testing

## Critical Architecture Notes

- **Each Claude Code instance MUST operate in its own git worktree**
- **Personas can create additional worktrees per task for isolation**
- **Developer personas cannot create/switch branches - restricted to assigned worktree**
- **Worktree management and cleanup is handled by the main orchestrator**

## Team Member Personas

Team member personas are Claude Code instances with specialized system prompts for specific roles:

- **Developer Pool**: Works on GitHub issues in isolated git worktrees (cannot create/switch branches)
- **Manager Persona**: Spawns developer agents, assigns issues, prevents conflicts via GitHub comments
- **PR Reviewer**: Reviews pull requests when triggered by events
- **Landing Manager**: Merges approved PRs after CI passes
- **CI Health Monitor & Code Quality Manager**: Monitors CI status, responds to failures, tracks code health and technical debt
- **Spec Refiner**: Ensures GitHub issues are clear and actionable
- **Backlog Manager**: Prioritizes and assigns work based on dependencies
- **QA Engineer**: Tests features and reports bugs

Each persona has a dedicated backlog/queue system for specialized tasks, except developers who work directly on assigned issues.

## Development Workflow

1. Check GitHub issues for tasks to work on
2. The issues are numbered and have dependencies listed
3. Start with high priority (P0) issues first
4. Each issue describes what needs to be implemented

## Commands

```bash
# Install dependencies
npm install

# Run the application
npm start

# Run tests
npm test

# Lint and format code
npm run lint
npm run format

# Build the application
npm run build
```

## Getting Started

The project uses GitHub issues as the source of truth for development tasks. Check the issues at https://github.com/vdeturckheim/coding-team/issues to see what needs to be implemented. Issues are prioritized (P0 = Critical, P1 = High, P2 = Medium, P3 = Low) and have dependencies noted.

## Memory

- include screenshots in PRs when you change visual stuff