# Issue Analysis and Dependencies

## Duplicate Issues Found

### 1. Persona Creation Issues (Multiple duplicates)
The following issues are essentially duplicates with different personas:
- #11, #29: PR Reviewer persona (same functionality)
- #12, #30: Landing Manager persona (same functionality)
- #13, #14, #32: CI Health Monitor + Code Quality Manager (combined in #32)
- #15, #34: Spec Refiner persona (same functionality)
- #16, #35: Backlog Manager persona (same functionality)
- #17, #36: QA Engineer persona (same functionality)

**Recommendation**: Close the older duplicates (11-17) and keep the newer ones (29-36) which have better descriptions.

### 2. Core System Components (Should be done together)
These issues form the foundation and should be implemented as a cohesive unit:
- #20: Claude TypeScript SDK integration
- #37: Claude Code instance management system
- #38: Persona hosting and execution environment
- #23: Persona system design
- #39: Work queue and task distribution

### 3. Git and Development Workflow (Related)
- #27: Git worktree management
- #25: GitHub issue assignment system
- #24: Specialized team member backlog system

### 4. UI Components (Related)
- #18: Electron app setup (completed)
- #22: shadcn/ui components
- #21: Settings view
- #42: Terminal mode (enhancement)

## Dependency Graph

### Critical Path (P0/P1 - Must be done first)
1. **#20** Claude TypeScript SDK ← Foundation for everything
2. **#37** Claude instance management ← Depends on #20
3. **#23** Persona system design ← Depends on #20
4. **#38** Persona hosting ← Depends on #37, #23
5. **#39** Work queue system ← Depends on #38

### Secondary Path (P1/P2 - Core features)
6. **#22** UI components ← Depends on #18 (completed)
7. **#21** Settings view ← Depends on #18, #22
8. **#25** Issue assignment ← Depends on #39, #38
9. **#27** Worktree management ← Depends on #25, #37
10. **#24** Backlog system ← Depends on #39
11. **#28** Trigger system ← Depends on #23, #24
12. **#31** Main orchestrator ← Depends on #38, #39, #25

### Persona Implementation (P2/P3 - Can be done in parallel after core)
All persona issues depend on:
- #23 (Persona system)
- #38 (Persona hosting)
- #28 (Trigger system) for event-driven personas

Individual personas:
- **#29** PR Reviewer ← Also depends on #28
- **#30** Landing Manager ← Depends on #29
- **#32** CI Health + Code Quality ← Depends on #19 (CI setup)
- **#34** Spec Refiner
- **#35** Backlog Manager ← Also depends on #24, #25
- **#36** QA Engineer

### Optional Features (P2/P3)
- **#26** LLM provider config ← Depends on #21
- **#42** Terminal mode ← Depends on core system

## Recommended Implementation Order

### Phase 1: Foundation (Critical)
1. #20 → #37 → #23 (in parallel with #22)
2. #38 + #39 (can be done in parallel)

### Phase 2: Core Systems
3. #21, #25, #27 (in parallel)
4. #24, #28
5. #31

### Phase 3: Personas (can be parallelized)
6. All persona issues (#29-#36)

### Phase 4: Enhancements
7. #26, #42

## Issues to Update

1. Close duplicates: #11-17
2. Update #37 to clarify it must be done immediately after #20
3. Update #38 to clarify it needs both #37 and #23
4. Update all persona issues to depend on #38 (not just #23)
5. Update #31 to list all its dependencies clearly
6. Update #27 to clarify integration with #37