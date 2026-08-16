import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildBlaster } from "@/game/blaster";
import { buildCrosshair3D } from "@/game/crosshair3d";
import { getGunSkin } from "@/game/guns";
import { SHOP_ITEMS } from "@/game/shop";

type ViewerKind = "gun" | "crosshair";

interface ModelViewerProps {
  kind: ViewerKind;
  /** shop item id (gun skin id or crosshair id) */
  itemId: string;
  className?: string;
}

/**
 * Interactive turntable: renders the real in-game 3D model for a shop item.
 * Drag (mouse or touch) to orbit, wheel / pinch to zoom, idles into a slow spin.
 */
export function ModelViewer({ kind, itemId, className }: ModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(host.clientWidth || 320, host.clientHeight || 320, false);
    renderer.domElement.style.width = "100%";
    renderer.domElement.style.height = "100%";
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";
    host.appendChild(renderer.domElement);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x2a1c3a, 1.05));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(2.4, 3, 2.6);
    scene.add(key);
    const rim = new THREE.PointLight(0xff5db3, 1.4, 14);
    rim.position.set(-2.6, 0.6, -2);
    scene.add(rim);
    const fill = new THREE.PointLight(0x4dd2ff, 1.1, 14);
    fill.position.set(2.2, -1.4, -2.4);
    scene.add(fill);

    const pivot = new THREE.Group();
    scene.add(pivot);

    let model: THREE.Object3D;
    if (kind === "gun") {
      const built = buildBlaster(getGunSkin(itemId));
      built.group.traverse((o) => {
        if (o.name === "playerHand") o.visible = false;
      });
      model = built.group;
    } else {
      const item = SHOP_ITEMS.find((i) => i.id === itemId) ?? SHOP_ITEMS[0]!;
      model = buildCrosshair3D(item.style, item.hex);
    }

    // centre + normalise scale so every item frames identically
    const box = new THREE.Box3().setFromObject(model);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(centre);
    const span = Math.max(size.x, size.y, size.z) || 1;
    model.scale.setScalar(2.6 / span);
    pivot.add(model);

    let dist = 6.2;
    let yaw = kind === "gun" ? -0.9 : 0.5;
    let pitch = 0.18;
    let spin = true;

    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const down = (e: PointerEvent) => {
      dragging = true;
      spin = false;
      lastX = e.clientX;
      lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      yaw += (e.clientX - lastX) * 0.01;
      pitch = Math.max(-1.2, Math.min(1.2, pitch - (e.clientY - lastY) * 0.008));
      lastX = e.clientX;
      lastY = e.clientY;
    };
    const up = (e: PointerEvent) => {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      try {
        renderer.domElement.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    };
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      dist = Math.max(3.2, Math.min(11, dist + e.deltaY * 0.006));
    };

    const el = renderer.domElement;
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("wheel", wheel, { passive: false });

    const resize = () => {
      const w = host.clientWidth || 320;
      const h = host.clientHeight || 320;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    let raf = 0;
    let prev = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - prev) / 1000);
      prev = t;
      if (spin) yaw += dt * 0.55;
      pivot.rotation.y = yaw;
      pivot.rotation.x = pitch;
      camera.position.set(0, 0.35, dist);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("wheel", wheel);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose();
      });
      renderer.dispose();
      el.remove();
    };
  }, [kind, itemId]);

  return <div ref={hostRef} className={className ?? "model-viewer"} aria-hidden="true" />;
}
