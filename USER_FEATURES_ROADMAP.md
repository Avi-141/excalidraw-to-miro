# User Features Roadmap

Product-facing features prioritized by user value. Each feature describes what users experience, why it matters, and what success looks like.

## Current State

The tool converts Excalidraw drawings to editable Miro board objects. Users get:

- Shapes, text, connectors, images, freedraw, and frames converted with style preservation
- Text inside shapes auto-merged into shape content
- Unbound arrows snapped to nearby shapes
- Content auto-centered on the Miro board
- Feature flags to skip element types

What users don't get: any preview before import, any post-import repair, any way to re-import without duplicating, or any guidance during setup.

---

## Near-Term: Trust and First-Run Delight (0-2 months)

### Import Preview

Before writing anything to Miro, show users exactly what will happen.

- Element-by-element breakdown: what will be created, what will be skipped, and why
- Human-readable summary printed to terminal
- Machine-readable JSON output for automation (`--output-format json`)
- Fidelity indicators per element type (e.g., "freedraw will be converted to static SVG image, not editable strokes")

**Why users care**: The tool writes irreversibly to a Miro board. Users need to see what they're getting before committing. This is the single biggest trust-builder for first-time users.

**Success metric**: First-time successful import rate >= 90%.

### Shareable Import Summary Card

After conversion, generate a formatted summary users can paste into Slack, Notion, or Jira.

- Counts: shapes, text, connectors, images, frames created
- Skipped elements with reasons
- Direct link to the Miro board
- Output as Markdown, plain text, or JSON

**Why users care**: Teams need to communicate that a migration happened and what the result was. Today users get terminal output they can't easily share.

**Success metric**: Summary card copied/shared in >= 30% of conversions.

### Presets for Common Use Cases

Named configuration bundles that tune import behavior for specific diagram types.

- "Architecture Diagram": prioritize connector fidelity, enable smart snapping, strict style mapping
- "Workshop Board": looser layout, skip freedraw simplification, preserve hand-drawn feel
- "Product Flow": merge text aggressively, normalize sizes, auto-frame detection

**Why users care**: The current CLI has 10+ flags. Most users want to say "I'm importing an architecture diagram" rather than figure out `--snap-threshold 80 --no-freedraw`.

**Success metric**: >= 40% of imports use a preset instead of manual flags.

### Beginner-Friendly Guided Import

Interactive CLI flow for users who don't know all the flags.

- Prompt for Miro token (with link to developer portal) if not provided
- Board selection from available boards (via API) instead of requiring the ID
- Preset selection from menu
- Confirmation before executing

**Why users care**: The current CLI requires three pieces of information (file path, board ID, token) that non-developers may struggle to assemble. A guided flow reduces setup friction.

**Success metric**: Time-to-first-usable-board reduced by 40%.

### One-Click Cleanup Suggestions

After import, report what could be improved and offer actionable next steps.

