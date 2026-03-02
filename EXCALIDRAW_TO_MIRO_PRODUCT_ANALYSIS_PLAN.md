# Excalidraw-to-Miro Product Analysis Plan

## What I Will Deliver

- A clear statement of the utility's goal, target users, and jobs-to-be-done using evidence from `README.md`, `src/cli.ts`, and `src/converter/converter.ts`.
- A feature inventory of what the app actually does today (not just what docs claim), including conversion phases, supported element mappings, fidelity, and known constraints from `src/parser/excalidraw-parser.ts`, `src/mappers`, and `src/types/miro.ts`.
- A reality check from tests on what behavior is guaranteed today and where risk sits, using `src/__tests__`.
- A competitive landscape summary (direct and adjacent tools) and implications for positioning.
- A prioritized roadmap of new features framed like a PM for collaborative editor ecosystems (Excalidraw, Miro, Obsidian workflows), with rationale and suggested sequencing.

## Analysis Method

- Cross-reference documented features vs implemented logic vs tested behavior.
- Distinguish: **already shipped**, **partially supported**, **missing but high-leverage**.
- Prioritize proposed features by:
  - User value for common workflows (architecture diagrams, workshops, knowledge workflows).
  - Technical feasibility given current architecture (parser -> mapper -> API client pipeline).
  - Strategic differentiation vs existing market options.

## Output Structure

- Product goal and current value proposition.
- Current feature matrix (import fidelity and constraints).
- Existing alternatives in market and where this utility stands.
- New feature opportunities grouped by horizon:
  - Near-term quick wins
  - Mid-term workflow features
  - Longer-term platform bets
- Suggested next 1-2 release themes and success metrics.

## Key Evidence Anchors

- Conversion orchestration and phase ordering: `src/converter/converter.ts`
- Supported element grouping: `src/parser/excalidraw-parser.ts`
- Public API/CLI surface: `src/index.ts`, `src/cli.ts`
- Conversion guarantees and gaps: `src/__tests__/real-file.test.ts` and related mapper tests

## Prioritized Roadmap (Detailed)

### Near-Term Quick Wins (0-2 months)

- **Dry-run mode with import report (`--dry-run`)**
  - Show projected created/skipped/failed elements before writing to Miro.
  - Output machine-readable JSON and human-readable summary.
  - Why: Reduces risk and boosts trust for first-time migrations.

- **Stronger diagnostics and recovery**
  - Add structured skip/error codes and actionable remediation tips.
  - Introduce retry with backoff for transient Miro API failures.
  - Why: Improves reliability without changing core mapping logic.

- **Batch conversion support**
  - Add `--in-glob` and per-file output summaries.
  - Support "continue on error" and final aggregate report.
  - Why: Useful for teams migrating many diagrams at once.

- **Expanded parser and mapper coverage**
  - Add tests for parser file I/O failures, connector edge cases, and image geometry parity.
  - Add stronger contract tests against current Miro payloads.
  - Why: Converts current "works for common case" into more predictable behavior.

- **Config file support**
  - Add `.excal2mirorc` or JSON/YAML config to avoid long CLI flags.
  - Why: Better repeatability for CI and teams.

### Mid-Term Workflow Features (2-6 months)

- **Incremental re-import / sync-lite**
  - Preserve Excalidraw ID to Miro ID mappings and update changed items only.
  - Add `--mode=create|update|upsert`.
  - Why: Biggest workflow unlock for living diagrams.

- **Grouping and hierarchy improvements**
  - Emulate Excalidraw groups using Miro-compatible parent/tag conventions.
  - Improve frame-child relative placement and nested frame behavior.
  - Why: Preserves mental model of large diagrams.

- **Text and style fidelity upgrades**
  - Improve vertical alignment, multiline behavior, and additional style mappings where possible.
  - Add optional "normalize style to team preset" mode.
  - Why: Reduces post-import cleanup effort.

- **Obsidian-aware ingestion**
  - Handle Excalidraw plugin export conventions and vault batch import patterns.
  - Why: Obsidian plus Excalidraw is a common technical documentation workflow.

- **Connector intelligence v2**
  - Better endpoint inference for hard cases and optional "nearest valid fallback" mode.
  - Why: Connectors are core to architecture diagrams and often highest pain point.

### Longer-Term Platform Bets (6-12+ months)

- **Bi-directional synchronization (selective scope)**
  - Start with one-way plus conflict detection, then opt-in two-way for supported primitives.
  - Why: Strong differentiation versus format-only converters.

- **Multi-target converter architecture**
  - Introduce target adapters (Miro first, then Mural/FigJam/Lucid-ready abstraction).
  - Why: Expands TAM and makes project future-proof.

- **Hosted conversion service**
  - Team UI for queues, audit logs, conversion history, and policy-controlled runs.
  - Why: Enterprise teams need governance, observability, and scale.

- **Template and semantic mapping layer**
  - Map diagram intent (service, DB, queue, actor) to curated Miro templates/components.
  - Why: Moves from "import tool" to "collaboration accelerator."

- **Quality scoring and AI-assisted repair**
  - Automatic post-conversion quality score plus suggested fixes for mismatches.
  - Why: Shortens manual rework and builds confidence in automation.

## Release Themes and Success Metrics

### Release Theme 1: Reliable Migration Foundation

- Includes: dry-run, import report, retries, batch mode, diagnostics.
- Success metrics:
  - Import success rate >= 95% on supported elements.
  - 50% reduction in "unknown failure" errors.
  - Median post-import manual cleanup time reduced by 30%.

### Release Theme 2: Living Diagram Workflows

- Includes: incremental re-import, sync-lite modes, better hierarchy and connectors.
- Success metrics:
  - >= 60% of repeat users adopt update/upsert mode.
  - >= 40% fewer recreated items on second import.
  - Connector preservation rate >= 90% on bound arrows.
