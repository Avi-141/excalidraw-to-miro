# CLI & Engineering Roadmap

Infrastructure, reliability, and developer experience features. These are the building blocks that make user-facing features possible and keep the tool dependable at scale.

## Current State

The CLI (`excal2miro`) accepts a file path, board ID, and token. It runs a sequential pipeline: parse -> group by type -> map elements -> call Miro API -> report results. Key characteristics:

- **No retry logic**: A single API failure permanently fails that element
- **No dry-run**: Every run writes to Miro irreversibly
- **No batch mode**: One file per invocation
- **No config file**: All options via CLI flags or env vars
- **Hardcoded rate limit**: Fixed 100ms delay between API calls
- **No interactive prompts**: All inputs must be provided upfront
- **No CLI argument tests**: `cli.ts` is excluded from test coverage
- **No direct MiroClient tests**: Always mocked in test suite
- **No ESLint config**: `npm run lint` script exists but no `.eslintrc`

---

## Near-Term: Reliable Foundation (0-2 months)

### Dry-Run Mode (`--dry-run`)

Run the full parse-and-map pipeline without calling the Miro API. Return the same `ConversionResult` structure with projected counts.

- Short-circuit `converter.ts` after mapping phase, before any `client.create*` calls
- Output human-readable summary to stdout
- Output machine-readable JSON to stdout or file (`--output-format json`, `--output-file report.json`)
- Validate board access (call `getBoard`) unless `--offline` is specified

**Enables user feature**: Import Preview.

**Implementation scope**: Add `dryRun` flag to `ConversionOptions`. In `converter.ts`, skip API calls when `dryRun` is true but still run all parsing, grouping, and mapping logic. In `cli.ts`, add `--dry-run` flag and format output.

### Retry with Exponential Backoff

Add retry logic to `MiroClient` for transient API failures.

- Retry on HTTP 429, 500, 502, 503, 504
- Respect `Retry-After` header when present
- Exponential backoff: 1s, 2s, 4s with jitter, max 3 retries
- Log each retry attempt when verbose
- Configurable via `MiroClientOptions`: `maxRetries`, `initialRetryDelayMs`

**Enables user feature**: Reliable imports for large diagrams (50+ elements).

**Implementation scope**: Add retry wrapper in `miro-client.ts` around the Axios interceptor. No changes to converter or mappers.

### Structured Error Codes

Replace free-text skip/error reasons with machine-parseable codes and human-readable descriptions.

Current state — reasons are strings like `"Cannot convert to connector"` and `"Image file data not found in .excalidraw"`.

Target state:

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

**Enables user features**: Import Preview (fidelity indicators), One-Click Cleanup Suggestions, Shareable Summary Card.

**Implementation scope**: Define `SkipCode` enum in `src/types/index.ts`. Update `skippedElements` to include `code` alongside `reason`. Update all skip-producing code paths in `converter.ts` and mapper guards.

### Batch Conversion (`--in-glob`)

Process multiple `.excalidraw` files in one invocation.

- Accept glob pattern: `excal2miro --in-glob "diagrams/**/*.excalidraw" --board BOARD_ID`
- Per-file progress and summary
- Continue on error by default; `--fail-fast` to stop on first error
- Aggregate report at the end (total created, total skipped, total errors, per-file breakdown)

**Enables user features**: Obsidian Workflow Mode (batch vault import), team migrations.

**Implementation scope**: Add glob resolution in `cli.ts` (use Node `glob` or `fast-glob`). Loop over files calling `converter.convert()` for each. Collect per-file `ConversionResult` objects and aggregate.

### Config File Support (`.excal2mirorc`)

Load options from a config file to avoid long CLI commands.

- Search order: `--config <path>`, `.excal2mirorc.json` in current directory, `~/.excal2mirorc.json`
- JSON format matching `ConversionOptions` structure plus `boardId` and preset name
- CLI flags override config file values
- `excal2miro --init` to generate a starter config

**Enables user features**: Presets (presets are named config bundles), Team Style Profiles.

**Implementation scope**: Add config loader in `cli.ts`. Merge config values under CLI flags in the options chain.

---

## Mid-Term: Pipeline Robustness (2-6 months)

### ID Map Persistence

Save and load Excalidraw-to-Miro ID mappings between runs.

