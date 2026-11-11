# JARVIS — ChatGPT Plus mode (experimental)

This fork adds an **optional, read-only ChatGPT/Codex bridge** to the original
JARVIS React/Three.js voice interface. The original Claude Code mode is left
intact. The Codex SDK reuses the local **Sign in with ChatGPT** login, so it
does **not** require a separately billed OpenAI API key.

**Scope:** basic spoken questions and answers, conversation continuity, wake
word, original visual interface and system/browser speech. The original Claude
MCP integrations, computer control, images, camera analysis and rich HUD authoring
are **not** ported. Do not enable action-taking for this prototype.

## Mac setup (no system-wide installation without permission)

1. Open Terminal in the **parent folder** where you want a new jarvis folder.
2. Run the following (if the clone is not already there):

       git clone --branch chatgpt-plus-codex-bridge https://github.com/samaritapogula/jarvis.git
       cd jarvis
       bash scripts/install-plus-macos.sh

3. The installer checks **Git, npm, Node.js 20+, Chrome/Edge and the absence of
   API-key environment variables before installing anything**.
   If a prerequisite is missing it **stops** and tells you; it does not run
   sudo, Homebrew, global npm installs, or a system package installer.
4. It runs the *upstream* advisory check (node scripts/setup.mjs), then
   npm install for **project-local npm packages only**.
   The upstream check may report Claude Code missing; this is expected.
5. When prompted, sign in through the local Codex CLI with
   **Sign in with ChatGPT**, **not an API key**. You approve the official
   browser login yourself; no password or auth token belongs in this repo.
6. After sign-in the installer runs npm run setup:plus, npm test and
   npm run build. The script does **not** start the app if checks fail.
7. To start it after the checks succeed:

       npm run start:plus

   In a real Chrome/Edge window, open http://localhost:5173, click INITIALISE,
   allow the microphone, and say "Hey Jarvis". Ctrl-C stops JARVIS.

The launcher **runs the Plus setup check again before every startup**.
If you prefer manual setup: run npm install, then
./node_modules/.bin/codex login, npm run setup:plus, npm test,
npm run build, and npm run start:plus in that order.

## Billing and usage safety

- No OpenAI API key is used. The bridge refuses to start if
  OPENAI_API_KEY or CODEX_API_KEY is present.
- No additional credits, paid resets, subscriptions, top-ups or checkout
  operations are requested by this repository or its installer.
- Included ChatGPT Plus Codex usage has **5-hour and weekly allowances**.
  When you reach a limit, wait for the automatic free reset.
- **Important:** if your account already has a purchased Codex credit balance,
  or automatic credit top-ups / reset features enabled, Codex behavior may
  depend on those account settings. This bridge cannot read your balance or
  enforce an exact included-allowance-only spending cutoff. Review
  ChatGPT Settings > Usage and disable any paid auto top-ups or optional reset
  features before signing in if you want to avoid all paid usage.
- Do not publish the contents of ~/.codex/ or copy your login credentials into
  GitHub. Authentication happens **only on your own Mac**.

## Technical notes

- The browser frontend still uses the original local WebSocket protocol on
  ws://localhost:8787; the Plus bridge answers only local Host/Origin requests.
- Codex is run with a fresh workspace, read-only sandbox, no network-enabled
  tools, and no approval for effectful operations. This is **not** an audited
  security boundary: never run untrusted instructions or enable writes.
- The Plus backend is **experimental and not yet verified end-to-end on macOS**.
  Syntax and pure-logic tests are not a substitute for a live ChatGPT login.
- The npm lockfile belongs to the original Claude fork. The first
  project-local npm install updates it for the new Codex dependencies.
  A fresh npm ci will not work until that updated lockfile is committed.
- Existing npm start / npm run bridge remain the **original Claude mode**;
  use **npm run start:plus** for ChatGPT mode.

## If Codex says a model is unsupported

An existing global Codex configuration may select a model like `gpt-5.5`
that is not available through ChatGPT-account sign-in. The Plus bridge now
explicitly requests `gpt-6-luna` at low reasoning effort, instead of inheriting
that setting. After pulling the latest branch, stop the existing JARVIS launcher
with Ctrl-C and run `npm run start:plus` again. To test the login independently:

    ./node_modules/.bin/codex exec --model gpt-6-luna --sandbox read-only "Reply with exactly: JARVIS ONLINE"

The direct Codex command requires `--model` because it otherwise continues
to inherit your global default. No system-wide configuration change is needed.

Official SDK: https://github.com/openai/codex/tree/main/sdk/typescript
Official plan docs: https://help.openai.com/en/articles/11369540-using-codex-with-your-chatgpt-plan
