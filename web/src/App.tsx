import { useState, useCallback, useRef } from 'react';

interface PreviewElement {
  id: string;
  type: string;
  status: 'will_create' | 'will_skip' | 'degraded';
  miroType: string;
  reason?: string;
  fidelityNote?: string;
}

interface PreviewResult {
  totalElements: number;
  willCreate: number;
  willSkip: number;
  degraded: number;
  elements: PreviewElement[];
  breakdown: {
    shapes: number;
    text: number;
    connectors: number;
    images: number;
    freedraw: number;
    frames: number;
    groups: number;
  };
}

interface CleanupSuggestion {
  category: 'connector' | 'text' | 'fidelity' | 'layout';
  severity: 'info' | 'warning' | 'action';
  message: string;
  elementId?: string;
  elementType?: string;
  suggestion: string;
}

interface ConversionResult {
  success: boolean;
  itemsCreated: number;
  connectorsCreated: number;
  framesCreated: number;
  groupsCreated: number;
  imagesCreated: number;
  freedrawConverted: number;
  skippedElements: Array<{ id: string; type: string; reason: string }>;
  errors: string[];
  boardUrl?: string;
  cleanupSuggestions?: CleanupSuggestion[];
}

interface Preset {
  id: string;
  name: string;
  description: string;
}

interface StyleProfileOption {
  id: string;
  name: string;
  description?: string;
}

type Step = 'setup' | 'upload' | 'preview' | 'converting' | 'result';

