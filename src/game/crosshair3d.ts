import * as THREE from "three";
import type { CrosshairStyle } from "./shop";

const neon = (hex: number, intensity = 1.6) =>
  new THREE.MeshStandardMaterial({
    color: hex,
    emissive: hex,
    emissiveIntensity: intensity,
    roughness: 0.25,
    metalness: 0.1,
  });

const bar = (w: number, h: number, mat: THREE.Material, x: number, y: number) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), mat);
  m.position.set(x, y, 0);
  return m;
};

const ring = (r: number, tube: number, mat: THREE.Material) =>
  new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 64), mat);

/**
 * Builds a chunky, extruded 3D version of a shop crosshair so it can be
 * spun around in the shop preview instead of shown as a flat CSS reticle.
 */
export function buildCrosshair3D(style: CrosshairStyle, hex: number): THREE.Group {
  const g = new THREE.Group();
  const mat = neon(hex);
  const soft = neon(hex, 0.7);

  // backing plate so the reticle reads as a solid object from any angle
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(1.34, 1.34, 0.05, 64),
    new THREE.MeshStandardMaterial({ color: 0x11151f, roughness: 0.55, metalness: 0.35 }),
  );
  plate.rotation.x = Math.PI / 2;
  plate.position.z = -0.09;
  g.add(plate);
  g.add(ring(1.34, 0.045, soft));

  const arms = (len: number, thick: number, gap: number, m: THREE.Material) => {
    g.add(bar(len, thick, m, 0, gap + len / 2));
    g.add(bar(len, thick, m, 0, -(gap + len / 2)));
    g.add(bar(thick, len, m, gap + len / 2, 0));
    g.add(bar(thick, len, m, -(gap + len / 2), 0));
  };

  if (style === "classic") {
    g.add(ring(0.72, 0.07, mat));
    arms(0.46, 0.09, 0.22, mat);
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.1, 20, 16), mat));
  } else if (style === "sniper") {
    arms(0.9, 0.06, 0.14, mat);
    for (const s of [-1, 1]) {
      for (let i = 1; i <= 3; i++) {
        g.add(bar(0.2, 0.05, soft, s * (0.3 + i * 0.2), 0));
        g.add(bar(0.05, 0.2, soft, 0, s * (0.3 + i * 0.2)));
      }
    }
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 12), mat));
  } else if (style === "duplex") {
    for (const s of [-1, 1]) {
      const thick = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.05), mat);
      thick.position.set(s * 0.82, 0, 0);
      g.add(thick);
      const v = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.05), mat);
      v.position.set(0, s * 0.82, 0);
      g.add(v);
    }
    arms(0.32, 0.05, 0.1, soft);
  } else if (style === "dotscope") {
    g.add(ring(1.02, 0.05, soft));
    g.add(ring(0.55, 0.075, mat));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.15, 22, 18), mat));
  } else if (style === "xcross") {
    for (const rot of [Math.PI / 4, -Math.PI / 4]) {
      for (const s of [-1, 1]) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.09, 0.05), mat);
        d.position.set(Math.cos(rot) * s * 0.62, Math.sin(rot) * s * 0.62, 0);
        d.rotation.z = rot;
        g.add(d);
      }
    }
    g.add(ring(1.1, 0.04, soft));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), mat));
  } else {
    // fine — hairline precision
    arms(1.0, 0.035, 0.1, mat);
    g.add(ring(0.9, 0.025, soft));
    g.add(new THREE.Mesh(new THREE.SphereGeometry(0.045, 16, 12), mat));
  }

  return g;
}
