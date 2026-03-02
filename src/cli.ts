#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as readline from 'readline';
import { Converter } from './converter';
import { ConversionOptions, ConversionResult, DEFAULT_OPTIONS, PreviewResult, StyleProfile } from './types';

type OutputFormat = 'text' | 'markdown' | 'json';

function formatSummaryText(result: ConversionResult, boardId: string): string {
  const lines: string[] = [
    'Excalidraw to Miro Import Summary',
    '',
    `Items created:     ${result.itemsCreated}`,
    `Connectors:        ${result.connectorsCreated}`,
  ];
  if (result.framesCreated > 0) lines.push(`Frames:            ${result.framesCreated}`);
  if (result.imagesCreated > 0) lines.push(`Images:            ${result.imagesCreated}`);
  if (result.freedrawConverted > 0) lines.push(`Freedraw:          ${result.freedrawConverted}`);
  if (result.skippedElements.length > 0) lines.push(`Skipped:           ${result.skippedElements.length}`);
  if (result.errors.length > 0) lines.push(`Errors:            ${result.errors.length}`);
  lines.push('', `Board: https://miro.com/app/board/${boardId}/`);
  if (result.skippedElements.length > 0) {
    lines.push('', 'Skipped elements:');
    result.skippedElements.forEach((s) => lines.push(`  - ${s.type} (${s.id}): ${s.reason}`));
  }
  if (result.cleanupSuggestions && result.cleanupSuggestions.length > 0) {
    lines.push('', 'Cleanup suggestions:');
    for (const s of result.cleanupSuggestions) {
      const icon = s.severity === 'action' ? '[ACTION]' : s.severity === 'warning' ? '[WARN]' : '[INFO]';
      lines.push(`  ${icon} ${s.message}`);
      lines.push(`         ${s.suggestion}`);
    }
  }
  return lines.join('\n');
}

function formatSummaryMarkdown(result: ConversionResult, boardId: string): string {
  const lines: string[] = [
    '## Excalidraw to Miro Import Summary',
    '',
    '| Metric | Count |',
    '|--------|-------|',
    `| Shapes & Text | ${result.itemsCreated} |`,
    `| Connectors | ${result.connectorsCreated} |`,
  ];
  if (result.framesCreated > 0) lines.push(`| Frames | ${result.framesCreated} |`);
  if (result.imagesCreated > 0) lines.push(`| Images | ${result.imagesCreated} |`);
  if (result.freedrawConverted > 0) lines.push(`| Freedraw | ${result.freedrawConverted} |`);
  if (result.skippedElements.length > 0) lines.push(`| Skipped | ${result.skippedElements.length} |`);
  if (result.errors.length > 0) lines.push(`| Errors | ${result.errors.length} |`);
  lines.push('', `**Board**: [Open in Miro](https://miro.com/app/board/${boardId}/)`);
  if (result.skippedElements.length > 0) {
    lines.push('', '**Skipped elements:**');
    result.skippedElements.forEach((s) => lines.push(`- ${s.type} (\`${s.id}\`): ${s.reason}`));
  }
  if (result.cleanupSuggestions && result.cleanupSuggestions.length > 0) {
    lines.push('', '### Cleanup Suggestions');
    for (const s of result.cleanupSuggestions) {
      const icon = s.severity === 'action' ? '🔴' : s.severity === 'warning' ? '🟡' : '🔵';
      lines.push(`- ${icon} **${s.message}** — ${s.suggestion}`);
    }
  }
  return lines.join('\n');
}

function formatSummaryJson(result: ConversionResult, boardId: string): string {
  return JSON.stringify({
    success: result.success,
    boardUrl: `https://miro.com/app/board/${boardId}/`,
    counts: {
      items: result.itemsCreated,
      connectors: result.connectorsCreated,
      frames: result.framesCreated,
      images: result.imagesCreated,
      freedraw: result.freedrawConverted,
      skipped: result.skippedElements.length,
      errors: result.errors.length,
    },
    skippedElements: result.skippedElements,
    errors: result.errors,
    cleanupSuggestions: result.cleanupSuggestions || [],
  }, null, 2);
}

