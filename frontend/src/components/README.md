# Shared UI kit

Screen tickets compose these pieces. Do not add a second sheet, toast, search, or confirm.

| Piece | Import | Motion |
| --- | --- | --- |
| Bottom sheet | `@/components/ui/sheet` (`Sheet`, `SheetContent side="bottom"`) | 800ms up, 700ms down, 55% dim over 450ms, drag-dismiss 120px, 16px top radius, grab handle |
| Toast | `@/components/ui/sonner` (`toast`, `Toaster`) | 700ms in, 600ms out, 20px travel, 2800ms stay, 12px radius. No undo |
| Search card | `@/components/ui/search-card` | 700ms open / 600ms close from 96% scale. Results belong to the search screen |
| Confirm | `@/components/ui/confirm-dialog` | 400ms from 92% scale, 62% dim, 16px radius, danger confirm |
| Amber press | default `@/components/ui/button` | 4% scale-down, 120ms in, 200ms out |
| Screen change | `AppShell` | 400ms crossfade when the pathname changes (tabs and opening a film) |
| Rolling number | `@/components/ui/cue-number` | NumberFlow, 400ms. Reduced motion shows the settled figure |
| Synopsis More | `@/components/ui/reveal` | 300ms height and fade |
| Infinite scroll | `@/hooks/use-infinite-scroll` plus `@/components/ui/infinite-scroll` (`InfiniteBatch`, `LoadingMore`) | Next page at 600px while `pagination.has_more`. Page size is an argument: watchlist 18, history 10. Batch fade 300ms, 30ms stagger. Flat teal “Loading more”, no glow |

`useReducedMotion()` (`@/hooks/use-reduced-motion`) and `frontend/src/lib/motion.ts` are the contract. Reduced motion is a 300ms fade or an instant settle: no travel, scale, or glow. Timings follow the CSS variables in `frontend/src/styles/tokens.css`.

Vaul's dialog and Radix Select must share one copy of `@radix-ui/react-focus-scope` and `@radix-ui/react-dismissable-layer`. The `overrides` in `frontend/package.json` pin those (and focus guards) so a select opened from a sheet is the top layer instead of a second focus trap.
