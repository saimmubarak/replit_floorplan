# Floorplan Wizard

## Overview

This is a single-page application (SPA) for creating architectural floorplans through a wizard-based interface. The application allows users to draw plot boundaries, create house shapes, add details, and export professional-quality plans at various DPI settings. It's designed as a precision CAD tool with a focus on clarity, efficiency, and technical accuracy.

The wizard guides users through four steps: Plot Size, House Shape, Details, and Export/Save. All measurements are stored in feet (world units) and displayed with decimal precision. The application supports multiple drawing tools (line, rectangle, polygon, freehand), precise transformations with snapping, and exports to PNG/PDF at configurable DPI levels (96, 150, 300, 600 DPI) with exact 0.25mm stroke rendering.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:**
- React with TypeScript for the UI layer
- Vite as the build tool and development server
- Wouter for client-side routing
- TanStack Query (React Query) for server state management
- Shadcn UI components built on Radix UI primitives
- Tailwind CSS for styling with custom design tokens

**Design System:**
- Hybrid approach combining Fluent Design and Apple HIG principles
- Typography: Inter for UI (legibility at small sizes), JetBrains Mono for measurements
- Spacing system based on Tailwind units (1, 2, 4, 6, 8, 12, 16)
- Custom color system using HSL values with CSS variables for theming
- Professional technical aesthetic appropriate for architectural/CAD work

**Component Architecture:**
- Wizard-based flow with step progression (WizardSteps component)
- Panel-based layout: left sidebar for tools, center canvas, right properties panel
- Specialized panels: PlotSizePanel for initial setup, PropertiesPanel for object editing
- Canvas renderer (FloorplanCanvas) handling coordinate transformations and drawing
- Toolbar component with drawing tools, view controls, and action buttons
- Export dialog with DPI and format configuration

**State Management:**
- Local component state for UI interactions (useState)
- TanStack Query for server data synchronization
- Custom hooks (useFloorplanProject) for data operations
- Shape state managed in parent component and passed down
- ViewTransform state for pan/zoom operations
- Command history for undo/redo functionality

### Backend Architecture

**Server Framework:**
- Express.js with TypeScript
- ESM module system
- Custom Vite middleware integration for development

**API Design:**
- RESTful endpoints under `/api/projects`
- CRUD operations: GET (all/single), POST (create), PATCH (update), DELETE
- Export preparation endpoint with DPI calculations
- JSON request/response format
- Zod validation for request data

**Business Logic:**
- Export engine with precise coordinate transformations (world units → export pixels)
- DPI-specific calculations for stroke width (0.25mm converted to pixels)
- Transform math for handle-based scaling and manipulation
- Storage abstraction layer (IStorage interface)
- Coordinate conversion utilities (world ↔ canvas ↔ export)

**Data Model:**
- FloorplanProject: Top-level project with metadata (id, name, timestamps)
- FloorplanShape: Geometric shapes with vertices, stroke properties, layers
- Point: Simple x/y coordinate pairs
- ViewTransform: Pan/zoom state (panX, panY, zoom)
- Standardized constants: PLOT_SCALE (3.1 ft/inch), A2 dimensions, grid spacing

### Data Storage

**Current Implementation:**
- In-memory storage (MemStorage class implementing IStorage interface)
- Maps for O(1) project lookups by ID
- UUID generation for project IDs
- Automatic timestamp management (createdAt, updatedAt)

**Schema Design (Drizzle ORM Ready):**
- Database configuration points to PostgreSQL via DATABASE_URL
- Migrations directory structure in place
- Schema defined in shared/schema.ts using Zod
- Drizzle-zod integration for type-safe validation
- Ready for migration to persistent database (Neon PostgreSQL configured)

**Data Flow:**
- Client → API → Storage abstraction → In-memory Map
- Designed for easy swap to database implementation
- Shape data stored as JSON (vertices arrays)
- No sessions or authentication currently implemented

### Coordinate Systems

**Three Coordinate Spaces:**

1. **World Coordinates (feet):** Physical measurements, stored in database
   - Plot boundaries, shape vertices, all geometry
   - Example: 50ft × 40ft plot

2. **Canvas Coordinates (screen pixels):** For editing view
   - Transformed using pixelsPerFoot × zoom + pan offset
   - Enables pan/zoom interactions
   - DPI: 96 (DEFAULT_EDITING_DPI)

3. **Export Coordinates (pixels):** For high-DPI output
   - Calculated per target DPI (96/150/300/600)
   - Exact formulas: pixelsPerFoot = DPI / 3.1, strokePx = (0.25mm / 25.4) × DPI
   - Maintains physical accuracy across resolutions

**Conversion Functions:**
- `worldToCanvas`: Applies view transform for editing
- `canvasToWorld`: Inverse for mouse interactions
- `worldToExport`: DPI-specific for file generation
- `mmToPixels`: Stroke width conversion
- `pixelsPerFoot`: Core scaling calculation

### Drawing Tools

**Tool Types:**
- Select: Object selection and manipulation
- Line: Two-point line segments
- Rectangle: Click-drag rectangle creation
- Polygon: Multi-point closed shapes
- Freehand: Continuous drawing path
- Pan: Canvas navigation (space key toggle)

**Interaction Features:**
- Grid snapping with configurable threshold (SNAP_THRESHOLD_FT = 0.5ft)
- Transform handles for scaling (n, s, e, w, ne, nw, se, sw)
- Symmetric scaling with modifier keys
- Live measurement labels on segments
- Undo/redo command history

## External Dependencies

### Third-Party UI Libraries
- **Radix UI:** Unstyled, accessible component primitives (dialogs, dropdowns, tooltips, etc.)
- **Shadcn UI:** Pre-built components using Radix primitives with Tailwind styling
- **Lucide React:** Icon library for consistent iconography
- **class-variance-authority & clsx:** Conditional className utilities
- **cmdk:** Command menu component

### Database & ORM
- **Drizzle ORM:** Type-safe SQL query builder configured for PostgreSQL
- **@neondatabase/serverless:** Neon PostgreSQL driver for serverless environments
- **drizzle-zod:** Zod schema integration for validation
- **drizzle-kit:** CLI for migrations and schema management

### State Management & Data Fetching
- **TanStack React Query:** Server state synchronization, caching, and mutations
- **Zod:** Runtime type validation and schema definition

### Development Tools
- **Vite:** Fast build tool and dev server with HMR
- **TypeScript:** Static typing across frontend and backend
- **ESBuild:** Production bundling for server code
- **tsx:** TypeScript execution for development
- **@replit/vite-plugin-*:** Replit-specific development plugins (error overlay, cartographer, dev banner)

### Styling & Fonts
- **Tailwind CSS:** Utility-first CSS framework
- **PostCSS & Autoprefixer:** CSS processing
- **Google Fonts:** Inter (UI text), JetBrains Mono (measurements)

### Utilities
- **nanoid:** Unique ID generation
- **date-fns:** Date formatting and manipulation
- **React Hook Form:** Form state management (configured with resolvers)
- **Wouter:** Lightweight routing library
- **embla-carousel-react:** Carousel components

### Database Connection
- **PostgreSQL (Neon):** Configured via DATABASE_URL environment variable
- **connect-pg-simple:** PostgreSQL session store (prepared for session management)

### Export Capabilities
- Canvas-based rendering for PNG export
- PDF generation support (format specified in ExportOptions)
- DPI-specific calculations ensuring physical accuracy
- Configurable options: grid visibility, measurement labels