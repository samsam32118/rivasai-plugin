# Riva Sai - advanced guide for AI assistants

Read [agent.md](agent.md) first: the conventions, the plan-script format and how to hand the design back are all there. This file adds what only a whole house, a garden or a site needs.

## More methods for plan scripts

Types: `Vec2` = `{ x, y }` in cm, `ID` = string id. `?` = optional.

- `site.update args { boundary?: Vec2[] | null, groundMaterial?: MaterialRef, sun?: { azimuth?: number, altitude?: number, latitude?: number }, showSky?: boolean }` - Updates the lot boundary (null = unbounded), ground material, sun position (partial) or sky.
- `site.setSunTime args { timeOfDay: number, latitude?: number, dayOfYear?: number }` - Places the sun for a local solar time (hours, 12 = noon), latitude (degrees; default the site's stored latitude, else 45; stored as site.sun.latitude) and day of the year (default 172, the June solstice).
- `site.fitBoundary args { margin?: number }` - Sets the lot boundary to a rectangle around everything on the plan plus a margin (cm, default 500), snapped outwards to 50 cm.
- `landscape.add args { kind: "lawn" | "patio" | "driveway" | "path" | "garden-bed" | "pool" | "pond" | "gravel" | "deck" | "sand", polygon: Vec2[], name?: string, material?: MaterialRef, elevation?: number, locked?: boolean, id?: ID }` - Adds a landscape area from a polygon; elevation and finish default per kind.
- `landscape.update args { id: ID, changes: { name?: string, kind?: "lawn" | "patio" | "driveway" | "path" | "garden-bed" | "pool" | "pond" | "gravel" | "deck" | "sand", polygon?: Vec2[], elevation?: number, material?: MaterialRef | null, locked?: boolean | null } }` - Updates a landscape area (null material restores the kind default).
- `landscape.remove args { id: ID }` - Removes a landscape area.
- `fences.add args { points: Vec2[], kind?: "picket" | "panel" | "rail" | "hedge" | "low-wall" | "glass", height?: number, closed?: boolean, material?: MaterialRef, locked?: boolean, id?: ID }` - Adds a fence through points (closed joins the last point to the first).
- `fences.update args { id: ID, changes: { kind?: "picket" | "panel" | "rail" | "hedge" | "low-wall" | "glass", points?: Vec2[], height?: number, closed?: boolean | null, material?: MaterialRef | null, locked?: boolean | null } }` - Updates a fence.
- `fences.remove args { id: ID }` - Removes a fence.
- `roofs.add args { polygon: Vec2[], type?: "flat" | "gable" | "hip" | "shed", pitch?: number, overhang?: number, ridgeAngle?: number, material?: MaterialRef, baseHeight?: number, floorId?: ID, id?: ID }` - Adds a roof over an eave outline (defaults: gable, 30°, no overhang, ridge along the longest side).
- `roofs.auto args { floorId?: ID, at?: Vec2, type?: "flat" | "gable" | "hip" | "shed", pitch?: number, overhang?: number, ridgeAngle?: number, material?: MaterialRef, baseHeight?: number, replace?: boolean, id?: ID }` - Roofs the building(s) of a floor from the exterior wall outline (offset by half the wall thickness plus overhang, default 30 cm); `at` picks one building; existing roofs over it are replaced unless replace=false.
- `roofs.update args { id: ID, changes: { type?: "flat" | "gable" | "hip" | "shed", polygon?: Vec2[], pitch?: number, overhang?: number, ridgeAngle?: number, material?: MaterialRef | null, baseHeight?: number | null } }` - Updates a roof.
- `roofs.remove args { id: ID }` - Removes a roof.
- `storeys.addStorey args { copy?: "envelope" | "walls" | "all" | "none", from?: string, height?: number, name?: string, activate?: boolean, stairs?: boolean, moveRoofs?: boolean }` - Adds a storey directly on top of another one (default: the top storey): its elevation is from.elevation + from.height. Copies the outline of the storey below by default so the new storey has exterior walls and a detected room. If storeys already sit at or above that elevation they are raised by the new height (inserting a storey). When the new storey becomes the top one, the roofs of the storey below move up onto it (moveRoofs). One undo step. Returns the new floor.
- `storeys.stack args { count: integer, copy?: "envelope" | "walls" | "all" | "none", height?: number, stairs?: boolean }` - Adds `count` storeys on top of the building, one above the other (each like storeys.addStorey on the current top storey, copying from the storey just below it). Roofs move up to the new top. One undo step for the whole stack. Returns the new floors, bottom to top.
- `storeys.addBasement args { height?: number, copy?: "envelope" | "none", name?: string, activate?: boolean, stairs?: boolean }` - Adds a storey below the lowest one: elevation = lowest.elevation - height (negative elevations are below ground level). Copies the exterior walls of the lowest storey by default. One undo step. Returns the new floor.
- `storeys.fromFootprint args { polygon: { x: number, y: number }[], storeys: integer, height?: number, thickness?: number, names?: string[], roof?: "gable" | "hip" | "flat" | "shed" | "none", pitch?: number, stairs?: boolean, replace?: boolean }` - Builds a complete multi-storey shell from a footprint polygon: on each storey closed exterior walls along the polygon (wall center lines), a detected room named after the storey, a straight staircase on every storey except the top one (placed inside along an exterior wall, clear of walls and of the stairwell below), and a roof on the top storey. Storeys are stacked from ground level 0 with conventional names. If every existing floor is empty (a new project) they are reused/removed; otherwise the new storeys are built on top of the existing building unless replace is true (which removes all existing floors and their content). Makes the ground storey active. One undo step. Returns { floors, roofs }. Example: a 10 x 8 m house = polygon [{x:0,y:0},{x:1000,y:0},{x:1000,y:800},{x:0,y:800}].
- `storeys.addStairs args { floorId?: string, position?: { x: number, y: number }, rotation?: number }` - Places a straight staircase (catalog item stairs-straight, 100 cm wide, about 107 cm of run per metre of rise) on a storey, climbing to the storey directly above; its slab opening and guard rails above are created automatically. The storey above must start where this one ends (within 30 cm). Without a position it is placed along an exterior wall where it fits clear of walls on both storeys, furniture and the stairwell coming up from below; fails with CONFLICT if nothing fits (then pass position). One undo step. Returns the staircase item.
- `storeys.renumber()` - Renames all storeys by elevation with conventional names: storeys below ground level (elevation < 0) are 'Basement', 'Basement 2', ... (deeper ones get higher numbers); the lowest storey at or above 0 is 'Ground floor', then '1st floor', '2nd floor', '3rd floor', '4th floor', ... One undo step (none if nothing changes). Returns the floors bottom to top.
- `terrain.clear()` - Removes all terrain data from the project (back to the flat ground). One undo step. Returns { removed } (false when there was none).
- `terrain.generate args { preset: "flat" | "slope" | "hill" | "valley" | "ridge" | "terraced" | "rolling", relief?: number, grade?: number, direction?: number, base?: number, center?: { x: number, y: number }, terraces?: integer, seed?: integer, spacing?: number, bounds?: { minX: number, minY: number, maxX: number, maxY: number }, keepPads?: boolean }` - Creates the existing ground (EG) from a procedural preset, replacing all survey points and breaklines (pads, boundary and settings are kept unless keepPads is false). Use it for concept design when there is no survey; import a real survey with terrain.importSurvey. Presets: 'flat' (level at base), 'slope' (a plane falling grade % towards direction), 'hill' (a mound of height relief at center), 'valley' (a trough along direction, relief deep), 'ridge' (a crest along direction, relief high), 'terraced' (terraces stepping down towards direction over relief), 'rolling' (smooth random undulation of amplitude relief, varied by seed). Elevations are relative to base (default -1 cm = the app's flat ground); the house's ground floor is at 0, so a hill under a house buries it until you grade a pad (terrain.padForBuilding). Plan coordinates in cm: x to the right, y downwards on the plan (north is up, i.e. -y). Elevations z in cm above the project datum: 0 = base of the ground floor; the app draws flat ground at -1 cm. One undo step. Returns { preset, points, spacing, bounds, min, max } (elevations cm). Example: { preset: 'slope', grade: 8, direction: 1.5708 } = ground falling 8 % towards +y (towards the bottom of the plan, south).
- `terrain.addPoints args { points: { id?: string, x: number, y: number, z: number, code?: string }[] }` - Adds survey points (spot elevations) to the existing ground; the surface is a TIN through all points (linear between them, flat beyond the outermost ones). Plan coordinates in cm: x to the right, y downwards on the plan (north is up, i.e. -y). Elevations z in cm above the project datum: 0 = base of the ground floor; the app draws flat ground at -1 cm. Max 20000 points in total. One undo step. Returns { added, total, ids }.
- `terrain.importSurvey args { text: string, format?: "PNEZD" | "PENZD" | "PXYZD" | "XYZ" | "NEZ" | "ENZ", units?: "m" | "cm" | "mm" | "ft" | "usft", origin?: "min" | "centroid" | { easting: number, northing: number } | null, elevationDatum?: number, flipY?: boolean, replace?: boolean }` - Imports survey points from CSV / TSV / whitespace text as exported by total stations and civil software. Columns by format: PNEZD = point, northing, easting, elevation, description; PENZD / PXYZD = point, easting, northing, elevation, description; XYZ / ENZ = easting, northing, elevation; NEZ = northing, easting, elevation. Header, blank and comment lines (# // ;) are skipped; bad lines are reported, not fatal. Easting becomes plan x and northing plan -y (north up). Use origin to bring large grid coordinates near the plan origin, and always give elevationDatum (the survey level of the finished ground floor, file units) for real surveys: z = 0 is the ground floor, so absolute elevations (e.g. 251 m) bury the house. One undo step. Returns { imported, total, skipped, errors: [{line, message, text}] (first 50), errorCount, origin, warnings } (warnings: e.g. imported ground far from the floor level, with a suggested elevationDatum).
- `terrain.removePoints args { ids?: string[], within?: { x: number, y: number }[], all?: boolean }` - Removes survey points by id and/or all points inside a plan polygon (cm). Give ids, within or both (a point matching either is removed); all: true removes every point. One undo step (none when nothing matches). Returns { removed, total }.
- `terrain.addBreakline args { points: { x: number, y: number, z: number }[], kind?: "hard" | "soft", id?: string }` - Adds a breakline: a 3D polyline the existing ground follows between its vertices (kerbs, ridge lines, top / toe of banks, ditch flow lines, retaining-wall tops). The TIN is made conforming (breakline segments become triangle edges, even with survey shots a few cm beside them), so the TIN follows it exactly; the raster surfaces sample it at the grid resolution, so a sharp break is rounded over one grid cell. Parts far outside the terrain extent are ignored. 'hard' = a sharp grade break (densified every resolution / 2), 'soft' = a guide line (every resolution). Plan coordinates in cm: x to the right, y downwards on the plan (north is up, i.e. -y). Elevations z in cm above the project datum: 0 = base of the ground floor; the app draws flat ground at -1 cm. One undo step. Returns the breakline { id, points, kind }.
- `terrain.removeBreakline args { id: string }` - Removes a breakline by id. One undo step. Returns { removed: true }; NOT_FOUND for an unknown id.
- `terrain.setBoundary args { polygon: { x: number, y: number }[] | null }` - Sets the extent of the terrain surface (plan polygon, cm), or null to use the default: the lot boundary (site.boundary), else the plan content bounds plus 5 m (grown to include all survey points). Make it larger than the lot when grading slopes must continue onto neighbouring land. One undo step. Returns { boundary } (null = default).
- `terrain.addPad args { polygon: { x: number, y: number }[], elevation: number, cutSlope?: number, fillSlope?: number, fall?: number, fallFrom?: { x: number, y: number }[], name?: string, kind?: "building" | "patio" | "road" | "custom", id?: string }` - Adds a grading pad: a flat area at a finished-grade elevation (building pad, patio, parking / road bed) whose edges daylight into the existing ground with cut slopes (where the ground is higher) and fill slopes (where it is lower). Later pads win inside their own outline. Plan coordinates in cm: x to the right, y downwards on the plan (north is up, i.e. -y). Elevations z in cm above the project datum: 0 = base of the ground floor; the app draws flat ground at -1 cm. Typical pad elevations: building pad = finished floor - 15 cm (use terrain.padForBuilding), patio = floor - 2..15 cm. One undo step. Returns { pad, earthwork } with the pad's cut / fill in m³.
- `terrain.updatePad args { id: string, changes: { polygon?: { x: number, y: number }[], elevation?: number, cutSlope?: number, fillSlope?: number, fall?: number, fallFrom?: { x: number, y: number }[], name?: string, kind?: "building" | "patio" | "road" | "custom" } }` - Changes a pad (only the given fields). One undo step. Returns { pad, earthwork }. Example: lower a pad by setting changes.elevation.
- `terrain.removePad args { id: string }` - Removes a pad by id. One undo step. Returns { removed: true }; NOT_FOUND for an unknown id.
- `terrain.padForBuilding args { floorId?: string, offset?: number, elevation?: number, cutSlope?: number, fillSlope?: number, fall?: number }` - Grades a building pad for every building (closed exterior wall outline) of a storey standing on the ground: the outline at the outer wall faces grown by offset (apron around the foundation), at elevation at the walls (default: floor elevation - 15 cm, the 6 in foundation clearance of IRC R404.1.6) falling away from them at fall % (default 5, IRC R401.3), with 2:1 cut and 3:1 fill side slopes. Ids 'building-1', 'building-2'...; replaced when called again. Where the ground all round is higher than the pad (a pit, e.g. flat ground at -1 cm with the floor at 0) water runs toward the house and terrain.check reports drainage-fall: warnings then says how high the finished floor must be (adjacent ground + 15.24 cm clearance + 15.24 cm fall); raise it (floors.update) and call this again. One undo step. Returns { pads, earthwork (m³ per pad), warnings }.
- `terrain.settings args { resolution?: number | null, contourInterval?: number, majorEvery?: integer, gradeSiteAreas?: boolean, material?: string, showContours?: boolean, showSpots?: boolean, showPads?: boolean }` - Reads or changes the terrain settings (contour interval, grid resolution, site-area grading, 3D material, what the plan shows). Pass only the fields to change; with no fields it just returns the settings. Creates empty terrain data when the project has none. One undo step when something changes. Returns the settings.
- `roofStyles.add args { style: "gable" | "hip" | "pyramid" | "shed" | "flat" | "saltbox" | "jerkinhead" | "dutch-gable" | "gambrel" | "mansard" | "bonnet" | "butterfly" | "sawtooth" | "clerestory" | "m-shaped" | "a-frame" | "barrel" | "bow" | "dome" | "conical", floorId?: string, at?: { x: number, y: number }, outline?: { x: number, y: number }[], pitch?: number, rise?: number, overhang?: number, ridgeAngle?: number | null, baseHeight?: number | null, material?: string | null, params?: { upperPitch?: number, breakHeight?: number, ridgeOffset?: number, clip?: number, bays?: integer, clerestoryHeight?: number, split?: number, parapet?: number, rise?: number, segments?: integer }, name?: string, replaceCoreRoofs?: boolean }` - Adds a styled roof over a building: by default the largest building of the top storey with walls (or the building containing 'at', or an explicit wall-line 'outline'). The outline is the exterior face of the exterior walls; eaves = outline + overhang. Defaults per style (pitch, overhang, material): see roofStyles.styles(). With replaceCoreRoofs (default true) the core roofs (roofs.*) of that storey whose centre lies under the new roof are removed so they do not overlap. One undo step. Returns the stored roof (StyledRoof). Example: { "options": { "style": "gambrel", "rise": 12 } }, { "options": { "style": "flat", "params": { "parapet": 60 } } }. Units: cm for lengths/heights, degrees for pitches (rise x:12 = inches per 12 of run, pitch = atan(rise / 12)); plan x right, y down.
- `roofStyles.update args { id: string, changes: { style?: "gable" | "hip" | "pyramid" | "shed" | "flat" | "saltbox" | "jerkinhead" | "dutch-gable" | "gambrel" | "mansard" | "bonnet" | "butterfly" | "sawtooth" | "clerestory" | "m-shaped" | "a-frame" | "barrel" | "bow" | "dome" | "conical", outline?: { x: number, y: number }[], pitch?: number, rise?: number, overhang?: number, ridgeAngle?: number | null, baseHeight?: number | null, material?: string | null, params?: object | null, name?: string } }` - Changes a styled roof: style, outline, pitch (degrees) or rise (x:12), overhang (cm), ridgeAngle (radians), baseHeight (cm), material, params (merged into the current params; a null value removes a key) or name. Dormers are kept (check() reports any that no longer fit). One undo step. Returns the updated roof. Example: { "options": { "id": "sroof1", "changes": { "style": "hip", "rise": 6 } } }. Units: cm for lengths/heights, degrees for pitches (rise x:12 = inches per 12 of run, pitch = atan(rise / 12)); plan x right, y down.
- `roofStyles.remove args { id: string }` - Removes a styled roof (with its dormers). One undo step. Returns { removed: true, id }.
- `roofStyles.addDormer args { roofId: string, type?: "gable" | "shed" | "hip" | "eyebrow", at: { x: number, y: number }, width?: number, height?: number, pitch?: number }` - Adds a dormer (gable, shed, hip or eyebrow) on a sloped plane of a styled roof. 'at' is the plan point (cm) where the dormer front stands; the dormer extends upslope from it. It must lie on a pitched plane of a style that supports dormers (not flat, butterfly, sawtooth, clerestory, curved or conical), fully inside that plane, below the ridge and >= 30 cm from hips, valleys, rakes and other dormers — otherwise INVALID_ARGUMENT explains why. Defaults: width 120 cm, front height 110 cm, pitch from the host slope. One undo step. Returns the dormer. Example: { "options": { "roofId": "sroof1", "type": "gable", "at": { "x": 300, "y": 620 } } }. Units: cm for lengths/heights, degrees for pitches (rise x:12 = inches per 12 of run, pitch = atan(rise / 12)); plan x right, y down.
- `roofStyles.removeDormer args { roofId: string, dormerId: string }` - Removes a dormer from a styled roof. One undo step. Returns { removed: true, roofId, dormerId }.
- `roofStyles.adopt args { roofId: string, style?: "gable" | "hip" | "pyramid" | "shed" | "flat" | "saltbox" | "jerkinhead" | "dutch-gable" | "gambrel" | "mansard" | "bonnet" | "butterfly" | "sawtooth" | "clerestory" | "m-shaped" | "a-frame" | "barrel" | "bow" | "dome" | "conical", name?: string }` - Converts a core roof (roofs.list / floor.roofs, types gable, hip, shed, flat) into a styled roof of the same storey, keeping its outline (eave polygon minus the overhang), pitch, overhang, ridge angle, base height and material, then removes the core roof. style defaults to the core type (e.g. 'hip'); pass any style to restyle it (e.g. 'mansard'). One undo step. Returns the new StyledRoof.

## Outdoor catalog

### Outdoor furniture

- `patio-table` Patio table 150×90×74, no front
- `patio-chair` Patio chair 55×55×85
- `sun-lounger` Sun lounger 70×195×40
- `garden-bench` Garden bench 150×60×85
- `parasol` Parasol 250×250×240, no front
- `sun-lounger-teak` Teak sun lounger 200×70×85
- `hammock` Hammock with stand 380×120×130
- `picnic-table` Picnic table 180×160×75, no front
- `pool-umbrella` Cantilever umbrella 300×300×260, no front
- `outdoor-sofa` Outdoor sofa 200×85×75
- `outdoor-sectional` Outdoor corner sofa 260×220×75
- `outdoor-lounge-chair` Outdoor lounge chair 80×85×75
- `adirondack-chair` Adirondack chair 75×90×95
- `porch-rocker` Porch rocking chair 65×90×105
- `porch-swing` Porch swing 180×150×210
- `egg-chair-hanging` Hanging egg chair 110×110×195
- `outdoor-daybed` Canopy daybed 210×150×200
- `outdoor-coffee-table` Outdoor coffee table 110×60×38, no front
- `bistro-set` Bistro set 150×80×90
- `outdoor-dining-set` Outdoor dining set (6) 240×180×90
- `patio-heater` Patio heater 80×80×225, no front
- `outdoor-rug` Outdoor rug 240×170×1, no front
- `deck-box` Deck storage box 130×60×62
- `outdoor-bar-set` Outdoor bar set 160×70×110
- `double-lounger` Double sun lounger 150×200×80
- `outdoor-bean-bag` Outdoor bean bag 90×90×70, no front
- `outdoor-side-table` Outdoor side table 50×50×50, no front
- `rattan-loveseat` Rattan loveseat 140×80×80
- `cafe-table-round` Round café table 70×70×74, no front

### Landscape & plants

- `planter` Planter box 100×40×45, no front
- `tree` Tree 250×250×450
- `tree-oak` Oak tree 700×700×900, no front
- `tree-maple` Red maple 600×600×850, no front
- `tree-birch` Silver birch 400×400×900, no front
- `tree-spruce` Spruce 350×350×1000, no front
- `tree-pine` Scots pine 500×500×1100, no front
- `tree-palm` Palm tree 450×450×800, no front
- `tree-cypress` Italian cypress 150×150×800, no front
- `tree-apple` Apple tree 400×400×450, no front
- `tree-willow` Weeping willow 700×700×800, no front
- `tree-japanese-maple` Japanese maple 350×300×300, no front
- `tree-cherry` Cherry blossom 500×500×550, no front
- `tree-olive` Olive tree 350×350×400, no front
- `tree-magnolia` Magnolia 450×450×500, no front
- `tree-lemon` Lemon tree 300×300×350, no front
- `tree-blue-spruce` Blue spruce 320×320×850, no front
- `shrub-boxwood` Boxwood ball 70×70×65, no front
- `hedge-block` Hedge section 200×60×120, no front
- `shrub-topiary-cone` Topiary cone 60×60×160, no front
- `shrub-hydrangea` Hydrangea 120×120×100, no front
- `shrub-rose` Rose bush 90×90×110, no front
- `plant-lavender` Lavender 100×50×55, no front
- `plant-ornamental-grass` Ornamental grass 90×90×110, no front
- `plant-fern` Fern 80×80×60, no front
- `plant-hosta` Hosta 90×90×55, no front
- `shrub-juniper` Spreading juniper 150×120×60, no front
- `plant-bamboo` Bamboo clump 120×120×350, no front
- `plant-agave` Agave 100×100×70, no front
- `plant-cactus` Saguaro cactus 80×45×190, no front
- `flower-bed` Flower bed 200×100×40, no front
- `flower-bed-round` Round flower bed 180×180×45, no front
- `flower-tulips` Tulip border 150×40×45, no front
- `flower-sunflowers` Sunflower row 150×40×160, no front
- `rock-boulder` Boulder 120×90×70, no front
- `rock-cluster` Rock cluster 180×120×60, no front
- `stepping-stones` Stepping stones 70×260×5, no front
- `planter-pot-large` Large pot with shrub 70×70×120, no front
- `raised-bed` Raised garden bed 240×120×60, no front
- `vegetable-patch` Vegetable patch 300×200×60, no front
- `planter-trough` Corten planter 180×45×90
- `compost-bin` Compost bin 100×90×90, no front
- `tree-linden` Linden tree 600×600×1000, no front
- `tree-dogwood` Flowering dogwood 450×450×450, no front
- `tree-jacaranda` Jacaranda 650×650×700, no front
- `shrub-azalea` Azalea 110×110×80, no front
- `shrub-arborvitae` Arborvitae 80×80×250, no front
- `plant-peony` Peony 70×70×75, no front
- `herb-spiral` Herb spiral 200×200×80, no front
- `green-wall` Living wall panel 150×15×200, on the wall at 40 cm
- `wildflower-meadow` Wildflower meadow 300×200×50, no front
- `rock-garden` Alpine rockery 250×180×70, no front
- `planter-box-wood` Wooden planter box 120×45×75
- `hanging-basket` Hanging flower basket 45×45×70, on the wall at 150 cm, no front
- `stone-lantern` Stone lantern 60×60×150
- `water-lilies` Water lilies 150×120×12, no front
- `rock-waterfall` Rock waterfall 220×150×140, no front
- `tree-copper-beech` Copper beech 800×800×1000, no front
- `tree-ginkgo` Ginkgo 450×450×900, no front
- `tree-plum` Plum tree 400×400×450, no front
- `tree-plane` Plane tree 900×900×1200, no front
- `shrub-lilac` Lilac 180×180×250, no front
- `topiary-standard` Topiary standard 60×60×150, no front
- `plant-yucca` Yucca 120×120×160, no front
- `flower-daffodils` Daffodils 60×60×40, no front
- `plant-pampas-grass` Pampas grass 150×150×220, no front
- `plant-tomato` Tomato plants 120×50×140, no front
- `planter-urn` Stone urn planter 70×70×110, no front
- `tree-stump` Tree stump seat 60×60×45, no front
- `plant-succulent-bowl` Succulent bowl 60×60×30, no front
- `ivy-obelisk` Climber obelisk 50×50×200, no front

### Exterior & structures

- `bbq-grill` BBQ grill 120×60×110
- `pergola` Pergola 400×300×260
- `gazebo` Gazebo 360×360×340
- `garden-shed` Garden shed 250×200×240
- `carport` Carport 320×560×260
- `greenhouse` Greenhouse 300×200×250
- `garage-door-panel` Sectional garage door 260×12×230, on the wall at 0 cm
- `awning` Retractable awning 300×160×70, on the wall at 210 cm
- `fence-gate` Garden gate 130×14×125
- `trellis` Trellis with climber 120×40×200
- `garden-arbor` Rose arbor 160×70×240
- `hot-tub` Hot tub 220×220×95, no front
- `pool-above-ground` Above-ground pool 460×460×125, no front
- `pool-ladder` Pool ladder 60×90×140
- `pool-float` Pool lounger float 180×80×22, no front
- `swing-set` Swing set 340×180×220
- `slide` Playground slide 90×360×210
- `trampoline` Trampoline 370×370×260, no front
- `sandbox` Sandbox 180×180×35, no front
- `playhouse` Playhouse 180×150×220
- `basketball-hoop` Basketball hoop 120×160×350
- `doghouse` Doghouse 90×110×95
- `car-sedan` Sedan car 470×185×145
- `car-suv` SUV 480×195×175
- `car-hatchback` Hatchback car 410×180×150
- `bicycle` Bicycle 175×60×105
- `motorcycle` Motorcycle 215×80×115
- `lamp-post` Lamp post 45×45×320, no front
- `bollard-light` Bollard light 22×22×85, no front
- `path-light` Garden path light 22×22×55, no front
- `mailbox` Mailbox 30×55×120
- `bench-park` Park bench 180×65×82
- `bike-rack` Bike rack 180×50×80
- `trash-bins` Wheelie bins 135×75×110
- `fountain` Tiered fountain 200×200×180, no front
- `bird-bath` Bird bath 55×55×80, no front
- `fire-pit` Fire pit 120×120×55, no front
- `outdoor-kitchen` Outdoor kitchen 300×80×120
- `grill-kettle` Kettle grill 65×65×100
- `solar-array` Solar panel array 420×220×150
- `ac-condenser` AC condenser unit 95×40×85
- `water-tank` Rainwater tank 150×150×200, no front
- `clothesline` Rotary clothesline 260×260×185
- `wheelbarrow` Wheelbarrow 150×65×70
- `pergola-louvered` Louvered pergola 400×350×270
- `sun-sail` Shade sail 500×400×300, no front
- `sauna-barrel` Barrel sauna 240×200×215
- `outdoor-shower` Outdoor shower 90×60×230
- `pool-diving-board` Diving board 70×300×70
- `outdoor-fireplace` Outdoor fireplace 180×90×300
- `pizza-oven` Wood-fired pizza oven 120×110×190
- `gas-grill` Gas grill 150×65×120
- `firewood-store` Firewood store 200×70×180
- `chicken-coop` Chicken coop 200×110×160
- `bee-hive` Beehive 55×50×80
- `rain-barrel` Rain barrel 65×65×110, no front
- `ev-charger` EV charging station 35×25×150
- `wall-lantern` Outdoor wall lantern 22×25×40, on the wall at 180 cm
- `festoon-lights` Festoon string lights 600×30×280, no front
- `flagpole` Flagpole 120×40×700, no front
- `driveway-gate` Driveway gate 400×20×160
- `garden-steps` Garden steps 150×120×60
- `bird-feeder` Bird feeder 40×40×180
- `soccer-goal` Soccer goal 300×150×200
- `ping-pong-table` Outdoor table tennis table 274×153×76, no front
- `seesaw` Seesaw 300×50×90
- `car-van` Minivan 510×195×180
- `bike-shelter` Bike shelter 220×120×160
- `garage-detached` Detached garage 350×650×300
- `pool-slide` Pool slide 120×350×230
- `tire-swing` Tire swing 200×150×230
- `climbing-frame` Climbing frame 350×250×260
- `garden-bridge` Garden bridge 300×120×90
- `sundial` Sundial 45×45×100, no front
- `garden-gnome` Garden gnome 25×25×45
- `potting-bench` Potting bench 140×60×140
- `hose-reel` Hose reel cart 60×50×85
- `garden-spotlight` Garden spotlight 15×20×35
- `wall-fountain` Wall fountain 80×35×120
- `car-pickup` Pickup truck 560×200×190
- `golf-cart` Golf cart 240×120×180
- `kayak` Kayak 350×65×40

## Retail products

Real products of shops (added by plugins such as the Norwegian Kit), usable like any `catalogId`: furniture with `items.add`, doors and windows with `openings.add`. Prefer them when the user wants to buy what they plan or names a shop. Prices are indicative.

### IKEA

- `no-ikea-kivik-3` KIVIK 3-seat sofa (IKEA) 228×95×83, ca. 7995 NOK
- `no-ikea-ektorp-3` EKTORP 3-seat sofa (IKEA) 218×88×88, ca. 5995 NOK
- `no-ikea-friheten` FRIHETEN corner sofa-bed (IKEA) 230×151×66, ca. 7995 NOK
- `no-ikea-klippan` KLIPPAN 2-seat sofa (IKEA) 180×88×66, ca. 2995 NOK
- `no-ikea-poang` POÄNG armchair (IKEA) 68×82×100, ca. 1290 NOK
- `no-ikea-strandmon` STRANDMON wing chair (IKEA) 82×96×101, ca. 3495 NOK
- `no-ikea-lack-coffee` LACK coffee table (IKEA) 90×55×45, ca. 299 NOK
- `no-ikea-lack-side` LACK side table (IKEA) 55×55×45, ca. 149 NOK
- `no-ikea-besta-tv` BESTÅ TV bench (IKEA) 180×42×38, ca. 1795 NOK
- `no-ikea-billy` BILLY bookcase (IKEA) 80×28×202, ca. 699 NOK
- `no-ikea-kallax-4x4` KALLAX shelving unit 4×4 (IKEA) 147×39×147, ca. 1199 NOK
- `no-ikea-hektar-floor` HEKTAR floor lamp (IKEA) 37×37×181, ca. 699 NOK
- `no-ikea-stoense` STOENSE rug 170×240 (IKEA) 170×240×1, ca. 1499 NOK
- `no-ikea-malm-bed-160` MALM bed frame 160×200 (IKEA) 176×209×100, ca. 2999 NOK
- `no-ikea-malm-bed-180` MALM bed frame 180×200 (IKEA) 196×209×100, ca. 3499 NOK
- `no-ikea-malm-6` MALM chest of 6 drawers (IKEA) 160×48×78, ca. 2299 NOK
- `no-ikea-hemnes-nightstand` HEMNES bedside table (IKEA) 46×35×70, ca. 999 NOK
- `no-ikea-pax-100` PAX wardrobe 100 cm (IKEA) 100×58×201, ca. 2895 NOK
- `no-ikea-pax-200` PAX wardrobe 200 cm (IKEA) 200×66×236, ca. 6995 NOK
- `no-ikea-micke` MICKE desk (IKEA) 105×50×75, ca. 799 NOK
- `no-ikea-alex-desk` ALEX desk (IKEA) 132×58×76, ca. 1890 NOK
- `no-ikea-markus` MARKUS office chair (IKEA) 62×60×135, ca. 1999 NOK
- `no-ikea-ekedalen` EKEDALEN extendable table (IKEA) 180×80×75, ca. 2495 NOK
- `no-ikea-lisabo` LISABO table (IKEA) 140×78×74, ca. 2190 NOK
- `no-ikea-ingolf` INGOLF chair (IKEA) 43×52×91, ca. 649 NOK
- `no-ikea-stefan` STEFAN chair (IKEA) 42×49×90, ca. 399 NOK
- `no-ikea-ivar` IVAR shelving unit (pine) (IKEA) 89×30×179, ca. 1235 NOK
- `no-ikea-hemnes-shoe` HEMNES shoe cabinet (IKEA) 89×30×127, ca. 1999 NOK
- `no-ikea-metod-base` METOD base cabinet 60 cm (IKEA) 60×62×88, ca. 1450 NOK
- `no-ikea-metod-sink` METOD sink cabinet 80 cm (IKEA) 80×62×88, ca. 3290 NOK
- `no-ikea-metod-wall` METOD wall cabinet 60 cm (IKEA) 60×37×80, ca. 990 NOK
- `no-ikea-metod-tall` METOD high cabinet (oven/micro) (IKEA) 60×62×228, ca. 3590 NOK
- `no-ikea-godmorgon` GODMORGON wash-stand with basin (IKEA) 80×49×64, ca. 3990 NOK
- `no-ikea-tuffing` TUFFING bunk bed (IKEA) 96×207×130, ca. 1290 NOK
- `no-ikea-sundvik-cot` SUNDVIK cot (IKEA) 66×123×80, ca. 1499 NOK
- `no-ikea-trofast` TROFAST storage combination (IKEA) 99×44×94, ca. 999 NOK
- `no-ikea-applaro-table` ÄPPLARÖ garden table (IKEA) 140×78×72, ca. 1990 NOK
- `no-ikea-applaro-chair` ÄPPLARÖ garden chair (IKEA) 56×64×87, ca. 599 NOK

### Bohus

- `no-bohus-continental-180` Continental bed 180×200 (Bohus) 180×200×120, ca. 14990 NOK
- `no-bohus-corner-sofa` Corner sofa (Bohus) 290×165×85, ca. 19990 NOK
- `no-bohus-recliner` Recliner (Bohus) 85×90×105, ca. 9990 NOK
- `no-bohus-dining-oak` Oak dining table (Bohus) 200×95×75, ca. 12990 NOK
- `no-bohus-sideboard` Sideboard (Bohus) 180×45×80, ca. 8990 NOK

### Skeidar

- `no-skeidar-continental-160` Continental bed 160×200 (Skeidar) 160×200×120, ca. 11990 NOK
- `no-skeidar-sofa-3` 3-seat sofa (Skeidar) 220×92×84, ca. 12990 NOK
- `no-skeidar-coffee-table` Coffee table (Skeidar) 90×90×42, ca. 3990 NOK
- `no-skeidar-dining-set` Dining chair (Skeidar) 48×55×88, ca. 1990 NOK

### JYSK

- `no-jysk-continental-90` Continental bed 90×200 (JYSK) 90×200×115, ca. 3999 NOK
- `no-jysk-wardrobe` Wardrobe (JYSK) 100×52×200, ca. 1999 NOK
- `no-jysk-garden-set` Garden lounge set (JYSK) 240×200×75, ca. 6999 NOK
- `no-jysk-sun-lounger` Sun lounger (JYSK) 65×190×40, ca. 899 NOK
- `no-jysk-parasol` Parasol (JYSK) 300×300×245, ca. 999 NOK

### Maxbo

- `no-maxbo-window-10x12` Window 10×12 · 990 × 1190 (Maxbo) 99×12×119 (window), ca. 5990 NOK
- `no-maxbo-window-12x12` Window 12×12 · 1190 × 1190 (Maxbo) 119×12×119 (window), ca. 6990 NOK
- `no-maxbo-window-15x15-pivot` Top-hung pivot window 15×15 (Maxbo) 149×12×149 (window), ca. 9490 NOK
- `no-maxbo-window-6x6` Small window 6×6 · 590 × 590 (Maxbo) 59×12×59 (window), ca. 3490 NOK
- `no-maxbo-patio-door` Terrace door 10×21 (Maxbo) 99×12×209 (door), ca. 11990 NOK
- `no-maxbo-front-door` Front door 10×21 (Maxbo) 99×12×209 (door), ca. 14990 NOK
- `no-maxbo-interior-door-9` Interior door 9×21 (Maxbo) 89×10×209 (door), ca. 2490 NOK
- `no-maxbo-interior-door-10` Interior door 10×21, step-free (Maxbo) 99×10×209 (door), ca. 2790 NOK
- `no-maxbo-jotul-f100` Jøtul F 100 wood stove (Maxbo) 52×45×230, ca. 14990 NOK
- `no-maxbo-stairs` Straight timber staircase (Maxbo) 90×300×280, ca. 19990 NOK
- `no-maxbo-shed` Garden shed (bod) (Maxbo) 250×200×240, ca. 24990 NOK
- `no-maxbo-carport` Carport (Maxbo) 320×560×260, ca. 34990 NOK
- `no-maxbo-firewood` Firewood shelter (vedskjul) (Maxbo) 200×70×180, ca. 3990 NOK
- `no-maxbo-flagpole` Flagpole 8 m with Norwegian flag (Maxbo) 210×40×800, ca. 5990 NOK
- `no-maxbo-ventilation` Balanced ventilation unit with heat recovery (Maxbo) 60×55×90, ca. 32990 NOK

### Byggmax

- `no-byggmax-shed-small` Tool shed (Byggmax) 220×180×225, ca. 14990 NOK
- `no-byggmax-shower-90` Shower enclosure 90×90 (Byggmax) 90×90×200, ca. 3490 NOK
- `no-byggmax-bathtub` Bathtub 170 × 75 (Byggmax) 170×75×58, ca. 4990 NOK
- `no-byggmax-toilet` Wall-hung toilet (Byggmax) 36×53×40, ca. 2990 NOK
- `no-byggmax-greenhouse` Greenhouse (Byggmax) 300×200×250, ca. 9990 NOK
- `no-byggmax-compost` Compost bin (Byggmax) 100×90×90, ca. 1290 NOK

### Obs BYGG

- `no-obsbygg-trampoline` Trampoline Ø 430 cm (Obs BYGG) 430×430×270, ca. 3999 NOK
- `no-obsbygg-hot-tub` Hot tub (Obs BYGG) 210×210×90, ca. 49990 NOK
- `no-obsbygg-grill` Charcoal kettle grill (Obs BYGG) 65×65×100, ca. 1999 NOK
- `no-obsbygg-gas-grill` Gas grill (Obs BYGG) 150×65×120, ca. 6999 NOK

### Montér

- `no-monter-garage-door` Sectional garage door (Montér) 250×12×213 (door), ca. 19990 NOK
- `no-monter-loft-stairs` Loft ladder hatch (Montér) 70×120×280, ca. 3990 NOK
- `no-monter-garage` Detached garage (Montér) 350×650×300, ca. 129000 NOK

### Elkjøp

- `no-elkjop-heat-pump` Air-to-air heat pump (indoor unit) (Elkjøp) 80×24×29, ca. 14990 NOK
- `no-elkjop-heat-pump-outdoor` Heat pump outdoor unit (Elkjøp) 80×30×55
- `no-elkjop-fridge-freezer` Fridge-freezer (Elkjøp) 60×66×186, ca. 8990 NOK
- `no-elkjop-dishwasher` Integrated dishwasher (Elkjøp) 60×55×82, ca. 6990 NOK
- `no-elkjop-induction` Induction hob with oven (Elkjøp) 60×60×88, ca. 7990 NOK
- `no-elkjop-hood` Cooker hood (Elkjøp) 60×50×40, ca. 2990 NOK
- `no-elkjop-tv-65` TV 65″ (Elkjøp) 145×8×84, ca. 9990 NOK

### POWER

- `no-power-washer` Washing machine (POWER) 60×60×85, ca. 5990 NOK
- `no-power-washer-dryer` Washer & dryer stack (POWER) 60×65×175, ca. 12990 NOK
- `no-power-microwave` Microwave (POWER) 50×38×30, ca. 1490 NOK
- `no-power-water-heater` Water heater 200 l (POWER) 60×60×150, ca. 9990 NOK

### Jernia

- `no-jernia-mailbox` Mailbox on post (Jernia) 30×55×120, ca. 899 NOK
- `no-jernia-panel-heater` Panel heater (Jernia) 100×9×40, ca. 2490 NOK
- `no-jernia-bike-rack` Bike rack (Jernia) 180×50×80, ca. 1490 NOK

### Clas Ohlson

- `no-clasohlson-pendant` Pendant lamp (Clas Ohlson) 40×40×60, ca. 599 NOK
- `no-clasohlson-table-lamp` Table lamp (Clas Ohlson) 30×30×50, ca. 399 NOK
- `no-clasohlson-wall-lantern` Outdoor wall lantern (Clas Ohlson) 22×25×40, ca. 499 NOK

### Plantasjen

- `no-plantasjen-birch` Birch tree (Plantasjen) 400×400×900, ca. 1499 NOK
- `no-plantasjen-spruce` Norway spruce (Plantasjen) 350×350×1000, ca. 999 NOK
- `no-plantasjen-pine` Scots pine (Plantasjen) 500×500×1100, ca. 1299 NOK
- `no-plantasjen-apple` Apple tree (Plantasjen) 400×400×450, ca. 699 NOK
- `no-plantasjen-lilac` Lilac (Plantasjen) 180×180×250, ca. 399 NOK
- `no-plantasjen-thuja` Thuja hedge plant (Plantasjen) 80×80×200, ca. 299 NOK
- `no-plantasjen-rhododendron` Rhododendron (Plantasjen) 110×110×80, ca. 349 NOK
- `no-plantasjen-raised-bed` Raised bed (pallet collar) (Plantasjen) 120×80×40, ca. 249 NOK

