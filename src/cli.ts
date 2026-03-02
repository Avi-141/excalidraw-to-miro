#!/usr/bin/env node

import { Command } from 'commander';
import { Converter } from './converter';
import { ConversionOptions, DEFAULT_OPTIONS } from './types';

const program = new Command();

program
  .name('excal2miro')
  .description('Convert Excalidraw drawings to Miro board objects')
  .version('1.0.0');

program
  .requiredOption('-i, --in <path>', 'Path to Excalidraw file (.excalidraw)')
  .requiredOption('-b, --board <id>', 'Miro board ID')
  .requiredOption(
    '-t, --token <token>',
    'Miro OAuth token (or set MIRO_TOKEN env var)'
  )
  .option(
    '-s, --scale <number>',
    'Scale factor for coordinates',
    parseFloat,
    DEFAULT_OPTIONS.scale
  )
  .option(
    '--offset-x <number>',
    'X offset on Miro board',
    parseFloat,
    DEFAULT_OPTIONS.offsetX
  )
  .option(
    '--offset-y <number>',
    'Y offset on Miro board',
    parseFloat,
    DEFAULT_OPTIONS.offsetY
  )
  .option(
    '--snap-threshold <number>',
    'Distance threshold for snapping arrows to shapes',
    parseFloat,
    DEFAULT_OPTIONS.snapThreshold
  )
  .option('--no-connectors', 'Skip creating connectors from arrows')
  .option('--skip-freedraw', 'Skip freedraw elements without converting')
  .option('--no-freedraw', 'Disable freedraw-to-SVG conversion')
  .option('--no-images', 'Disable image element conversion')
  .option('--no-frames', 'Disable frame conversion')
  .option('-v, --verbose', 'Enable verbose logging')
  .action(async (opts) => {
    const token = opts.token || process.env.MIRO_TOKEN;
    if (!token) {
      console.error(
        'Error: Miro token required. Use --token or set MIRO_TOKEN environment variable.'
      );
      process.exit(1);
    }

    const options: Partial<ConversionOptions> = {
      scale: opts.scale,
      offsetX: opts.offsetX,
      offsetY: opts.offsetY,
      snapThreshold: opts.snapThreshold,
      createConnectors: opts.connectors !== false,
      skipFreedraw: opts.skipFreedraw ?? false,
      convertFreedraw: opts.freedraw !== false,
      convertImages: opts.images !== false,
      convertFrames: opts.frames !== false,
      verbose: opts.verbose ?? false,
    };

    console.log(`\n🔄 Converting Excalidraw to Miro...`);
    console.log(`   Input: ${opts.in}`);
    console.log(`   Board: ${opts.board}`);
    if (opts.verbose) {
      console.log(`   Options: ${JSON.stringify(options, null, 2)}`);
    }
    console.log('');

    const converter = new Converter({
      miroToken: token,
      boardId: opts.board,
      options,
      verbose: opts.verbose,
    });

    try {
      const result = await converter.convert(opts.in);

      console.log('\n📊 Conversion Results:');
      console.log(`   ✅ Items created: ${result.itemsCreated}`);
      console.log(`   🔗 Connectors created: ${result.connectorsCreated}`);

      if (result.framesCreated > 0) {
        console.log(`   🖼  Frames created: ${result.framesCreated}`);
      }
      if (result.imagesCreated > 0) {
        console.log(`   📷 Images uploaded: ${result.imagesCreated}`);
      }
      if (result.freedrawConverted > 0) {
        console.log(`   ✏️  Freedraw converted: ${result.freedrawConverted}`);
      }

      if (result.skippedElements.length > 0) {
        console.log(`   ⏭️  Elements skipped: ${result.skippedElements.length}`);
        if (opts.verbose) {
          for (const skipped of result.skippedElements) {
            console.log(`      - ${skipped.type}: ${skipped.reason}`);
          }
        }
      }

      if (result.errors.length > 0) {
        console.log(`   ❌ Errors: ${result.errors.length}`);
        for (const error of result.errors) {
          console.log(`      - ${error}`);
        }
      }

      if (result.success) {
        console.log('\n✨ Conversion complete!');
        console.log(
          `   Open your board: https://miro.com/app/board/${opts.board}/`
        );
      } else {
        console.log('\n⚠️  Conversion completed with errors');
        process.exit(1);
      }
    } catch (error) {
      console.error(
        '\n❌ Conversion failed:',
        error instanceof Error ? error.message : error
      );
      process.exit(1);
    }
  });

program.parse();
