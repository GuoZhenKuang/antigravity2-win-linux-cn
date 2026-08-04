# Antigravity Chinese Localization — Project Instructions

These instructions apply to every AI agent and contributor working in this repository. The goal is to deliver natural, complete, and maintainable Simplified Chinese localization without breaking Antigravity functionality, user content, or technical identifiers.

## 1. Project structure and scope

- JSON files in `dicts/` are Simplified Chinese dictionaries. Before changing one, use `rg` to find existing keys and translations. Reuse established wording and avoid duplicate or conflicting entries.
- `localization_engine.js` injects dictionaries and dynamic translation rules into the client. Put fixed UI text in the appropriate `dicts/*.json` file. Handle text formed from variables, counts, React text fragments, or runtime state with narrowly scoped logic in the engine.
- Change only dictionaries, engine rules, installer scripts, or version references that are directly relevant to the requested localization issue. Do not reorder large dictionaries, rewrite unrelated translations, or change release metadata without an explicit request.

## 2. Translation quality and terminology

- Translate whole sentences in their actual UI context; do not translate word by word. Keep buttons, menus, prompts, and errors concise and natural in Chinese, using standard Chinese punctuation.
- Preserve content that must not be translated: URLs, paths, commands, code, keyboard shortcuts, model names, product names, MCP, API, environment variables, configuration keys, version numbers, and user-provided text. Translate only the surrounding explanation when needed.
- Keep terminology consistent. For example: `file` → “文件”, `folder` → “文件夹”, `page` → “页面”, `task` → “任务”, `search` → “搜索” or “次搜索” as grammar requires, and `tool` → “工具”. Check existing translations before introducing a new term.
- Dictionary keys must precisely match the client source text. Do not add overly broad single-word substitutions merely to make a translation look generic; they can affect code, file names, and unrelated contexts.

## 3. Dynamic text, React fragments, and screenshot reports

- When a screenshot shows untranslated text, determine whether it is a complete fixed string, a string with variables, or a combination of DOM text nodes. Never add a dictionary key for only the specific number shown in a screenshot.
- Use capture groups for dynamic counts, durations, model names, project names, and file names, and support singular and plural forms. For example, `Explored 2 pages` must become “探索了 2 个页面”; do not translate only `Explored` or add a fixed `2 pages` dictionary entry.
- React may split a sentence into adjacent nodes, such as `Explored ` and `2 pages`. When necessary, handle the combined text and its fragments through narrowly scoped logic such as `getCombinedStatusTranslation`, `translateFragmentedStatus`, or their equivalent. Rules must be anchored to the complete status text so they cannot affect unrelated content.
- Dynamic rules should cover the full sentence, an individual count fragment, and required suffix fragments. Preserve arrows, shortcuts, and other independent UI elements. Every new rule must handle both singular and plural forms.
- For every screenshot report, identify the source text, UI location, whether it is dynamic, and the expected Chinese result. Do not add third-party web content, user messages, terminal output, or editor/code content to the global localization dictionary.

## 4. Protected content and implementation safety

- Never translate user prompts, chat bodies, Monaco/code-editor content, terminal input or output, command arguments, file contents, URLs, secrets, or credentials.
- Respect existing exclusion zones and markers, including `data-testid="user-input-step"`, `data-ag-localization-skip`, and editor- or terminal-related areas. Check that a new rule cannot cross these boundaries.
- Do not implement localization with broad `innerHTML` replacement. Preserve DOM structure, component behavior, event handlers, and user data.

## 5. Required workflow and verification

1. Read the relevant dictionary entries, engine rules, screenshots, and logs first. Confirm the original English text and how it is produced.
2. Add an exact dictionary entry for fixed text. For dynamic text, add the smallest safe regular-expression or combined-text-node rule and document the affected scenario in code when it is not self-evident.
3. Verify that every dictionary JSON file parses, run `node --check localization_engine.js`, compile-check the generated injection script, and run `git diff --check`.
4. Do not run commands that install, inject, or modify a user's Antigravity client. In particular, never run `node localization_engine.js`, `install.sh`, Windows installer scripts, or equivalent deployment commands. After completing changes, instruct the user to install manually: Linux normally uses `sudo ./install.sh`; Windows uses the installer batch file provided by the repository.
5. Update versions, create tags, commit, push, or publish a GitHub Release only when the user explicitly requests it. Before staging, ensure the selected files do not include unrelated user changes.
