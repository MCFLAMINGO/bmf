# Contributing to BMF

Thanks for helping shape a durable standard.

## Where to start

- **Bugs / clarifications** in the spec → open an issue tagged `spec`.
- **SDK bugs or feature requests** → open an issue tagged `sdk`.
- **New capability proposals** → open an issue tagged `capability`, describe the bone/topology preconditions and the runtime behavior enabled. Include a reference GLB.
- **PRs** → small and focused. Include tests where behavior changes.

## Spec-change process

1. Open an RFC issue describing motivation, spec delta, and back-compat plan.
2. Iterate in the issue thread.
3. Small edits → PR against `spec/SPEC.md` with a bump to `CHANGELOG.md`.
4. Breaking changes → new spec version (`0.2.0`), with a migration note.

## SDK conventions

- Zero optional deps. Add a dependency only when it materially reduces attack surface (e.g. `@noble/ed25519` for Ed25519).
- Public API is `export` from `src/index.ts`. No default exports.
- Every public function has a JSDoc block explaining inputs, outputs, and failure modes.

## License

By contributing you agree your work is licensed Apache-2.0 (see `LICENSE`).