function formatPreviewText(preview: PreviewResult): string {
  const lines: string[] = [
    'Import Preview',
    '==============',
    '',
    `Total elements:  ${preview.totalElements}`,
    `Will create:     ${preview.willCreate}`,
    `Degraded:        ${preview.degraded}`,
    `Will skip:       ${preview.willSkip}`,
    '',
    'Breakdown:',
  ];
  const b = preview.breakdown;
  if (b.shapes > 0) lines.push(`  Shapes:      ${b.shapes}`);
  if (b.text > 0) lines.push(`  Text:        ${b.text}`);
  if (b.connectors > 0) lines.push(`  Connectors:  ${b.connectors}`);
  if (b.images > 0) lines.push(`  Images:      ${b.images}`);
  if (b.freedraw > 0) lines.push(`  Freedraw:    ${b.freedraw}`);
  if (b.frames > 0) lines.push(`  Frames:      ${b.frames}`);

  const attention = preview.elements.filter((e) => e.status !== 'will_create');
  if (attention.length > 0) {
    lines.push('', 'Attention needed:');
    for (const el of attention) {
      const icon = el.status === 'will_skip' ? '[SKIP]' : '[WARN]';
      lines.push(`  ${icon} ${el.type} -> ${el.miroType}`);
      if (el.reason) lines.push(`        Reason: ${el.reason}`);
      if (el.fidelityNote) lines.push(`        Note: ${el.fidelityNote}`);
    }
  }
  return lines.join('\n');
}

function formatPreviewJson(preview: PreviewResult): string {
  return JSON.stringify(preview, null, 2);
}

function formatSummary(result: ConversionResult, boardId: string, format: OutputFormat): string {
  switch (format) {
    case 'json': return formatSummaryJson(result, boardId);
    case 'markdown': return formatSummaryMarkdown(result, boardId);
    default: return formatSummaryText(result, boardId);
  }
}

function buildConversionOptions(opts: Record<string, unknown>): Partial<ConversionOptions> {
  return {
    scale: opts.scale as number,
    offsetX: opts.offsetX as number,
    offsetY: opts.offsetY as number,
    snapThreshold: opts.snapThreshold as number,
    createConnectors: opts.connectors !== false,
    skipFreedraw: (opts.skipFreedraw ?? false) as boolean,
    convertFreedraw: opts.freedraw !== false,
    convertImages: opts.images !== false,
    convertFrames: opts.frames !== false,
    verbose: (opts.verbose ?? false) as boolean,
  };
}

function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function loadStyleProfile(profilePath: string): StyleProfile {
  const content = fs.readFileSync(profilePath, 'utf-8');
  const profile = JSON.parse(content) as StyleProfile;
  if (!profile.name || !profile.overrides) {
    throw new Error('Invalid style profile: must have "name" and "overrides" fields');
  }
  return profile;
}

const PRESET_CONFIGS: Record<string, Partial<ConversionOptions>> = {
  architecture: {
    createConnectors: true,
    snapThreshold: 80,
    convertImages: true,
    convertFreedraw: true,
    convertFrames: true,
  },
  workshop: {
    createConnectors: true,
    snapThreshold: 30,
    convertImages: true,
    convertFreedraw: true,
    convertFrames: true,
    skipFreedraw: false,
  },
  'product-flow': {
    createConnectors: true,
    snapThreshold: 50,
    convertImages: true,
    convertFreedraw: false,
    convertFrames: true,
  },
};

const program = new Command();

program
  .name('excal2miro')
  .description('Convert Excalidraw drawings to Miro board objects')
  .version('1.0.0');

