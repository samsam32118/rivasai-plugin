---
name: riva-sai-home-design
description: Designs homes, apartments, rooms, interiors and gardens in Riva Sai (rivasai.com), the free 2D/3D home planner. Turns a brief, sketch, photo or floor plan into a checked plan script and a link that opens the design in 2D and 3D. Use when the user wants to plan or furnish a room, lay out an apartment or house, try furniture arrangements, plan a renovation or garden, or mentions Riva Sai, rivasai.com or a #plan= / #p= link.
---

# Designing homes with Riva Sai

Riva Sai (https://rivasai.com) is a free home planner in the browser. You design a home as a **plan
script**, a JSON list of Riva Sai API calls. You hand it back as a **link**,
`https://rivasai.com/#plan=<the script, percent-encoded>`. Opening the link builds the design in the
user's browser, in 2D and 3D, ready to change. Nothing is uploaded: the design travels inside the link.

The `riva-sai` MCP server in this plugin has the tools. Use them rather than guessing:

| Tool | Use it to |
|---|---|
| `riva_guide` | Read the conventions, the plan-script format and the methods (`part: "advanced"` for outdoors, terrain, roofs, storeys) |
| `riva_search_catalog` | Find catalog ids and real sizes ("corner sofa", "bunk bed", "sliding door") |
| `riva_list_options` | List categories, floor/wall materials, furniture finishes and starter templates |
| `riva_check_plan` | Check a script and get the link. Fix every error and warning first |
| `riva_plan_link` | Make the link for a script that already passed the check |
| `riva_read_design` | Read a `#p=` / `#plan=` link or a project JSON the user brings back |

If the tools are not available, read [references/agent.md](references/agent.md) instead and write the
link yourself. The outdoor guide is [references/agent-advanced.md](references/agent-advanced.md).

## Workflow

1. **Ask about the space.** Ask about the rooms and their rough sizes (or a sketch, photo or floor
   plan), doors and windows, who lives there, style and budget. Ask one or two short questions at a
   time, not a form.
2. **Never block on exact measurements.** Help the user estimate: count floor tiles, pace it out, or
   compare with a bed or sofa of known size. Otherwise assume typical sizes and say what you assumed.
   A first link within minutes beats a perfect one.
3. **Read the guide once** (`riva_guide`) before your first script in a conversation. The conventions
   matter: centimetres, x east, y south, plan up is north, `position` is the centre of the footprint,
   and walls are 15 cm thick on the room lines.
4. **Propose the layout in plain words** (where the sofa goes and why), then write the plan script.
   Look up every catalog id you are not sure of with `riva_search_catalog`.
5. **Check it** with `riva_check_plan`. Fix the errors (the app would refuse the script) and the
   warnings (furniture overlapping or crossing a wall), then check again until it is clean.
6. **Hand it back** as the link from the check, written as a markdown link
   (`[Open your design in Riva Sai](https://rivasai.com/#plan=...)`). Add two or three lines on what
   is in it and what you assumed. When the tool says the link is long, also give the script as a
   ```json block, which the user can paste in Riva Sai under Designs > From my assistant.
7. **Iterate on the user's latest version.** The user may change things in the app and paste back a
   text that starts with `Here is my current Riva Sai design`, including a `Design id: … · version: …`
   line. Build the next script on that pasted design, not on your earlier script. Put
   `"design": "<id>"` and `"basedOn": "<version>"` at the top level so the app updates the same
   design and keeps the earlier version. For a `#p=` share link, use `riva_read_design`.

## Plan script in brief

```json
{ "freeinterior": "plan", "version": 1, "name": "Our flat", "steps": [
  { "call": "rooms.createRectangular", "args": { "x": 0, "y": 0, "width": 500, "depth": 400, "name": "Living room" }, "as": "living" },
  { "call": "openings.add", "args": { "at": { "x": 150, "y": 400 }, "catalogId": "door-front", "opensInto": "$living" } },
  { "call": "items.add", "args": { "catalogId": "tv-stand", "position": { "x": 250, "y": 40 }, "facing": "S" }, "as": "tv" },
  { "call": "items.add", "args": { "catalogId": "sofa-3-seat", "position": { "x": 250, "y": 300 }, "faceToward": "$tv" } }
] }
```

- `"as": "tv"` names a result. Later steps refer to it as `"$tv"`, or `"$living.walls.2.id"` to reach
  inside a result.
- `"template"` (`studio`, `two-bedroom`, `house`, `garden-house`) starts from a furnished starter
  instead of an empty plan.
- The script runs all or nothing, at most 5000 steps.

## Good layouts

- Keep walkways 80–90 cm wide. Leave 60–100 cm in front of cabinets, appliances and beds.
- Set every item's front with `facing` or `faceToward`. The front is the side a person uses: a sofa
  faces the TV, a bed's front is its foot, and a desk's front is where you sit.
- Interior doors are 80–90 cm wide and the front door is 100 cm. Keep openings away from corners.
- Kitchen, dining and living in one open space is one room. Name the zones with `labels.add`.
- Wet rooms get a tile floor (`tile-*`). Use real catalog sizes. When something is missing from the
  catalog, use the closest item and give it a `name`.

## What not to do

- Do not invent catalog ids, materials or methods. `riva_check_plan` lists the closest real ones.
- Do not give a link that has not passed `riva_check_plan`.
- Do not ask for personal details beyond the home itself. The design never needs a name or address.
