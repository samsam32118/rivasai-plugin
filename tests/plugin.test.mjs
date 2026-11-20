// Tests for the Riva Sai plugin: packaging (the plugin directory's rules), the MCP server over
// stdio, and the plan checker. Node's built-in test runner, no dependencies: `npm test`.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { deflateRawSync } from 'node:zlib';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const PLUGIN = path.join(ROOT, 'plugins/riva-sai');
const SERVER = path.join(PLUGIN, 'server/riva-sai-mcp.mjs');
const lite = await import(pathToFileURL(SERVER).href);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

const plan = (steps, extra = {}) => ({ freeinterior: 'plan', version: 1, ...extra, steps });
const room = { call: 'rooms.createRectangular', args: { x: 0, y: 0, width: 500, depth: 400, name: 'Living' }, as: 'l' };
const sofa = (args = {}) => ({ call: 'items.add', args: { catalogId: 'sofa-3-seat', position: { x: 250, y: 200 }, ...args } });
const EXAMPLE = plan(
  [
    { call: 'rooms.createRectangular', args: { x: 0, y: 0, width: 500, depth: 400, name: 'Living room', floorMaterial: { id: 'wood-oak' } }, as: 'living' },
    { call: 'rooms.createRectangular', args: { x: 500, y: 0, width: 350, depth: 400, name: 'Bedroom', floorMaterial: { id: 'wood-oak' } }, as: 'bed' },
    { call: 'openings.add', args: { at: { x: 150, y: 400 }, catalogId: 'door-front', opensInto: '$living' } },
    { call: 'openings.add', args: { at: { x: 500, y: 320 }, catalogId: 'door-single', opensInto: '$bed' } },
    { call: 'openings.add', args: { at: { x: 250, y: 0 }, catalogId: 'window-double' } },
    { call: 'items.add', args: { catalogId: 'tv-stand', position: { x: 250, y: 40 }, facing: 'S' }, as: 'tv' },
    { call: 'items.add', args: { catalogId: 'sofa-3-seat', position: { x: 250, y: 300 }, faceToward: '$tv' }, as: 'sofa' },
    { call: 'items.add', args: { catalogId: 'bed-double', position: { x: 735, y: 200 }, facing: 'W' } },
    { call: 'items.update', args: { id: '$sofa', changes: { color: '#7c9a82' } } },
  ],
  { name: 'Our flat' },
);

