#!/usr/bin/env node
/**
 * Riva Sai MCP server for the Riva Sai Claude plugin.
 *
 * Riva Sai (https://rivasai.com) is a free 2D/3D home, interior and garden planner in the browser.
 * An assistant designs a home as a *plan script* (a JSON list of Riva Sai API calls) and hands it
 * to the user as a link, https://rivasai.com/#plan=<the script, percent-encoded>, which builds the
 * design in the user's browser.
 *
 * This server helps write those scripts well. It:
 *   - serves the design guide and searches the catalog (data/catalog.json),
 *   - checks a plan script before the user sees it: the format, every call and option against the
 *     API (data/methods.json), catalog ids, materials, facing, references between steps, and the
 *     layout (furniture overlapping, crossing walls, doors and windows away from walls),
 *   - makes the link, and reads back the links and designs the user pastes from the app.
 *
 * Plain Node.js (18+), no dependencies, nothing to install. It reads only its own data files,
 * makes no network requests and writes no files. Transport: MCP over stdio (newline-delimited
 * JSON-RPC 2.0).
 *
 * The data files are generated from the Riva Sai app source (`npm run claude-plugin` in the app
 * repository); this file is hand-written. Source: https://github.com/samsam32118/rivasai-plugin
 */
import { readFileSync, realpathSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const SERVER_VERSION = '1.0.0';
const APP_URL = 'https://rivasai.com';
const MAX_STEPS = 5000;
/** Links longer than this can be cut off by chat apps and browsers. */
const LONG_LINK = 60_000;
/** Largest design accepted from a link or text (bytes), as in the app. */
const MAX_DESIGN_BYTES = 8_000_000;

const readData = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');
const API = JSON.parse(readData('./data/methods.json'));
const CATALOG = JSON.parse(readData('./data/catalog.json')).entries;
const CATALOG_BY_ID = new Map(CATALOG.map((e) => [e.id, e]));
const MATERIAL_IDS = new Set(API.materials.map((m) => m.id));
const FINISH_IDS = new Set(API.finishes.map((f) => f.id));
const TEMPLATE_IDS = API.templates.map((t) => t.id);
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const WALL_THICKNESS = 15;
const TOP_LEVEL = ['freeinterior', 'version', 'name', 'template', 'design', 'basedOn', 'steps'];

// ---------------------------------------------------------------------------
// Reading designs: objects, JSON text, links (#plan= / #p=) and pasted chat messages
// ---------------------------------------------------------------------------

/** A problem with the input that the caller can fix; reported as a tool error. */
class InputError extends Error {}

function decodeFragment(kind, body) {
  if (kind === 'p') {
    // compact links made by the app: '1' + base64url(deflate-raw(JSON))
    if (!body.startsWith('1')) throw new InputError('This link was made by a newer Riva Sai version.');
    const bytes = Buffer.from(body.slice(1), 'base64url');
    try {
      return inflateRawSync(bytes, { maxOutputLength: MAX_DESIGN_BYTES }).toString('utf8');
    } catch {
      throw new InputError('The link is damaged (it could not be unpacked). Ask the user to copy it again.');
    }
  }
  try {
    return decodeURIComponent(body);
  } catch {
    throw new InputError('The link is damaged (bad %-encoding). Ask the user to copy it again.');
  }
}

function parseJson(text, what) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new InputError(`${what} is not valid JSON: ${e.message}`);
  }
}

/** Turns the `design` argument into a JSON value. */
function readDesign(input) {
  if (input && typeof input === 'object') return input;
  if (typeof input !== 'string' || !input.trim()) {
    throw new InputError('Give "design": a plan script (an object or JSON text), a Riva Sai link, or the text the user pasted.');
  }
  const text = input.trim();
  if (text.length > MAX_DESIGN_BYTES) throw new InputError('The design is too large.');
  const link = /#(p|plan|json)=([^\s)"'<>]*)/.exec(text);
  if (link && !text.startsWith('{')) return parseJson(decodeFragment(link[1], link[2]), 'The design in the link');
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  const body = (fenced ? fenced[1] : text).trim();
  const start = body.indexOf('{');
  const end = body.lastIndexOf('}');
  if (start < 0 || end < start) throw new InputError('No design found: expected a Riva Sai link or a JSON plan script.');
  return parseJson(body.slice(start, end + 1), 'The design');
}

