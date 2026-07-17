# 更新日志

## [2.3.1] - 2026-07-17

### 新增汉化翻译
- 新增智能体执行、队列消息投递相关设置汉化。
- 新增 PostHog 与 gopls (Go 语言助手) 等多个 MCP 服务器详细说明汉化。
- 新增撤销操作提示、会话/工作区属性、任务及交付件状态等多处 UI 细节汉化。
- 将主要对照字典文件重命名为 `v2.3.1.json` 以匹配新版本。

## [2.2.1] - 2026-07-13

### 新增汉化翻译
- 新增“选择思维等级”与 Gemini 3.5 Flash (Low) 推理模式的提示及设置汉化。
- 新增付费用户 Quotas Increased（配额增加）及每周配额重置相关提示汉化。
- 新增项目创建引导界面、项目权限说明等汉化。
- 新增会话面板宽度（Conversation Width）、窄/宽（Narrow/Wide）设置项汉化。
- 新增 Token 消耗细分展示（Show 1 breakdown/Hide breakdown）汉化。
- 新增 Google Maps Platform 模版集成及路线路由卡片信息汉化。
- 新增应用自动更新检查设置（Automatic Check for Updates）汉化。
- 新增会话列表右键菜单操作（置顶、复制会话名称/ID、复制项目名称）汉化。
- 新增设置项目名称（Set Project Name）与环境选择器（Environment Selector）提示汉化。

### 修复与优化
- 修正了 Google Cloud Quotas 在原字典匹配时因空格排印导致的漏译问题，补全了该 MCP 卡片及标题的汉化。
- 优化了动态文本的汉化引擎，在 `localization_engine.js` 中新增了对以下带数值的动态字符串的正则拦截，彻底解决漏译问题：
  - 活跃对话数（如 `1 active conversation`）
  - 已归档对话数（如 `0 archived conversations`）
  - 正在运行的任务数（如 `1 task running`）
  - 已更改的文件数（如 `2 files changed`）