export default function App() {
  const [step, setStep] = useState<Step>('setup');
  const [token, setToken] = useState('');
  const [boardId, setBoardId] = useState('');
  const [preset, setPreset] = useState('');
  const [styleProfile, setStyleProfile] = useState('');
  const [scale, setScale] = useState('1');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const presets: Preset[] = [
    { id: '', name: 'Default', description: 'Standard import with all features enabled' },
    { id: 'architecture', name: 'Architecture Diagram', description: 'Prioritize connector fidelity and smart snapping' },
    { id: 'workshop', name: 'Workshop Board', description: 'Preserve hand-drawn feel with looser layout' },
    { id: 'product-flow', name: 'Product Flow', description: 'Merge text aggressively, skip freedraw' },
  ];

  const styleProfiles: StyleProfileOption[] = [
    { id: '', name: 'Original', description: 'Keep source file styles as-is' },
    { id: 'corporate-clean', name: 'Corporate Clean', description: 'Professional fonts and muted colors' },
    { id: 'design-system', name: 'Design System', description: 'Modern blue accent with clean typography' },
    { id: 'sketch-hand-drawn', name: 'Sketch', description: 'Preserve hand-drawn aesthetic' },
  ];

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      setError('');
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = e.dataTransfer.files[0];
    if (dropped && (dropped.name.endsWith('.excalidraw') || dropped.name.endsWith('.excalidraw.json'))) {
      setFile(dropped);
      setError('');
    } else {
      setError('Please drop an .excalidraw file');
    }
  }, []);

  const runPreview = async () => {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('scale', scale);
      if (preset) formData.append('preset', preset);
      if (styleProfile) formData.append('styleProfile', styleProfile);

      const res = await fetch('/api/preview', { method: 'POST', body: formData });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Preview failed');
      }

      const data: PreviewResult = await res.json();
      setPreview(data);
      setStep('preview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const runConvert = async () => {
    if (!file || !token || !boardId) return;
    setStep('converting');
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('token', token);
      formData.append('boardId', boardId);
      formData.append('scale', scale);
      if (preset) formData.append('preset', preset);
      if (styleProfile) formData.append('styleProfile', styleProfile);

      const res = await fetch('/api/convert', { method: 'POST', body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Conversion failed');

      setResult(data);
      setStep('result');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Conversion failed');
      setStep('preview');
    }
  };

  const buildSummaryCard = (): string => {
    if (!result) return '';
    const lines = [
      '## Excalidraw to Miro Import Summary',
      '',
      `| Metric | Count |`,
      `|--------|-------|`,
      `| Shapes & Text | ${result.itemsCreated} |`,
      `| Connectors | ${result.connectorsCreated} |`,
    ];
    if (result.framesCreated > 0) lines.push(`| Frames | ${result.framesCreated} |`);
    if (result.groupsCreated > 0) lines.push(`| Groups | ${result.groupsCreated} |`);
    if (result.imagesCreated > 0) lines.push(`| Images | ${result.imagesCreated} |`);
    if (result.freedrawConverted > 0) lines.push(`| Freedraw | ${result.freedrawConverted} |`);
    if (result.skippedElements.length > 0) lines.push(`| Skipped | ${result.skippedElements.length} |`);
    if (result.errors.length > 0) lines.push(`| Errors | ${result.errors.length} |`);
    lines.push('');
    if (result.boardUrl) lines.push(`**Board**: [Open in Miro](${result.boardUrl})`);
    if (result.skippedElements.length > 0) {
      lines.push('', '**Skipped elements:**');
      result.skippedElements.forEach((s) => lines.push(`- ${s.type} (\`${s.id}\`): ${s.reason}`));
    }
    return lines.join('\n');
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(buildSummaryCard());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const reset = () => {
    setStep('setup');
    setFile(null);
    setPreview(null);
    setResult(null);
    setError('');
    setCopied(false);
    setStyleProfile('');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <header className="mb-10">
          <h1 className="text-3xl font-bold tracking-tight">Excalidraw to Miro</h1>
          <p className="text-gray-400 mt-2">Convert your Excalidraw drawings to editable Miro board objects</p>
        </header>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-8 text-sm">
          {(['setup', 'upload', 'preview', 'result'] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={`w-8 h-px ${stepIndex(step) >= i ? 'bg-blue-500' : 'bg-gray-700'}`} />}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium ${
                stepIndex(step) > i ? 'bg-blue-600 text-white'
                : stepIndex(step) === i ? 'bg-blue-500 text-white ring-2 ring-blue-400/30'
                : 'bg-gray-800 text-gray-500'
              }`}>
                {stepIndex(step) > i ? '✓' : i + 1}
              </div>
              <span className={stepIndex(step) >= i ? 'text-gray-200' : 'text-gray-600'}>
                {s === 'setup' ? 'Connect' : s === 'upload' ? 'Upload' : s === 'preview' ? 'Preview' : 'Done'}
              </span>
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-800 rounded-lg text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Connect */}
        {step === 'setup' && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Miro API Token</label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Paste your Miro OAuth token"
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Get a token from the{' '}
                <a href="https://developers.miro.com/" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                  Miro Developer Portal
                </a>
                {' '}with <code className="text-gray-400">boards:write</code> scope
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Board ID</label>
              <input
                type="text"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                placeholder="e.g., uXjVN1234567abcd="
                className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-2">
                Find the board ID in the URL: <code className="text-gray-400">miro.com/app/board/<span className="text-blue-400">BOARD_ID</span>/</code>
              </p>
            </div>

            <button
              onClick={() => setStep('upload')}
              disabled={!token || !boardId}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
            >
              Continue
            </button>
          </div>
        )}

        {/* Step 2: Upload + Options */}
        {step === 'upload' && (
          <div className="space-y-6">
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
                file ? 'border-blue-500 bg-blue-950/20' : 'border-gray-700 hover:border-gray-500 bg-gray-900/50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".excalidraw,.json"
                onChange={handleFileSelect}
                className="hidden"
              />
              {file ? (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <p className="font-medium text-gray-200">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{(file.size / 1024).toFixed(1)} KB</p>
                </div>
              ) : (
                <div>
                  <div className="text-2xl mb-2">📁</div>
                  <p className="text-gray-300">Drop your .excalidraw file here</p>
                  <p className="text-sm text-gray-500 mt-1">or click to browse</p>
                </div>
              )}
            </div>

            {/* Preset selector */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Import Preset</label>
              <div className="grid grid-cols-2 gap-3">
                {presets.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPreset(p.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      preset === p.id
                        ? 'border-blue-500 bg-blue-950/30 text-blue-200'
                        : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">{p.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Style profile */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-3">Style Profile</label>
              <div className="grid grid-cols-2 gap-3">
                {styleProfiles.map((sp) => (
                  <button
                    key={sp.id}
                    onClick={() => setStyleProfile(sp.id)}
                    className={`p-3 rounded-lg border text-left transition-colors ${
                      styleProfile === sp.id
                        ? 'border-purple-500 bg-purple-950/30 text-purple-200'
                        : 'border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-500'
                    }`}
                  >
                    <div className="text-sm font-medium">{sp.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{sp.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Scale */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Scale</label>
              <input
                type="number"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                min="0.1"
                max="5"
                step="0.1"
                className="w-24 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep('setup')}
                className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={runPreview}
                disabled={!file || loading}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-700 disabled:text-gray-500 rounded-lg font-medium transition-colors"
              >
                {loading ? 'Analyzing...' : 'Preview Import'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-6">
            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl font-bold text-green-400">{preview.willCreate}</div>
                <div className="text-xs text-gray-400 mt-1">Will Create</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl font-bold text-yellow-400">{preview.degraded}</div>
                <div className="text-xs text-gray-400 mt-1">Degraded</div>
              </div>
              <div className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="text-2xl font-bold text-red-400">{preview.willSkip}</div>
                <div className="text-xs text-gray-400 mt-1">Will Skip</div>
              </div>
            </div>

            {/* Breakdown */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-300 mb-3">Element Breakdown</h3>
              <div className="grid grid-cols-3 gap-y-2 text-sm">
                {preview.breakdown.shapes > 0 && <><span className="text-gray-400">Shapes</span><span className="text-gray-200 col-span-2">{preview.breakdown.shapes}</span></>}
                {preview.breakdown.text > 0 && <><span className="text-gray-400">Text</span><span className="text-gray-200 col-span-2">{preview.breakdown.text}</span></>}
                {preview.breakdown.connectors > 0 && <><span className="text-gray-400">Connectors</span><span className="text-gray-200 col-span-2">{preview.breakdown.connectors}</span></>}
                {preview.breakdown.images > 0 && <><span className="text-gray-400">Images</span><span className="text-gray-200 col-span-2">{preview.breakdown.images}</span></>}
                {preview.breakdown.freedraw > 0 && <><span className="text-gray-400">Freedraw</span><span className="text-gray-200 col-span-2">{preview.breakdown.freedraw}</span></>}
                {preview.breakdown.frames > 0 && <><span className="text-gray-400">Frames</span><span className="text-gray-200 col-span-2">{preview.breakdown.frames}</span></>}
                {preview.breakdown.groups > 0 && <><span className="text-gray-400">Groups</span><span className="text-gray-200 col-span-2">{preview.breakdown.groups}</span></>}
              </div>
            </div>

            {/* Element details */}
            {(preview.elements.filter((e) => e.status === 'will_skip' || e.status === 'degraded').length > 0) && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Attention Needed</h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {preview.elements
                    .filter((e) => e.status !== 'will_create')
                    .map((el) => (
                      <div key={el.id} className="flex items-start gap-3 text-sm p-2 rounded bg-gray-800/50">
                        <span className={`mt-0.5 shrink-0 ${el.status === 'will_skip' ? 'text-red-400' : 'text-yellow-400'}`}>
                          {el.status === 'will_skip' ? '✕' : '⚠'}
                        </span>
                        <div>
                          <span className="text-gray-200">{el.type}</span>
                          <span className="text-gray-600 mx-1">→</span>
                          <span className="text-gray-400">{el.miroType}</span>
                          {el.reason && <p className="text-xs text-red-300 mt-1">{el.reason}</p>}
                          {el.fidelityNote && <p className="text-xs text-yellow-300 mt-1">{el.fidelityNote}</p>}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setStep('upload')}
                className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                Back
              </button>
              <button
                onClick={runConvert}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 rounded-lg font-medium transition-colors"
              >
                Convert to Miro
              </button>
            </div>
          </div>
        )}

        {/* Step 3.5: Converting */}
        {step === 'converting' && (
          <div className="text-center py-16">
            <div className="inline-block animate-spin text-3xl mb-4">🔄</div>
            <p className="text-gray-300 text-lg">Converting to Miro...</p>
            <p className="text-gray-500 text-sm mt-2">This may take a moment for large diagrams</p>
          </div>
        )}

        {/* Step 4: Result */}
        {step === 'result' && result && (
          <div className="space-y-6">
            <div className={`p-4 rounded-lg border ${result.success
              ? 'bg-green-900/20 border-green-800 text-green-300'
              : 'bg-yellow-900/20 border-yellow-800 text-yellow-300'
            }`}>
              {result.success ? 'Conversion complete!' : 'Conversion completed with errors'}
            </div>

            {/* Result stats */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-400">Items created</span><span className="float-right text-gray-200">{result.itemsCreated}</span></div>
                <div><span className="text-gray-400">Connectors</span><span className="float-right text-gray-200">{result.connectorsCreated}</span></div>
                {result.framesCreated > 0 && <div><span className="text-gray-400">Frames</span><span className="float-right text-gray-200">{result.framesCreated}</span></div>}
                {result.groupsCreated > 0 && <div><span className="text-gray-400">Groups</span><span className="float-right text-gray-200">{result.groupsCreated}</span></div>}
                {result.imagesCreated > 0 && <div><span className="text-gray-400">Images</span><span className="float-right text-gray-200">{result.imagesCreated}</span></div>}
                {result.freedrawConverted > 0 && <div><span className="text-gray-400">Freedraw</span><span className="float-right text-gray-200">{result.freedrawConverted}</span></div>}
                {result.skippedElements.length > 0 && <div><span className="text-gray-400">Skipped</span><span className="float-right text-yellow-400">{result.skippedElements.length}</span></div>}
              </div>
            </div>

            {/* Skipped elements */}
            {result.skippedElements.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Skipped Elements</h3>
                <div className="space-y-1 text-sm max-h-40 overflow-y-auto">
                  {result.skippedElements.map((s, i) => (
                    <div key={i} className="text-gray-400">
                      <span className="text-red-400 mr-2">✕</span>
                      {s.type}: {s.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Errors */}
            {result.errors.length > 0 && (
              <div className="bg-red-900/20 rounded-lg border border-red-800 p-4">
                <h3 className="text-sm font-medium text-red-300 mb-2">Errors</h3>
                {result.errors.map((e, i) => <p key={i} className="text-sm text-red-400">{e}</p>)}
              </div>
            )}

            {/* Cleanup suggestions */}
            {result.cleanupSuggestions && result.cleanupSuggestions.length > 0 && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                <h3 className="text-sm font-medium text-gray-300 mb-3">Cleanup Suggestions</h3>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {result.cleanupSuggestions.map((s, i) => (
                    <div key={i} className="flex items-start gap-3 text-sm p-3 rounded-lg bg-gray-800/50">
                      <span className={`mt-0.5 shrink-0 ${
                        s.severity === 'action' ? 'text-red-400'
                        : s.severity === 'warning' ? 'text-yellow-400'
                        : 'text-blue-400'
                      }`}>
                        {s.severity === 'action' ? '!' : s.severity === 'warning' ? '⚠' : 'i'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-200">{s.message}</p>
                        <p className={`text-xs mt-1 ${
                          s.severity === 'action' ? 'text-red-300'
                          : s.severity === 'warning' ? 'text-yellow-300'
                          : 'text-blue-300'
                        }`}>
                          {s.suggestion}
                        </p>
                      </div>
                      <span className="text-xs text-gray-600 shrink-0">{s.category}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              {result.boardUrl && (
                <a
                  href={result.boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-medium text-center transition-colors"
                >
                  Open in Miro
                </a>
              )}
              <button
                onClick={copySummary}
                className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                {copied ? 'Copied!' : 'Copy Summary'}
              </button>
              <button
                onClick={reset}
                className="px-6 py-3 border border-gray-700 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors"
              >
                New Import
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function stepIndex(step: Step): number {
  return { setup: 0, upload: 1, preview: 2, converting: 2, result: 3 }[step];
}
