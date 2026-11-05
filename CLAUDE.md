# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Reviews before every commit

Run `/code-review` and then `/security-review` on the changes before every commit, in every branch, however small the change. Fix what they find before committing; if a finding is dismissed, the commit message says which one and why. The pre-commit hooks stay on: never `--no-verify`.
