# Riva Sai - guide for AI assistants

Riva Sai (https://rivasai.com) is a free 2D/3D home planner in the browser. You are the user's personal home planning assistant: you talk with them about their home (homeowner), their client's brief (contractor) or their trade (subcontractor), design the layout, and hand it back as a **Riva Sai link** they open in their browser.

## How to work with the user

1. Ask about the space first: rooms and their sizes (or a sketch / photo), doors and windows, who lives there, style and budget. A handful of short questions, not a form - and only one or two at a time.
2. **Never block on exact measurements.** Most people do not know them. Help them estimate (a photo, a sketch, counting floor tiles or steps, a bed or sofa of known size), otherwise assume typical sizes, say what you assumed, and let them correct it later. A first link within a few minutes beats a perfect one.
3. Propose the layout in plain words (where the sofa goes and why), then build it as a plan script (below).
4. Give back a link (preferred, see "Handing the design back") or the plan script as a ```json code block.
5. **Working back and forth.** The user changes things in Riva Sai too (moves the sofa, deletes a chair) and pastes their current design back to you - a text that starts with `Here is my current Riva Sai design` and has a line `Design id: … · version: …`, then every room and item with size, position and which way it faces. **Always build on the latest design they pasted** (not on your earlier script), and return a new complete plan script with `"design": "<that id>"` and `"basedOn": "<that version>"` at the top level. The app then updates that same design instead of adding a new one, keeps the earlier version, and offers Undo; if the user changed the design after pasting it, the app asks them which to keep. Without `design` the link always opens as a new design.

## Conventions (read carefully)

- Units are **centimetres**. The plan is seen from above: **x points east (right), y points south (down)**. **Plan up is north.**
- An item's `position` is the centre of its footprint. **Width runs along its front, depth from front to back** (a sofa 220 wide × 95 deep; a crib 70 wide × 130 deep has its front on a short end). At rotation 0 (facing S) width runs along x.
- **Facing:** every directional item has a front (sofa seat, bed foot, TV screen, wardrobe doors, chair seat). Set it with `"facing": "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW"` or degrees clockwise from north, or with `"faceToward": "$tv"` / `{ "x": 250, "y": 40 }`. `facing` also turns items without a front (a rectangular rug or table with `"facing": "E"` is turned 90°). `rotation` is in radians - you never need it.
- Example: an item at rotation 0 faces south (S); a TV on the north wall faces S, the sofa in front of it faces N. A bed's head is at its back: a bed with its head against the east wall faces W.
- **Walls** are 15 cm thick unless you set `thickness`. Room coordinates (`x, y, width, depth` of `rooms.createRectangular`, wall `a` / `b`) are wall **centre lines**, so the free floor ends half a wall (7.5 cm) inside them: an item against a wall at y = 0 has its back at y = 7.5, i.e. `position.y = 7.5 + depth / 2`.
- **Rooms side by side:** draw each room with `rooms.createRectangular`; touching rooms share their walls automatically, also when they share only part of a side (a hall against a long living-room wall): the existing wall is split where the new room ends and nothing is doubled. Its result is `{ room, walls, sides }`: `walls` has one wall per side - **north, east, south, west** - and `sides` every piece of each side. `"$living"` is the room's id.
- **Doors and windows:** `openings.add` with a door/window `catalogId` and `at` = the centre of the opening on the plan, a point on the wall line (`{ "x": 150, "y": 400 }` is on the south wall of a room 400 deep); the nearest wall within 30 cm is used. `opensInto: "$bed"` makes a door swing into that room; `flip: true` moves the hinge to the other end. (Instead of `at` you can give `wallId` and `offset` = cm from the wall's `a` point to the centre.) Interior doors are 80-90 cm wide, the front door 100.
- **Wall-mounted items** (wall cabinets, range hoods, art, shelves, sconces) and ceiling lights get the catalog's height above the floor automatically; set `elevation` only to change it. Floor items stand on the floor. To put one thing on another (a TV on its stand), give the same `position` and `elevation` = the height of the lower item.
- Overlapping items are not an error (the app highlights them), but avoid them: keep 80-90 cm walkways, 60-100 cm in front of cabinets, appliances and beds, and do not place items across walls.
- Results of `walls.split` are `[first part, second part]`: the first keeps the wall's id and runs from `a` to the split point.
- **Which side is the front:** the side a person uses. Sofas, chairs and beds: the way a seated (or lying) person looks - a bed's front is its foot. Desks, vanities, kitchen units, appliances, wardrobes and shelves: the side you stand or sit at. TVs and screens: the screen. So "a desk facing the window" means its front points away from the window when it stands against that wall (the person sitting looks at the window); a chair at a desk faces the desk.
- An item on another one (a TV on its stand) gets the same `position` and `facing`. Wall-mounted items use the same rule as floor items: `position` is the centre of the footprint, back against the wall.
- **Open-plan spaces** (kitchen + dining + living) are one room; name the zones with `labels.add`. Keep doors and windows at least half their width + 10 cm away from a corner or a wall junction.
- **Not in the catalog?** Use the closest item and give it a `name` (a sofa bed: `sofa-3-seat` with `"name": "Sofa bed"`).
- `rooms.setWallFinish` paints the faces of the walls that look into that room only (a shared wall keeps the other room's finish on its other face). Wet rooms: a tile floor (`tile-*`) and, if wanted, tiles on the walls.

## Plan scripts

A plan script is JSON: `{ "freeinterior": "plan", "version": 1, "name"?: string, "template"?: string, "steps": [ ... ] }`. Each step is `{ "call": "<namespace.method>", "args": { ... }, "as"?: "<name>" }`:

- `args` is the method's options object (for `items.add`, `rooms.createRectangular`, `openings.add` ...) or its named parameters (`{ "id": "$sofa", "changes": { ... } }` for `items.update`).
- `"as": "tv"` names the result; later steps write `"$tv"` for its id, or `"$living.walls.2.id"` to reach inside a result.
- It runs on a fresh project, all or nothing; an error names the failing step. At most 5000 steps.
- `"template"` starts from a starter project instead of an empty one: `studio`, `two-bedroom`, `house`, `garden-house`.

Complete example (two rooms side by side, a front door, a door between them that opens into the bedroom, windows, a TV and a sofa facing it, a bed):

```json
{
  "freeinterior": "plan",
  "version": 1,
  "name": "Our flat",
  "steps": [
    {
      "call": "rooms.createRectangular",
      "args": {
        "x": 0,
        "y": 0,
        "width": 500,
        "depth": 400,
        "name": "Living room",
        "floorMaterial": {
          "id": "wood-oak"
        }
      },
      "as": "living"
    },
    {
      "call": "rooms.createRectangular",
      "args": {
        "x": 500,
        "y": 0,
        "width": 350,
        "depth": 400,
        "name": "Bedroom",
        "floorMaterial": {
          "id": "wood-oak"
        }
      },
      "as": "bed"
    },
    {
      "call": "openings.add",
      "args": {
        "at": {
          "x": 150,
          "y": 400
        },
        "catalogId": "door-front",
        "opensInto": "$living"
      }
    },
    {
      "call": "openings.add",
      "args": {
        "at": {
          "x": 500,
          "y": 320
        },
        "catalogId": "door-single",
        "opensInto": "$bed"
      }
    },
    {
      "call": "openings.add",
      "args": {
        "at": {
          "x": 250,
          "y": 0
        },
        "catalogId": "window-double"
      }
    },
    {
      "call": "openings.add",
      "args": {
        "at": {
          "x": 675,
          "y": 0
        },
        "catalogId": "window-standard"
      }
    },
    {
      "call": "items.add",
      "args": {
        "catalogId": "tv-stand",
        "position": {
          "x": 250,
          "y": 40
        },
        "facing": "S"
      },
      "as": "tv"
    },
    {
      "call": "items.add",
      "args": {
        "catalogId": "sofa-3-seat",
        "position": {
          "x": 250,
          "y": 300
        },
        "faceToward": "$tv"
      },
      "as": "sofa"
    },
    {
      "call": "items.add",
      "args": {
        "catalogId": "bed-double",
        "position": {
          "x": 735,
          "y": 200
        },
        "facing": "W"
      }
    },
    {
      "call": "items.update",
      "args": {
        "id": "$sofa",
        "changes": {
          "color": "#7c9a82"
        }
      }
    }
  ]
}
```

## Handing the design back

Best: a link. Take the address the user gave you (the page this file is on, without `/agent.md`) and append `#plan=` followed by the plan script JSON, percent-encoded (`encodeURIComponent(JSON.stringify(script))` in JavaScript, `urllib.parse.quote(json.dumps(script), safe="")` in Python):

```
<app address>/#plan=%7B%22freeinterior%22%3A%22plan%22%2C...
```

The app address is in the prompt the user gave you (it is where this file lives). If you do not know it, skip the link and give the code block below.

**Build the link with code when you can** (a code tool or interpreter), so the encoding is exact. Always send it as a Markdown link with a label, never a bare URL (spaces and quotes would break it), and say in one line what happens next, for example:

> [Open your living room in Riva Sai](<the link>) - it opens in 2D; tap **3D** to look around. Keep this link: it always reopens this design. To change anything, just tell me here.

The design opens straight away (anything the user had before is kept under Open). On a phone the app is for looking (with a simple edit mode for moving and turning furniture), so changes usually come back through you. If the link would be very long (more than ~30 000 characters) or you cannot build it, give the plan script as a ```json code block instead and tell the user to choose **Open > From my assistant** and paste it. A complete project JSON (as exported by the app) is accepted the same way.

There is no dry run: if a step is wrong the app says which one ("step 7 (openings.add): at: no wall within 30 cm ...") and opens nothing; the user gets a button that copies that message for you. Fix the step and send a new link. Keep the script simple: rooms first, then doors and windows, then furniture.

## Methods you can call in a plan script

Types: `Vec2` = `{ x, y }` in cm, `ID` = string id, `MaterialRef` = `{ id, color? }`. `?` = optional.

- `project.rename args { name: string }` - Renames the project.
- `project.setPhase args { ids?: ID[], all?: boolean, phase: "existing" | "demolish" | "new" }` - Sets the renovation phase of walls, openings and items as one undo step: ids names them, all: true marks every wall, opening and item on every floor. Start a renovation by marking all 'existing', then set 'demolish' on what goes and add new work. Returns the changed ids and whether the project is a renovation.
- `floors.add args { name?: string, elevation?: number, height?: number, copyFrom?: ID, copyContent?: "walls" | "all", activate?: boolean, id?: ID }` - Adds a floor (optionally copying walls/content from another, and activating it).
- `floors.update args { id: ID, changes: { name?: string, elevation?: number, height?: number } }` - Updates a floor name, elevation or height.
- `floors.remove args { id: ID }` - Removes a floor and its content.
- `floors.setActive args { id: ID }` - Makes a floor active.
- `walls.add args { a: Vec2, b: Vec2, thickness?: number, height?: number, materialLeft?: MaterialRef, materialRight?: MaterialRef, phase?: "existing" | "demolish" | "new", floorId?: ID, id?: ID }` - Adds a wall from a to b (cm).
- `walls.addPolyline args { points: Vec2[], closed?: boolean, thickness?: number, height?: number, phase?: "existing" | "demolish" | "new", floorId?: ID }` - Adds connected walls through points (closed connects back to the start).
- `walls.update args { id: ID, changes: { a?: Vec2, b?: Vec2, thickness?: number, height?: number | null, materialLeft?: MaterialRef | null, materialRight?: MaterialRef | null, phase?: "existing" | "demolish" | "new" | null } }` - Updates a wall.
- `walls.remove args { id: ID }` - Removes a wall and its openings.
- `walls.split args { id: ID, options: { at?: Vec2, offset?: number } }` - Splits a wall at a point or offset; returns both parts.
- `walls.moveEndpoint args { id: ID, end: "a" | "b", to: Vec2, connected?: boolean }` - Moves a wall endpoint; connected walls follow unless connected=false.
- `walls.move args { ids: ID[], delta: Vec2, connected?: boolean }` - Translates walls by delta as one undo step; straight continuations move along and joined walls stretch, so rooms stay square and keep their identity.
- `rooms.add args { polygon: Vec2[], name?: string, floorMaterial?: MaterialRef, ceilingMaterial?: MaterialRef, floorId?: ID, id?: ID }` - Adds a manual room polygon.
- `rooms.update args { id: ID, changes: { name?: string, polygon?: Vec2[], auto?: boolean, floorMaterial?: MaterialRef | null, ceilingMaterial?: MaterialRef | null } }` - Updates a room.
- `rooms.remove args { id: ID }` - Removes a room.
- `rooms.setWallFinish args { id: ID, material: MaterialRef | null }` - Sets the finish of every wall face enclosing a room (null restores the default paint) as one undo step; returns the changed walls.
- `rooms.detect args { floorId?: ID }` - Re-detects rooms enclosed by walls.
- `rooms.createRectangular args { x: number, y: number, width: number, depth: number, name?: string, thickness?: number, phase?: "existing" | "demolish" | "new", floorMaterial?: MaterialRef, floorId?: ID }` - Draws a rectangular room with top-left corner x,y (wall centre lines). Neighbouring rooms share walls: a side along an existing wall reuses it (splitting it where the side ends) and only the uncovered parts get new walls. walls[] holds one wall per side - north, east, south, west (the first piece of each side); sides[] holds every wall of each side in order.
- `openings.add args { wallId?: ID, at?: Vec2, opensInto?: ID, kind?: "door" | "window" | "opening", catalogId?: string, offset?: number, width?: number, height?: number, sill?: number, flip?: boolean, side?: "left" | "right", phase?: "existing" | "demolish" | "new", id?: ID }` - Adds a door/window/opening to a wall: give wallId (+ offset, cm from wall.a to the centre; default the middle) or at, the centre point on the plan (the nearest wall within 30 cm is used). opensInto (a room id) makes a door swing into that room.
- `openings.update args { id: ID, changes: { wallId?: ID, kind?: "door" | "window" | "opening", catalogId?: string, offset?: number, width?: number, height?: number, sill?: number, flip?: boolean | null, side?: "left" | "right" | null, phase?: "existing" | "demolish" | "new" | null } }` - Updates an opening.
- `openings.remove args { id: ID }` - Removes an opening.
- `items.add args { catalogId: string, position: Vec2, rotation?: number, elevation?: number, dims?: Dims, scale?: Vec3, color?: string, material?: MaterialRef, name?: string, locked?: boolean, phase?: "existing" | "demolish" | "new", floorId?: ID, id?: ID, facing?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | number, faceToward?: Vec2 | ID }` - Places a catalog item (dims/elevation default from the catalog).
- `items.update args { id: ID, changes: { catalogId?: string, position?: Vec2, elevation?: number, rotation?: number, scale?: Vec3 | null, dims?: Dims | null, color?: string | null, material?: MaterialRef | null, name?: string | null, locked?: boolean | null, phase?: "existing" | "demolish" | "new" | null, facing?: "N" | "NE" | "E" | "SE" | "S" | "SW" | "W" | "NW" | number, faceToward?: Vec2 | ID } }` - Updates an item.
- `items.remove args { id: ID }` - Removes an item.
- `items.duplicate args { ids: ID | ID[], offset?: Vec2 }` - Duplicates items with an offset (default 20,20).
- `labels.add args { text: string, position: Vec2, floorId?: ID, id?: ID }` - Adds a text label.
- `labels.update args { id: ID, changes: { text?: string, position?: Vec2 } }` - Updates a label.
- `labels.remove args { id: ID }` - Removes a label.

Outdoors, terrain, roofs and extra storeys: see [agent-advanced.md](agent-advanced.md) (only needed for a whole house, a garden or a site).

## Catalog

Use these `catalogId`s. Sizes are default width × depth × height in cm (override with `dims: { w, d, h }`). Outdoor furniture, plants and structures are in [agent-advanced.md](agent-advanced.md).

### Doors and windows (for `openings.add`)

- `door-single` Interior door, 90 wide × 210 high
- `door-double` Double door, 160 wide × 210 high
- `door-sliding` Sliding door, 180 wide × 210 high
- `door-pocket` Pocket door, 80 wide × 210 high
- `door-front` Front door, 100 wide × 220 high
- `door-garage` Garage door, 250 wide × 220 high
- `opening-plain` Wall opening, 100 wide × 210 high
- `opening-arch` Arched opening, 100 wide × 220 high
- `window-standard` Casement window, 120 wide × 120 high
- `window-double` Double window, 180 wide × 140 high
- `window-sliding` Sliding window, 150 wide × 120 high
- `window-picture` Picture window, 200 wide × 160 high
- `window-small` Small window, 60 wide × 60 high
- `window-tall` French window, 120 wide × 230 high

### Living room

- `sofa-3-seat` 3-seat sofa 220×95×85
- `sofa-2-seat` Loveseat 160×90×85
- `sofa-corner` Corner sofa 260×200×85
- `armchair` Armchair 85×85×90
- `coffee-table` Coffee table 120×60×42, no front
- `coffee-table-round` Round coffee table 90×90×42, no front
- `side-table` Side table 50×50×55, no front
- `tv-stand` TV stand 180×45×50
- `tv` Flat TV 145×8×85
- `bookshelf` Bookshelf 90×35×200
- `ottoman` Ottoman 60×60×42, no front
- `fireplace` Fireplace 150×45×110
- `rug-rect` Rectangular rug 240×170×1, no front
- `rug-round` Round rug 200×200×1, no front
- `sofa-sectional-chaise` Sectional sofa with chaise 280×165×85
- `recliner` Recliner 90×95×102
- `ottoman-tufted` Tufted storage ottoman 110×55×45, no front
- `bookcase-cube` Cube bookcase 150×38×150
- `media-wall-unit` Media wall unit 280×45×200
- `wood-stove` Wood-burning stove 65×55×230
- `grand-piano` Grand piano 150×200×100
- `floor-cushion` Floor cushion 70×70×18, no front
- `console-table` Console table 120×35×78
- `pool-table` Pool table 250×140×80, no front
- `bean-bag` Bean bag chair 90×90×75, no front
- `projector-screen` Projector screen 250×12×160, on the wall at 90 cm
- `sofa-chesterfield` Chesterfield sofa 220×95×78
- `armchair-wingback` Wingback chair 85×90×110
- `rocking-chair` Rocking chair 65×90×105
- `nesting-tables` Nesting side tables 60×40×55, no front

### Bedroom

- `bed-double` Double bed 160×210×95
- `bed-king` King bed 200×215×100
- `bed-single` Single bed 100×205×90
- `nightstand` Nightstand 50×40×55
- `wardrobe` Wardrobe 150×60×210
- `dresser` Dresser 120×50×85
- `vanity-table` Vanity table 100×45×76
- `mirror-floor` Floor mirror 60×5×170
- `bench-bed` Bed bench 140×40×45
- `canopy-bed` Canopy bed 180×220×210
- `loft-bed` Loft bed with desk 105×205×185
- `wardrobe-sliding` Sliding-door wardrobe 200×65×220
- `dressing-table` Dressing table with lit mirror 110×45×150
- `chest-of-drawers` Chest of drawers 80×45×120
- `murphy-bed` Murphy wall bed 165×45×220
- `bed-upholstered` Upholstered bed 180×215×120

### Kitchen

- `kitchen-base-cabinet` Base cabinet 60×60×90
- `kitchen-wall-cabinet` Wall cabinet 60×35×70, on the wall at 145 cm
- `kitchen-sink-cabinet` Sink cabinet 80×60×90
- `kitchen-island` Kitchen island 180×90×92
- `fridge` Refrigerator 70×70×185
- `stove` Range cooker 60×60×90
- `dishwasher` Dishwasher 60×60×85
- `range-hood` Range hood 60×50×40, on the wall at 160 cm
- `microwave` Microwave 50×38×30
- `bar-stool` Bar stool 40×40×75
- `kitchen-island-stools` Kitchen island with stools 200×150×92
- `range-hood-island` Island range hood 90×60×100, ceiling
- `fridge-french-door` French-door refrigerator 90×75×180
- `wine-fridge` Wine cooler 60×58×85
- `oven-tower` Oven tower 60×60×215
- `kitchen-shelf` Open kitchen shelf 100×25×60, on the wall at 145 cm
- `pantry-cabinet` Pantry cabinet 60×60×215
- `coffee-machine` Espresso machine 32×40×38
- `kitchen-cart` Kitchen cart 80×45×90
- `range-cooker` Dual-fuel range cooker 110×65×95

### Bathroom

- `bathtub` Bathtub 170×75×58
- `shower` Shower cabin 90×90×210
- `toilet` Toilet 38×65×78
- `bathroom-sink` Bathroom sink 60×45×85
- `double-vanity` Double vanity 140×50×85
- `towel-rack` Towel radiator 50×8×110, on the wall at 40 cm
- `washing-machine` Washing machine 60×60×85
- `bath-mirror` Bathroom mirror 60×3×80, on the wall at 110 cm
- `bathtub-freestanding` Freestanding bathtub 170×80×62
- `shower-walk-in` Walk-in shower 140×90×205
- `bidet` Bidet 38×55×40
- `washer-dryer-stack` Washer & dryer stack 60×65×175
- `vanity-vessel` Floating vanity with vessel sink 100×48×70, on the wall at 45 cm
- `towel-ladder` Towel ladder 50×35×165
- `laundry-hamper` Laundry hamper 45×35×62
- `water-heater` Water heater 60×60×150
- `clawfoot-tub` Clawfoot bathtub 170×75×75
- `towel-radiator` Heated towel rail 50×10×120, on the wall at 20 cm
- `ironing-board` Ironing board 130×40×90

### Dining

- `dining-table` Dining table 180×90×75, no front
- `dining-table-round` Round dining table 120×120×75, no front
- `dining-chair` Dining chair 45×50×90
- `bench` Dining bench 150×40×45
- `sideboard` Sideboard 160×45×80
- `china-cabinet` Display cabinet 100×40×190
- `bar-cart` Bar cart 80×45×85
- `buffet-hutch` Buffet with hutch 150×45×200
- `dining-table-extendable` Extendable dining table 200×95×76, no front
- `banquette` Upholstered banquette 160×60×95
- `wine-rack` Wine rack 90×35×180

### Office

- `desk` Desk 140×70×75
- `desk-l` Corner desk 160×140×75
- `office-chair` Office chair 60×60×105
- `filing-cabinet` Filing cabinet 45×60×100
- `office-shelf` Office shelving 80×40×180
- `computer` Computer monitor 60×20×45
- `printer` Printer 45×40×25
- `desk-executive` Executive desk 180×85×76
- `ergonomic-chair` Ergonomic chair 68×66×122
- `filing-cabinet-lateral` Lateral filing cabinet 90×50×105
- `bookshelf-ladder` Ladder bookshelf 70×45×180
- `standing-desk` Standing desk 150×75×115
- `printer-mfp` Office copier 60×62×115
- `drafting-table` Drafting table 120×80×95

### Kids

- `bunk-bed` Bunk bed 100×205×160
- `crib` Crib 70×130×95
- `toy-chest` Toy chest 80×45×50
- `kids-table` Kids table 80×60×50, no front
- `kids-chair` Kids chair 32×32×55
- `changing-table` Changing table 90×55×95
- `play-mat` Play mat 150×150×2, no front
- `toy-storage-bins` Toy storage with bins 90×32×80
- `play-tent` Play teepee 120×120×165
- `kids-table-set` Kids table & chairs 120×100×58
- `rocking-horse` Rocking horse 90×32×72
- `cradle` Rocking cradle 95×55×85
- `foosball-table` Foosball table 140×75×90, no front
- `high-chair` High chair 60×75×100

### Lighting

- `floor-lamp` Floor lamp 40×40×165
- `table-lamp` Table lamp 30×30×50
- `pendant-light` Pendant light 40×40×60, ceiling, no front
- `ceiling-light` Ceiling light 45×45×12, ceiling, no front
- `chandelier` Chandelier 70×70×70, ceiling, no front
- `wall-sconce` Wall sconce 20×15×30, on the wall at 170 cm
- `desk-lamp` Desk lamp 20×20×45
- `chandelier-sputnik` Sputnik chandelier 90×90×80, ceiling, no front
- `track-light` Track lighting 150×14×22, ceiling, no front
- `wall-sconce-swing` Swing-arm wall lamp 22×55×42, on the wall at 110 cm
- `arc-floor-lamp` Arc floor lamp 180×40×210
- `pendant-cluster` Pendant cluster 110×30×90, ceiling, no front
- `pendant-rattan` Rattan pendant 50×50×60, ceiling, no front

### Decor

- `plant-pot` Potted plant 45×45×120, no front
- `plant-small` Small plant 20×20×35, no front
- `wall-art` Framed picture 80×3×60, on the wall at 140 cm
- `wall-mirror` Wall mirror 70×3×100, on the wall at 110 cm
- `vase` Vase 20×20×40, no front
- `clock` Wall clock 35×5×35, on the wall at 180 cm
- `curtains` Curtains 160×12×250, on the wall at 0 cm
- `radiator` Radiator 100×10×60, on the wall at 15 cm
- `shelf-wall` Wall shelf 80×22×4, on the wall at 150 cm
- `coat-rack` Coat rack 50×50×180
- `shoe-cabinet` Shoe cabinet 90×35×100
- `piano` Upright piano 150×60×125
- `stairs-straight` Straight staircase 100×300×280
- `stairs-l` L-shaped staircase 200×200×280
- `stairs-spiral` Spiral staircase 160×160×280, no front
- `column-square` Square column 30×30×280, no front
- `column-round` Round column 30×30×280, no front
- `mirror-arched` Arched floor mirror 80×6×180
- `rug-runner` Runner rug 80×300×1, no front
- `rug-shag` Shag rug 200×140×4, no front
- `wall-art-set` Gallery wall set 150×3×90, on the wall at 120 cm
- `curtains-sheer` Curtains with sheers 220×16×260, on the wall at 0 cm
- `blinds` Venetian blinds 120×6×150, on the wall at 90 cm
- `room-divider` Folding screen divider 180×40×175
- `grandfather-clock` Grandfather clock 50×30×200
- `fig-tree` Fiddle-leaf fig tree 75×75×190, no front
- `cactus` Cactus 40×30×110, no front
- `vase-set` Vase set 45×20×42, no front
- `treadmill` Treadmill 80×180×140
- `exercise-bike` Exercise bike 55×115×125
- `weight-bench` Weight bench & rack 180×130×130
- `yoga-mat` Yoga mat 65×185×12, no front
- `aquarium` Aquarium 120×45×140
- `cat-tree` Cat tree 60×50×160
- `dog-bed` Dog bed 90×70×25
- `hall-tree` Hall tree bench 100×40×190
- `plant-monstera` Monstera plant 90×90×150, no front
- `wall-clock-sunburst` Sunburst wall clock 70×6×70, on the wall at 165 cm

## Materials

- Floors (room `floorMaterial`, e.g. `{ "id": "wood-oak" }`): `tile-white` (White tiles), `tile-grey` (Grey tiles), `wood-oak` (Oak parquet), `wood-walnut` (Walnut planks), `wood-light` (Light ash planks), `carpet-beige` (Beige carpet), `carpet-grey` (Grey carpet), `stone-marble` (Marble), `vinyl-grey` (Grey vinyl), `concrete` (Polished concrete), `wood-herringbone` (Herringbone parquet), `wood-grey` (Grey oak planks), `carpet-blue` (Blue carpet), `tile-checker` (Checkerboard tiles), `tile-hex` (Hexagon tiles), `tile-terracotta` (Terracotta tiles), `terrazzo` (Terrazzo), `stone-slate` (Slate), `no-oak-parquet` (Oak parquet, white oiled), `no-slate-oppdal` (Oppdal slate)
- Walls (`rooms.setWallFinish` for a whole room, or wall `materialLeft` / `materialRight`): `paint-white` (White paint), `paint-warm-grey` (Warm grey paint), `paint-sage` (Sage paint), `paint-blue` (Soft blue paint), `paint-terracotta` (Terracotta paint), `brick-red` (Red brick), `tile-white` (White tiles), `tile-grey` (Grey tiles), `stone-marble` (Marble), `concrete` (Polished concrete), `stone-cladding` (Stone cladding), `wood-siding` (Wood siding), `stucco` (Render / stucco), `paint-charcoal` (Charcoal paint), `paint-navy` (Navy paint), `paint-blush` (Blush paint), `paint-olive` (Olive paint), `wallpaper-stripes` (Striped wallpaper), `wallpaper-damask` (Damask wallpaper), `wallpaper-dots` (Polka dot wallpaper), `brick-white` (White brick), `tile-checker` (Checkerboard tiles), `tile-hex` (Hexagon tiles), `terrazzo` (Terrazzo), `stone-slate` (Slate), `board-batten` (Board and batten), `no-cladding-barn-red` (Standing cladding, barn red (låvefarge)), `no-cladding-white` (Standing cladding, white), `no-cladding-ochre` (Standing cladding, ochre (oker)), `no-cladding-grey` (Standing cladding, grey), `no-cladding-tar-black` (Standing cladding, tar black (tjærebrun)), `no-pine-panel` (Pine panelling (furupanel)), `no-slate-oppdal` (Oppdal slate)

Common room names: Living room, Kitchen, Dining room, Bedroom, Kids room, Bathroom, WC, Hall, Office, Utility, Storage, Garage, Balcony.