describe('packaging (plugin directory checklist)', () => {
  const files = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else files.push(path.relative(PLUGIN, p).split(path.sep).join('/'));
    }
  };
  walk(PLUGIN);

  it('keeps files small, of allowed types, with safe names and no lockfile', () => {
    assert.ok(files.length < 512);
    for (const f of files) {
      assert.match(f, /\.(md|json|mjs|png)$|^LICENSE$/, f);
      assert.match(f, /^[\w./-]+$/, f);
      assert.doesNotMatch(path.basename(f), /lock/i, f);
      if (!f.endsWith('.png')) assert.ok(statSync(path.join(PLUGIN, f)).size < 256 * 1024, `${f} is 256 KiB or more`);
    }
  });

  it('has readable (not minified) code', () => {
    for (const f of files.filter((x) => x.endsWith('.mjs'))) {
      const longest = Math.max(...readFileSync(path.join(PLUGIN, f), 'utf8').split('\n').map((l) => l.length));
      assert.ok(longest <= 140, `${f}: a line of ${longest} characters`);
    }
  });

  it('has a valid manifest, MCP config, README, license and marketplace entry', () => {
    const manifest = readJson(path.join(PLUGIN, '.claude-plugin/plugin.json'));
    assert.match(manifest.name, /^[a-z0-9]+(-[a-z0-9]+)*$/);
    assert.doesNotMatch(manifest.name, /claude|anthropic/);
    assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
    assert.equal(manifest.license, 'MIT');
    assert.deepEqual(readdirSync(path.join(PLUGIN, '.claude-plugin')), ['plugin.json']);
    for (const k of ['homepage', 'documentationUrl', 'supportUrl', 'privacyPolicyUrl']) assert.match(manifest[k], /^https:\/\//, k);
    assert.ok(statSync(path.join(PLUGIN, manifest.icon)).isFile());
    const mcp = readJson(path.join(PLUGIN, '.mcp.json'));
    assert.deepEqual(mcp.mcpServers['riva-sai'], { command: 'node', args: ['${CLAUDE_PLUGIN_ROOT}/server/riva-sai-mcp.mjs'] });
    const market = readJson(path.join(ROOT, '.claude-plugin/marketplace.json'));
    assert.equal(market.plugins.length, 1);
    assert.equal(market.plugins[0].name, manifest.name);
    assert.equal(market.plugins[0].source, './plugins/riva-sai');
    const readme = readFileSync(path.join(PLUGIN, 'README.md'), 'utf8').replace(/```[\s\S]*?```/g, '');
    assert.ok(readme.split(/\s+/).length > 40);
    assert.ok(statSync(path.join(PLUGIN, 'LICENSE')).isFile());
  });

  it('keeps the skill within the authoring limits', () => {
    const dir = path.join(PLUGIN, 'skills/riva-sai-home-design');
    const skill = readFileSync(path.join(dir, 'SKILL.md'), 'utf8');
    const front = /^---\n([\s\S]*?)\n---\n/.exec(skill)[1];
    const name = /^name: (.*)$/m.exec(front)[1];
    const description = /^description: (.*)$/m.exec(front)[1];
    assert.equal(name, 'riva-sai-home-design');
    assert.ok(description.length <= 1024);
    assert.ok(skill.split('\n').length < 500);
    for (const [, link] of skill.matchAll(/\]\((references\/[^)]+)\)/g)) assert.ok(statSync(path.join(dir, link)).isFile(), link);
  });
});

describe('plan checker', () => {
  it('accepts a good plan and makes its link', () => {
    assert.deepEqual(lite.checkPlan(EXAMPLE), { errors: [], warnings: [], notes: [] });
    assert.equal(lite.planLink(EXAMPLE), `https://rivasai.com/#plan=${encodeURIComponent(JSON.stringify(EXAMPLE))}`);
  });

  const refused = {
    'an unknown method': plan([room, { call: 'rooms.makeRectangle', args: {} }]),
    'a blocked method': plan([{ call: 'project.load', args: {} }]),
    'an unknown option': plan([room, sofa({ colour: 'red' })]),
    'a missing option': plan([room, { call: 'items.add', args: { catalogId: 'sofa-3-seat' } }]),
    'an unknown catalog id': plan([room, sofa({ catalogId: 'sofa-9-seat' })]),
    'a door added as an item': plan([room, sofa({ catalogId: 'door-single' })]),
    'bad facing': plan([room, sofa({ facing: 'up' })]),
    'an unknown material': plan([{ ...room, args: { ...room.args, floorMaterial: { id: 'marble-pink' } } }]),
    'an unknown finish': plan([room, sofa({ material: { id: 'gold-leaf' } })]),
    'an unknown reference': plan([room, { call: 'openings.add', args: { catalogId: 'door-single', at: { x: 250, y: 400 }, opensInto: '$kitchen' } }]),
    'a door off the walls': plan([room, { call: 'openings.add', args: { catalogId: 'door-single', at: { x: 250, y: 200 } } }]),
    'a door in a corner': plan([room, { call: 'openings.add', args: { catalogId: 'door-single', at: { x: 20, y: 0 } } }]),
    'version 2': { freeinterior: 'plan', version: 2, steps: [] },
    'an unknown template': plan([], { template: 'castle' }),
  };
  for (const [what, script] of Object.entries(refused)) {
    it(`refuses ${what}`, () => assert.notDeepEqual(lite.checkPlan(script).errors, []));
  }

  it('warns about furniture overlapping or crossing walls, not about a TV on its stand or a rug', () => {
    const bad = lite.checkPlan(plan([room, sofa(), sofa({ position: { x: 260, y: 210 } }), sofa({ catalogId: 'bed-double', position: { x: 0, y: 200 } })]));
    assert.ok(bad.warnings.some((w) => /overlaps/.test(w)));
    assert.ok(bad.warnings.some((w) => /Double bed.*crosses a wall/.test(w)));
    const good = lite.checkPlan(
      plan([
        room,
        { call: 'items.add', args: { catalogId: 'tv-stand', position: { x: 250, y: 40 }, facing: 'S' } },
        { call: 'items.add', args: { catalogId: 'tv', position: { x: 250, y: 40 }, facing: 'S', elevation: 50 } },
        { call: 'items.add', args: { catalogId: 'rug-rect', position: { x: 250, y: 250 } } },
        sofa({ position: { x: 250, y: 300 }, facing: 'N' }),
      ]),
    );
    assert.deepEqual(good.warnings, []);
  });

  it('reads #p= links made by the app, #plan= links and JSON code blocks', () => {
    const packed = `https://rivasai.com/#p=1${deflateRawSync(Buffer.from(JSON.stringify(EXAMPLE))).toString('base64url')}`;
    assert.deepEqual(lite.readDesign(`Here it is: ${packed} thanks`), EXAMPLE);
    assert.deepEqual(lite.readDesign(lite.planLink(EXAMPLE)), EXAMPLE);
    assert.deepEqual(lite.readDesign('```json\n' + JSON.stringify(EXAMPLE) + '\n```'), EXAMPLE);
  });
});

