# CLI & Engineering Roadmap

Infrastructure, reliability, and developer experience features. These are the building blocks that make user-facing features possible and keep the tool dependable at scale.

## Current State

The CLI (`excal2miro`) supports subcommands (`convert`, `preview`, `guided`, `batch`, `repair`) and a backward-compatible default mode with flags. Key characteristics:

- **Dry-run / Preview**: `excal2miro preview` parses and maps without calling the Miro API : Done
- **Output formatters**: `--output-format text|markdown|json` for all commands : Done
- **Batch mode**: `excal2miro batch` imports entire directories including Obsidian vaults : Done
- **Interactive prompts**: `excal2miro guided` walks users through setup : Done
- **Presets**: `--preset architecture|workshop|product-flow` : Done
- **Style profiles**: `--style-profile profile.json` with built-in and custom profiles : Done
- **Import modes**: `--import-mode create|update|upsert` with `--mapping-file` persistence : Done
- **Miro update API**: `updateShape`, `updateText`, `deleteItem`, `itemExists` : Done
- **Obsidian parser**: `.excalidraw.md` support with JSON extraction : Done
- **Connector repair**: `excal2miro repair` interactive post-import resolution : Done
- **Cleanup suggestions**: Generated per-conversion with categories and severities : Done
- **Metadata preservation**: Links and customData carried through conversion : Done

Remaining gaps:

- **No retry logic**: A single API failure permanently fails that element
- **No config file**: All options via CLI flags, env vars, or presets
- **Hardcoded rate limit**: Fixed 100ms delay between API calls
- **No CLI argument tests**: `cli.ts` is excluded from test coverage
- **No direct MiroClient tests**: Always mocked in test suite
- **No ESLint config**: `npm run lint` script exists but no `.eslintrc`
- **No structured error codes**: Skip reasons are still free-text strings

---

## Implemented: Near-Term Features

### Dry-Run Mode : Done

Run the full parse-and-map pipeline without calling the Miro API.

- `excal2miro preview -i file.excalidraw` runs parse, group, and map phases
- Returns `PreviewResult` with per-element status (will_create, will_skip, degraded), fidelity notes, and breakdown
- `--output-format json` for machine consumption, `text` for human reading
- Available via CLI, `/api/preview` endpoint, and web UI

**Enabled user features**: Import Preview, trust-building for first-time users.

### Batch Conversion : Done

Process multiple `.excalidraw` files in one invocation.

- `excal2miro batch -d ./diagrams -b BOARD -t TOKEN`
- Recursive directory scanning for `.excalidraw`, `.excalidraw.json`, `.excalidraw.md` files
- `--no-recursive` flag to limit to top-level directory
- Per-file progress reporting with success/failure counts
- Confirmation prompt before execution
- Supports `--preset` and `--style-profile` for all files in the batch

**Enabled user features**: Obsidian Workflow Mode, team migrations.

### Interactive CLI Prompts : Done

Interactive mode via `excal2miro guided` when users don't know the flags.

- File path prompt with existence validation
- Token prompt with developer portal link (skipped if `MIRO_TOKEN` env var set)
- Board ID prompt with URL format guidance
- Preset selection from numbered menu (1-4)
- Preview displayed with confirmation before execution
- Uses Node.js `readline` (no external dependencies)

**Enabled user feature**: Beginner-Friendly Guided Import.

### Output Formatters : Done

Structured output for conversion results in multiple formats.

- `--output-format text` (default): human-readable with aligned columns
- `--output-format markdown`: table format with board link, suitable for Slack/Notion/Jira
- `--output-format json`: machine-parseable with counts, skipped elements, errors, and cleanup suggestions
- Applied to both conversion results and preview output
- Web UI "Copy Summary" generates Markdown format

**Enabled user features**: Shareable Import Summary Card, CI/automation integration.

### ID Map Persistence : Done

Save and load Excalidraw-to-Miro ID mappings between runs.

