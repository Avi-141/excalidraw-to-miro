# excalidraw-to-miro

Convert Excalidraw drawings to editable Miro board objects via the Miro REST API.

## Demo

**Excalidraw (input)**

![Excalidraw input](assets/demo-excalidraw.png)

**Miro (output)**

![Miro output](assets/demo-miro.png)

Shapes, colors, text, connectors, and layout are preserved. Text inside shapes is automatically merged into shape content rather than created as separate overlapping items.

## Features

- **Shapes**: Rectangles, ellipses, and diamonds become editable Miro shapes
- **Text**: Standalone text and text bound to shapes
- **Connectors**: Arrows and lines become Miro connectors with proper endpoint binding
- **Images**: Embedded images are extracted and uploaded to Miro
- **Freedraw**: Hand-drawn strokes are converted to SVG and uploaded as images
- **Frames**: Excalidraw frames become Miro frames with children properly attached
- **Styles**: Stroke colors, fill colors, border styles, and opacity
- **Auto-centering**: Content is automatically centered on the Miro board
- **Smart snapping**: Unbound arrow endpoints snap to nearby shapes

## Installation

```bash
npm install
npm run build
```

Or for development:

```bash
npm install
npm run dev -- --help
```

## Prerequisites

### 1. Get a Miro OAuth Token

