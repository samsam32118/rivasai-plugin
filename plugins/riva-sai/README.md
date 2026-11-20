# Riva Sai plugin for Claude

Design homes, interiors and gardens with Claude in [Riva Sai](https://rivasai.com), the free 2D/3D
home planner in the browser. Describe your space, or share a sketch, photo or floor plan. Claude
asks a few questions, lays out the rooms, doors, windows and furniture, and checks the plan. It then
gives you a link that opens the design at rivasai.com in 2D and 3D, ready to walk through and change.

![A two-storey house in Riva Sai: 2D plan and live 3D model](https://raw.githubusercontent.com/samsam32118/rivasai-plugin/main/docs/riva-sai-house.png)

## What you get

- **Skill `riva-sai-home-design`.** Claude's workflow for planning a home with you. It asks one or
  two questions at a time, assumes typical sizes instead of demanding measurements, and follows the
  layout rules (walkways, clearances, which way furniture faces). It keeps building on your latest
  version when you change things in the app. The full Riva Sai guide and catalog come with it.
- **Commands.**
  - `/riva-sai:design-home [brief]` starts a design.
  - `/riva-sai:check-plan [script, link or error]` checks and repairs a plan script.

Works in Claude Code, Cowork and claude.ai. The plugin contains instructions and reference text
only: no programs, no network access, no data collection.

**Optional, Claude Code only:** the `riva-sai-tools` plugin from the same marketplace adds a local
MCP server (plain Node.js 18+, read-only) that checks plan scripts for Claude, searches the catalog,
and makes and reads Riva Sai links. Install it with `claude plugin install riva-sai-tools@rivasai`.

## Install

In Claude Code:

```bash
claude plugin marketplace add samsam32118/rivasai-plugin
```

```bash
claude plugin install riva-sai@rivasai
```

Or inside a session: `/plugin marketplace add samsam32118/rivasai-plugin`, then
`/plugin install riva-sai@rivasai`.

## Try it

> Plan a 65 m² two-bedroom flat for a couple with a baby: open kitchen and living room, a bathroom
> with a bathtub, and a small home office corner.

> Here's a photo of my living room, about 4 by 5 metres. Where should the sofa and TV go?

> /riva-sai:design-home a small garden house with a deck, a pool and a vegetable bed

Claude answers with a link like `https://rivasai.com/#plan=...`. Open it to see the design in 2D and
3D. Change anything in the app, then use **Assistant > Copy design** and paste the result back to
Claude to keep working on the same design.

## Privacy

The plugin collects nothing and runs no programs. Designs travel inside the link, after the `#`, which browsers never send to the server. See
[PRIVACY.md](PRIVACY.md).

## For developers

Source: [github.com/samsam32118/rivasai-plugin](https://github.com/samsam32118/rivasai-plugin).
`skills/riva-sai-home-design/references/*.md` are generated from the Riva Sai app source. The rest is
hand-written.

Support: [GitHub issues](https://github.com/samsam32118/rivasai-plugin/issues).

## License

The plugin (this folder) is under the [MIT License](LICENSE).
