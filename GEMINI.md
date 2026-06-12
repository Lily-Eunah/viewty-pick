# Secret and Token Handling Rules

Project-level security guidance added for Gemini/agent workflows.

## Secret and Token Handling Rules

* Never print, echo, summarize, or reveal secrets or tokens.
* Never embed GitHub PATs in remote URLs.
* Never run commands like:
  `git remote set-url origin https://<TOKEN>@github.com/...`
* Never store PATs in scripts, scratch files, logs, `.git/config`, `.env`, or documentation.
* Never ask the user to paste a PAT into chat.
* Prefer existing local authentication:
  * `gh auth status`
  * `gh auth login`
  * Git Credential Manager
  * SSH remote URLs
* If authentication is missing, stop and ask the user to authenticate locally outside the chat.
* Before push/PR/API work, verify:
  * `git remote -v` contains no token
  * `.git/config` contains no token
  * repository files contain no `github_pat`
  * git history contains no token traces
* When scanning for secrets, report paths only and never matching secret contents.
* If a token is ever exposed, immediately instruct the user to revoke it and clean local traces.

## Safe Push and PR Workflow

1. Check:
   ```bash
   git status --short
   git remote -v
   gh auth status
   ```
2. If authenticated safely, proceed with push/PR.
3. If not authenticated, stop and ask the user to run:
   ```bash
   gh auth login
   ```
   or configure SSH:
   ```bash
   git remote set-url origin git@github.com:Lily-Eunah/viewty-pick.git
   ```
4. Do not handle PATs directly.