1. Go to [Miro Developer Portal](https://developers.miro.com/)
2. Create a new app or use an existing one
3. Add the `boards:write` scope
4. Generate an access token

### 2. Get Your Board ID

The board ID is in the URL when viewing a board:
```
https://miro.com/app/board/uXjVN1234567=/
                          ^^^^^^^^^^^^^^^ this is the board ID
```

## Usage

### CLI

```bash
# Basic usage
excal2miro --in drawing.excalidraw --board uXjVN1234567= --token YOUR_TOKEN

# With options
excal2miro \
  --in drawing.excalidraw \
  --board uXjVN1234567= \
  --token YOUR_TOKEN \
  --scale 1.5 \
  --verbose

# Using environment variable for token
export MIRO_TOKEN=YOUR_TOKEN
excal2miro --in drawing.excalidraw --board uXjVN1234567=

# Disable specific features
excal2miro --in drawing.excalidraw --board uXjVN1234567= \
  --no-images --no-freedraw --no-frames
```

### Options

| Option | Description | Default |
|--------|-------------|---------|
| `-i, --in <path>` | Path to Excalidraw file (required) | - |
| `-b, --board <id>` | Miro board ID (required) | - |
| `-t, --token <token>` | Miro OAuth token (or use `MIRO_TOKEN` env) | - |
| `-s, --scale <number>` | Scale factor for coordinates | `1` |
| `--offset-x <number>` | X offset on Miro board | `0` (auto-center) |
| `--offset-y <number>` | Y offset on Miro board | `0` (auto-center) |
| `--snap-threshold <number>` | Distance for snapping arrows to shapes | `50` |
| `--no-connectors` | Skip creating connectors from arrows | `false` |
| `--no-images` | Skip converting embedded images | `false` |
| `--no-freedraw` | Skip converting freedraw to SVG | `false` |
| `--skip-freedraw` | Skip freedraw elements silently | `false` |
| `--no-frames` | Skip converting frames | `false` |
| `-v, --verbose` | Enable verbose logging | `false` |

### Programmatic API

```typescript
import { Converter } from 'excalidraw-to-miro';

const converter = new Converter({
  miroToken: 'YOUR_TOKEN',
  boardId: 'YOUR_BOARD_ID',
  options: {
    scale: 1,
    convertImages: true,
    convertFreedraw: true,
    convertFrames: true,
    verbose: true,
  },
});

const result = await converter.convert('drawing.excalidraw');

console.log(`Items created: ${result.itemsCreated}`);
console.log(`Connectors created: ${result.connectorsCreated}`);
console.log(`Frames created: ${result.framesCreated}`);
console.log(`Images uploaded: ${result.imagesCreated}`);
console.log(`Freedraw converted: ${result.freedrawConverted}`);
```

## Element Mapping

| Excalidraw | Miro |
|------------|------|
| `rectangle` | Shape (rectangle or round_rectangle) |
| `ellipse` | Shape (circle) |
| `diamond` | Shape (rhombus) |
| `text` | Text item (or merged into parent shape) |
I| `arrow` | Connector |
| `line` | Connector |
| `freedraw` | Image (SVG conversion) |
| `image` | Image (uploaded from embedded data) |
| `frame` | Frame (with children attached) |

## Text Handling

Text elements are handled intelligently:

- **Text inside shapes**: If a standalone text element's center falls within a shape's bounds, it is merged into the shape's content rather than created as a separate overlapping text item. Multiple texts in the same shape are joined with line breaks, ordered top-to-bottom.
- **Bound text**: Text with a `containerId` is automatically included in the parent shape (standard Excalidraw binding).
- **Standalone text**: Text that doesn't overlap any shape is created as a separate Miro text item.

### Font Mapping

| Excalidraw | Miro |
|------------|------|
| Virgil (hand-drawn, `1`) | `caveat` |
| Helvetica (`2`) | `arial` |
| Cascadia (code, `3`) | `roboto_mono` |
| Liberation Sans (`4`) | `arial` |

## Image Support

Embedded images in `.excalidraw` files are automatically extracted, decoded from base64, and uploaded to Miro via the image API. Limitations:

- Maximum upload size is 6 MB per image (Miro API limit)
- Images must have `status: "saved"` in the Excalidraw file
- The `scale` property on images is applied to the output dimensions

## Freedraw Conversion

Freedraw (hand-drawn) elements are converted to SVG paths and uploaded as images:

- Points are smoothed using quadratic bezier curves for natural-looking strokes
- Paths with 500+ points are simplified using Douglas-Peucker decimation
- Stroke color, width, style (dashed/dotted), and opacity are preserved
- Use `--no-freedraw` to disable this and skip freedraw elements

## Frame Support

Excalidraw frames are converted to Miro frames:

- Frames are created first, then child items are attached via the Miro API
- Children are identified by their `frameId` property in the Excalidraw data
- Frame title/name is preserved
- Miro frames don't support rotation; rotated frames are created without rotation

**Note**: Excalidraw `groupIds` (visual selection groups) are not converted, as Miro has no equivalent REST API concept. Only frames are mapped.

## Connector Behavior

Connectors (arrows/lines) are handled as follows:

1. **Bound arrows**: If an arrow is bound to shapes in Excalidraw, the connector attaches to those Miro items
2. **Unbound arrows**: Endpoints snap to the nearest shape within the snap threshold
3. **Unresolvable arrows**: If either endpoint can't be matched to a shape, the connector is skipped (Miro requires both endpoints to reference board items)
4. **Self-referencing**: Arrows where both endpoints resolve to the same shape are skipped

### Arrowhead Mapping

| Excalidraw | Miro |
|------------|------|
| `arrow` | `arrow` |
| `triangle` | `filled_triangle` |
| `bar` | `stealth` |
| `dot` | `filled_oval` |
| `null` | `none` |

## Conversion Phases

The converter processes elements in a specific order to maintain references:

1. **Phase 0**: Create frames (so children can be attached later)
2. **Phase 1**: Create shapes, text, images, and freedraw SVGs
3. **Phase 1d**: Attach child items to their parent frames
4. **Phase 2**: Create connectors (which reference shapes by Miro ID)

## Coordinate System

- Excalidraw uses top-left origin with Y increasing downward
- Miro uses center-based positioning for shapes
- By default, content is auto-centered at (0, 0) on the Miro board
- Use `--offset-x` and `--offset-y` to position content elsewhere

## Rate Limiting

The converter includes a 100ms delay between API calls to respect Miro's rate limits. For large drawings, the conversion may take some time.

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run in development mode
npm run dev -- --in test.excalidraw --board BOARD_ID --token TOKEN

# Run tests
npm test
```

## Project Structure

```
src/
├── api/                 # Miro API client
│   └── miro-client.ts
├── converter/           # Main conversion orchestrator
│   └── converter.ts
├── mappers/             # Element type mappers
│   ├── shape-mapper.ts
│   ├── text-mapper.ts
│   ├── connector-mapper.ts
│   ├── image-mapper.ts
│   ├── freedraw-mapper.ts
│   ├── frame-mapper.ts
│   ├── style-mapper.ts
│   └── coordinate-transformer.ts
├── parser/              # Excalidraw JSON parser
│   └── excalidraw-parser.ts
├── types/               # TypeScript types
│   ├── excalidraw.ts
│   └── miro.ts
├── cli.ts               # CLI entry point
└── index.ts             # Library exports
```

## License

MIT
