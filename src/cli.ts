#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as readline from 'readline';
import { Converter } from './converter';
import { ConversionOptions, ConversionResult, PreviewResult, StyleProfile } from './types';

type OutputFormat = 'text' | 'markdown' | 'json';

function formatSummaryText(result: ConversionResult, boardId: string): string {
  const lines: string[] = [
    'Excalidraw to Miro Import Summary',
    '',
    `Items created:     ${result.itemsCreated}`,
    `Connectors:        ${result.connectorsCreated}`,
  ];
  if (result.framesCreated > 0) lines.push(`Frames:            ${result.framesCreated}`);
  if (result.groupsCreated > 0) lines.push(`Groups:            ${result.groupsCreated}`);
  if (result.imagesCreated > 0) lines.push(`Images:            ${result.imagesCreated}`);
  if (result.freedrawConverted > 0) lines.push(`Freedraw:          ${result.freedrawConverted}`);
  if (result.skippedElements.length > 0) lines.push(`Skipped:           ${result.skippedElements.length}`);
  if (result.errors.length > 0) lines.push(`Errors:            ${result.errors.length}`);
  lines.push('', `Board: https://miro.com/app/board/${boardId}/`);
  if (result.skippedElements.length > 0) {
    lines.push('', 'Skipped elements:');
    result.skippedElements.forEach((s) => lines.push(`  - ${s.type} (${s.id}) [${s.code}]: ${s.reason}`));
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
  if (result.groupsCreated > 0) lines.push(`| Groups | ${result.groupsCreated} |`);
  if (result.imagesCreated > 0) lines.push(`| Images | ${result.imagesCreated} |`);
  if (result.freedrawConverted > 0) lines.push(`| Freedraw | ${result.freedrawConverted} |`);
  if (result.skippedElements.length > 0) lines.push(`| Skipped | ${result.skippedElements.length} |`);
  if (result.errors.length > 0) lines.push(`| Errors | ${result.errors.length} |`);
  lines.push('', `**Board**: [Open in Miro](https://miro.com/app/board/${boardId}/)`);
  if (result.skippedElements.length > 0) {
    lines.push('', '**Skipped elements:**');
    result.skippedElements.forEach((s) => lines.push(`- ${s.type} (\`${s.id}\`) [\`${s.code}\`]: ${s.reason}`));
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
      groups: result.groupsCreated,
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
  if (b.groups > 0) lines.push(`  Groups:      ${b.groups}`);

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

function flagPassed(flags: string[]): boolean {
  return process.argv.some((arg) => flags.some((flag) => arg === flag || arg.startsWith(`${flag}=`)));
}

function buildConversionOptions(opts: Record<string, unknown>): Partial<ConversionOptions> {
  const options: Partial<ConversionOptions> = {};

  if (flagPassed(['--scale', '-s'])) options.scale = opts.scale as number;
  if (flagPassed(['--offset-x'])) options.offsetX = opts.offsetX as number;
  if (flagPassed(['--offset-y'])) options.offsetY = opts.offsetY as number;
  if (flagPassed(['--snap-threshold'])) options.snapThreshold = opts.snapThreshold as number;
  if (flagPassed(['--no-connectors'])) options.createConnectors = false;
  if (flagPassed(['--skip-freedraw'])) options.skipFreedraw = true;
  if (flagPassed(['--no-freedraw'])) options.convertFreedraw = false;
  if (flagPassed(['--no-images'])) options.convertImages = false;
  if (flagPassed(['--no-frames'])) options.convertFrames = false;
  if (flagPassed(['--verbose', '-v'])) options.verbose = true;

  return options;
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

interface CliConfig {
  token?: string;
  boardId?: string;
  preset?: string;
  styleProfile?: string;
  outputFormat?: OutputFormat;
  importMode?: 'create' | 'update' | 'upsert';
  mappingFile?: string;
  options?: Partial<ConversionOptions>;
}

function getConfigPath(configFromFlag?: string): string | undefined {
  if (configFromFlag) return path.resolve(configFromFlag);

  const cwdPath = path.resolve(process.cwd(), '.excal2mirorc.json');
  if (fs.existsSync(cwdPath)) return cwdPath;

  const homePath = path.join(os.homedir(), '.excal2mirorc.json');
  if (fs.existsSync(homePath)) return homePath;

  return undefined;
}

function loadCliConfig(configFromFlag?: string): CliConfig | undefined {
  const configPath = getConfigPath(configFromFlag);
  if (!configPath) return undefined;

  const raw = fs.readFileSync(configPath, 'utf-8');
  return JSON.parse(raw) as CliConfig;
}

function maybeLoadStyleProfile(profilePath?: string): StyleProfile | undefined {
  if (!profilePath) return undefined;
  return loadStyleProfile(profilePath);
}

function initConfigFile(configFromFlag?: string): void {
  const outputPath = configFromFlag
    ? path.resolve(configFromFlag)
    : path.resolve(process.cwd(), '.excal2mirorc.json');

  if (fs.existsSync(outputPath)) {
    console.error(`Config already exists: ${outputPath}`);
    process.exit(1);
  }

  const starter: CliConfig = {
    boardId: 'uXjVN1234567abcd=',
    preset: 'architecture',
    outputFormat: 'text',
    importMode: 'create',
    mappingFile: './mapping.json',
    options: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      snapThreshold: 50,
      createConnectors: true,
      skipFreedraw: false,
      convertFreedraw: true,
      convertImages: true,
      convertFrames: true,
      verbose: false,
    },
  };

  fs.writeFileSync(outputPath, JSON.stringify(starter, null, 2), 'utf-8');
  console.log(`Created starter config at ${outputPath}`);
}

function getConfigArgFromArgv(): string | undefined {
  const configIndex = process.argv.indexOf('--config');
  if (configIndex >= 0 && process.argv[configIndex + 1]) {
    return process.argv[configIndex + 1];
  }

  const inline = process.argv.find((arg) => arg.startsWith('--config='));
  if (inline) {
    return inline.split('=').slice(1).join('=');
  }

  return undefined;
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
  .version('1.0.0')
  .option('--config <path>', 'Path to .excal2mirorc.json')
  .option('--init', 'Create starter .excal2mirorc.json in current directory');

program
  .command('convert')
  .description('Convert an Excalidraw file and import to Miro')
  .requiredOption('-i, --in <path>', 'Path to Excalidraw file (.excalidraw)')
  .option('-b, --board <id>', 'Miro board ID')
  .option('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .option('-s, --scale <number>', 'Scale factor for coordinates', parseFloat)
  .option('--offset-x <number>', 'X offset on Miro board', parseFloat)
  .option('--offset-y <number>', 'Y offset on Miro board', parseFloat)
  .option('--snap-threshold <number>', 'Distance threshold for snapping arrows to shapes', parseFloat)
  .option('--no-connectors', 'Skip creating connectors from arrows')
  .option('--skip-freedraw', 'Skip freedraw elements without converting')
  .option('--no-freedraw', 'Disable freedraw-to-SVG conversion')
  .option('--no-images', 'Disable image element conversion')
  .option('--no-frames', 'Disable frame conversion')
  .option('--preset <name>', 'Use a preset (architecture, workshop, product-flow)')
  .option('--style-profile <path>', 'Path to a JSON style profile for visual normalization')
  .option('--import-mode <mode>', 'Import mode: create, update, upsert')
  .option('--mapping-file <path>', 'Path to mapping file for re-import (stores ID mappings)')
  .option('--output-format <format>', 'Summary output format: text, markdown, json')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = loadCliConfig(globalOpts.config);

    const boardId = opts.board || config?.boardId;
    if (!boardId) {
      console.error('Error: Miro board ID required. Use --board or set boardId in config.');
      process.exit(1);
    }

    const token = opts.token || config?.token || process.env.MIRO_TOKEN;
    if (!token) {
      console.error('Error: Miro token required. Use --token or set MIRO_TOKEN environment variable.');
      process.exit(1);
    }

    const selectedPreset = opts.preset || config?.preset;
    const presetOpts = selectedPreset && PRESET_CONFIGS[selectedPreset] ? PRESET_CONFIGS[selectedPreset] : {};
    const options: Partial<ConversionOptions> = {
      ...(config?.options ?? {}),
      ...presetOpts,
      ...buildConversionOptions(opts),
    };

    const styleProfilePath = opts.styleProfile || config?.styleProfile;
    const styleProfile = maybeLoadStyleProfile(styleProfilePath);
    if (styleProfile) {
      options.styleProfile = styleProfile;
    }

    if (opts.importMode || config?.importMode) {
      options.importMode = (opts.importMode || config?.importMode) as ConversionOptions['importMode'];
    }
    if (opts.mappingFile || config?.mappingFile) {
      options.mappingFile = opts.mappingFile || config?.mappingFile;
    }
    const format: OutputFormat = (opts.outputFormat || config?.outputFormat || 'text') as OutputFormat;

    if (format === 'text') {
      console.log(`\nConverting Excalidraw to Miro...`);
      console.log(`   Input: ${opts.in}`);
      console.log(`   Board: ${boardId}`);
      if (selectedPreset) console.log(`   Preset: ${selectedPreset}`);
      if (opts.verbose) console.log(`   Options: ${JSON.stringify(options, null, 2)}`);
      console.log('');
    }

    const converter = new Converter({
      miroToken: token,
      boardId,
      options,
      verbose: opts.verbose,
    });

    try {
      const result = await converter.convert(opts.in);

      if (format === 'json' || format === 'markdown') {
        console.log(formatSummary(result, boardId, format));
      } else {
        console.log('\nConversion Results:');
        console.log(`   Items created: ${result.itemsCreated}`);
        console.log(`   Connectors created: ${result.connectorsCreated}`);
        if (result.framesCreated > 0) console.log(`   Frames created: ${result.framesCreated}`);
        if (result.groupsCreated > 0) console.log(`   Groups created: ${result.groupsCreated}`);
        if (result.imagesCreated > 0) console.log(`   Images uploaded: ${result.imagesCreated}`);
        if (result.freedrawConverted > 0) console.log(`   Freedraw converted: ${result.freedrawConverted}`);

        if (result.skippedElements.length > 0) {
          console.log(`   Elements skipped: ${result.skippedElements.length}`);
          if (opts.verbose) {
            for (const skipped of result.skippedElements) {
              console.log(`      - ${skipped.type} [${skipped.code}]: ${skipped.reason}`);
              console.log(`        -> ${skipped.remediation}`);
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
          console.log(`   Open your board: https://miro.com/app/board/${boardId}/`);
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
  .option('-s, --scale <number>', 'Scale factor for coordinates', parseFloat)
  .option('--no-connectors', 'Skip creating connectors from arrows')
  .option('--skip-freedraw', 'Skip freedraw elements without converting')
  .option('--no-freedraw', 'Disable freedraw-to-SVG conversion')
  .option('--no-images', 'Disable image element conversion')
  .option('--no-frames', 'Disable frame conversion')
  .option('--preset <name>', 'Use a preset (architecture, workshop, product-flow)')
  .option('--output-format <format>', 'Output format: text, json')
  .action((opts) => {
    const globalOpts = program.opts();
    const config = loadCliConfig(globalOpts.config);
    const selectedPreset = opts.preset || config?.preset;
    const presetOpts = selectedPreset && PRESET_CONFIGS[selectedPreset] ? PRESET_CONFIGS[selectedPreset] : {};
    const options: Partial<ConversionOptions> = {
      ...(config?.options ?? {}),
      ...presetOpts,
      ...buildConversionOptions(opts),
      dryRun: true,
    };
    const format: OutputFormat = (opts.outputFormat || config?.outputFormat || 'text') as OutputFormat;

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
  .option('-b, --board <id>', 'Miro board ID')
  .option('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .option('-s, --scale <number>', 'Scale factor', parseFloat)
  .option('--preset <name>', 'Use a preset')
  .option('--style-profile <path>', 'Path to a JSON style profile')
  .option('--no-recursive', 'Do not search subdirectories')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = loadCliConfig(globalOpts.config);
    const boardId = opts.board || config?.boardId;
    if (!boardId) {
      console.error('Error: Miro board ID required. Use --board or set boardId in config.');
      process.exit(1);
    }

    const token = opts.token || config?.token || process.env.MIRO_TOKEN;
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

    const selectedPreset = opts.preset || config?.preset;
    const presetOpts = selectedPreset && PRESET_CONFIGS[selectedPreset] ? PRESET_CONFIGS[selectedPreset] : {};
    const baseOptions: Partial<ConversionOptions> = {
      ...(config?.options ?? {}),
      ...presetOpts,
      ...buildConversionOptions(opts),
    };

    const styleProfile = maybeLoadStyleProfile(opts.styleProfile || config?.styleProfile);
    if (styleProfile) {
      baseOptions.styleProfile = styleProfile;
    }

    let totalSuccess = 0;
    let totalFailed = 0;

    for (let i = 0; i < files.length; i++) {
      const filePath = files[i];
      console.log(`\n[${i + 1}/${files.length}] Importing: ${filePath}`);

      const converter = new Converter({
        miroToken: token,
        boardId,
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
    console.log(`Board: https://miro.com/app/board/${boardId}/`);

    if (totalFailed > 0) process.exit(1);
  });

program
  .command('repair')
  .description('Interactive repair of skipped connectors from a previous import')
  .requiredOption('-i, --in <path>', 'Path to the original Excalidraw file')
  .option('-b, --board <id>', 'Miro board ID')
  .option('-t, --token <token>', 'Miro OAuth token (or set MIRO_TOKEN env var)')
  .requiredOption('--mapping-file <path>', 'Path to the mapping file from the original import')
  .option('-s, --scale <number>', 'Scale factor', parseFloat)
  .option('--snap-threshold <number>', 'Snap threshold', parseFloat)
  .action(async (opts) => {
    const globalOpts = program.opts();
    const config = loadCliConfig(globalOpts.config);
    const boardId = opts.board || config?.boardId;
    if (!boardId) {
      console.error('Error: Miro board ID required. Use --board or set boardId in config.');
      process.exit(1);
    }

    const token = opts.token || config?.token || process.env.MIRO_TOKEN;
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
        await client.createConnector(boardId, {
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
  .option('--style-profile <path>', 'Path to a JSON style profile')
  .option('--import-mode <mode>', 'Import mode: create, update, upsert')
  .option('--mapping-file <path>', 'Path to mapping file for re-import (stores ID mappings)')
  .option('--output-format <format>', 'Output format: text, markdown, json')
  .option('-v, --verbose', 'Verbose logging')
  .action(async (opts) => {
    const globalOpts = program.opts();
    if (globalOpts.init) {
      initConfigFile(globalOpts.config);
      process.exit(0);
    }

    if (!opts.in) return;

    const config = loadCliConfig(globalOpts.config);
    const boardId = opts.board || config?.boardId;
    const token = opts.token || config?.token || process.env.MIRO_TOKEN;
    if (!token || !boardId) {
      console.error('Error: --in, --board (or config boardId), and --token (or MIRO_TOKEN/config token) are required.');
      console.error('Tip: Use `excal2miro guided` for an interactive flow.');
      process.exit(1);
    }

    const selectedPreset = opts.preset || config?.preset;
    const presetOpts = selectedPreset && PRESET_CONFIGS[selectedPreset] ? PRESET_CONFIGS[selectedPreset] : {};
    const options: Partial<ConversionOptions> = {
      ...(config?.options ?? {}),
      ...presetOpts,
      ...buildConversionOptions(opts),
    };
    if (opts.importMode || config?.importMode) {
      options.importMode = (opts.importMode || config?.importMode) as ConversionOptions['importMode'];
    }
    if (opts.mappingFile || config?.mappingFile) {
      options.mappingFile = opts.mappingFile || config?.mappingFile;
    }
    const styleProfile = maybeLoadStyleProfile(opts.styleProfile || config?.styleProfile);
    if (styleProfile) {
      options.styleProfile = styleProfile;
    }
    const format: OutputFormat = (opts.outputFormat || config?.outputFormat || 'text') as OutputFormat;

    const converter = new Converter({
      miroToken: token,
      boardId,
      options,
      verbose: opts.verbose,
    });

    try {
      const result = await converter.convert(opts.in);
      console.log(formatSummary(result, boardId, format));
      if (!result.success) process.exit(1);
    } catch (error) {
      console.error('Conversion failed:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

if (process.argv.includes('--init')) {
  initConfigFile(getConfigArgFromArgv());
  process.exit(0);
}

program.parse();
