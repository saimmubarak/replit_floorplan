import {
  type FloorplanShape,
  type ExportOptions,
  type Point,
  PLOT_SCALE,
  MM_TO_INCHES,
  A2_WIDTH_FT,
  A2_HEIGHT_FT,
} from "@shared/schema";

// ============================================
// COORDINATE CONVERSION FOR EXPORT
// ============================================

export function pixelsPerFoot(dpi: number): number {
  return dpi / PLOT_SCALE;
}

export function mmToPixels(mm: number, dpi: number): number {
  return (mm * MM_TO_INCHES) * dpi;
}

export function worldToExportPixels(
  point: Point,
  dpi: number,
  exportOrigin: Point = { x: 0, y: 0 }
): Point {
  const ppf = pixelsPerFoot(dpi);
  return {
    x: (point.x - exportOrigin.x) * ppf,
    y: (point.y - exportOrigin.y) * ppf,
  };
}

// ============================================
// EXACT DPI CALCULATIONS (as specified)
// ============================================

export const DPI_CALCULATIONS = {
  96: {
    pixelsPerFoot: 96 / 3.1,  // 30.96774193548387
    strokePx: (0.25 / 25.4) * 96,  // 0.9448818897637795
  },
  150: {
    pixelsPerFoot: 150 / 3.1,  // 48.387096774193544
    strokePx: (0.25 / 25.4) * 150,  // 1.4763779527559056
  },
  300: {
    pixelsPerFoot: 300 / 3.1,  // 96.77419354838709
    strokePx: (0.25 / 25.4) * 300,  // 2.952755905511811
  },
  600: {
    pixelsPerFoot: 600 / 3.1,  // 193.54838709677418
    strokePx: (0.25 / 25.4) * 600,  // 5.905511811023622
  },
};

// ============================================
// CANVAS EXPORT DATA
// ============================================

export interface ExportCanvasData {
  width: number;
  height: number;
  shapes: FloorplanShape[];
  includeGrid: boolean;
  includeMeasurements: boolean;
}

export function prepareExportData(
  shapes: FloorplanShape[],
  options: ExportOptions
): ExportCanvasData {
  const dpi = parseInt(options.dpi);
  const ppf = pixelsPerFoot(dpi);

  const width = A2_WIDTH_FT * ppf;
  const height = A2_HEIGHT_FT * ppf;

  return {
    width,
    height,
    shapes,
    includeGrid: options.includeGrid,
    includeMeasurements: options.includeMeasurements,
  };
}

// ============================================
// MEASUREMENT LABEL GENERATION
// ============================================

export interface MeasurementLabel {
  start: Point;
  end: Point;
  length: number;
  midpoint: Point;
  angle: number;
}

export function generateMeasurements(shape: FloorplanShape): MeasurementLabel[] {
  if (shape.vertices.length < 2 || !shape.labelVisibility) {
    return [];
  }

  const measurements: MeasurementLabel[] = [];

  for (let i = 0; i < shape.vertices.length; i++) {
    const j = (i + 1) % shape.vertices.length;
    
    if (shape.type === 'line' && i > 0) break;
    if (shape.type === 'freehand' && i >= shape.vertices.length - 1) break;

    const start = shape.vertices[i];
    const end = shape.vertices[j];
    
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };
    
    const angle = Math.atan2(dy, dx);

    measurements.push({
      start,
      end,
      length,
      midpoint,
      angle,
    });
  }

  return measurements;
}

// ============================================
// GRID GENERATION
// ============================================

export interface GridLine {
  start: Point;
  end: Point;
  type: 'vertical' | 'horizontal';
}

export function generateGridLines(
  canvasWidth: number,
  canvasHeight: number,
  gridSpacingFt: number,
  dpi: number
): GridLine[] {
  const ppf = pixelsPerFoot(dpi);
  const gridSpacingPx = gridSpacingFt * ppf;
  const lines: GridLine[] = [];

  // Vertical lines
  for (let x = 0; x <= canvasWidth; x += gridSpacingPx) {
    lines.push({
      start: { x, y: 0 },
      end: { x, y: canvasHeight },
      type: 'vertical',
    });
  }

  // Horizontal lines
  for (let y = 0; y <= canvasHeight; y += gridSpacingPx) {
    lines.push({
      start: { x: 0, y },
      end: { x: canvasWidth, y },
      type: 'horizontal',
    });
  }

  return lines;
}

// ============================================
// PDF EXPORT METADATA
// ============================================

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  creator: string;
  creationDate: Date;
}

export function createPDFMetadata(projectName: string = 'Floorplan'): PDFMetadata {
  return {
    title: projectName,
    author: 'Floorplan Wizard',
    subject: 'Architectural Floorplan',
    creator: 'Floorplan Wizard Application',
    creationDate: new Date(),
  };
}