- Persist `ConversionResult.idMap` to a `.excal2miro-state.json` file alongside the source file
- On subsequent runs, load prior state and use it for update/upsert mode
- Include source file hash to detect changes
- Include timestamp and board ID to prevent cross-board conflicts

**Enables user feature**: Smart Re-Import for Living Diagrams.

**Implementation scope**: New `src/state/` module. Read/write JSON. Hash source file contents. Integrate with `converter.ts` to detect existing Miro IDs.

### Miro Update API Methods

Add `updateShape`, `updateText`, `updateConnector`, `deleteItem` to `MiroClient`.

- Use Miro REST API PATCH and DELETE endpoints
- Required for re-import and connector repair features
- Include same retry logic as create methods

**Enables user features**: Smart Re-Import, One-Click Cleanup Suggestions, Connector Repair.

**Implementation scope**: Add methods to `miro-client.ts`. Add corresponding types to `src/types/miro.ts`.

### Interactive CLI Prompts

Add an interactive mode when required options are missing.

- Use `inquirer` or `@inquirer/prompts` for terminal prompts
- Token: prompt with masked input, link to developer portal, option to save to env
- Board: list available boards via API, let user select
- Preset: display available presets, let user choose
- Confirmation: show summary and ask before executing

**Enables user feature**: Beginner-Friendly Guided Import.

**Implementation scope**: Add prompt flow in `cli.ts`. Call when required options are missing. Skip prompts when all options are provided (non-interactive/CI usage).

### Obsidian Format Parser

Parse `.excalidraw.md` files from the Obsidian Excalidraw plugin.

- Strip Markdown front-matter and extract embedded Excalidraw JSON
- Handle Obsidian-specific conventions (wiki-links in text, vault-relative image paths)
- Integrate with existing parser pipeline

**Enables user feature**: Obsidian Workflow Mode.

**Implementation scope**: New parser variant in `src/parser/`. Detect file extension and route to appropriate parser in `converter.ts`.

### Expanded Test Coverage

Close the gaps in the current test suite.

- **CLI tests**: Test argument parsing, flag combinations, env var fallback, error messages
- **MiroClient integration tests**: Test retry logic, rate limiting, error interceptor with realistic HTTP responses
- **Connector edge cases**: Test with lines (not just arrows), multi-segment connectors, connectors between frames
- **ESLint setup**: Add eslint config, fix any issues, integrate into CI
- **Parser failure modes**: Invalid JSON, missing required fields, corrupted file data

**Enables**: Confidence in all features above. Foundation for CI/CD gating.

**Implementation scope**: New test files. Add eslint config. Update `package.json` scripts.

---

## Longer-Term: Platform Infrastructure (6-12+ months)

### Multi-Target Adapter Architecture

Abstract the Miro-specific layer so the same parser and mapper pipeline can output to different targets.

- Define `Target` interface with `createShape`, `createText`, `createConnector`, etc.
- `MiroTarget` wraps current `MiroClient`
- Future targets: `MuralTarget`, `FigJamTarget`, `LucidTarget`
- Introduce intermediate representation between mappers and targets

**Enables user feature**: Cross-Tool Diagram Hub.

**Implementation scope**: Major refactor. Current mappers return `MiroCreateShapeRequest` etc. — these need to return a target-agnostic intermediate type that gets translated per-target.

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
- JSON output mode for machine consumption
- Webhook notification on completion (configurable URL)
- GitHub Action wrapper

**Enables**: Team CI workflows, automated diagram sync on commit.

---

## Dependency Map

Which engineering features are prerequisites for which user features:

| User Feature | Required Engineering |
|---|---|
| Import Preview | Dry-run mode, Structured error codes |
| Shareable Summary Card | Structured error codes, Output formatters |
| Presets | Config file support |
| Guided Import | Interactive CLI prompts |
| Cleanup Suggestions | Structured error codes, Miro update API |
| Smart Re-Import | ID map persistence, Miro update API |
| Obsidian Mode | Obsidian format parser, Batch conversion |
| Style Profiles | Config file support |
| Connector Repair | Miro update API, Interactive CLI prompts |
| Cross-Tool Hub | Multi-target adapter architecture |
| Version Timeline | Conversion state store |
