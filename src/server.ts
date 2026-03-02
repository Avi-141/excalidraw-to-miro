import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'path';
import { Converter } from './converter';
import { ConversionOptions, DEFAULT_OPTIONS, PreviewResult, StyleProfile } from './types';

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

const PRESETS: Record<string, Partial<ConversionOptions>> = {
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

const BUILT_IN_STYLE_PROFILES: Record<string, StyleProfile> = {
  'corporate-clean': {
    name: 'Corporate Clean',
    description: 'Professional look with consistent fonts and muted colors',
    overrides: {
      fontFamily: 'arial',
      fontSize: '14',
      borderColor: '#1a1a1a',
      borderWidth: '2.0',
      borderStyle: 'normal',
      connectorColor: '#1a1a1a',
      connectorStrokeWidth: '2.0',
    },
  },
  'design-system': {
    name: 'Design System',
    description: 'Modern design tokens with blue accent and rounded style',
    overrides: {
      fontFamily: 'arial',
      fontSize: '14',
      borderColor: '#2563eb',
      borderWidth: '2.0',
      fillColor: '#eff6ff',
      fillOpacity: '1.0',
      textColor: '#1e293b',
      connectorColor: '#2563eb',
      connectorStrokeWidth: '2.0',
    },
  },
  'sketch-hand-drawn': {
    name: 'Sketch / Hand-drawn',
    description: 'Preserve the hand-drawn Excalidraw aesthetic',
    overrides: {},
    preserveOriginalStyles: true,
  },
};

app.get('/api/style-profiles', (_req, res) => {
  const profiles = Object.entries(BUILT_IN_STYLE_PROFILES).map(([id, profile]) => ({
    id,
    ...profile,
  }));
  res.json(profiles);
});

app.get('/api/presets', (_req, res) => {
  const presetList = Object.entries(PRESETS).map(([id, opts]) => ({
    id,
    name: id === 'architecture' ? 'Architecture Diagram'
      : id === 'workshop' ? 'Workshop Board'
      : 'Product Flow',
    description: id === 'architecture' ? 'Prioritize connector fidelity and smart snapping'
      : id === 'workshop' ? 'Preserve hand-drawn feel with looser layout'
      : 'Merge text aggressively, skip freedraw',
    options: opts,
  }));
  res.json(presetList);
});

app.post('/api/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const fileJson = req.file.buffer.toString('utf-8');
    const preset = req.body.preset as string | undefined;
    const presetOpts = preset && PRESETS[preset] ? PRESETS[preset] : {};

    const styleProfileId = req.body.styleProfile as string | undefined;
    const styleProfile = styleProfileId && BUILT_IN_STYLE_PROFILES[styleProfileId]
      ? BUILT_IN_STYLE_PROFILES[styleProfileId]
      : undefined;

    const options: Partial<ConversionOptions> = {
      ...DEFAULT_OPTIONS,
      ...presetOpts,
      scale: parseFloat(req.body.scale) || 1,
      dryRun: true,
      styleProfile,
    };

    const converter = new Converter({
      miroToken: 'preview-only',
      boardId: 'preview-only',
      options,
    });

    const preview: PreviewResult = converter.preview(fileJson);
    res.json(preview);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Preview failed';
    res.status(400).json({ error: message });
  }
});

app.post('/api/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }

    const token = req.body.token as string;
    const boardId = req.body.boardId as string;

    if (!token) {
      res.status(400).json({ error: 'Miro token is required' });
      return;
    }
    if (!boardId) {
      res.status(400).json({ error: 'Board ID is required' });
      return;
    }

    const fileJson = req.file.buffer.toString('utf-8');
    const preset = req.body.preset as string | undefined;
    const presetOpts = preset && PRESETS[preset] ? PRESETS[preset] : {};

    const styleProfileId = req.body.styleProfile as string | undefined;
    const styleProfile = styleProfileId && BUILT_IN_STYLE_PROFILES[styleProfileId]
      ? BUILT_IN_STYLE_PROFILES[styleProfileId]
      : undefined;

    const options: Partial<ConversionOptions> = {
      ...presetOpts,
      scale: parseFloat(req.body.scale) || 1,
      styleProfile,
    };

    const converter = new Converter({
      miroToken: token,
      boardId,
      options,
      verbose: true,
    });

    const result = await converter.convertJson(fileJson);

    res.json({
      ...result,
      boardUrl: `https://miro.com/app/board/${boardId}/`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Conversion failed';
    res.status(500).json({ error: message });
  }
});

app.use(express.static(path.join(__dirname, '..', 'web', 'dist')));

app.get('/{*splat}', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'web', 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Excalidraw-to-Miro server running at http://localhost:${PORT}`);
});
