# AI Rules for Películas Brasil App

## Tech Stack Overview

- **React 19** with TypeScript for the UI framework
- **Tailwind CSS** for all styling (utility-first approach)
- **IndexedDB** for client-side data persistence (via custom `db.ts` service)
- **jsPDF** with autotable plugin for PDF generation
- **Font Awesome** for icons (CDN-loaded)
- **Google Fonts** (Roboto & Montserrat) for typography
- **Google Gemini AI** for intelligent features (optional, user-configured)
- **Vite** as the build tool and dev server
- **No routing library** - single-page app with tab-based navigation

## Core Architecture Rules

### State Management
- Use React's built-in `useState` and `useEffect` hooks
- NO external state management libraries (Redux, Zustand, etc.)
- Keep state as local as possible, lift only when necessary
- Use `useMemo` and `useCallback` for performance optimization

### Data Persistence
- ALL data operations MUST go through `services/db.ts` (which re-exports `offlineFirstDb.ts`)
- **Primary storage**: Supabase (PostgreSQL) for persistent cloud storage
- **Offline cache**: IndexedDB for local caching and offline support
- The `offlineFirstDb.ts` handles the offline-first logic automatically
- When offline, data is saved to IndexedDB and synced when back online
- `syncService.ts` manages automatic synchronization
- Data is auto-saved after 1.5 seconds of inactivity


### Styling
- ONLY use Tailwind CSS utility classes
- NO custom CSS files (except for animations in `<style jsx>` blocks)
- NO inline styles except for dynamic values (colors, transforms, positions)
- Use Tailwind's responsive prefixes (`sm:`, `md:`, etc.) for responsive design
- Mobile-first approach: design for mobile, then add desktop enhancements

### Component Structure
- Keep components small and focused (ideally < 200 lines)
- Use `React.memo()` for expensive list items
- Put modals in `components/modals/`
- Put views (tab content) in `components/views/`
- Put reusable UI elements in `components/ui/`

### File Organization
- Source code in `src/` folder
- Pages go in `src/pages/` (currently only Index.tsx)
- Services in `src/services/`
- Types in `types.ts` at root
- Constants in `constants.ts` at root

## Library Usage Rules

### Icons
- Use Font Awesome classes: `<i className="fas fa-icon-name"></i>`
- Never import icon libraries - they're loaded via CDN

### PDF Generation
- Use jsPDF for all PDF operations
- Access via global `jspdf` object: `const { jsPDF } = jspdf;`
- Use autotable plugin for tables: `doc.autoTable({ ... })`
- Generate PDFs in `services/pdfGenerator.ts`

### Forms & Inputs
- Use the custom `Input` component from `components/ui/Input.tsx`
- For color selection, use `ColorPicker` component
- For searchable dropdowns, use `SearchableSelect` component
- For dynamic text/select, use `DynamicSelector` component

### Modals
- Use the base `Modal` component from `components/ui/Modal.tsx`
- All modals should have a footer with action buttons
- Close modals on backdrop click (handled by Modal component)

### Mobile Interactions
- Use touch events for swipe gestures (see MeasurementGroup, FilmListItem)
- Implement rubber-band effect for over-scroll
- Use `touchAction: 'pan-y'` to prevent horizontal scroll interference
- Add haptic feedback with `navigator.vibrate(10)` for button presses

## Coding Conventions

### TypeScript
- Define all types in `types.ts`
- Use interfaces for object shapes
- Use type unions for variants (e.g., `'pending' | 'approved' | 'revised'`)
- Avoid `any` - use proper typing

### Naming
- Components: PascalCase (e.g., `ClientModal`)
- Functions: camelCase (e.g., `handleSubmit`)
- Constants: UPPER_SNAKE_CASE (e.g., `AMBIENTES`)
- Files: PascalCase for components, camelCase for utilities

### Event Handlers
- Prefix with `handle`: `handleClick`, `handleSubmit`, `handleChange`
- Use arrow functions for inline handlers
- Prevent default and stop propagation when needed

### Accessibility
- Always include `aria-label` for icon-only buttons
- Use semantic HTML (`<button>`, `<label>`, etc.)
- Ensure keyboard navigation works (Tab, Enter, Escape)
- Add `role` attributes where appropriate

## Feature-Specific Rules

### Numpad
- Custom numpad for numeric input (mobile-optimized)
- Auto-advance after entering width/height in format `X.XX`
- Support for decimal separator (comma in Portuguese)
- Vibration feedback on button press

### PDF Generation
- Always save PDFs to IndexedDB before downloading
- Include company logo, colors, and signature if configured
- Format currency as Brazilian Real (R$)
- Use Portuguese date format (DD/MM/YYYY)

### Client Management
- Auto-fetch address from ViaCEP API when CEP is entered
- Support reverse lookup (address → CEP)
- Apply phone mask: `(XX) XXXXX-XXXX`
- Apply CPF/CNPJ mask automatically

### Measurements
- Support drag-and-drop reordering (desktop)
- Support swipe gestures for actions (mobile)
- Auto-save after 1.5 seconds of inactivity
- Calculate m² as: width × height × quantity

### Appointments (Agenda)
- Validate against working hours and days
- Prevent double-booking (max = number of employees)
- Support export to .ics calendar format
- Link appointments to PDFs when applicable

## AI Integration (Optional)

### Google Gemini
- API key stored in `userInfo.aiConfig.apiKey`
- Used for route optimization in appointment scheduling
- Structured output with JSON schema validation
- Graceful degradation if API key not configured

## Performance Guidelines

- Use `React.memo()` for list items that re-render frequently
- Debounce search inputs (300ms)
- Lazy load views with `React.lazy()` and `Suspense`
- Optimize images (compress logos, use appropriate formats)
- Minimize re-renders with `useCallback` and `useMemo`

## Error Handling

- Show user-friendly error messages (Portuguese)
- Log errors to console for debugging
- Validate user input before processing
- Handle API failures gracefully (ViaCEP, Gemini)

## Localization

- All text in Brazilian Portuguese
- Currency: Brazilian Real (R$)
- Date format: DD/MM/YYYY
- Number format: Use comma for decimals (1,50 instead of 1.50)
- Phone format: (XX) XXXXX-XXXX

## DO NOT

- ❌ Add new npm dependencies without explicit approval
- ❌ Use CSS-in-JS libraries (styled-components, emotion, etc.)
- ❌ Use component libraries (Material-UI, Ant Design, etc.)
- ❌ Add routing libraries (React Router is mentioned but not used)
- ❌ Use global state management (Redux, MobX, etc.)
- ❌ Write custom CSS files (use Tailwind only)
- ❌ Use class components (functional components only)
- ❌ Mutate state directly (always use setState)

## DO

- ✅ Use Tailwind utility classes for all styling
- ✅ Keep components small and focused
- ✅ Use TypeScript for type safety
- ✅ Follow the existing code patterns
- ✅ Test on both mobile and desktop
- ✅ Ensure accessibility (keyboard nav, ARIA labels)
- ✅ Use the existing UI components (Input, Modal, etc.)
- ✅ Handle errors gracefully with user-friendly messages