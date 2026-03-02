# User Features Roadmap

Product-facing features prioritized by user value. Each feature describes what users experience, why it matters, and what success looks like.

## Current State

The tool converts Excalidraw drawings to editable Miro board objects. Users get:

- Shapes, text, connectors, images, freedraw, and frames converted with style preservation
- Text inside shapes auto-merged into shape content
- Unbound arrows snapped to nearby shapes
- Content auto-centered on the Miro board
- Feature flags to skip element types
- Preview before import with element-by-element breakdown and fidelity indicators
- Shareable summary card (Markdown, plain text, JSON) with board link
- Named presets for architecture, workshop, and product-flow diagrams
- Interactive guided import for first-time users
- Post-import cleanup suggestions with actionable guidance
- Metadata preservation (links and custom data carried into Miro)
- Team style profiles to normalize visual aesthetics across imports
- Smart re-import with update/upsert modes and ID mapping persistence
- Interactive connector repair for skipped connectors
- Obsidian `.excalidraw.md` file support and batch import from directories

---

## Implemented: Near-Term Features

### Import Preview : Done

Before writing anything to Miro, users see exactly what will happen.

- Element-by-element breakdown: what will be created, what will be skipped, and why
- Human-readable summary via `excal2miro preview` CLI command
- Machine-readable JSON output for automation (`--output-format json`)
- Fidelity indicators per element type (e.g., "freedraw will be converted to static SVG image, not editable strokes")
- Web UI preview step with summary cards (Will Create / Degraded / Will Skip) and attention list

**Implementation**: `excal2miro preview -i file.excalidraw --output-format json|text`, `/api/preview` endpoint, web UI step 3.

### Shareable Import Summary Card : Done

After conversion, users get a formatted summary they can paste into Slack, Notion, or Jira.

- Counts: shapes, text, connectors, images, frames created
- Skipped elements with reasons
- Cleanup suggestions with severity and actionable guidance
- Direct link to the Miro board
- Output as Markdown, plain text, or JSON via `--output-format`
- Web UI "Copy Summary" button

**Implementation**: CLI `--output-format markdown|json|text`, web UI `buildSummaryCard()` with clipboard copy.

### Presets for Common Use Cases : Done

Named configuration bundles that tune import behavior for specific diagram types.

- "Architecture Diagram": prioritize connector fidelity, enable smart snapping (`snapThreshold: 80`)
- "Workshop Board": preserve hand-drawn feel, looser layout (`snapThreshold: 30`)
- "Product Flow": skip freedraw, focus on structure (`snapThreshold: 50`)

**Implementation**: CLI `--preset architecture|workshop|product-flow`, `/api/presets` endpoint, web UI preset selector grid.

### Beginner-Friendly Guided Import : Done

Interactive CLI flow for users who don't know all the flags.

- Prompt for file path with existence validation
- Prompt for Miro token (with link to developer portal) if `MIRO_TOKEN` env not set
- Board ID input with URL format hint
- Preset selection from numbered menu
- Preview shown before execution with confirmation prompt

**Implementation**: `excal2miro guided` command using `readline` prompts.

### One-Click Cleanup Suggestions : Done

After import, the tool reports what could be improved with actionable next steps.

- Skipped connectors listed with nearby shapes identified (within 300px radius)
- Orphan text flagged (standalone text not near any shape)
- Rotated frames flagged with degree of lost rotation
- Freedraw fidelity note (static SVG, not editable strokes)
- Severity levels: action (fix needed), warning (review), info (awareness)
- Category tags: connector, text, fidelity, layout

**Implementation**: `CleanupSuggestion` type, `generateCleanupSuggestions()` in converter, web UI cleanup section in result step, CLI formatters include suggestions.

---

## Implemented: Mid-Term Features

### Smart Re-Import for Living Diagrams : Done

Update an existing Miro board from a newer version of the same Excalidraw file without recreating everything.

- Persist Excalidraw-to-Miro ID mappings via `--mapping-file` (JSON file with board ID, timestamp, and ID map)
- Modes: `create` (default), `update` (modify existing only), `upsert` (create new + update existing)
- In update mode: skip elements without existing mapping; skip elements whose Miro item was deleted
- In upsert mode: update existing items, create new ones that don't have a mapping
- Mappings auto-saved after each conversion

**Implementation**: CLI `--import-mode create|update|upsert --mapping-file state.json`, Miro client `updateShape()`, `updateText()`, `itemExists()`, `deleteItem()`.

### Comments and Notes Preservation : Done

Carry over non-visual metadata from Excalidraw into Miro.

- Excalidraw `link` field appended as clickable `<a>` tag in shape/text content
- `customData` key-value pairs appended as formatted text below element content
- Applied to shapes and standalone text elements

**Implementation**: `customData` field added to Excalidraw types, `appendMetadataToContent()` in converter applied during shape and text creation.

### Obsidian Workflow Mode : Done

First-class support for Excalidraw files created via the Obsidian Excalidraw plugin.

- Parse `.excalidraw.md` files (Excalidraw JSON embedded in `` ```json `` code blocks, `%%` delimiters, or inline)
- Batch import from directory with `excal2miro batch`
- Recursive directory scanning for `.excalidraw`, `.excalidraw.json`, and `.excalidraw.md` files
- Per-file progress reporting and aggregate summary
- Confirmation prompt before batch execution

**Implementation**: `parseObsidianExcalidrawMd()` parser, `findExcalidrawFiles()` directory scanner, `excal2miro batch -d ./vault -b BOARD -t TOKEN`.

### Team Style Profiles : Done

Style profiles that normalize aesthetics to match team Miro board standards.

- Define overrides for: font family, font size, text color, fill color, fill opacity, border color, border width, border style, connector color, connector stroke width
- `preserveOriginalStyles` flag to keep source file styles untouched
- 3 built-in profiles: Corporate Clean, Design System, Sketch/Hand-drawn
- Apply via CLI `--style-profile profile.json` or web UI selector
- Overrides applied to shapes, text, and connectors during mapping

**Implementation**: `StyleProfile` type, `applyShapeProfileOverrides()` / `applyTextProfileOverrides()` in style mapper, `/api/style-profiles` endpoint, web UI profile selector.

### Connector Repair : Done

Interactive resolution for skipped or ambiguous connectors.

- `excal2miro repair` command loads original file and mapping from previous import
- Lists skipped connectors with skip reasons
- Shows available shape candidates from the ID mapping (up to 10)
- User selects start and end shapes for each connector interactively
- Creates connector via Miro API with default curved style
- Reports repair success count

**Implementation**: `excal2miro repair -i file.excalidraw -b BOARD -t TOKEN --mapping-file state.json`.

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
