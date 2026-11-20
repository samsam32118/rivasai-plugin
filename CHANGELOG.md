# Changelog

## riva-sai 1.1.0, riva-sai-tools 1.0.0 - 2026-11-20

- The local MCP server moved to its own plugin, `riva-sai-tools`. `riva-sai` is now instructions and
  reference text only, so it can be listed in the plugin directory and also works in claude.ai.
  Install `riva-sai-tools@rivasai` in Claude Code for the checker, catalog search and link tools.
- The skill works without the tools: it checks the script itself and gives the plan script as JSON
  when it can't build the link.
- The skill's description is quoted YAML.

## 1.0.0 - 2026-11-20

- First release: the `riva-sai-home-design` skill, the `/riva-sai:design-home` and
  `/riva-sai:check-plan` commands, and the `riva-sai` MCP server with six read-only tools
  (`riva_guide`, `riva_search_catalog`, `riva_list_options`, `riva_check_plan`, `riva_plan_link`,
  `riva_read_design`).