program
  .command('convert')
  .description('Convert an Excalidraw file and import to Miro')
  .requiredOption('-i, --in <path>', 'Path to Excalidraw file (.excalidraw)')
  .requiredOption('-b, --board <id>', 'Miro board ID')
  .requiredOption('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .option('-s, --scale <number>', 'Scale factor for coordinates', parseFloat, DEFAULT_OPTIONS.scale)
  .option('--offset-x <number>', 'X offset on Miro board', parseFloat, DEFAULT_OPTIONS.offsetX)
  .option('--offset-y <number>', 'Y offset on Miro board', parseFloat, DEFAULT_OPTIONS.offsetY)
  .option('--snap-threshold <number>', 'Distance threshold for snapping arrows to shapes', parseFloat, DEFAULT_OPTIONS.snapThreshold)
  .option('--no-connectors', 'Skip creating connectors from arrows')
  .option('--skip-freedraw', 'Skip freedraw elements without converting')
  .option('--no-freedraw', 'Disable freedraw-to-SVG conversion')
  .option('--no-images', 'Disable image element conversion')
  .option('--no-frames', 'Disable frame conversion')
  .option('--preset <name>', 'Use a preset (architecture, workshop, product-flow)')
  .option('--style-profile <path>', 'Path to a JSON style profile for visual normalization')
  .option('--import-mode <mode>', 'Import mode: create, update, upsert', 'create')
  .option('--mapping-file <path>', 'Path to mapping file for re-import (stores ID mappings)')
  .option('--output-format <format>', 'Summary output format: text, markdown, json', 'text')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    const token = opts.token || process.env.MIRO_TOKEN;
    if (!token) {
      console.error('Error: Miro token required. Use --token or set MIRO_TOKEN environment variable.');
      process.exit(1);
    }

    const presetOpts = opts.preset && PRESET_CONFIGS[opts.preset] ? PRESET_CONFIGS[opts.preset] : {};
    const options: Partial<ConversionOptions> = { ...presetOpts, ...buildConversionOptions(opts) };

    if (opts.styleProfile) {
      options.styleProfile = loadStyleProfile(opts.styleProfile);
    }

    if (opts.importMode) {
      options.importMode = opts.importMode;
    }
    if (opts.mappingFile) {
      options.mappingFile = opts.mappingFile;
    }
    const format: OutputFormat = opts.outputFormat || 'text';

    if (format === 'text') {
      console.log(`\nConverting Excalidraw to Miro...`);
      console.log(`   Input: ${opts.in}`);
      console.log(`   Board: ${opts.board}`);
      if (opts.preset) console.log(`   Preset: ${opts.preset}`);
      if (opts.verbose) console.log(`   Options: ${JSON.stringify(options, null, 2)}`);
      console.log('');
    }

    const converter = new Converter({
      miroToken: token,
      boardId: opts.board,
      options,
      verbose: opts.verbose,
    });

    try {
      const result = await converter.convert(opts.in);

      if (format === 'json' || format === 'markdown') {
        console.log(formatSummary(result, opts.board, format));
      } else {
        console.log('\nConversion Results:');
        console.log(`   Items created: ${result.itemsCreated}`);
        console.log(`   Connectors created: ${result.connectorsCreated}`);
        if (result.framesCreated > 0) console.log(`   Frames created: ${result.framesCreated}`);
        if (result.imagesCreated > 0) console.log(`   Images uploaded: ${result.imagesCreated}`);
        if (result.freedrawConverted > 0) console.log(`   Freedraw converted: ${result.freedrawConverted}`);

        if (result.skippedElements.length > 0) {
          console.log(`   Elements skipped: ${result.skippedElements.length}`);
          if (opts.verbose) {
            for (const skipped of result.skippedElements) {
              console.log(`      - ${skipped.type}: ${skipped.reason}`);
            }
          }
        }

        if (result.errors.length > 0) {
          console.log(`   Errors: ${result.errors.length}`);
          for (const error of result.errors) {
            console.log(`      - ${error}`);
          }
        }

        if (result.success) {
          console.log('\nConversion complete!');
          console.log(`   Open your board: https://miro.com/app/board/${opts.board}/`);
        } else {
          console.log('\nConversion completed with errors');
          process.exit(1);
        }
      }
    } catch (error) {
      console.error('\nConversion failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('preview')
  .description('Dry-run preview of what will happen without writing to Miro')
  .requiredOption('-i, --in <path>', 'Path to Excalidraw file (.excalidraw)')
  .option('-s, --scale <number>', 'Scale factor for coordinates', parseFloat, DEFAULT_OPTIONS.scale)
  .option('--no-connectors', 'Skip creating connectors from arrows')
  .option('--skip-freedraw', 'Skip freedraw elements without converting')
  .option('--no-freedraw', 'Disable freedraw-to-SVG conversion')
  .option('--no-images', 'Disable image element conversion')
  .option('--no-frames', 'Disable frame conversion')
  .option('--preset <name>', 'Use a preset (architecture, workshop, product-flow)')
  .option('--output-format <format>', 'Output format: text, json', 'text')
  .action((opts) => {
    const presetOpts = opts.preset && PRESET_CONFIGS[opts.preset] ? PRESET_CONFIGS[opts.preset] : {};
    const options: Partial<ConversionOptions> = { ...presetOpts, ...buildConversionOptions(opts), dryRun: true };
    const format: OutputFormat = opts.outputFormat || 'text';

    try {
      const fileJson = fs.readFileSync(opts.in, 'utf-8');
      const converter = new Converter({
        miroToken: 'preview-only',
        boardId: 'preview-only',
        options,
      });

      const preview: PreviewResult = converter.preview(fileJson);

      if (format === 'json') {
        console.log(formatPreviewJson(preview));
      } else {
        console.log(formatPreviewText(preview));
      }
    } catch (error) {
      console.error('Preview failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('guided')
  .description('Interactive guided import flow')
  .action(async () => {
    console.log('\nExcalidraw to Miro — Guided Import');
    console.log('===================================\n');

    const filePath = await promptUser('Path to your .excalidraw file: ');
    if (!filePath) { console.error('File path is required.'); process.exit(1); }
    if (!fs.existsSync(filePath)) { console.error(`File not found: ${filePath}`); process.exit(1); }

    let token = process.env.MIRO_TOKEN || '';
    if (!token) {
      console.log('\nYou need a Miro API token with boards:write scope.');
      console.log('Get one at: https://developers.miro.com/\n');
      token = await promptUser('Miro API Token: ');
    }
    if (!token) { console.error('Token is required.'); process.exit(1); }

    const boardId = await promptUser('\nMiro Board ID (from the board URL): ');
    if (!boardId) { console.error('Board ID is required.'); process.exit(1); }

    console.log('\nAvailable presets:');
    console.log('  1. Default          — Standard import with all features');
    console.log('  2. Architecture     — Prioritize connector fidelity, smart snapping');
    console.log('  3. Workshop         — Preserve hand-drawn feel, looser layout');
    console.log('  4. Product Flow     — Merge text aggressively, skip freedraw');

    const presetChoice = await promptUser('\nSelect preset [1-4, default: 1]: ');
    const presetMap: Record<string, string | undefined> = { '2': 'architecture', '3': 'workshop', '4': 'product-flow' };
    const presetName = presetMap[presetChoice];
    const presetOpts = presetName && PRESET_CONFIGS[presetName] ? PRESET_CONFIGS[presetName] : {};

    const fileJson = fs.readFileSync(filePath, 'utf-8');
    const previewConverter = new Converter({
      miroToken: 'preview-only',
      boardId: 'preview-only',
      options: { ...presetOpts, dryRun: true },
    });

    const preview = previewConverter.preview(fileJson);
    console.log('\n' + formatPreviewText(preview));

    const confirm = await promptUser('\nProceed with conversion? [Y/n]: ');
    if (confirm.toLowerCase() === 'n') {
      console.log('Cancelled.');
      process.exit(0);
    }

    console.log('\nConverting...');
    const converter = new Converter({
      miroToken: token,
      boardId,
      options: presetOpts,
      verbose: false,
    });

    try {
      const result = await converter.convert(filePath);
      console.log('\n' + formatSummaryText(result, boardId));

      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('\nConversion failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('batch')
  .description('Batch import multiple Excalidraw files from a directory (supports Obsidian vaults)')
  .requiredOption('-d, --dir <path>', 'Directory containing .excalidraw or .excalidraw.md files')
  .requiredOption('-b, --board <id>', 'Miro board ID')
  .requiredOption('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .option('-s, --scale <number>', 'Scale factor', parseFloat, DEFAULT_OPTIONS.scale)
  .option('--preset <name>', 'Use a preset')
  .option('--style-profile <path>', 'Path to a JSON style profile')
  .option('--no-recursive', 'Do not search subdirectories')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (opts) => {
    const token = opts.token || process.env.MIRO_TOKEN;
    if (!token) { console.error('Error: Miro token required.'); process.exit(1); }

    const { findExcalidrawFiles } = await import('./parser');

    const files = findExcalidrawFiles(opts.dir, opts.recursive !== false);

    if (files.length === 0) {
      console.log('No .excalidraw or .excalidraw.md files found.');
      process.exit(0);
    }

    console.log(`\nFound ${files.length} file(s) to import:\n`);
    files.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));

    const confirm = await promptUser(`\nImport all ${files.length} files? [Y/n]: `);
    if (confirm.toLowerCase() === 'n') {
      console.log('Cancelled.');
      process.exit(0);
    }

    const presetOpts = opts.preset && PRESET_CONFIGS[opts.preset] ? PRESET_CONFIGS[opts.preset] : {};
    const baseOptions: Partial<ConversionOptions> = {
      ...presetOpts,
      scale: opts.scale,
      verbose: opts.verbose ?? false,
    };

    if (opts.styleProfile) {
      baseOptions.styleProfile = loadStyleProfile(opts.styleProfile);
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      console.log(`\n[${i + 1}/${files.length}] Importing: ${filePath}`);

      const converter = new Converter({
        miroToken: token,
        boardId: opts.board,
        options: baseOptions,
        verbose: opts.verbose,
      });

      try {
        const result = await converter.convert(filePath);
        if (result.success) {
          console.log(`  Items: ${result.itemsCreated}, Connectors: ${result.connectorsCreated}`);
          totalSuccess++;
        } else {
          console.log(`  Completed with ${result.errors.length} error(s)`);
          totalFailed++;
        }
      } catch (error) {
        console.error(`  Failed: ${error instanceof Error ? error.message : error}`);
        totalFailed++;
      }
    }

    console.log(`\nBatch import complete: ${totalSuccess} succeeded, ${totalFailed} failed.`);
    console.log(`Board: https://miro.com/app/board/${opts.board}/`);

    if (totalFailed > 0) process.exit(1);
  });

program
  .command('repair')
  .description('Interactive repair of skipped connectors from a previous import')
  .requiredOption('-i, --in <path>', 'Path to the original Excalidraw file')
  .requiredOption('-b, --board <id>', 'Miro board ID')
  .requiredOption('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .requiredOption('--mapping-file <path>', 'Path to the mapping file from the original import')
  .option('-s, --scale <number>', 'Scale factor', parseFloat, DEFAULT_OPTIONS.scale)
  .option('--snap-threshold <number>', 'Snap threshold', parseFloat, DEFAULT_OPTIONS.snapThreshold)
  .action(async (opts) => {
    const token = opts.token || process.env.MIRO_TOKEN;
    if (!token) { console.error('Error: Miro token required.'); process.exit(1); }

    if (!fs.existsSync(opts.mappingFile)) {
      console.error(`Mapping file not found: ${opts.mappingFile}`);
      console.error('Run a conversion first with --mapping-file to generate it.');
      process.exit(1);
    }

    const mappingContent = fs.readFileSync(opts.mappingFile, 'utf-8');
    const mappingData = JSON.parse(mappingContent);
    const idMap: Record<string, string> = mappingData.idMap || {};

    const fileJson = fs.readFileSync(opts.in, 'utf-8');
    const converter = new Converter({
      miroToken: 'preview-only',
      boardId: 'preview-only',
      options: { dryRun: true },
    });

    const preview = converter.preview(fileJson);
    const skippedConnectors = preview.elements.filter(
      (e) => (e.type === 'arrow' || e.type === 'line') && e.status === 'will_skip'
    );

    if (skippedConnectors.length === 0) {
      console.log('\nNo skipped connectors found. Nothing to repair.');
      process.exit(0);
    }

    console.log(`\nFound ${skippedConnectors.length} skipped connector(s):\n`);

    const shapesInMap = Object.entries(idMap)
      .filter(([, miroId]) => miroId && miroId !== 'merged')
      .map(([exId, miroId]) => ({ excalidrawId: exId, miroId }));

    const { MiroClient } = await import('./api');
    const client = new MiroClient({ token, verbose: false });

    let repaired = 0;
    for (const sc of skippedConnectors) {
      console.log(`  Connector: ${sc.id.slice(0, 12)}...`);
      console.log(`    Reason: ${sc.reason || 'Unknown'}`);
      console.log(`    Available shapes to connect:`);

      const candidates = shapesInMap.slice(0, 10);
      candidates.forEach((c, idx) => {
        console.log(`      ${idx + 1}. ${c.excalidrawId.slice(0, 12)}... -> Miro: ${c.miroId}`);
      });

      if (candidates.length === 0) {
        console.log('    No shapes available in mapping.');
        continue;
      }

      const startChoice = await promptUser(`    Start shape [1-${candidates.length}, or skip]: `);
      if (startChoice.toLowerCase() === 'skip' || !startChoice) continue;

      const endChoice = await promptUser(`    End shape [1-${candidates.length}, or skip]: `);
      if (endChoice.toLowerCase() === 'skip' || !endChoice) continue;

      const startIdx = parseInt(startChoice, 10) - 1;
      const endIdx = parseInt(endChoice, 10) - 1;

      if (startIdx < 0 || startIdx >= candidates.length || endIdx < 0 || endIdx >= candidates.length) {
        console.log('    Invalid selection, skipping.');
        continue;
      }

      try {
        await client.createConnector(opts.board, {
          startItem: { id: candidates[startIdx].miroId },
          endItem: { id: candidates[endIdx].miroId },
          shape: 'curved',
          style: {
            strokeColor: '#1a1a1a',
            strokeWidth: '2.0',
            endStrokeCap: 'arrow',
          },
        });
        console.log('    Connector created successfully.');
        repaired++;
      } catch (error) {
        console.error(`    Failed: ${error instanceof Error ? error.message : error}`);
      }
    }

    console.log(`\nRepair complete. ${repaired}/${skippedConnectors.length} connector(s) resolved.`);
  });

// Default command for backward compatibility: bare arguments work as convert
program
  .option('-i, --in <path>', 'Path to Excalidraw file')
  .option('-b, --board <id>', 'Miro board ID')
  .option('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .option('-s, --scale <number>', 'Scale factor', parseFloat)
  .option('--offset-x <number>', 'X offset', parseFloat)
  .option('--offset-y <number>', 'Y offset', parseFloat)
  .option('--snap-threshold <number>', 'Snap threshold', parseFloat)
  .option('--no-connectors', 'Skip connectors')
  .option('--skip-freedraw', 'Skip freedraw')
  .option('--no-freedraw', 'Disable freedraw')
  .option('--no-images', 'Disable images')
  .option('--no-frames', 'Disable frames')
  .option('--preset <name>', 'Use a preset')
  .option('--output-format <format>', 'Output format: text, markdown, json')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (opts) => {
    if (!opts.in) return;

    const token = opts.token || process.env.MIRO_TOKEN;
    if (!token || !opts.board) {
      console.error('Error: --in, --board, and --token (or MIRO_TOKEN) are required.');
      console.error('Tip: Use `excal2miro guided` for an interactive flow.');
      process.exit(1);
    }

    const presetOpts = opts.preset && PRESET_CONFIGS[opts.preset] ? PRESET_CONFIGS[opts.preset] : {};
    const options: Partial<ConversionOptions> = {
      ...presetOpts,
      ...buildConversionOptions(opts),
    };
    const format: OutputFormat = opts.outputFormat || 'text';

    const converter = new Converter({
      miroToken: token,
      boardId: opts.board,
      options,
      verbose: opts.verbose,
    });

    try {
      const result = await converter.convert(opts.in);
      console.log(formatSummary(result, opts.board, format));
      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Conversion failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse();
