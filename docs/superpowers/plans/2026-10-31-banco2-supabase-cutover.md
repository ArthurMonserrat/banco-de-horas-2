# Banco 2 Supabase Persistence Cutover Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Banco 2 use the shared Supabase session and `banco2` schema for corporate persistence, without copying Banco 1 users, roles, or entries. The authorized remote migration has been applied without deleting existing rows; Production promotion remains pending.

**Architecture:** Reuse the shared Supabase Auth/profile identity from Banco 1. Keep Banco 2 operational rows in `banco2.apontamentos`, accessed through the existing server-side Supabase Data API client and protected by RLS. Remove Prisma/localStorage as a corporate data source; retain localStorage only for explicitly non-business UI state.

**Tech Stack:** TypeScript, React/Vite, Vercel Functions, Supabase Data API/PostgreSQL, Vitest, Node test runner, Prisma only where legacy code remains outside the cutover path.

**Spec:** The approved Banco 2 consolidation plan in the current task context.

## Global Constraints

- Do not modify Azure or Vercel variables without a separate explicit authorization.
- The authorized Supabase project was reconciled with the versioned Banco 2 migration; no rows were deleted or updated.
- Do not perform the future data reset in the same change as the runtime cutover.
- Do not copy Banco 1 users, roles, profiles, or time entries into Banco 2.
- Do not expose `service_role` or database credentials to the browser.
- Corporate operations must fail with an explicit error when Supabase persistence is unavailable; never silently fall back to localStorage.
- Preserve the existing shared Supabase profile and authorization contract.

## Review Focus

- A request must never choose another `profile_id`; test that browser-supplied identity fields are ignored.
- A Supabase/Data API failure must not create a local success state; test the error path.
- Missing Supabase configuration must produce a controlled unavailable state.
- Legacy localStorage data must not be read by the corporate persistence path.
- The Banco 2 schema and authentication headers must remain explicit and testable.

## Future controlled data reset

The existing local/browser and remote Banco 2 test data are intentionally preserved for validation. A later, separately approved operation may reset them after:

1. confirming that no real Banco 2 records need preservation;
2. exporting only non-sensitive structural evidence and obtaining a restorable backup;
3. freezing writes and recording row counts/fingerprints;
4. clearing browser business keys (`apontamentos_sma`, versioned time-entry keys, and `@sma_offline_queue`) without removing session, theme, or onboarding state;
5. truncating or deleting remote Banco 2 rows only through a reviewed, versioned operation;
6. rerunning owner, supervisor, director, and anonymous-access checks.

Until that operation is explicitly approved, the cutover must preserve the 54 existing remote rows and must not silently erase browser data.

### Task 1: Document the cutover boundary

**Files:**
- Create: `docs/superpowers/plans/2026-10-31-banco2-supabase-cutover.md`

- [x] **Step 1: Record the baseline commands and scope**

Run: `npm run test:api` and `npm --prefix frontend test -- --run`.
Expected: 23 API tests and 376 frontend tests pass.

### Task 2: Make the corporate service boundary explicit

**Files:**
- Modify: `api/apontamentos.ts`
- Modify: `api/_lib/supabaseDatabase.ts`
- Test: `tests/api-apontamentos-supabase.test.ts`
- Test: `tests/supabase-database.test.ts`

**Interfaces:**
- `createApontamentosHandler(authenticate, getClient)` remains the API boundary.
- `createSupabaseRestClient(baseUrl, anonKey, accessToken, fetchImpl, schema)` remains schema-aware and token-bound.

- [x] **Step 1: Add failing regression coverage** for missing configuration, caller-supplied `userId`, and persistence failure.
- [x] **Step 2: Run the focused tests and verify they fail for the intended behavior.**
- [x] **Step 3: Implement the minimal boundary behavior**: use only the authenticated Supabase profile, return controlled errors, and never invoke local storage or Prisma for corporate entries.
- [x] **Step 4: Run focused tests and then the complete API suite.**
- [x] **Step 5: Commit:** `fix: enforce Banco 2 Supabase persistence boundary`

### Task 3: Route the frontend corporate flow through the persistent API

**Files:**
- Inspect/modify: `frontend/src/services/timeEntryService.ts`
- Inspect/modify: `frontend/src/services/supabaseTimeEntryService.ts`
- Inspect/modify: `frontend/src/features/session/DemoSessionProvider.tsx`
- Inspect/modify: `frontend/src/features/time-entries/useTimeEntryForm.ts`
- Test: existing service and page tests covering create/list/update behavior

- [x] **Step 1: Add failing tests** showing corporate create/list/update calls the API and does not write business records to localStorage.
- [x] **Step 2: Run the focused frontend tests and verify the expected failures.**
- [x] **Step 3: Implement the smallest adapter change** preserving the current UI domain types and explicit error states.
- [x] **Step 4: Add a namespaced, one-time cleanup only for known Banco 2 business keys; preserve theme/onboarding/session storage.**
- [x] **Step 5: Run frontend tests, typecheck, lint, and build.**
- [x] **Step 6: Commit:** `feat: route Banco 2 corporate entries to Supabase`

### Task 4: Validate locally without production access

**Files:**
- Modify/create: `.github/workflows/` only if a disposable validation workflow is already supported by the repository
- Create/modify: synthetic integration fixtures and documentation as needed

- [ ] **Step 1: Run the existing API/frontend suites and inspect the migration contract for `banco2.apontamentos`.**
- [ ] **Step 2: If local Supabase/Docker is available, apply only versioned migrations to a disposable instance and run owner/supervisor/director isolation checks.**
- [x] **Step 3: If unavailable, report the exact environment blocker rather than claiming managed validation.** Local `supabase` CLI is not installed and Docker Desktop is not running.
- [ ] **Step 4: Run `git diff --check`, root typecheck, frontend typecheck, lint, and build.**
- [ ] **Step 5: Commit:** `test: validate Banco 2 Supabase persistence locally` only if files changed.

### Task 5: Final review

- [ ] **Step 1: Verify no production files, secrets, migrations-to-production, or Azure/Vercel configuration changed.**
- [ ] **Step 2: Review the diff and run the complete verification commands fresh.**
- [ ] **Step 3: Report the branch, commits, tests, remaining remote prerequisites, and whether the work is ready for PR publication.**
