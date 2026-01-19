# claude.md — Modern RAT (DeepWiki-first)

## Mission
Build a modern “Security Requirements Automation Tool” that makes OWASP standards easy to consume by:
- asking a small set of questions,
- shortlisting requirements deterministically,
- presenting a clean checklist (role-aware),
- exporting and creating/linking tickets via adapters.

Primary sources (must use):
- SecurityRAT (legacy baseline)
- RatModern (modern attempt + useful patterns)
- OWASP ASVS (requirements source)
- OWASP SPVS (pipeline controls source)

Claude: do not invent requirement IDs, versions, or content. Always preserve traceability.

## Non-negotiables
- Deterministic results: same answers → same output (no “LLM decides requirements”).
- Traceability: every item links back to standard + version + requirement ID.
- Declarative rules: questionnaire + filtering logic must be data-driven, not scattered if/else.
- Pluggable ticketing: vendor logic only via adapters (Rally/Jira/etc).
- UI uses shadcn/ui components by default.

## DeepWiki-first workflow (MANDATORY for new features)
Before proposing any architecture or implementation:
1) Read DeepWiki pages for:
   - SecurityRAT: how it models artifacts/properties and maps to requirements
   - RatModern: current direction, UI patterns, data model decisions
   - ASVS: requirement IDs, levels, structure
   - SPVS: categories/stages and control structure
   https://deepwiki.com/SecurityRAT/SecurityRAT
   https://deepwiki.com/conleth/RatModern
   https://deepwiki.com/OWASP/ASVS
   https://deepwiki.com/OWASP/www-project-spvs
   

2) Write a short “Findings” note in the PR/commit message or in a docs note:
   - what to copy,
   - what to avoid,
   - what is missing,
   - what our repo will do differently.

If you cannot access DeepWiki in the environment, stop and ask for the specific pages/exports.
Do NOT proceed with assumptions.

## Product shape (what we’re building)
### Core flows
- Questionnaire → shortlist → checklist
- Checklist → export (JSON/CSV/Markdown)
- Checklist → ticket creation/linking (adapter)
- Optional: “Why is this required?” explanation per item
- Optional: “What did we exclude and why?” for transparency/debugging

### Minimum question set
Start with questions that affect the biggest requirement deltas:
- app type (web, api, mobile, internal tool)
- auth type (none, session, oauth/oidc, sso)
- data sensitivity (public/internal/confidential/regulated)
- internet exposure (public, private network, mixed)
- hosting model (on-prem, cloud, hybrid)
- pipeline maturity signals (CI, signed artifacts, secret scanning, IaC, etc.)

Keep questions short. Default to “recommended baseline” quickly.

## Data model invariants
Every shortlisted requirement must include:
- standard: ASVS | SPVS
- standard_version
- requirement_id (canonical from standard)
- title, description (from standard or curated safe paraphrase)
- rationale: deterministic explanation derived from answers/rules
- tags: role/platform/category

Never generate new IDs. Never change canonical requirement_id formats.
(ASVS uses chapter.section.requirement format.)  

## Architecture expectations
### Keep logic out of UI
UI collects answers and displays results.
Backend/engine computes:
- derived attributes
- included requirements
- rationale strings
- (optional) exclusions with reasons

### Rules must be declarative
Implement rules as:
- JSON/YAML/TS objects (predicates over derived attributes + requirement metadata)
- compiled/executed by a small rules engine module

Avoid embedding rules in React components.

### Ticketing adapters
Define a single adapter interface:
- authenticate/connect (optional)
- create ticket(s)
- link existing ticket(s)
- update status (optional)

Adapters live in their own module folder.
No vendor specifics in UI pages.

## UI rules (shadcn)
Use shadcn/ui for:
- forms (radio, select, checkbox)
- stepper/wizard
- cards, tabs, badges
- data tables for requirement lists
- dialogs for ticketing/export
Keep the layout minimal and fast.
Prefer progressive disclosure over making everything visible at once.

## Testing rules
- Unit test: rules engine (most important)
- Unit test: mapping/ingestion of ASVS/SPVS data
- Minimal integration test: questionnaire → shortlist count + key IDs
- Snapshot tests only if stable and useful (avoid churn)

## Definition of done
A change is done when:
- deterministic output holds
- traceability fields are present
- rules are declarative + tested
- adapters stay isolated
- UI uses shadcn components and remains simple
- no secrets are logged or committed
