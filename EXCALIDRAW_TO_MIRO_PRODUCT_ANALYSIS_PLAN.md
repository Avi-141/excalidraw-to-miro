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

## Prioritized Roadmap (User-Facing)

### Near-Term User Wins (0-2 months)

- **Import Preview Experience**
  - Before import, show a visual preview of what will be created in Miro (what looks perfect, what may degrade, what will be skipped).
  - Why users care: no surprises, higher confidence on first run.

- **One-Click Cleanup Suggestions**
  - After import, present "fix now" actions such as reconnect skipped arrows, merge orphan text, and normalize sizes.
  - Why users care: saves immediate manual cleanup time.

- **Presets for Common Use Cases**
  - Provide presets like "Architecture Diagram," "Workshop Board," and "Product Flow" that tune import behavior.
  - Why users care: easier onboarding than many technical flags.

- **Shareable Import Summary Card**
  - Generate a human-friendly summary users can paste in Slack/Notion/Jira: imported counts, skipped counts, and board link.
  - Why users care: improves team communication and handoff.

- **Beginner-Friendly Guided Import**
  - Step-by-step flow with tooltips and examples for token, board selection, and options.
  - Why users care: reduces setup friction for non-developers.

### Mid-Term Workflow Features (2-6 months)

- **Smart Re-Import for Living Diagrams**
  - Users can update an existing Miro board from newer Excalidraw versions without rebuilding everything.
  - Why users care: supports iterative workflows and recurring design reviews.

- **Comments and Notes Preservation**
  - Convert Excalidraw links/notes into Miro-friendly annotations (comments, metadata cards, or linked notes).
  - Why users care: keeps discussion context and decision history.

- **Obsidian Workflow Mode**
  - Better support for Excalidraw files coming from Obsidian vaults, including bulk import by folder/tag.
  - Why users care: bridges personal knowledge workflows to collaborative boards.

- **Team Style Profiles**
  - Let teams define import style profiles (fonts, colors, connector styles) to match their Miro standards.
  - Why users care: consistent board aesthetics across contributors.

- **Connector Repair UI**
  - Interactive UI to resolve skipped or ambiguous connectors by selecting target shapes visually.
  - Why users care: eliminates one of the biggest post-import pain points.

### Longer-Term Product Bets (6-12+ months)

- **Bi-Directional Workspace Sync**
  - Keep supported objects synchronized between Excalidraw and Miro for hybrid teams.
  - Why users care: they can work in their preferred tool without divergence.

- **Cross-Tool Diagram Hub**
  - Expand beyond Miro with user-facing imports/exports for Mural, FigJam, and Lucid while preserving collaboration metadata.
  - Why users care: less vendor lock-in and easier org-wide adoption.

- **Version Timeline and Compare**
  - Show visual diffs between import versions and allow easy rollback.
  - Why users care: safer experimentation and better change tracking.

- **Template-to-Template Conversion**
  - Map Excalidraw structures directly to Miro workshop templates (journey map, event storming, architecture review boards).
  - Why users care: faster start for facilitation and planning sessions.

- **AI Assistant for Diagram Refinement**
  - Suggest board cleanup, grouping, naming, and readability improvements after import.
  - Why users care: improves clarity and collaboration quality at scale.

## Release Themes and User-Centric Success Metrics

### Release Theme 1: Trust and First-Run Delight

- Includes: import preview, guided setup, one-click cleanup, summary card.
- Success metrics:
  - First-time successful import rate >= 90%.
  - Time-to-first-usable-board reduced by 40%.
  - User satisfaction (post-import prompt) >= 4.2/5.

### Release Theme 2: Repeat Collaboration Workflows

- Includes: smart re-import, style profiles, connector repair UI, Obsidian mode.
- Success metrics:
  - Repeat import usage (same board) >= 50% of active users.
  - Manual post-import edits reduced by 35%.
  - Connector resolution success >= 95% after assisted repair flow.