- `--mapping-file state.json` persists `idMap` as JSON with board ID and timestamp
- Loaded at start of conversion; merged with new mappings; saved at end
- Supports `--import-mode update` (modify existing only) and `upsert` (create + update)
- In update mode: elements without existing mappings are skipped
- In upsert mode: existing items updated via Miro PATCH API, new items created normally

**Enabled user feature**: Smart Re-Import for Living Diagrams.

### Miro Update API Methods : Done

Added PATCH and DELETE methods to `MiroClient`.

- `updateShape(boardId, itemId, request)` — PATCH `/boards/{id}/shapes/{id}`
- `updateText(boardId, itemId, request)` — PATCH `/boards/{id}/texts/{id}`
- `deleteItem(boardId, itemId)` — DELETE `/boards/{id}/items/{id}`
- `itemExists(boardId, itemId)` — GET with boolean return (catches 404)

**Enabled user features**: Smart Re-Import, Connector Repair.

### Obsidian Format Parser : Done

Parse `.excalidraw.md` files from the Obsidian Excalidraw plugin.

- Extracts Excalidraw JSON from `` ```json `` code blocks
- Fallback to `%%` delimited sections
- Fallback to inline `{"type":"excalidraw"...}` JSON
- `findExcalidrawFiles(dir, recursive)` scans directories for all supported extensions
- Integrated into `parseExcalidrawFile()` — auto-detects format by extension

**Enabled user feature**: Obsidian Workflow Mode.

### Style Profile System : Done

Apply style overrides to normalize visual aesthetics.

- `StyleProfile` type with overrides: fontFamily, fontSize, textColor, fillColor, fillOpacity, borderColor, borderWidth, borderStyle, connectorColor, connectorStrokeWidth
- `preserveOriginalStyles` flag bypasses overrides
- CLI: `--style-profile profile.json` loads custom profile
- Server: 3 built-in profiles (Corporate Clean, Design System, Sketch) via `/api/style-profiles`
- Applied at the mapper level: `buildShapeStyle()`, `buildTextStyle()`, connector mapper

**Enabled user feature**: Team Style Profiles.

### Cleanup Suggestion Engine : Done

Post-conversion analysis that generates actionable suggestions.

- `CleanupSuggestion` type with `category`, `severity`, `message`, `suggestion`, optional element reference
- Categories: connector, text, fidelity, layout
- Severities: info, warning, action
- Detects: skipped connectors with nearby shapes, orphan text, rotated frames, freedraw fidelity loss
- Integrated into `ConversionResult.cleanupSuggestions`

**Enabled user feature**: One-Click Cleanup Suggestions.

---

## Remaining: Near-Term Priorities

### Retry with Exponential Backoff

Add retry logic to `MiroClient` for transient API failures.

- Retry on HTTP 429, 500, 502, 503, 504
- Respect `Retry-After` header when present
- Exponential backoff: 1s, 2s, 4s with jitter, max 3 retries
- Log each retry attempt when verbose
- Configurable via `MiroClientOptions`: `maxRetries`, `initialRetryDelayMs`

**Enables**: Reliable imports for large diagrams (50+ elements).

### Structured Error Codes

Replace free-text skip/error reasons with machine-parseable codes and human-readable descriptions.

| Code | Description | Remediation |
|---|---|---|
| `CONNECTOR_SELF_REF` | Arrow start and end resolve to same shape | Rebind one endpoint in Excalidraw |
| `CONNECTOR_NO_TARGET` | Arrow endpoint doesn't match any shape | Move endpoint closer to a shape or increase `--snap-threshold` |
| `CONNECTOR_INVALID` | Connector configuration invalid after mapping | Check arrow bindings in source file |
| `IMAGE_NOT_FOUND` | Image file data missing from `.excalidraw` | Re-save image in Excalidraw to embed data |
| `IMAGE_NOT_SAVED` | Image status is not "saved" | Save the image element in Excalidraw |
| `IMAGE_TOO_LARGE` | Image exceeds 6 MB Miro upload limit | Resize or compress the image |
| `IMAGE_NO_FILES` | No embedded files section in `.excalidraw` | File may be exported without embedded data |
| `FREEDRAW_TOO_SHORT` | Freedraw has fewer than 2 points | Remove or redraw the element |
| `FREEDRAW_DISABLED` | Freedraw conversion turned off | Use `--freedraw` to enable |
| `IMAGE_DISABLED` | Image conversion turned off | Use `--images` to enable |
| `FRAME_DISABLED` | Frame conversion turned off | Use `--frames` to enable |
| `TYPE_UNSUPPORTED` | Element type not supported by converter | No action available |

### Config File Support (`.excal2mirorc`)

Load options from a config file to avoid long CLI commands.

- Search order: `--config <path>`, `.excal2mirorc.json` in current directory, `~/.excal2mirorc.json`
- JSON format matching `ConversionOptions` structure plus `boardId` and preset name
- CLI flags override config file values
- `excal2miro --init` to generate a starter config

### Expanded Test Coverage

Close the gaps in the current test suite.

- **CLI tests**: Test argument parsing, flag combinations, env var fallback, error messages
- **MiroClient integration tests**: Test retry logic, rate limiting, error interceptor with realistic HTTP responses
- **Connector edge cases**: Test with lines (not just arrows), multi-segment connectors, connectors between frames
- **ESLint setup**: Add eslint config, fix any issues, integrate into CI
- **Parser failure modes**: Invalid JSON, missing required fields, corrupted `.excalidraw.md` files
- **Style profile tests**: Verify override application, preserveOriginalStyles behavior
- **Import mode tests**: Test update/upsert with mock Miro API responses

---

## Longer-Term: Platform Infrastructure (6-12+ months)

### Multi-Target Adapter Architecture

Abstract the Miro-specific layer so the same parser and mapper pipeline can output to different targets.

- Define `Target` interface with `createShape`, `createText`, `createConnector`, etc.
- `MiroTarget` wraps current `MiroClient`
- Future targets: `MuralTarget`, `FigJamTarget`, `LucidTarget`
- Introduce intermediate representation between mappers and targets

**Enables user feature**: Cross-Tool Diagram Hub.

### Conversion State Store

Replace flat JSON state files with a structured store for version history.

- Store conversion results, source file hashes, timestamps, and diffs
- Support querying history (list imports, compare versions, rollback)
- Local SQLite or structured JSON directory

**Enables user features**: Version Timeline and Compare, rollback.

### Adaptive Rate Limiting

Replace the hardcoded 100ms delay with dynamic rate limiting.

- Track API response times and rate-limit headers
- Adjust delay between calls based on current throughput
- Parallel requests where Miro API allows (e.g., independent shapes)
- Configurable concurrency limit

**Enables**: Faster imports for large diagrams (100+ elements).

### Webhook and CI Integration

Make the tool usable in automated pipelines.

- Exit codes: 0 for success, 1 for partial failure, 2 for complete failure
- JSON output mode for machine consumption (done : Done)
- Webhook notification on completion (configurable URL)
- GitHub Action wrapper

**Enables**: Team CI workflows, automated diagram sync on commit.

---

## Dependency Map

Which engineering features are prerequisites for which user features:

| User Feature | Required Engineering | Status |
|---|---|---|
| Import Preview | Dry-run mode, Structured error codes | : Done Done (error codes still free-text) |
| Shareable Summary Card | Output formatters | : Done Done |
| Presets | Preset configs in server + CLI | : Done Done |
| Guided Import | Interactive CLI prompts | : Done Done |
| Cleanup Suggestions | Cleanup suggestion engine | : Done Done |
| Smart Re-Import | ID map persistence, Miro update API | : Done Done |
| Obsidian Mode | Obsidian format parser, Batch conversion | : Done Done |
| Style Profiles | Style profile system | : Done Done |
| Connector Repair | Miro update API, Interactive CLI prompts | : Done Done |
| Cross-Tool Hub | Multi-target adapter architecture | Not started |
| Version Timeline | Conversion state store | Not started |
