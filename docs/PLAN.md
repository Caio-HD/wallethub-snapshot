# Audit Plan: Desktop UI Consolidation

## User Review Required

> [!IMPORTANT]
> The site was developed with a heavy mobile-first focus, leading to degraded desktop aesthetics. This plan focuses on validating and fixing the entire site's desktop experience while maintaining mobile compliance (Regra §8).
> Please approve this plan so we can begin the Phase 2 Multi-Agent Orchestration.

## Proposed Resolution Strategy

The orchestration will involve the following agents working in parallel to fix the desktop views:

### 1. Frontend Refinement (`frontend-specialist`)
- **Desktop Grid & Layout:** Audit and fix Tailwind CSS classes across `apps/web/src` to ensure that standard desktop layout patterns (e.g., side-by-side grids, proper max-widths, improved whitespace) are applied appropriately above the `md:`, `lg:`, and `xl:` breakpoints.
- **Overlays (§8):** Validate that adjusting desktop layouts doesn't introduce clipping or modal stacking issues, which is strictly prohibited.
- **Aesthetic Consistency:** Ensure UI components scale correctly without looking awkwardly stretched or sparse on wide screens.
- **Do not break the mobile view.** Ensure that the mobile view is still functional and aesthetically pleasing.

### 2. Performance & UX Optimization (`performance-optimizer`)
- **Core Web Vitals:** Verify that layout adjustments (like changing grids or adding responsive behaviors) do not introduce layout shifts (CLS) on desktop viewports.
- **Lighthouse:** Prepare to run Lighthouse audits against the desktop views.

### 3. End-to-End Verification (`test-engineer`)
- **Responsive E2E Tests:** Execute frontend tests and visual checks to ensure functionality is retained and styles behave as expected across viewports.
- **Audit Scripts:** Run `python .agent/skills/frontend-design/scripts/ux_audit.py` if available and verify through `python .agent/scripts/checklist.py .`.

---

## Verification Plan

### Automated Checks
- Run `python .agent/scripts/checklist.py .` (Full suite including UX, Lint, and E2E)
- Run any Playwright E2E tests configured in the workspace to catch responsive regressions.

### Manual Verification
- We will use the agent browser tooling to visually inspect `http://localhost:3030/login` at standard Desktop viewports (e.g., 1440x900) to verify grid structures, card ratios, and navigation legibility.
