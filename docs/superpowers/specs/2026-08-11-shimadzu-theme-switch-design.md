# Shimadzu Theme Switch Design

## Scope

Remove the hero workflow subtitle and add a light/dark theme switch to the Shimadzu GC–MS analysis workbench. Preserve the existing data-control-deck layout, copy outside the removed subtitle, account access, task desk, downloads, monitoring, analysis behavior, Worker/API/Supabase integration, and output contracts.

## Theme behavior

- The first visit uses the existing dark theme.
- The topbar contains one compact theme button immediately before “返回首页”.
- The button label describes the action: dark mode shows “切换浅色”, light mode shows “切换深色”.
- The button exposes `aria-pressed`, a descriptive `aria-label`, and a sun or moon icon.
- The selected theme is stored under `shimadzu-analysis-theme` in `localStorage` and restored on the next visit.
- If storage is unavailable, the workbench still switches theme for the current page without interrupting analysis.

## Visual direction

Dark mode remains unchanged. Light mode is composed as a scientific control surface rather than an inverted dark palette: cool gray canvas, white and pale-blue surfaces, navy text, restrained blue actions, teal telemetry, green success, amber review, and red failure. The live monitor remains the deepest evidence surface for log readability while surrounding tool panels become light.

## Acceptance criteria

1. The text “原始峰表 → 化合物筛查 → 平行补建 → 半定量 → 统计与作图矩阵” is absent from the rendered source.
2. Theme choice persists through `localStorage` with dark fallback.
3. The root exposes the active theme to CSS through `data-theme`.
4. Both themes preserve visible focus, semantic status cues, responsive layout and reduced-motion behavior.
5. No scientific calculation or backend contract changes.
