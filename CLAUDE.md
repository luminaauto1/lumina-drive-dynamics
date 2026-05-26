# Workflow Rules

## Auto-approve (no confirmation needed)
- Edit, read, or write any file
- `git status`, `git diff`, `git log`, `git branch`
- `npm install`, `npm run` (any script)
- Any read-only command (`ls`, `cat`, `grep`, `find`)

## Always ask permission before
- `git push` (any branch)
- `git reset`, `git revert`, `git rebase`, `git push --force`
- Any `rm` or delete command
- Any command that touches the database
- Running edge function deploy commands (project is on Lovable Cloud — never deploy directly)

## Approval checkpoints
When a checkpoint requiring approval is reached: summarize what was done, what is about to happen, and what could go wrong. Wait for explicit "yes" before proceeding.
