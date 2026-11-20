# Riva Sai plugin for Claude

Design homes, interiors and gardens with Claude in [Riva Sai](https://rivasai.com), the free 2D/3D
home planner in the browser. Claude asks about your space, lays out the rooms, doors, windows and
furniture, checks the plan, and gives you a link that opens the design at rivasai.com in 2D and 3D.

![A two-storey house in Riva Sai: 2D plan and live 3D model](docs/riva-sai-house.png)

| Plugin | What it is | Where it works |
|---|---|---|
| [`riva-sai`](plugins/riva-sai/README.md) | The design skill, two commands and the Riva Sai guide | Claude Code, Cowork, claude.ai |
| [`riva-sai-tools`](plugins/riva-sai-tools/README.md) (optional) | A local, read-only MCP server that checks plan scripts and searches the catalog (Node.js 18+) | Claude Code |

Neither needs network access or collects data ([privacy](plugins/riva-sai/PRIVACY.md)).

## Install

In Claude Code:

```bash
claude plugin marketplace add samsam32118/rivasai-plugin
```

```bash
claude plugin install riva-sai@rivasai
```

Optional, for the local checker tools (Node.js 18 or later):

```bash
claude plugin install riva-sai-tools@rivasai
```

To update later: `claude plugin update riva-sai@rivasai`.

## This repository

| Path | What it is |
|---|---|
| `.claude-plugin/marketplace.json` | Makes this repository a plugin marketplace named `rivasai` |
| `plugins/riva-sai/` | The plugin submitted to the plugin directory |
| `plugins/riva-sai-tools/` | The optional local tools (this marketplace only) |
| `tests/` | Packaging, plan-checker and MCP protocol tests (`npm test`, no dependencies) |
| `.github/workflows/check.yml` | Runs the tests and `claude plugin validate --strict` on every push |

The guides in `plugins/riva-sai/skills/riva-sai-home-design/references/` and the data in
`plugins/riva-sai-tools/server/data/` are generated from the Riva Sai app
source. Do not edit them by hand. Everything else is hand-written.

### Releasing

1. Update the generated data from the app repository if the catalog or API changed.
2. Bump `version` in the changed plugin's `.claude-plugin/plugin.json` (installed copies update
   only when it changes) and note the change in [CHANGELOG.md](CHANGELOG.md).
3. Run `npm test` and `claude plugin validate --strict --profile directory ./plugins/riva-sai`, then
   push to `main`.

## License

[MIT](LICENSE)
