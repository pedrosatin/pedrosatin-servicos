---
name: delete-comment
description: >
  Delete and ratchets code comments in pedrosatin-servicos. Use when asked to
  clean comments, ban comments, run /delete-comment, update comments-baseline,
  or turn leftover excuses into scratch tickets and decisions into docs/adr.
---

# delete-comment

Remove acionável comments from this repo, record real decisions as ADRs, file
excuse tickets, and keep the comment ratchet honest.

## Scope

Versioned code under `src/`, `worker/`, `shared/`, `scripts/` (`.ts` `.tsx`
`.js` `.mjs` `.css`) plus code configs (`vite.config.ts`, `vitest.config.ts`,
`wrangler.toml`, …). Skip `node_modules`, `dist`, `graphify-out`, binary
assets, generated files, Markdown, data JSON, and `.github/` YAML.

**Keep (not “comments” for this skill):** license headers, shebang, tool
directives (`// @ts-*`, `eslint-disable` / `oxlint-disable`, `prettier-ignore`,
`/// <reference>`, `@vitest-environment`), and JSDoc that defines a public API
contract (`@param` / `@returns` / `@typedef` / …).

## Categories

| Category | Meaning | Action |
| --- | --- | --- |
| Tautology | Repeats what the code already shows | Delete |
| Stale | Refers to removed or outdated implementation | Delete |
| Excuse | Papers over a hacky implementation | Delete + scratch ticket |
| Decision Record | Important, non-obvious choice with a real trade-off | Move into an ADR, then delete |

A one-line gloss on an obvious identifier is Tautology. Related decisions share
one ADR. Do not build an ADR that is a paste of `file:line` pointers: those
lines disappear when the comment goes.

## Steps

1. **Inventory** with `node scripts/check-comments.mjs` (counts only) or by
   scanning the scope. Note exception counts kept in place.
2. **Classify** every actionable comment into the four categories.
3. **ADRs** for Decision Records: write or extend `docs/adr/NNNN-slug.md`
   (context, decision, consequences, name modules/symbols). If the decision is
   already there, only delete the comment.
4. **Excuse tickets** in the **primary** worktree
   (`git worktree list --porcelain | awk '/^worktree / { print $2; exit }'`):
   `.scratch/no-comments-YYYY-MM/issues/NN-slug.md` with `Status: needs-triage`,
   original comment, file:line at discovery, and what to fix. Same hack family
   shares one ticket. Short `.scratch/no-comments-YYYY-MM/spec.md`. `.scratch/`
   stays out of Git.
5. **Delete** Tautology / Stale / Excuse / Decision comments. Behavior unchanged;
   tests are the proof. For JSX, remove the whole `{/* … */}` (leaving `{}`
   breaks the tree).
6. **Ratchet:** `node scripts/check-comments.mjs --update` after counts drop.
   The baseline never rises. Wire stays on `npm run lint` / `npm run check`.
7. **Report** category counts, exceptions kept, ADRs, ticket paths, lines
   removed this pass, baseline remaining, and total lines shed when the
   baseline hits zero (`removed + baseline`).

## Ratchet

- Checker: `scripts/check-comments.mjs`
- Baseline: `comments-baseline.json` (per-file actionable counts)
- Fails when a file exceeds its baseline or a new file introduces comments
- `--update` rewrites only when every file is ≤ its previous count

## Done when

Actionable comments intended for this pass are gone, ADRs/tickets exist for
what they covered, `node scripts/check-comments.mjs` passes, and
`npm run check` is green for the change.