- List skipped connectors with why they were skipped and which shapes they were near
- Identify orphan text (text that wasn't merged into any shape)
- Flag elements with degraded fidelity (e.g., rotated frames imported without rotation)
- Suggest Miro board link to the area where skipped elements should have been

**Why users care**: Today the tool reports skipped elements as a count. Users need to know what to do about them.

**Success metric**: Median post-import manual cleanup time reduced by 30%.

---

## Mid-Term: Repeat Collaboration Workflows (2-6 months)

### Smart Re-Import for Living Diagrams

Update an existing Miro board from a newer version of the same Excalidraw file without recreating everything.

- Persist Excalidraw-to-Miro ID mappings between runs
- Modes: `create` (default, current behavior), `update` (modify existing items), `upsert` (create new, update existing)
- Detect deleted elements and optionally remove from Miro
- Show diff summary before applying changes

**Why users care**: This is the biggest workflow unlock. Today, re-importing duplicates everything. Teams with iterative design reviews need to update, not rebuild.

**Success metric**: >= 60% of repeat users adopt update/upsert mode. >= 40% fewer recreated items on second import.

### Comments and Notes Preservation

Carry over non-visual metadata from Excalidraw into Miro.

- Excalidraw link references become Miro item links or comments
- Element-level notes or descriptions become Miro card annotations
- Preserve any custom metadata in `customData` fields

**Why users care**: Architecture diagrams often carry decision context, links to docs, or notes. Losing them on import forces manual re-entry.

**Success metric**: >= 80% of link/note metadata preserved on supported elements.

### Obsidian Workflow Mode

First-class support for Excalidraw files created via the Obsidian Excalidraw plugin.

- Parse `.excalidraw.md` files (Excalidraw JSON embedded in Markdown front-matter)
- Batch import from vault folder or by tag
- Preserve Obsidian wiki-link references as Miro comments or links

**Why users care**: Obsidian + Excalidraw is one of the most common technical documentation workflows. These users have dozens of diagrams in a vault and need bulk migration.

**Success metric**: Successful import of Obsidian-format files with zero manual pre-processing.

### Team Style Profiles

Import style profiles that normalize aesthetics to match team Miro board standards.

- Define font, color palette, stroke width, and connector style overrides
- Apply per-import or as a persistent team default
- Option to preserve original Excalidraw styles or normalize to profile

**Why users care**: When multiple team members import different Excalidraw files into the same board, visual consistency matters. Today every import uses the source file's styles.

**Success metric**: Manual post-import edits reduced by 35%.

### Connector Repair

Interactive resolution for skipped or ambiguous connectors.

- After import, list connectors that couldn't be resolved
- For each, show the source/target candidates and let users select the correct binding
- Apply fixes via Miro API update calls

**Why users care**: Connectors are the most fragile part of the import. Architecture diagrams are useless without them. This is the highest-pain post-import problem.

**Success metric**: Connector resolution success >= 95% after repair flow.

---

## Longer-Term: Product Bets (6-12+ months)

### Bi-Directional Workspace Sync

Keep supported objects synchronized between Excalidraw and Miro for hybrid teams.

- Start with one-way plus conflict detection (flag divergence, don't auto-resolve)
- Progress to opt-in two-way sync for shapes, text, and connectors
- Selective scope: sync specific frames or element groups, not entire boards

**Why users care**: Some team members prefer Excalidraw for drafting, others work in Miro for collaboration. Divergence between tools is the core pain point for hybrid teams.

### Cross-Tool Diagram Hub

Expand beyond Miro to support Mural, FigJam, and Lucid as import/export targets.

- Shared intermediate representation across targets
- User-facing target selection in presets and guided flow
- Preserve collaboration metadata (comments, links) across targets where possible

**Why users care**: Reduces vendor lock-in and makes the tool useful for any org, regardless of which whiteboard platform they use.

### Version Timeline and Compare

Track import history and enable visual comparison between versions.

- Store conversion results with timestamps and source file hashes
- Show element-level diffs between import versions (added, changed, removed)
- Allow rollback to a previous import state

**Why users care**: Safer experimentation and better change tracking for iterative diagrams.

### Template-to-Template Conversion

Map Excalidraw diagram intent to curated Miro workshop templates.

- Detect diagram patterns (service architecture, event storming, user journey)
- Map to Miro template structures (frames, sticky notes, swimlanes)
- User selects target template, tool maps elements accordingly

**Why users care**: Moves the tool from "import" to "collaboration accelerator." Faster start for facilitation and planning sessions.

### AI-Assisted Diagram Refinement

Post-import quality scoring and automated improvement suggestions.

- Score conversion quality per element (position accuracy, style fidelity, connector binding)
- Suggest fixes: realign shapes, fix connector routing, improve text readability
- Apply suggestions with user approval

**Why users care**: Reduces manual rework and builds confidence in automation at scale.
