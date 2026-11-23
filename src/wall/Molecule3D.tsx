import { useEffect, useRef } from 'react';

// A slowly turning 3D picture of a protein, drawn with Babylon.js. It uses only the backbone (one point per residue)
// from RCSB's Model Server, so even a spike trimer is a few thousand small spheres. The Babylon code is loaded the
// first time it is needed, in its own file, and everything is disposed when the slide changes.
const MODEL = 'https://models.rcsb.org/v1';

interface Trace { xyz: Float32Array; chainOf: Uint16Array; n: number; chains: number }

async function fetchAtoms(id: string, atom: string): Promise<string> {
  const res = await fetch(`${MODEL}/${id.toLowerCase()}/atoms?label_atom_id=${atom}&encoding=cif`);
  if (!res.ok) throw new Error('model');
  return res.text();
}

/** Reads the x, y, z and chain of every ATOM row from the CIF text, first model only. */
function parseTrace(text: string): Trace | null {
  const lines = text.split('\n');
  const cols: string[] = [];
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.startsWith('_atom_site.')) { cols.push(l.trim().slice('_atom_site.'.length)); start = i + 1; }
    else if (start > 0 && cols.length) break;
  }
  if (!cols.length) return null;
  const ix = cols.indexOf('Cartn_x'), iy = cols.indexOf('Cartn_y'), iz = cols.indexOf('Cartn_z');
  const ic = cols.indexOf('label_asym_id'), ig = cols.indexOf('group_PDB'), im = cols.indexOf('pdbx_PDB_model_num');
  if (ix < 0 || iy < 0 || iz < 0 || ic < 0) return null;
  const xs: number[] = [], chain: number[] = [];
  const names = new Map<string, number>();
  for (let i = start; i < lines.length; i++) {
    const l = lines[i];
    if (!l || l[0] === '#' || l.startsWith('loop_') || l[0] === '_') break;
    const t = l.trim().split(/\s+/);
    if (ig >= 0 && t[ig] !== 'ATOM') continue;
    if (im >= 0 && t[im] !== '1') continue;
    const x = Number(t[ix]), y = Number(t[iy]), z = Number(t[iz]);
    if (!Number.isFinite(x + y + z)) continue;
    const c = t[ic];
    if (!names.has(c)) names.set(c, names.size);
    xs.push(x, y, z);
    chain.push(names.get(c)!);
  }
  if (chain.length < 3) return null;
  return { xyz: Float32Array.from(xs), chainOf: Uint16Array.from(chain), n: chain.length, chains: names.size };
}

async function loadTrace(id: string): Promise<Trace> {
  const ca = parseTrace(await fetchAtoms(id, 'CA'));
  if (ca) return ca;
  const p = parseTrace(await fetchAtoms(id, 'P')); // DNA and RNA have no alpha carbons: use the phosphate backbone
  if (p) return p;
  throw new Error('empty');
}

// Chain colours: the lab's coral first, then a calm set that reads well on the dark card.
const PALETTE: [number, number, number][] = [
  [1.0, 0.42, 0.29], [0.35, 0.72, 0.85], [0.95, 0.75, 0.3], [0.62, 0.52, 0.92],
  [0.4, 0.8, 0.55], [0.92, 0.5, 0.7], [0.55, 0.65, 0.95], [0.75, 0.85, 0.4],
];
// A single chain runs from blue at the start to coral at the end, so the fold's direction is visible.
const gradient = (t: number): [number, number, number] => [0.3 + 0.7 * t, 0.55 - 0.15 * t, 0.95 - 0.66 * t];

export function Molecule3D({ id, onFail, className }: { id: string; onFail: () => void; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let live = true;
    let dispose: (() => void) | null = null;

    (async () => {
      const trace = await loadTrace(id);
      if (!live || !ref.current) return;
      const [{ Engine }, { Scene }, { ArcRotateCamera }, { Vector3 }, { Color3, Color4 }, { CreateSphere }, { StandardMaterial }, { HemisphericLight }, { DirectionalLight }] =
        await Promise.all([
          import('@babylonjs/core/Engines/engine'),
          import('@babylonjs/core/scene'),
          import('@babylonjs/core/Cameras/arcRotateCamera'),
          import('@babylonjs/core/Maths/math.vector'),
          import('@babylonjs/core/Maths/math.color'),
          import('@babylonjs/core/Meshes/Builders/sphereBuilder'),
          import('@babylonjs/core/Materials/standardMaterial'),
          import('@babylonjs/core/Lights/hemisphericLight'),
          import('@babylonjs/core/Lights/directionalLight'),
        ]);
      await import('@babylonjs/core/Meshes/thinInstanceMesh');
      if (!live || !ref.current) return;

      const engine = new Engine(ref.current, true, { alpha: true, antialias: true, stencil: false, powerPreference: 'low-power' }, false);
      const scene = new Scene(engine);
      scene.clearColor = new Color4(0, 0, 0, 0);

      // centre the trace and measure how far it reaches
      const { xyz, chainOf, n, chains } = trace;
      let cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { cx += xyz[i * 3]; cy += xyz[i * 3 + 1]; cz += xyz[i * 3 + 2]; }
      cx /= n; cy /= n; cz /= n;
      let reach = 1;
      for (let i = 0; i < n; i++) {
        const d = Math.hypot(xyz[i * 3] - cx, xyz[i * 3 + 1] - cy, xyz[i * 3 + 2] - cz);
        if (d > reach) reach = d;
      }

      const camera = new ArcRotateCamera('cam', 0.6, 1.15, reach * 2.55, Vector3.Zero(), scene);
      camera.minZ = reach * 0.1;
      camera.maxZ = reach * 10;
      new HemisphericLight('sky', new Vector3(0.3, 1, 0.2), scene).intensity = 0.85;
      const sun = new DirectionalLight('sun', new Vector3(-0.5, -1, -0.7), scene);
      sun.intensity = 0.9;

      // one low-poly sphere, drawn once per residue
      const bead = CreateSphere('bead', { diameter: 1, segments: 6 }, scene);
      const mat = new StandardMaterial('bead', scene);
      mat.diffuseColor = Color3.White();
      mat.specularColor = new Color3(0.3, 0.3, 0.3);
      bead.material = mat;
      const size = Math.min(4.6, Math.max(2.4, 3.6));
      const matrices = new Float32Array(n * 16);
      const colours = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        const o = i * 16;
        matrices[o] = matrices[o + 5] = matrices[o + 10] = size;
        matrices[o + 15] = 1;
        matrices[o + 12] = xyz[i * 3] - cx;
        matrices[o + 13] = xyz[i * 3 + 1] - cy;
        matrices[o + 14] = xyz[i * 3 + 2] - cz;
        const c = chains > 1 ? PALETTE[chainOf[i] % PALETTE.length] : gradient(i / Math.max(1, n - 1));
        colours.set([c[0], c[1], c[2], 1], i * 4);
      }
      bead.thinInstanceSetBuffer('matrix', matrices, 16, true);
      bead.thinInstanceSetBuffer('color', colours, 4, true);
      bead.alwaysSelectAsActiveMesh = true;

      // turn slowly, and draw every other frame: easy on an old graphics chip left on all day
      let frame = 0;
      engine.runRenderLoop(() => {
        if ((frame++ & 1) === 0) {
          camera.alpha += 0.008;
          scene.render();
        }
      });
      engine.resize();

      dispose = () => {
        engine.stopRenderLoop();
        scene.dispose();
        engine.dispose();
      };
      if (!live) dispose();
    })().catch(() => { if (live) onFail(); });

    return () => {
      live = false;
      dispose?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
