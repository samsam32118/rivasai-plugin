---
name: riva-sai-home-design
description: "Designs homes, apartments, rooms, interiors and gardens in Riva Sai (rivasai.com), the free 2D/3D home planner. Turns a brief, sketch, photo or floor plan into a plan script and a link that opens the design in 2D and 3D. Use when the user wants to plan or furnish a room, lay out an apartment or house, try furniture arrangements, plan a renovation or garden, or mentions Riva Sai, rivasai.com or a Riva Sai link."
---

# Designing homes with Riva Sai

Riva Sai (https://rivasai.com) is a free home planner in the browser. You design a home as a **plan
script**, a JSON list of Riva Sai API calls. You hand it back as a **link**,
`https://rivasai.com/#plan=<the script, percent-encoded>`. Opening the link builds the design in the
user's browser, in 2D and 3D, ready to change. Nothing is uploaded: the design travels inside the link.

## Read the guide first

Before your first plan script in a conversation, read
[references/agent.md](references/agent.md). It has the conventions, the plan-script format, every
method you can call and the indoor catalog with real sizes. For gardens, terrain, roofs and more
storeys, also read [references/agent-advanced.md](references/agent-advanced.md). Use only catalog
ids, materials and methods listed there. Never invent them: the app refuses the whole script when one
step is wrong.

If the `riva_*` tools of the optional **riva-sai-tools** plugin are available (Claude Code), use
them as well:
- `riva_search_catalog` to find items.
- `riva_check_plan` to check a script before the user sees it. It catches overlaps, furniture
  through walls and doors in corners, and makes the link.
- `riva_read_design` to read a `#p=` share link the user brings back.

## Workflow

1. **Ask about the space.** Ask about the rooms and their rough sizes (or a sketch, photo or floor
   plan), doors and windows, who lives there, style and budget. Ask one or two short questions at a
   time, not a form.
2. **Never block on exact measurements.** Help the user estimate: count floor tiles, pace it out, or
   compare with a bed or sofa of known size. Otherwise assume typical sizes and say what you assumed.
   A first link within minutes beats a perfect one.
3. **Propose the layout in plain words** (where the sofa goes and why), then write the plan script.
4. **Check it before sending.** Use `riva_check_plan` when you have it. Otherwise go through the
   script yourself:
   - Every `call`, option, catalog id and material is in the guide.
   - Every `$name` is defined by an earlier step's `"as"`.
   - No two pieces of furniture overlap, and nothing crosses a wall (see the conventions).
   - Doors and windows sit on a wall line, at least half their width plus 10 cm from a corner.
5. **Hand it back.** Give the link as a markdown link
   (`[Open your design in Riva Sai](https://rivasai.com/#plan=...)`), with two or three lines on what
   is in it and what you assumed. Build the link with code when you can, so the percent-encoding is
   exact. When you cannot run code, or the link would be long (over about 30,000 characters), also
   give the script as a ```json block. The user can paste it in Riva Sai under **Open > From my
   assistant**.
6. **Fix what the app reports.** If a step is wrong, the app opens nothing and names the step (for
   example `step 7 (openings.add): at: no wall within 30 cm`). The user can copy that message to you.
   Fix that step and send a new link.
7. **Iterate on the user's latest version.** The user may change things in the app and paste back a
   text that starts with `Here is my current Riva Sai design`, including a `Design id: … · version: …`
   line. Build the next script on that pasted design, not on your earlier script. Put
   `"design": "<id>"` and `"basedOn": "<version>"` at the top level so the app updates the same
   design and keeps the earlier version.

## Plan script in brief

```json
{ "freeinterior": "plan", "version": 1, "name": "Our flat", "steps": [
  { "call": "rooms.createRectangular", "args": { "x": 0, "y": 0, "width": 500, "depth": 400, "name": "Living room" }, "as": "living" },
  { "call": "openings.add", "args": { "at": { "x": 150, "y": 400 }, "catalogId": "door-front", "opensInto": "$living" } },
  { "call": "items.add", "args": { "catalogId": "tv-stand", "position": { "x": 250, "y": 40 }, "facing": "S" }, "as": "tv" },
  { "call": "items.add", "args": { "catalogId": "sofa-3-seat", "position": { "x": 250, "y": 300 }, "faceToward": "$tv" } }
] }
```

- Units are centimetres. x points east, y points south, and plan up is north. `position` is the
  centre of an item's footprint.
- Walls are 15 cm thick, centred on the room lines. An item against the wall at y = 0 has its centre at
  `y = 7.5 + depth / 2`.
- `"as": "tv"` names a result. Later steps refer to it as `"$tv"`, or `"$living.walls.2.id"` to reach
  inside a result.
- `"template"` (`studio`, `two-bedroom`, `house`, `garden-house`) starts from a furnished starter
  instead of an empty plan.
- The script runs all or nothing, at most 5000 steps.

## Good layouts

- Keep walkways 80–90 cm wide. Leave 60–100 cm in front of cabinets, appliances and beds.
- Set every item's front with `facing` or `faceToward`. The front is the side a person uses: a sofa
  faces the TV, a bed's front is its foot, and a desk's front is where you sit.
- Interior doors are 80–90 cm wide and the front door is 100 cm.
- Kitchen, dining and living in one open space is one room. Name the zones with `labels.add`.
- Wet rooms get a tile floor (`tile-*`). Use real catalog sizes. When something is missing from the
  catalog, use the closest item and give it a `name`.

## What not to do

- Do not invent catalog ids, materials or methods.
- Do not send a script you have not checked.
- Do not ask for personal details beyond the home itself. The design never needs a name or address.
