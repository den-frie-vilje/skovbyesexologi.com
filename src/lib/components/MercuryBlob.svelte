<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { createWarmEnvTexture } from '$lib/three/warmEnv';

  interface Props {
    tint?: string;
    accent?: string;
    background?: string;
    intensity?: number;
    scale?: number;
    speed?: number;
    detail?: number;
    drips?: boolean;
    class?: string;
  }

  let {
    tint = '#d8d8dc',
    accent = '#ff7a45',
    background = '#efece6',
    intensity = 1,
    scale = 1,
    speed = 1,
    detail = 128,
    drips = false,
    class: className = ''
  }: Props = $props();

  let host: HTMLDivElement;
  let cleanup: (() => void) | null = null;

  onMount(() => {
    if (!browser) return;
    let disposed = false;

    (async () => {
      const THREE = await import('three');

      if (disposed) return;

      const width = host.clientWidth;
      const height = host.clientHeight;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
      renderer.setSize(width, height, false);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05 * intensity;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';

      const scene = new THREE.Scene();
      scene.background = null;

      const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
      camera.position.set(0, 0, 3.2);

      const warmTex = createWarmEnvTexture(THREE);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const envMap = pmrem.fromEquirectangular(warmTex).texture;
      scene.environment = envMap;
      warmTex.dispose();

      const tintColor = new THREE.Color(tint);
      const accentColor = new THREE.Color(accent);
      const bgColor = new THREE.Color(background);

      const mat = new THREE.MeshPhysicalMaterial({
        color: tintColor,
        metalness: 0.95,
        roughness: 0.14,
        envMapIntensity: 1.3,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        iridescence: 0.65,
        iridescenceIOR: 1.4,
        iridescenceThicknessRange: [220, 580]
      });

      const segments = Math.max(48, detail);
      const geom = new THREE.SphereGeometry(1 * scale, segments, Math.round(segments * 0.75));
      const basePositions = geom.attributes.position.array.slice() as Float32Array;
      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);

      const dripMeshes: Array<{
        mesh: InstanceType<typeof THREE.Mesh>;
        basePos: Float32Array;
        orbitR: number;
        orbitSpeed: number;
        orbitPhase: number;
        yDrift: number;
        yPhase: number;
        stretchPhase: number;
        displaceAmp: number;
      }> = [];

      if (drips) {
        const goldMat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color('#f5c34a'),
          metalness: 1.0,
          roughness: 0.11,
          envMapIntensity: 1.5,
          clearcoat: 1.0,
          clearcoatRoughness: 0.03,
          iridescence: 0.25,
          iridescenceIOR: 1.3,
          iridescenceThicknessRange: [140, 360]
        });

        const dripConfigs = [
          {
            radius: 0.28 * scale,
            seg: 48,
            orbitR: 1.35 * scale,
            orbitSpeed: 0.25,
            orbitPhase: 0.4,
            yDrift: 0.2,
            yPhase: 0.7,
            stretchPhase: 0.2,
            displaceAmp: 0.08
          },
          {
            radius: 0.18 * scale,
            seg: 40,
            orbitR: 1.55 * scale,
            orbitSpeed: -0.18,
            orbitPhase: 2.3,
            yDrift: 0.35,
            yPhase: 1.9,
            stretchPhase: 1.1,
            displaceAmp: 0.06
          }
        ];

        for (const c of dripConfigs) {
          const g = new THREE.SphereGeometry(c.radius, c.seg, Math.round(c.seg * 0.75));
          const base = g.attributes.position.array.slice() as Float32Array;
          const m = new THREE.Mesh(g, goldMat);
          scene.add(m);
          dripMeshes.push({
            mesh: m,
            basePos: base,
            orbitR: c.orbitR,
            orbitSpeed: c.orbitSpeed,
            orbitPhase: c.orbitPhase,
            yDrift: c.yDrift,
            yPhase: c.yPhase,
            stretchPhase: c.stretchPhase,
            displaceAmp: c.displaceAmp
          });
        }
      }

      const keyLight = new THREE.PointLight(accentColor, 3.5, 12, 1.5);
      keyLight.position.set(-2.2, 1.8, 2.4);
      scene.add(keyLight);

      const fillLight = new THREE.PointLight(bgColor, 1.2, 10, 2);
      fillLight.position.set(2.6, -1.4, 1.8);
      scene.add(fillLight);

      let time = 0;
      let pointerX = 0;
      let pointerY = 0;
      let targetRotX = 0;
      let targetRotY = 0;

      const onPointerMove = (e: PointerEvent) => {
        const rect = host.getBoundingClientRect();
        pointerX = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        pointerY = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      const onResize = () => {
        const w = host.clientWidth;
        const h = host.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      const ro = new ResizeObserver(onResize);
      ro.observe(host);

      let running = true;
      const io = new IntersectionObserver(
        (entries) => {
          running = entries[0]?.isIntersecting ?? true;
        },
        { threshold: 0.01 }
      );
      io.observe(host);

      const positions = geom.attributes.position;
      const count = positions.count;

      const tick = () => {
        if (disposed) return;
        requestAnimationFrame(tick);
        if (!running || document.hidden) return;

        time += 0.005 * speed;

        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          const bx = basePositions[ix];
          const by = basePositions[ix + 1];
          const bz = basePositions[ix + 2];
          const len = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
          const nx = bx / len;
          const ny = by / len;
          const nz = bz / len;

          const wave =
            Math.sin(nx * 1.6 + time * 1.2) * 0.14 +
            Math.sin(ny * 2.1 + time * 0.9) * 0.11 +
            Math.sin(nz * 1.4 + time * 1.5) * 0.1 +
            Math.sin((nx + ny) * 2.7 + time * 1.7) * 0.06 +
            Math.sin((ny + nz) * 3.3 + time * 1.1) * 0.04;

          positions.array[ix] = bx + nx * wave;
          positions.array[ix + 1] = by + ny * wave;
          positions.array[ix + 2] = bz + nz * wave;
        }
        positions.needsUpdate = true;
        geom.computeVertexNormals();

        targetRotX += (pointerY * 0.25 - targetRotX) * 0.06;
        targetRotY += (pointerX * 0.3 - targetRotY) * 0.06;
        mesh.rotation.x = targetRotX + Math.sin(time * 0.3) * 0.08;
        mesh.rotation.y = targetRotY + time * 0.18;

        for (const d of dripMeshes) {
          const a = time * d.orbitSpeed + d.orbitPhase;
          const yBob = Math.sin(time * 0.9 + d.yPhase) * d.yDrift;
          d.mesh.position.x = Math.cos(a) * d.orbitR;
          d.mesh.position.y = yBob - Math.abs(Math.sin(a)) * 0.15;
          d.mesh.position.z = Math.sin(a) * d.orbitR * 0.6;

          const stretch = 1 + 0.35 + Math.sin(time * 1.3 + d.stretchPhase) * 0.25;
          d.mesh.scale.set(1, stretch, 1);
          d.mesh.rotation.z = Math.sin(time * 0.7 + d.stretchPhase) * 0.3;

          const dp = d.mesh.geometry.attributes.position;
          const dc = dp.count;
          for (let j = 0; j < dc; j++) {
            const jx = j * 3;
            const bx = d.basePos[jx];
            const by = d.basePos[jx + 1];
            const bz = d.basePos[jx + 2];
            const dlen = Math.sqrt(bx * bx + by * by + bz * bz) || 1;
            const nnx = bx / dlen;
            const nny = by / dlen;
            const nnz = bz / dlen;
            const dwave =
              Math.sin(nnx * 3 + time * 2) * d.displaceAmp +
              Math.sin(nny * 2.5 + time * 1.4) * d.displaceAmp * 0.7;
            dp.array[jx] = bx + nnx * dwave;
            dp.array[jx + 1] = by + nny * dwave;
            dp.array[jx + 2] = bz + nnz * dwave;
          }
          dp.needsUpdate = true;
          d.mesh.geometry.computeVertexNormals();
        }

        renderer.render(scene, camera);
      };
      tick();

      cleanup = () => {
        disposed = true;
        window.removeEventListener('pointermove', onPointerMove);
        ro.disconnect();
        io.disconnect();
        geom.dispose();
        mat.dispose();
        for (const d of dripMeshes) {
          d.mesh.geometry.dispose();
        }
        envMap.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => cleanup?.();
  });
</script>

<div bind:this={host} class={`mercury ${className}`} aria-hidden="true"></div>

<style>
  .mercury {
    position: relative;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
