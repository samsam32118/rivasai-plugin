# Riva Sai tools (optional, Claude Code)

Local tools for the [riva-sai](../riva-sai/README.md) plugin. A small MCP server, in plain Node.js
18+ with no dependencies, gives Claude six read-only tools:

| Tool | What it does |
|---|---|
| `riva_guide` | The design guide: conventions, plan-script format, methods, catalog |
| `riva_search_catalog` | Searches 470+ furniture, fixture, door, window, plant and exterior items, with real sizes |
| `riva_list_options` | Categories, floor and wall materials, furniture finishes, starter templates |
| `riva_check_plan` | Checks a plan script: format, calls and options, catalog ids, materials, facing, references, and layout (overlaps, furniture through walls, doors off walls or in corners). Returns the link when the script is valid |
| `riva_plan_link` | Makes the rivasai.com link for a valid plan script |
| `riva_read_design` | Reads a Riva Sai share link (`#p=` / `#plan=`) or project JSON you bring back |

```bash
claude plugin install riva-sai-tools@rivasai
```

The server makes no network requests, reads only its own files in `server/data/`, and writes
nothing. Those data files are generated from the Riva Sai app source; `server/riva-sai-mcp.mjs` is
hand-written. Local MCP servers run in Claude Code (and in Cowork on your own computer), not in
claude.ai chat.

MIT License.