describe('MCP server', () => {
  it('answers every tool with valid input', () => {
    const calls = [
      ['riva_guide', {}],
      ['riva_guide', { part: 'advanced' }],
      ['riva_search_catalog', { query: 'corner sofa' }],
      ['riva_list_options', {}],
      ['riva_check_plan', { design: EXAMPLE }],
      ['riva_plan_link', { design: EXAMPLE }],
      ['riva_read_design', { design: lite.planLink(EXAMPLE) }],
    ];
    for (const [name, args] of calls) {
      const r = lite.handle('tools/call', { name, arguments: args });
      assert.equal(r.isError, undefined, name);
      assert.ok(r.content[0].text.length > 20, name);
    }
  });

  it('speaks MCP over stdio', async () => {
    const child = spawn(process.execPath, [SERVER], { stdio: ['pipe', 'pipe', 'inherit'] });
    const lines = [];
    let buf = '';
    child.stdout.on('data', (d) => {
      buf += d.toString();
      for (let i; (i = buf.indexOf('\n')) >= 0; buf = buf.slice(i + 1)) lines.push(JSON.parse(buf.slice(0, i)));
    });
    const send = (m) => child.stdin.write(`${JSON.stringify(m)}\n`);
    send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
    send({ jsonrpc: '2.0', method: 'notifications/initialized' });
    send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    send({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'riva_check_plan', arguments: { design: JSON.stringify(EXAMPLE) } } });
    send({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'riva_plan_link', arguments: { design: '{"freeinterior":"plan","version":1,"steps":[{"call":"nope.x"}]}' } } });
    send({ jsonrpc: '2.0', id: 5, method: 'nope' });
    const deadline = Date.now() + 10_000;
    while (lines.length < 5 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 20));
    child.kill();
    const by = (id) => lines.find((l) => l.id === id);
    assert.equal(by(1).result.protocolVersion, '2025-06-18');
    const tools = by(2).result.tools;
    assert.deepEqual(
      tools.map((t) => t.name),
      ['riva_guide', 'riva_search_catalog', 'riva_list_options', 'riva_check_plan', 'riva_plan_link', 'riva_read_design'],
    );
    for (const t of tools) {
      assert.equal(t.annotations.title, t.title);
      assert.equal(t.annotations.readOnlyHint, true);
      assert.equal(t.annotations.destructiveHint, false);
    }
    assert.equal(by(3).result.structuredContent.ok, true);
    assert.equal(by(3).result.structuredContent.link, lite.planLink(EXAMPLE));
    assert.equal(by(4).result.isError, true);
    assert.match(by(4).result.content[0].text, /nope\.x cannot be used/);
    assert.equal(by(5).error.code, -32601);
  });
});
