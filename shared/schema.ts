import { z } from "zod";

// ============================================
// COORDINATE & GEOMETRY TYPES
// ============================================

export const Point = z.object({
  x: z.number(),
  y: z.number(),
});
export type Point = z.infer<typeof Point>;

export const ViewTransform = z.object({
  panX: z.number(),
  panY: z.number(),
  zoom: z.number(),
});
export type ViewTransform = z.infer<typeof ViewTransform>;

// ============================================
// FLOORPLAN SHAPE TYPES
// ============================================

export const ShapeType = z.enum([
  'rectangle',
  'polygon',
  'line',
  'freehand',
]);
export type ShapeType = z.infer<typeof ShapeType>;

export const FloorplanShape = z.object({
  id: z.string(),
  type: ShapeType,
  vertices: z.array(Point),
  strokeMm: z.number().default(0.25),
  strokeColor: z.string().default('#000000'),
  fill: z.string().optional(),
  layer: z.string().default('default'),
  labelVisibility: z.boolean().default(true),
  lockAspect: z.boolean().default(false),
  name: z.string().optional(),
});
export type FloorplanShape = z.infer<typeof FloorplanShape>;

export const insertShapeSchema = FloorplanShape.omit({ id: true });
export type InsertShape = z.infer<typeof insertShapeSchema>;

// ============================================
// WIZARD & PROJECT TYPES
// ============================================

export const WizardStep = z.enum([
  'plot-size',
  'house-shape',
  'details',
  'export-save',
]);
export type WizardStep = z.infer<typeof WizardStep>;

export const FloorplanProject = z.object({
  id: z.string(),
  name: z.string(),
  currentStep: WizardStep,
  shapes: z.array(FloorplanShape),
  viewTransform: ViewTransform,
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FloorplanProject = z.infer<typeof FloorplanProject>;

export const insertProjectSchema = FloorplanProject.omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});
export type InsertProject = z.infer<typeof insertProjectSchema>;

// ============================================
// TOOL & INTERACTION TYPES
// ============================================

export const ToolType = z.enum([
  'select',
  'line',
  'rectangle',
  'polygon',
  'freehand',
  'pan',
]);
export type ToolType = z.infer<typeof ToolType>;

export const HandleType = z.enum([
  'nw', 'n', 'ne',
  'e',
  'se', 's', 'sw',
  'w',
  'center',
  'rotate',
]);
export type HandleType = z.infer<typeof HandleType>;

export const TransformMode = z.enum([
  'translate',
  'scale-axis',
  'corner-drag',
  'rotate',
]);
export type TransformMode = z.infer<typeof TransformMode>;

export const TransformSession = z.object({
  mode: TransformMode,
  shapeId: z.string(),
  handleType: HandleType,
  anchor: Point,
  initialVertices: z.array(Point),
  modifiers: z.object({
    shift: z.boolean(),
    alt: z.boolean(),
    ctrl: z.boolean(),
  }),
});
export type TransformSession = z.infer<typeof TransformSession>;

// ============================================
// UNDO/REDO COMMAND TYPES
// ============================================

export const Command = z.object({
  type: z.enum(['create', 'update', 'delete', 'transform']),
  shapeId: z.string(),
  before: FloorplanShape.optional(),
  after: FloorplanShape.optional(),
  timestamp: z.string(),
});
export type Command = z.infer<typeof Command>;

// ============================================
// EXPORT TYPES
// ============================================

export const ExportFormat = z.enum(['png', 'pdf']);
export type ExportFormat = z.infer<typeof ExportFormat>;

export const ExportDPI = z.enum(['96', '150', '300', '600']);
export type ExportDPI = z.infer<typeof ExportDPI>;

export const ExportOptions = z.object({
  format: ExportFormat,
  dpi: ExportDPI,
  includeGrid: z.boolean().default(false),
  includeMeasurements: z.boolean().default(true),
});
export type ExportOptions = z.infer<typeof ExportOptions>;

// ============================================
// CONSTANTS
// ============================================

export const PLOT_SCALE = 3.1;
export const DEFAULT_EDITING_DPI = 96;
export const SNAP_THRESHOLD_FT = 0.5;
export const GRID_SPACING_FT = 1;
export const MM_TO_INCHES = 1 / 25.4;

// A2 dimensions in feet (16.54" x 23.39" = 1.378ft x 1.949ft)
export const A2_WIDTH_FT = 23.39 / 12;
export const A2_HEIGHT_FT = 16.54 / 12;

// Preset plot sizes (1 Kanal = 5445 sq ft, typically 90ft x 60.5ft)
export const PRESET_PLOTS = {
  '1-kanal': { width: 90, height: 60.5, name: '1 Kanal' },
  '2-kanal': { width: 127.3, height: 85.5, name: '2 Kanal' },
  '10-marla': { width: 75, height: 50.4, name: '10 Marla' },
  'custom': { width: 50, height: 50, name: 'Custom' },
};
