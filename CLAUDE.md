# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

指标管理平台 (MetricBase DW) - A data warehouse metrics management platform built with React, TypeScript, and Vite. The application provides DWD layer configuration, metrics management, and model building for data warehouse operations.

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- **Frontend**: React 18, TypeScript, React Router v7
- **Build Tool**: Vite 6 with `@vitejs/plugin-react`
- **Styling**: Tailwind CSS v4 with CSS-based configuration (`@import 'tailwindcss'`)
- **UI Components**: shadcn/ui pattern using Radix UI primitives + `class-variance-authority`
- **Icons**: Lucide React
- **Backend**: Supabase Edge Functions using Hono framework (Deno runtime)

## Project Structure

```
src/
├── main.tsx              # Entry point - mounts React app
├── app/
│   ├── App.tsx           # Root component with RouterProvider
│   ├── routes.tsx        # React Router route definitions
│   ├── components/
│   │   ├── Layout.tsx    # Main layout with sidebar navigation
│   │   ├── Modal.tsx     # Reusable modal component
│   │   ├── figma/        # Figma-specific components
│   │   └── ui/           # 40+ shadcn/ui components (button, card, dialog, etc.)
│   └── views/
│       ├── Dashboard.tsx
│       ├── Dimensions.tsx    # DWD dimension management
│       ├── FactTables.tsx    # Fact table management
│       ├── Metrics.tsx       # Metrics configuration
│       └── ModelBuilder.tsx  # Model building interface
├── styles/
│   ├── index.css         # Main stylesheet (imports fonts, tailwind, theme)
│   ├── tailwind.css      # Tailwind v4 imports with @source
│   ├── theme.css         # CSS variables for theming
│   └── fonts.css         # Custom font definitions

supabase/functions/server/  # Edge Functions
├── index.tsx             # Hono app with CORS setup
└── kv_store.tsx          # Supabase KV store interface
```

## Key Architectural Patterns

### Vite Configuration
- `@` alias maps to `./src` directory
- Custom `figma:asset/` resolver for Figma assets
- Supports raw imports for `.svg` and `.csv` files
- React and Tailwind plugins are required and must not be removed

### UI Component Pattern
Components follow the shadcn/ui pattern:
```typescript
// Uses class-variance-authority for variants
const buttonVariants = cva("base classes", {
  variants: { variant: { default: "...", destructive: "..." } },
});

// Uses cn() utility for class merging (from ./utils.ts)
import { cn } from "./utils";
className={cn(buttonVariants({ variant }), className)}
```

### Styling Architecture
- Tailwind CSS v4 uses CSS-based configuration (no `tailwind.config.js`)
- Theme variables defined in `theme.css` using CSS custom properties
- Dark mode supported via `.dark` class
- Utility: `cn()` from `clsx` + `tailwind-merge` for conditional classes

### Routing
- React Router v7 with `createBrowserRouter`
- Layout component wraps all routes with sidebar navigation
- Routes: `/` (Dashboard), `/dimensions`, `/fact-tables`, `/metrics`, `/model-builder`

### Backend (Supabase Edge Functions)
- Uses Hono framework for routing and middleware
- KV store interface in `kv_store.tsx` for simple data persistence
- CORS enabled for all routes
- Health check endpoint: `/make-server-7b7e4046/health`

## File Conventions

- TypeScript/React files use `.tsx` extension
- Components are exported as named exports (e.g., `export function Layout()`)
- View components are default exports
- UI components use `data-slot` attribute for styling hooks
- CSS imports: `@import './file.css'` in `index.css`

## Important Notes

- This is a Figma Make-generated project with shadcn/ui components
- Peer dependencies: React 18.3.1, React DOM 18.3.1
- Package manager: pnpm (configured via `pnpm.overrides`)
- Never add `.css`, `.tsx`, or `.ts` to Vite's `assetsInclude` config