const isPlanScript = (v) => !!v && typeof v === 'object' && v.freeinterior === 'plan';
const isProject = (v) => !!v && typeof v === 'object' && Array.isArray(v.floors) && typeof v.version === 'number';

function planLink(script) {
  return `${APP_URL}/#plan=${encodeURIComponent(JSON.stringify(script))}`;
}

// ---------------------------------------------------------------------------
// Checking plan scripts
// ---------------------------------------------------------------------------

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isPoint = (v) => !!v && typeof v === 'object' && isNum(v.x) && isNum(v.y);
const isRef = (v) => typeof v === 'string' && /^\$[A-Za-z_][\w-]*(\.[\w-]+)*$/.test(v);
const fmt = (p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`;

/** Closest names by edit distance, for "did you mean". */
function closest(name, names, count = 3) {
  const dist = (a, b) => {
    const d = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = d[0];
      d[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const keep = d[j];
        d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = keep;
      }
    }
    return d[b.length];
  };
  return names
    .map((n) => [n, dist(name.toLowerCase(), n.toLowerCase())])
    .sort((a, b) => a[1] - b[1])
    .slice(0, count)
    .map(([n]) => n);
}

/** Rotation (radians) for a facing, as in the app: rotation 0 faces south. */
function rotationFor(facing) {
  const degrees = typeof facing === 'number' ? facing : COMPASS.indexOf(facing) * 45;
  const r = (degrees * Math.PI) / 180 - Math.PI;
  return Math.atan2(Math.sin(r), Math.cos(r));
}

/** Corners of a w x d rectangle centred on `c`, turned by `rotation`. */
function rect(c, w, d, rotation) {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return [
    [-w / 2, -d / 2],
    [w / 2, -d / 2],
    [w / 2, d / 2],
    [-w / 2, d / 2],
  ].map(([x, y]) => ({ x: c.x + x * cos - y * sin, y: c.y + x * sin + y * cos }));
}

/** Whether two convex polygons share interior area (separating axis test). */
function overlaps(p, q) {
  for (const poly of [p, q]) {
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const axis = { x: a.y - b.y, y: b.x - a.x };
      const project = (pts) => pts.map((v) => v.x * axis.x + v.y * axis.y);
      const pp = project(p);
      const qq = project(q);
      if (Math.max(...pp) <= Math.min(...qq) + 1e-6 || Math.max(...qq) <= Math.min(...pp) + 1e-6) return false;
    }
  }
  return true;
}

const distanceToSegment = (p, a, b) => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2)) : 0;
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
};

/**
 * Checks a plan script. Returns { errors, warnings, notes }: errors stop the app from building the
 * design (it runs all or nothing), warnings are layout problems the app would highlight, notes are
 * suggestions.
 */
function checkPlan(script) {
  const errors = [];
  const warnings = [];
  const notes = [];
  if (!isPlanScript(script)) {
    errors.push('Not a Riva Sai plan script: expected { "freeinterior": "plan", "version": 1, "steps": [...] }.');
    return { errors, warnings, notes };
  }
  for (const key of Object.keys(script)) {
    if (!TOP_LEVEL.includes(key)) errors.push(`Unknown top-level field "${key}".`);
  }
  if (script.version !== 1) errors.push('"version" must be 1.');
  if (script.template !== undefined && !TEMPLATE_IDS.includes(script.template)) {
    errors.push(`Unknown template "${script.template}"; use one of ${TEMPLATE_IDS.join(', ')}.`);
  }
  if (script.design !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(String(script.design))) {
    errors.push('"design" must be the design id from the pasted brief (letters, digits, - and _).');
  }
  if (!Array.isArray(script.steps)) {
    errors.push('"steps" must be an array.');
    return { errors, warnings, notes };
  }
  if (script.steps.length > MAX_STEPS) errors.push(`A plan script has at most ${MAX_STEPS} steps.`);

  // Layout model of the default floor, from steps with literal coordinates.
  const rooms = []; // { x, y, w, d, thickness }
  const items = []; // { name, at, poly, z0, z1, flat, onFloor, where }
  const openings = []; // { at, kind, width, where }
  let otherWalls = !!script.template; // walls the checker cannot see (templates, walls.add, ...)
  let floorChanged = false;

  const named = new Set();
  script.steps.forEach((step, i) => {
    const where = `step ${i + 1}${step && typeof step.call === 'string' ? ` (${step.call})` : ''}`;
    if (!step || typeof step !== 'object' || Array.isArray(step)) {
      return errors.push(`${where}: each step must be an object { "call", "args", "as" }.`);
    }
    for (const key of Object.keys(step)) {
      if (!['call', 'args', 'as'].includes(key)) {
        warnings.push(`${where}: the field "${key}" is ignored (a step has call, args and as).`);
      }
    }
    if (typeof step.call !== 'string') return errors.push(`${where}: "call" must name a method, e.g. "items.add".`);
    const method = API.methods[step.call];
    if (!method) {
      const guesses = closest(step.call, Object.keys(API.methods)).join(', ');
      return errors.push(`${where}: ${step.call} cannot be used in a plan script. Did you mean ${guesses}?`);
    }
    if (step.as !== undefined) {
      if (typeof step.as !== 'string' || !/^[A-Za-z_][\w-]*$/.test(step.as)) {
        errors.push(`${where}: "as" must be a simple name like "living".`);
      } else if (named.has(step.as)) {
        warnings.push(`${where}: the name "${step.as}" is used twice; later steps refer to the newest one.`);
      }
    }

    // references to earlier results
    const visit = (v) => {
      if (isRef(v)) {
        const name = v.slice(1).split('.')[0];
        if (!named.has(name)) {
          errors.push(`${where}: ${v} refers to no earlier step (name one with "as": "${name}" first).`);
        }
      } else if (Array.isArray(v)) v.forEach(visit);
      else if (v && typeof v === 'object') Object.values(v).forEach(visit);
    };
    visit(step.args);
    if (typeof step.as === 'string') named.add(step.as);

    const args = step.args;
    if (args !== undefined && (args === null || typeof args !== 'object')) {
      return errors.push(`${where}: "args" must be an object (or an array of positional arguments).`);
    }
    // positional arguments, or a plugin method without a published schema: format checks only
    if (Array.isArray(args) || !method.params) return;

    // named parameters, or the options object of a single-options method
    const keys = Object.keys(args ?? {});
    const asParams = keys.length > 0 && keys.every((k) => method.params.includes(k));
    if (!asParams && method.options) {
      const unknown = keys.filter((k) => !method.options.includes(k));
      for (const k of unknown) {
        errors.push(`${where}: "${k}" is not an option of ${step.call} (options: ${method.options.join(', ')}).`);
      }
      for (const k of method.required ?? []) {
        if (!(k in (args ?? {}))) errors.push(`${where}: ${step.call} needs "${k}".`);
      }
    } else if (!asParams && keys.length) {
      errors.push(`${where}: ${step.call} takes ${method.params.join(', ') || 'no parameters'}.`);
    }
    const o = args ?? {};

    // catalog ids, materials and facing
    const material = (field, ids, what) => {
      const id = o[field]?.id;
      if (typeof id === 'string' && !isRef(id) && !ids.has(id)) {
        errors.push(`${where}: unknown ${what} "${id}" in ${field}. Closest: ${closest(id, [...ids]).join(', ')}.`);
      }
    };
    if (typeof o.catalogId === 'string') {
      const entry = CATALOG_BY_ID.get(o.catalogId);
      if (!entry) {
        const guesses = closest(o.catalogId, [...CATALOG_BY_ID.keys()]).join(', ');
        errors.push(`${where}: unknown catalogId "${o.catalogId}". Closest: ${guesses}.`);
      } else if (step.call === 'items.add' && entry.kind !== 'item') {
        errors.push(`${where}: ${o.catalogId} is a ${entry.kind}; add it with openings.add.`);
      } else if (step.call === 'openings.add' && entry.kind === 'item') {
        errors.push(`${where}: ${o.catalogId} is not a door, window or opening; add it with items.add.`);
      }
    }
    if (o.facing !== undefined && !(COMPASS.includes(o.facing) || isNum(o.facing) || isRef(o.facing))) {
      errors.push(`${where}: facing must be one of ${COMPASS.join(', ')} or degrees clockwise from north.`);
    }
    material('floorMaterial', MATERIAL_IDS, 'surface material');
    material('materialLeft', MATERIAL_IDS, 'surface material');
    material('materialRight', MATERIAL_IDS, 'surface material');
    if (step.call === 'rooms.setWallFinish') material('material', MATERIAL_IDS, 'surface material');
    if (step.call === 'items.add') material('material', FINISH_IDS, 'furniture finish');
    const finish = step.call === 'items.update' ? o.changes?.material?.id : undefined;
    if (typeof finish === 'string' && !FINISH_IDS.has(finish)) {
      errors.push(`${where}: unknown furniture finish "${finish}". Closest: ${closest(finish, [...FINISH_IDS]).join(', ')}.`);
    }

    // the layout model
    if (/^(floors|storeys)\./.test(step.call) && !/\.(list|get|active|summary|validate)$/.test(step.call)) {
      floorChanged = true;
    }
    if (/^walls\.(add|addPolyline|split|move|moveEndpoint|remove)$|^rooms\.(add|detect|remove)$/.test(step.call)) {
      otherWalls = true;
    }
    if (floorChanged || o.floorId !== undefined) return;
    if (step.call === 'rooms.createRectangular') {
      for (const k of ['x', 'y', 'width', 'depth']) {
        if (k in o && !isNum(o[k])) errors.push(`${where}: "${k}" must be a number (cm).`);
      }
      if (isNum(o.width) && o.width <= 0) errors.push(`${where}: width must be more than 0.`);
      if (isNum(o.depth) && o.depth <= 0) errors.push(`${where}: depth must be more than 0.`);
      if ([o.x, o.y, o.width, o.depth].every(isNum)) {
        const thickness = isNum(o.thickness) ? o.thickness : WALL_THICKNESS;
        rooms.push({ x: o.x, y: o.y, w: o.width, d: o.depth, thickness });
      }
    }
    if (step.call === 'items.add' && isPoint(o.position)) {
      const entry = CATALOG_BY_ID.get(o.catalogId);
      if (!entry || entry.kind !== 'item') return;
      const dims = { ...entry.dims, ...(o.dims ?? {}) };
      for (const [axis, k] of [['x', 'w'], ['y', 'd'], ['z', 'h']]) {
        if (isNum(o.scale?.[axis])) dims[k] *= o.scale[axis];
      }
      let rotation = 0;
      if (isNum(o.rotation)) rotation = o.rotation;
      else if (o.facing !== undefined && !isRef(o.facing)) rotation = rotationFor(o.facing);
      else if (isPoint(o.faceToward)) {
        rotation = Math.atan2(-(o.faceToward.x - o.position.x), o.faceToward.y - o.position.y);
      }
      // faceToward "$name" (another item) is left at rotation 0: the checks below are approximate there
      const z0 = isNum(o.elevation) ? o.elevation : entry.elevation ?? 0;
      items.push({
        name: o.name ?? entry.name,
        at: o.position,
        poly: rect(o.position, Math.max(0.5, dims.w - 4), Math.max(0.5, dims.d - 4), rotation),
        z0,
        z1: z0 + dims.h,
        flat: dims.h <= 5,
        onFloor: entry.mount === 'floor',
        where,
      });
    }
    if (step.call === 'openings.add' && isPoint(o.at)) {
      const entry = CATALOG_BY_ID.get(o.catalogId);
      const width = isNum(o.width) ? o.width : (entry?.dims.w ?? 90);
      openings.push({ at: o.at, where, kind: entry?.kind ?? 'opening', width });
    }
  });

  // walls of the rectangular rooms: centre lines, with the thickness as a band around them
  const walls = rooms.flatMap((r) => {
    const c = [
      { x: r.x, y: r.y },
      { x: r.x + r.w, y: r.y },
      { x: r.x + r.w, y: r.y + r.d },
      { x: r.x, y: r.y + r.d },
    ];
    return c.map((a, i) => ({ a, b: c[(i + 1) % 4], t: r.thickness }));
  });
  const wallBand = (w) => {
    const len = Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
    const centre = { x: (w.a.x + w.b.x) / 2, y: (w.a.y + w.b.y) / 2 };
    return rect(centre, len + w.t, w.t, Math.atan2(w.b.y - w.a.y, w.b.x - w.a.x));
  };
  const bands = walls.map(wallBand);
  const inRoom = (p) => rooms.find((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.d);

  if (errors.length === 0) {
    for (const it of items) {
      if (it.onFloor && !it.flat && bands.some((b) => overlaps(it.poly, b))) {
        warnings.push(
          `${it.where}: "${it.name}" at ${fmt(it.at)} crosses a wall. Walls are ${WALL_THICKNESS} cm thick on the ` +
            "room lines: against a wall at y = 0 the item's centre is at y = 7.5 + depth / 2.",
        );
      }
      if (rooms.length && !otherWalls && !inRoom(it.at)) {
        notes.push(`${it.where}: "${it.name}" at ${fmt(it.at)} stands outside every room.`);
      }
    }
    for (let i = 0; i < items.length; i++) {
      for (let j = i + 1; j < items.length; j++) {
        const a = items[i];
        const b = items[j];
        if (a.flat || b.flat) continue; // rugs lie under furniture
        if (a.z1 <= b.z0 + 1 || b.z1 <= a.z0 + 1) continue; // one stands on, or hangs above, the other
        if (overlaps(a.poly, b.poly)) warnings.push(`${b.where}: "${b.name}" overlaps "${a.name}" (${a.where}).`);
      }
    }
    if (!otherWalls && walls.length) {
      for (const op of openings) {
        const near = walls
          .map((w) => ({ w, dist: distanceToSegment(op.at, w.a, w.b) }))
          .sort((x, y) => x.dist - y.dist)[0];
        if (near.dist > 30) {
          errors.push(`${op.where}: no wall within 30 cm of ${fmt(op.at)}; put "at" on a wall line.`);
          continue;
        }
        const fromA = Math.hypot(op.at.x - near.w.a.x, op.at.y - near.w.a.y);
        const fromB = Math.hypot(op.at.x - near.w.b.x, op.at.y - near.w.b.y);
        if (Math.min(fromA, fromB) < op.width / 2 + 5) {
          const keep = Math.ceil(op.width / 2 + 10);
          errors.push(`${op.where}: the ${op.kind} at ${fmt(op.at)} does not fit; keep it ${keep} cm or more from a corner.`);
        }
      }
    }
    if (rooms.length && !otherWalls && !openings.some((o) => o.kind === 'door')) {
      notes.push('There are no doors yet: add a front door with openings.add.');
    }
  }
  if (floorChanged) {
    notes.push('The layout checks cover the floor the script starts on; later floors are checked for format only.');
  }
  return { errors, warnings, notes };
}

/** A short summary of a plan script or project for the user. */
function summarize(value) {
  if (isPlanScript(value)) {
    const steps = Array.isArray(value.steps) ? value.steps : [];
    const count = (call) => steps.filter((s) => s && s.call === call).length;
    const rooms = steps
      .filter((s) => s && s.call === 'rooms.createRectangular')
      .map((s) => {
        const a = s.args ?? {};
        const m2 = isNum(a.width) && isNum(a.depth) ? ` ${((a.width * a.depth) / 10_000).toFixed(1)} m²` : '';
        return `- ${a.name ?? 'Room'}:${m2}${m2 ? ' (to wall centre lines)' : ''}`;
      });
    const furniture = steps
      .filter((s) => s && s.call === 'items.add')
      .map((s) => s.args?.name ?? CATALOG_BY_ID.get(s.args?.catalogId)?.name ?? s.args?.catalogId);
    const shown = furniture.slice(0, 40).join(', ') + (furniture.length > 40 ? ', ...' : '');
    const base = value.template ? ` on the ${value.template} template` : '';
    const updates = value.design ? ` (updates design ${value.design})` : '';
    return [
      `Plan script "${value.name ?? 'Untitled'}"${base}${updates}: ${steps.length} steps.`,
      rooms.length ? `Rooms:\n${rooms.join('\n')}` : null,
      `Doors and windows: ${count('openings.add')}.`,
      `Furniture and fixtures: ${furniture.length}${furniture.length ? ` (${shown})` : ''}.`,
    ]
      .filter(Boolean)
      .join('\n');
  }
  if (isProject(value)) {
    const lines = [`Riva Sai project "${value.name ?? 'Untitled'}" (cm; x east, y south, plan up is north).`];
    for (const floor of value.floors) {
      const n = (xs) => xs?.length ?? 0;
      lines.push(
        `${floor.name ?? 'Floor'}: ${n(floor.rooms)} rooms, ${n(floor.walls)} walls, ` +
          `${n(floor.openings)} doors and windows, ${n(floor.items)} items.`,
      );
      for (const room of floor.rooms ?? []) lines.push(`- Room "${room.name ?? 'Room'}"`);
      for (const item of floor.items ?? []) {
        const name = item.name ?? CATALOG_BY_ID.get(item.catalogId)?.name ?? item.catalogId;
        lines.push(`  - ${name} [${item.catalogId}] at ${fmt(item.position)}`);
      }
    }
    return lines.join('\n');
  }
  return 'This is neither a plan script nor a Riva Sai project.';
}

// ---------------------------------------------------------------------------
// Catalog search
// ---------------------------------------------------------------------------

function searchCatalog({ query = '', category, kind, limit = 15 }) {
  const words = String(query).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const scored = [];
  for (const e of CATALOG) {
    if (category && e.category !== category) continue;
    if (kind && e.kind !== kind) continue;
    const id = e.id.toLowerCase();
    const name = e.name.toLowerCase();
    let score = words.length ? 0 : 1;
    for (const w of words) {
      if (id === w || name === w) score += 10;
      else if (id.split('-').includes(w) || name.split(/\s+/).includes(w)) score += 5;
      else if (id.includes(w) || name.includes(w)) score += 2;
      else if (e.category.includes(w)) score += 1;
    }
    if (score > 0) scored.push([score, e]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
  return scored.slice(0, Math.max(1, Math.min(50, limit))).map(([, e]) => e);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };
const DESIGN = {
  description:
    'The design: a plan script (JSON object or JSON text), a Riva Sai link (#plan= or #p=), or a ' +
    'whole message the user pasted.',
  type: ['object', 'string'],
};
const guideFile = (part) => {
  const file = part === 'advanced' ? 'agent-advanced.md' : 'agent.md';
  return readData(`../skills/riva-sai-home-design/references/${file}`);
};

const TOOLS = [
  {
    name: 'riva_guide',
    title: 'Riva Sai design guide',
    description:
      'Returns the Riva Sai guide for designing homes: conventions (centimetres, x east, y south, ' +
      'plan up is north, which way furniture faces), the plan-script format and the methods with the ' +
      'indoor catalog. part "advanced" covers outdoors, terrain, roofs, storeys and the outdoor ' +
      'catalog. Read it before writing a plan script.',
    inputSchema: {
      type: 'object',
      properties: { part: { type: 'string', enum: ['indoor', 'advanced'], description: 'Which guide (default indoor).' } },
      additionalProperties: false,
    },
    run: ({ part }) => ({ text: guideFile(part) }),
  },
  {
    name: 'riva_search_catalog',
    title: 'Search the Riva Sai catalog',
    description:
      'Searches the Riva Sai catalog of furniture, fixtures, doors, windows, plants and exterior ' +
      'items by words (for example "corner sofa", "bunk bed", "sliding door"). Returns each catalogId' +
      ' with its size in cm (width x depth x height), mounting, default elevation and whether it has ' +
      'a front. Use the ids in items.add (kind item) or openings.add (door, window, opening).',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to search for. Empty lists the category or kind.' },
        category: { type: 'string', description: 'Only this category id (see riva_list_options).' },
        kind: { type: 'string', enum: ['item', 'door', 'window', 'opening'], description: 'Only this kind.' },
        limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Most results (default 15).' },
      },
      additionalProperties: false,
    },
    outputSchema: {
      type: 'object',
      properties: { results: { type: 'array', items: { type: 'object' } } },
      required: ['results'],
    },
    run: (args) => {
      const results = searchCatalog(args);
      const lines = results.map(
        (e) =>
          `${e.id}: ${e.name} [${e.category}, ${e.kind}, ${e.mount}] ${e.dims.w} x ${e.dims.d} x ${e.dims.h} cm` +
          `${e.elevation ? `, ${e.elevation} cm up` : ''}${e.hasFront ? ', has a front' : ''}`,
      );
      const text = lines.length ? lines.join('\n') : 'No matches. Try other words, or riva_list_options for the categories.';
      return { text, structured: { results } };
    },
  },
  {
    name: 'riva_list_options',
    title: 'List Riva Sai categories, materials and templates',
    description:
      'Lists the catalog categories, the surface materials (floorMaterial, wall finishes, ground and ' +
      'roofs), the furniture finishes (item material.id) and the starter templates of Riva Sai.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: () => ({
      text: [
        `Catalog categories: ${API.categories.map((c) => `${c.id} (${c.name})`).join(', ')}`,
        `Surface materials: ${API.materials.map((m) => m.id).join(', ')}`,
        `Furniture finishes: ${API.finishes.map((f) => f.id).join(', ')}`,
        `Templates: ${API.templates.map((t) => `${t.id} - ${t.description ?? t.name}`).join('; ')}`,
      ].join('\n\n'),
      structured: {
        categories: API.categories,
        materials: API.materials,
        finishes: API.finishes,
        templates: API.templates,
      },
    }),
  },
  {
    name: 'riva_check_plan',
    title: 'Check a Riva Sai plan script',
    description:
      'Checks a Riva Sai plan script before the user opens it: the format, every call and option, ' +
      'catalog ids, materials, facing, references between steps, and the layout (furniture that ' +
      'overlaps or crosses walls, doors and windows off the walls or too close to corners). Returns ' +
      'errors (the app would refuse the script), warnings and notes, a short summary, and the ' +
      'rivasai.com link when there are no errors.',
    inputSchema: { type: 'object', properties: { design: DESIGN }, required: ['design'], additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: {
        ok: { type: 'boolean' },
        errors: { type: 'array', items: { type: 'string' } },
        warnings: { type: 'array', items: { type: 'string' } },
        notes: { type: 'array', items: { type: 'string' } },
        link: { type: ['string', 'null'] },
      },
      required: ['ok', 'errors', 'warnings', 'notes', 'link'],
    },
    run: ({ design }) => {
      const script = readDesign(design);
      const { errors, warnings, notes } = checkPlan(script);
      const ok = errors.length === 0;
      const link = ok ? planLink(script) : null;
      const list = (title, xs) => (xs.length ? `${title} (${xs.length}):\n${xs.map((x) => `- ${x}`).join('\n')}` : null);
      let verdict = 'The script is valid.';
      if (!ok) verdict = 'The app would refuse this script. Fix the errors and check again.';
      else if (warnings.length) verdict = 'The script is valid, but fix the warnings before giving it to the user.';
      let linkText = null;
      if (link && link.length > LONG_LINK) {
        linkText = `Link (${link.length} characters; long links can be cut off, so also give the script as a JSON block):\n${link}`;
      } else if (link) {
        linkText = `Link:\n${link}`;
      }
      const text = [verdict, list('Errors', errors), list('Warnings', warnings), list('Notes', notes), summarize(script), linkText]
        .filter(Boolean)
        .join('\n\n');
      return { text, structured: { ok, errors, warnings, notes, link } };
    },
  },
  {
    name: 'riva_plan_link',
    title: 'Make a Riva Sai link',
    description:
      'Turns a valid plan script into the link that opens and builds it at rivasai.com ' +
      '(https://rivasai.com/#plan=...). Fails with the errors when riva_check_plan would.',
    inputSchema: { type: 'object', properties: { design: DESIGN }, required: ['design'], additionalProperties: false },
    outputSchema: {
      type: 'object',
      properties: { link: { type: 'string' }, length: { type: 'integer' } },
      required: ['link', 'length'],
    },
    run: ({ design }) => {
      const script = readDesign(design);
      const { errors } = checkPlan(script);
      if (errors.length) throw new InputError(`Fix these first:\n${errors.map((e) => `- ${e}`).join('\n')}`);
      const link = planLink(script);
      return { text: link, structured: { link, length: link.length } };
    },
  },
  {
    name: 'riva_read_design',
    title: 'Read a Riva Sai link or design',
    description:
      'Reads what the user brings back from Riva Sai: a share link (#p= or #plan=), a project JSON, ' +
      'or a plan script. Returns a summary and the full JSON, to build the next version on. The "Here' +
      ' is my current Riva Sai design" text the app copies is already readable and needs no tool.',
    inputSchema: { type: 'object', properties: { design: DESIGN }, required: ['design'], additionalProperties: false },
    run: ({ design }) => {
      const value = readDesign(design);
      if (!isPlanScript(value) && !isProject(value)) {
        throw new InputError('This is neither a Riva Sai plan script nor a Riva Sai project.');
      }
      let json = JSON.stringify(value);
      if (json.length > 200_000) json = `${json.slice(0, 200_000)}... (cut off at 200 000 characters)`;
      return {
        text: `${summarize(value)}\n\n${isPlanScript(value) ? 'Plan script' : 'Project JSON'}:\n${json}`,
        structured: { kind: isPlanScript(value) ? 'plan' : 'project', value },
      };
    },
  },
];

// ---------------------------------------------------------------------------
// MCP over stdio
// ---------------------------------------------------------------------------

const PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS =
  'Riva Sai (https://rivasai.com) is a free 2D/3D home planner. To design a home: read riva_guide, ' +
  'find items with riva_search_catalog, write a plan script, run riva_check_plan and fix every error ' +
  'and warning, then give the user the link it returns.';

function callTool(params) {
  const tool = TOOLS.find((t) => t.name === params?.name);
  if (!tool) {
    const err = new Error(`Unknown tool: ${params?.name}`);
    err.code = -32602;
    throw err;
  }
  try {
    const { text, structured } = tool.run(params.arguments ?? {});
    const result = { content: [{ type: 'text', text }] };
    if (structured) result.structuredContent = structured;
    return result;
  } catch (e) {
    const text = e instanceof InputError ? e.message : `The ${tool.name} tool failed: ${e.message}`;
    return { content: [{ type: 'text', text }], isError: true };
  }
}

/** Handles one JSON-RPC request; returns its result (undefined for notifications). */
export function handle(method, params) {
  switch (method) {
    case 'initialize':
      return {
        protocolVersion: PROTOCOL_VERSIONS.includes(params?.protocolVersion) ? params.protocolVersion : PROTOCOL_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'riva-sai', title: 'Riva Sai', version: SERVER_VERSION, websiteUrl: APP_URL },
        instructions: INSTRUCTIONS,
      };
    case 'ping':
      return {};
    case 'tools/list':
      return {
        tools: TOOLS.map((t) => ({
          name: t.name,
          title: t.title,
          description: t.description,
          inputSchema: t.inputSchema,
          ...(t.outputSchema ? { outputSchema: t.outputSchema } : {}),
          annotations: { title: t.title, ...READ_ONLY },
        })),
      };
    case 'tools/call':
      return callTool(params);
    default: {
      if (method.startsWith('notifications/')) return undefined;
      const err = new Error(`Method not found: ${method}`);
      err.code = -32601;
      throw err;
    }
  }
}

export { checkPlan, readDesign, planLink, searchCatalog };

function serve() {
  const send = (msg) => process.stdout.write(`${JSON.stringify(msg)}\n`);
  const rl = createInterface({ input: process.stdin, crlfDelay: Infinity });
  rl.on('line', (line) => {
    if (!line.trim()) return;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      return send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
    }
    const id = req.id;
    const notification = id === undefined || id === null;
    try {
      if (typeof req.method !== 'string') throw Object.assign(new Error('Invalid request'), { code: -32600 });
      const result = handle(req.method, req.params);
      if (!notification) send({ jsonrpc: '2.0', id, result: result ?? {} });
    } catch (e) {
      if (!notification) send({ jsonrpc: '2.0', id, error: { code: e.code ?? -32603, message: e.message } });
    }
  });
  rl.on('close', () => process.exit(0));
}

// Serve on stdio when run as a program (not when imported by the tests).
const isMain = () => {
  try {
    return !!process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
};
if (isMain()) serve();
