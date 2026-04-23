<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import {
    createWarmEnvTexture,
    createGoldEnvTexture,
    createGemEnvTexture,
    createChromeEnvTexture
  } from '$lib/three/warmEnv';

  export type Pin = { selector: string; dx?: number; dy?: number };
  export type ElementState = {
    x: number;
    y: number;
    scale: number;
    pin?: Pin;
  };
  export type SectionAnchor = {
    selector: string;
    main: ElementState;
    drip1: ElementState;
    drip2: ElementState;
    intensity?: number;
  };

  interface Props {
    anchors: SectionAnchor[];
    /** 0 = therapy palette, 1 = konsulent palette. Smoothly
     *  interpolated — the homepage drives this continuously from
     *  scroll position; service pages pin it to 0 or 1. */
    chapterMode?: number;
    /**
     * When set, the renderer and camera use these pixel dimensions
     * instead of `window.innerWidth / innerHeight`, and the resize
     * listener is skipped. Used by the OG image layout to render the
     * stage into a sub-region (e.g. 780×630 text column) while the
     * surrounding Playwright viewport stays at 1200×630. Leave both
     * undefined for the default full-viewport behavior.
     */
    width?: number;
    height?: number;
  }

  let {
    anchors,
    chapterMode = 0,
    width: widthOverride,
    height: heightOverride
  }: Props = $props();

  /*
    Therapy-palette endpoints + scene lighting colours. These used
    to be props but were never driven externally — the defaults
    matched our design tokens and nothing had a plan to vary them
    at runtime. Inlining removes API noise.

    Chapter differentiation lives in `chapterMode` (above): this
    component lerps from `tint` / `gold` / `gem` (THERAPY) to
    hardcoded konsulent endpoints (below in this file — search
    for `Konsulent`) along that 0..1 value. Change these constants
    to retune the therapy palette; the konsulent endpoints live
    alongside the lerp call where they're used.
  */
  const tint = '#e3c3cb';       // mercury-orb base + therapy end of orb lerp
  const accent = '#d7ff3a';     // scene key-light colour
  const background = '#f3ede2'; // scene fill-light colour

  let host: HTMLDivElement;
  let cleanup: (() => void) | null = null;

  onMount(() => {
    if (!browser) return;
    /*
      Reduced-motion opt-out. The stage is continuous motion — orb
      rotation, pointer-driven tilt, marching-cubes wobble, chapter
      cross-fade — none of which are tied to decorative animation
      timelines that CSS `@media (prefers-reduced-motion)` can
      suppress. When the OS preference is `reduce`, skip the entire
      WebGL pipeline (no three.js import, no shader compile, no
      canvas at all). `.flod`'s gradient background already provides
      a readable static fallback; the OG still PNGs are a richer
      alternative if we ever want to swap them in here.

      The width/height override path (OG image capture at build time)
      must ALWAYS render regardless of the host's motion preference —
      the capture environment's media query is irrelevant to what
      the final site user sees. Gate reduced-motion skip on the
      default (no-override) path only.
    */
    const fixedSizeAtMount =
      typeof widthOverride === 'number' && typeof heightOverride === 'number';
    const prefersReducedMotion =
      !fixedSizeAtMount &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;
    let disposed = false;

    (async () => {
      const THREE = await import('three');
      const { MarchingCubes } = await import('three/addons/objects/MarchingCubes.js');
      if (disposed) return;

      const fixedSize =
        typeof widthOverride === 'number' && typeof heightOverride === 'number';
      const width = fixedSize ? widthOverride! : window.innerWidth;
      const height = fixedSize ? heightOverride! : window.innerHeight;

      const renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: true,
        powerPreference: 'high-performance'
      });
      // Cap pixel ratio at 1.5 — retina phones at 3× quadruple the GPU
      // work for very little visible gain on these materials.
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio));
      renderer.setSize(width, height, false);
      // Explicit transparent clear colour — on some mobile browsers the
      // default clear can flash white during rapid scroll.
      renderer.setClearColor(0x000000, 0);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      host.appendChild(renderer.domElement);
      renderer.domElement.style.display = 'block';
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      renderer.domElement.style.background = 'transparent';
      // Hardware-accel hints — Safari sometimes paints the canvas's own
      // element background white during scroll unless these are set.
      renderer.domElement.style.transform = 'translateZ(0)';
      (renderer.domElement.style as CSSStyleDeclaration & { webkitBackfaceVisibility?: string })
        .webkitBackfaceVisibility = 'hidden';
      renderer.domElement.style.backfaceVisibility = 'hidden';

      const scene = new THREE.Scene();
      scene.background = null;

      const fov = 38;
      /*
        Near plane pulled in to 0.01 (was 0.1). Background-fill
        poses (`fullBleed` with scale 3.5) can push a sphere's
        surface forward to z ≈ 3.5, and with the camera at z = 3.2
        the surface crosses the previous near plane and gets
        sliced. The scene only has three opaque-ish elements and
        a flat environment, so the depth-buffer precision loss
        from the smaller near is well within tolerance.
      */
      const camera = new THREE.PerspectiveCamera(fov, width / height, 0.01, 100);
      camera.position.set(0, 0, 3.2);

      const pmrem = new THREE.PMREMGenerator(renderer);
      const warmTex = createWarmEnvTexture(THREE);
      const envMap = pmrem.fromEquirectangular(warmTex).texture;
      scene.environment = envMap;
      warmTex.dispose();

      const goldTex = createGoldEnvTexture(THREE);
      const goldEnvMap = pmrem.fromEquirectangular(goldTex).texture;
      goldTex.dispose();

      const gemTex = createGemEnvTexture(THREE);
      const gemEnvMap = pmrem.fromEquirectangular(gemTex).texture;
      gemTex.dispose();

      const chromeTex = createChromeEnvTexture(THREE);
      const chromeEnvMap = pmrem.fromEquirectangular(chromeTex).texture;
      chromeTex.dispose();

      // Patch the env-map ShaderChunk ONCE globally so every
      // MeshPhysicalMaterial we create samples both `envMap` and
      // `uEnvMapB`, mixed by `uEnvMix`. We can't do this per-material in
      // onBeforeCompile because the `#include` directives haven't been
      // resolved yet at that point.
      const chunkPatchFlag = '_flodEnvCrossfadePatched';
      // Wide cast — THREE.ShaderChunk's official type is a map of
      // string chunks, but we stash a non-chunk boolean under our
      // private key to track whether the patch already ran. Treat
      // the holder as `unknown`-valued so the boolean write below
      // type-checks.
      const chunkHolder = THREE.ShaderChunk as unknown as Record<string, unknown>;
      if (!chunkHolder[chunkPatchFlag]) {
        const original = THREE.ShaderChunk.envmap_physical_pars_fragment;
        THREE.ShaderChunk.envmap_physical_pars_fragment = original
          .replace(
            /vec4 envMapColor = textureCubeUV\(\s*envMap,\s*envMapRotation\s*\*\s*worldNormal,\s*1\.0\s*\);/g,
            `vec4 envMapColor = mix(
              textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 ),
              textureCubeUV( uEnvMapB, envMapRotation * worldNormal, 1.0 ),
              uEnvMix
            );`
          )
          .replace(
            /vec4 envMapColor = textureCubeUV\(\s*envMap,\s*envMapRotation\s*\*\s*reflectVec,\s*roughness\s*\);/g,
            `vec4 envMapColor = mix(
              textureCubeUV( envMap, envMapRotation * reflectVec, roughness ),
              textureCubeUV( uEnvMapB, envMapRotation * reflectVec, roughness ),
              uEnvMix
            );`
          );
        chunkHolder[chunkPatchFlag] = true;
      }

      type EnvMixUniforms = {
        uEnvMapB: { value: InstanceType<typeof THREE.Texture> };
        uEnvMix: { value: number };
      };
      const enableEnvCrossfade = (
        mat: InstanceType<typeof THREE.MeshPhysicalMaterial>,
        envB: InstanceType<typeof THREE.Texture>
      ): EnvMixUniforms => {
        const uniforms: EnvMixUniforms = {
          uEnvMapB: { value: envB },
          uEnvMix: { value: 0 }
        };
        mat.onBeforeCompile = (shader) => {
          // Wire the two new uniforms into the shader program
          shader.uniforms.uEnvMapB = uniforms.uEnvMapB;
          shader.uniforms.uEnvMix = uniforms.uEnvMix;
          // Declare them in the fragment shader. The patched env chunk
          // references these identifiers when it gets inlined later.
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
uniform sampler2D uEnvMapB;
uniform float uEnvMix;`
          );
        };
        return uniforms;
      };

      const tintColor = new THREE.Color(tint);
      const accentColor = new THREE.Color(accent);
      const bgColor = new THREE.Color(background);

      const mainMat = new THREE.MeshPhysicalMaterial({
        color: tintColor,
        metalness: 0.9,
        roughness: 0.12,
        // Explicit envMap (instead of relying on scene.environment) so we can
        // swap it per-chapter in lockstep with the gold and gem materials.
        envMap: envMap,
        envMapIntensity: 1.5,
        clearcoat: 1.0,
        clearcoatRoughness: 0.05,
        // Holographic shimmer — strong iridescence + wide thickness range
        iridescence: 1.0,
        iridescenceIOR: 1.3,
        iridescenceThicknessRange: [120, 700]
      });

      const mainSegs = 128;
      const mainGeom = new THREE.SphereGeometry(1, mainSegs, Math.round(mainSegs * 0.75));
      const mainBase = mainGeom.attributes.position.array.slice() as Float32Array;
      const mainMesh = new THREE.Mesh(mainGeom, mainMat);
      scene.add(mainMesh);
      const mainEnvUniforms = enableEnvCrossfade(mainMat, chromeEnvMap);

      // Polished gold — Filament/Disney F0 reference, no clearcoat.
      // The dramatic dark-floor env gives the deep reflection valleys that
      // separate "polished metal" from "wax".
      const goldMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(1.0, 0.86, 0.57),
        metalness: 1.0,
        roughness: 0.15,
        envMap: goldEnvMap,
        envMapIntensity: 1.85
      });
      const goldEnvUniforms = enableEnvCrossfade(goldMat, chromeEnvMap);

      // Polished dark amethyst that morphs into faceted chrome in the
      // Konsulentydelser chapter. Transmission/thickness/DoubleSide are
      // deliberately omitted — the gem is opaque throughout, and enabling
      // `transmission > 0` forces Three.js to add a second scene render
      // pass into a transmission render target every frame (expensive,
      // and it compounds with sticky + backdrop-filter on the page).
      const gemMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#3c1f55'),
        metalness: 0.15,
        roughness: 0.12,
        envMap: gemEnvMap,
        envMapIntensity: 2.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        ior: 1.75,
        specularIntensity: 1.2,
        specularColor: new THREE.Color('#ffb0de'),
        sheen: 0.8,
        sheenColor: new THREE.Color('#ff8fc8'),
        sheenRoughness: 0.25,
        flatShading: true
      });
      const gemEnvUniforms = enableEnvCrossfade(gemMat, chromeEnvMap);

      // Chapter palette endpoints — lerp'd toward based on `chapterMode`
      const mainTintTerapi = new THREE.Color(tint);
      const mainTintKonsulent = new THREE.Color('#b6c5da');
      // Chrome F0 (Filament reference, cooled slightly for "mercury" feel)
      const goldTerapi = new THREE.Color(1.0, 0.86, 0.57);
      const goldKonsulent = new THREE.Color(0.82, 0.85, 0.9);

      const gemTerapi = new THREE.Color('#3c1f55');
      // In konsulent the gem becomes the SAME chrome material as the
      // metaballs — faceted polished silver instead of glass/diamond.
      // Unified material → no more specular blow-out, coherent scene.
      const gemKonsulent = goldKonsulent;
      let liveChapter = chapterMode;

      // Fluid gold metaball cluster — MarchingCubes with a handful of balls
      // that orbit, bob, and one that periodically "drips" downward. All balls
      // expand together with scale: tight cluster at non-hero, dispersed at hero.
      type FluidBall = {
        orbitPhase: number;
        orbitSpeed: number;
        orbitRadius: number;
        orbitEllipse: number;
        bobPhase: number;
        bobSpeed: number;
        strengthMin: number;
        strengthMax: number;
        strengthPhase: number;
        fallBias: number;
      };

      type FluidGold = {
        mesh: InstanceType<typeof MarchingCubes>;
        balls: FluidBall[];
      };

      function makeFluidGold(): FluidGold {
        const mc = new MarchingCubes(48, goldMat, true, false, 20000);
        mc.isolation = 80;
        mc.position.set(0, 0, 0);
        mc.scale.setScalar(0.6);
        scene.add(mc);
        const balls: FluidBall[] = [
          {
            orbitPhase: 0.0, orbitSpeed: 0.22, orbitRadius: 0.05, orbitEllipse: 0.8,
            bobPhase: 0.3, bobSpeed: 0.55,
            strengthPhase: 0.0, strengthMin: 0.6, strengthMax: 0.78, fallBias: 0
          },
          {
            orbitPhase: 2.1, orbitSpeed: -0.18, orbitRadius: 0.09, orbitEllipse: 0.85,
            bobPhase: 1.2, bobSpeed: 0.75,
            strengthPhase: 1.5, strengthMin: 0.5, strengthMax: 0.66, fallBias: 0
          },
          {
            orbitPhase: 4.2, orbitSpeed: 0.12, orbitRadius: 0.11, orbitEllipse: 0.7,
            bobPhase: 2.8, bobSpeed: 0.5,
            strengthPhase: 3.2, strengthMin: 0.46, strengthMax: 0.62, fallBias: 0
          },
          {
            orbitPhase: 1.3, orbitSpeed: 0.2, orbitRadius: 0.12, orbitEllipse: 0.9,
            bobPhase: 3.6, bobSpeed: 0.8,
            strengthPhase: 2.4, strengthMin: 0.36, strengthMax: 0.52, fallBias: 0
          },
          {
            orbitPhase: 5.1, orbitSpeed: -0.26, orbitRadius: 0.14, orbitEllipse: 0.95,
            bobPhase: 4.4, bobSpeed: 1.0,
            strengthPhase: 4.1, strengthMin: 0.3, strengthMax: 0.46, fallBias: 0
          },
          {
            orbitPhase: 3.0, orbitSpeed: 0.38, orbitRadius: 0.15, orbitEllipse: 0.6,
            bobPhase: 2.2, bobSpeed: 0.9,
            strengthPhase: 0.7, strengthMin: 0.28, strengthMax: 0.44, fallBias: 0
          },
          // Drip — pulls downward via fallBias
          {
            orbitPhase: 0.9, orbitSpeed: 0.4, orbitRadius: 0.08, orbitEllipse: 1.0,
            bobPhase: 0.6, bobSpeed: 1.4,
            strengthPhase: 0.5, strengthMin: 0.28, strengthMax: 0.48, fallBias: -0.3
          }
        ];
        return { mesh: mc, balls };
      }

      type GemState = {
        mesh: InstanceType<typeof THREE.Mesh>;
        geom: InstanceType<typeof THREE.IcosahedronGeometry>;
        base: Float32Array;
        orbitPhase: number;
        stretchPhase: number;
        fallPhase: number;
      };

      function makeGem(radius: number, phaseBase: number): GemState {
        const g = new THREE.IcosahedronGeometry(radius, 0);
        const base = g.attributes.position.array.slice() as Float32Array;
        const m = new THREE.Mesh(g, gemMat);
        scene.add(m);
        return {
          mesh: m,
          geom: g,
          base,
          orbitPhase: phaseBase,
          stretchPhase: phaseBase + 0.8,
          fallPhase: phaseBase + 1.4
        };
      }

      const fluidGold = makeFluidGold();
      const drip2 = makeGem(0.26, 2.3);

      const keyLight = new THREE.PointLight(accentColor, 2.5, 16, 1.4);
      keyLight.position.set(-2.4, 1.8, 2.6);
      scene.add(keyLight);
      const fillLight = new THREE.PointLight(bgColor, 1.2, 12, 2);
      fillLight.position.set(2.6, -1.4, 1.8);
      scene.add(fillLight);

      const ndcToWorld = (ndcX: number, ndcY: number, z = 0) => {
        const halfH = (camera.position.z - z) * Math.tan((fov * Math.PI) / 360);
        const halfW = halfH * camera.aspect;
        return { x: ndcX * halfW, y: ndcY * halfH };
      };

      const elementToNdc = (el: HTMLElement) => {
        const r = el.getBoundingClientRect();
        const cx = r.left + r.width / 2;
        const cy = r.top + r.height / 2;
        return {
          x: (cx / window.innerWidth - 0.5) * 2,
          y: -(cy / window.innerHeight - 0.5) * 2
        };
      };

      // Cache DOM elements for anchor sections + any pin selectors
      const sectionEls = new Map<string, HTMLElement | null>();
      const pinEls = new Map<string, HTMLElement | null>();

      const refreshCaches = () => {
        sectionEls.clear();
        pinEls.clear();
        for (const a of anchors) {
          sectionEls.set(a.selector, document.querySelector(a.selector) as HTMLElement | null);
          for (const el of [a.main, a.drip1, a.drip2]) {
            if (el.pin && !pinEls.has(el.pin.selector)) {
              pinEls.set(
                el.pin.selector,
                document.querySelector(el.pin.selector) as HTMLElement | null
              );
            }
          }
        }
      };
      refreshCaches();

      // Compute intersection ratio per section each frame for smooth weighting
      const computeVisibility = () => {
        const vh = window.innerHeight;
        const map = new Map<string, number>();
        for (const a of anchors) {
          const el = sectionEls.get(a.selector);
          if (!el) {
            map.set(a.selector, 0);
            continue;
          }
          const r = el.getBoundingClientRect();
          const top = Math.max(0, r.top);
          const bottom = Math.min(vh, r.bottom);
          const overlap = Math.max(0, bottom - top);
          const denom = Math.min(vh, r.height || 1);
          const ratio = denom > 0 ? overlap / denom : 0;
          map.set(a.selector, Math.min(1, ratio));
        }
        return map;
      };

      type Live = { x: number; y: number; scale: number };
      // Initialise live state at the FIRST anchor's positions so elements
      // appear at their hero resting poses immediately — no visible lerp
      // from centre on load.
      const firstAnchor = anchors[0];
      const liveMain: Live = {
        x: firstAnchor.main.x,
        y: firstAnchor.main.y,
        scale: firstAnchor.main.scale
      };
      const liveDrip1: Live = {
        x: firstAnchor.drip1.x,
        y: firstAnchor.drip1.y,
        scale: firstAnchor.drip1.scale
      };
      const liveDrip2: Live = {
        x: firstAnchor.drip2.x,
        y: firstAnchor.drip2.y,
        scale: firstAnchor.drip2.scale
      };
      let liveIntensity = firstAnchor.intensity ?? 1;

      const resolvePin = (pin: Pin | undefined): { x: number; y: number } | null => {
        if (!pin) return null;
        const el = pinEls.get(pin.selector);
        if (!el) return null;
        const ndc = elementToNdc(el);
        return { x: ndc.x + (pin.dx ?? 0), y: ndc.y + (pin.dy ?? 0) };
      };

      const blendTargets = () => {
        const vis = computeVisibility();
        let sumW = 0;
        let mx = 0,
          my = 0,
          ms = 0;
        let d1x = 0,
          d1y = 0,
          d1s = 0;
        let d2x = 0,
          d2y = 0,
          d2s = 0;
        let inten = 0;

        let dominant: SectionAnchor | null = null;
        let dominantR = 0;

        for (const a of anchors) {
          const r = vis.get(a.selector) ?? 0;
          if (r > dominantR) {
            dominantR = r;
            dominant = a;
          }
          if (r <= 0.01) continue;
          // Cubic easing — middle sections weighted heavily, edges tapered
          const w = r * r * r;
          sumW += w;

          // For pinned elements, sample pin position at blend time
          const mPin = resolvePin(a.main.pin);
          const mainX = mPin ? mPin.x : a.main.x;
          const mainY = mPin ? mPin.y : a.main.y;
          const d1Pin = resolvePin(a.drip1.pin);
          const d1X = d1Pin ? d1Pin.x : a.drip1.x;
          const d1Y = d1Pin ? d1Pin.y : a.drip1.y;
          const d2Pin = resolvePin(a.drip2.pin);
          const d2X = d2Pin ? d2Pin.x : a.drip2.x;
          const d2Y = d2Pin ? d2Pin.y : a.drip2.y;

          mx += mainX * w;
          my += mainY * w;
          ms += a.main.scale * w;
          d1x += d1X * w;
          d1y += d1Y * w;
          d1s += a.drip1.scale * w;
          d2x += d2X * w;
          d2y += d2Y * w;
          d2s += a.drip2.scale * w;
          inten += (a.intensity ?? 1) * w;
        }

        if (sumW > 1e-5) {
          return {
            main: { x: mx / sumW, y: my / sumW, scale: ms / sumW },
            drip1: { x: d1x / sumW, y: d1y / sumW, scale: d1s / sumW },
            drip2: { x: d2x / sumW, y: d2y / sumW, scale: d2s / sumW },
            intensity: inten / sumW
          };
        }
        // Fallback to dominant or first
        const a = dominant ?? anchors[0];
        return {
          main: { x: a.main.x, y: a.main.y, scale: a.main.scale },
          drip1: { x: a.drip1.x, y: a.drip1.y, scale: a.drip1.scale },
          drip2: { x: a.drip2.x, y: a.drip2.y, scale: a.drip2.scale },
          intensity: a.intensity ?? 1
        };
      };

      // Height-only resize policy:
      //   Mobile (touch-primary): ignore. iOS Safari fires a resize event
      //     every time the URL bar shows/hides during scroll, which would
      //     squeeze the 3D viewport mid-scroll. Orientation changes still
      //     trigger because width changes too.
      //   Desktop: respect. Users genuinely resize window height, toggle
      //     DevTools, maximize vertically, etc., and the canvas must
      //     follow or the camera aspect drifts and elements stretch.
      // Detect touch-primary via pointer/hover media — more reliable than
      // viewport-width heuristics (tablets in landscape read as desktop
      // width but still have the URL-bar issue).
      const isTouchPrimary = window.matchMedia(
        '(hover: none) and (pointer: coarse)'
      ).matches;
      let lastResizeW = width;
      let lastResizeH = height;
      const onResize = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;
        const widthChanged = Math.abs(w - lastResizeW) > 1;
        const heightChanged = Math.abs(h - lastResizeH) > 1;
        const shouldResize = widthChanged || (!isTouchPrimary && heightChanged);
        if (!shouldResize) {
          // Keep caches in sync — section positions may have shifted even
          // without a canvas resize.
          refreshCaches();
          return;
        }
        lastResizeW = w;
        lastResizeH = h;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        refreshCaches();
      };
      // When width/height are pinned by props, the stage is for a
      // capture-time layout (OG image) — no user resizing happens, so
      // skip the listener. Avoids refreshCaches() running against the
      // surrounding 1200×630 viewport and thrashing visibility math.
      if (!fixedSize) {
        window.addEventListener('resize', onResize, { passive: true });
      }

      let pointerX = 0;
      let pointerY = 0;
      const onPointerMove = (e: PointerEvent) => {
        pointerX = (e.clientX / window.innerWidth - 0.5) * 2;
        pointerY = (e.clientY / window.innerHeight - 0.5) * 2;
      };
      window.addEventListener('pointermove', onPointerMove, { passive: true });

      // Scroll-activity biases the chapter lerp toward konsulent while the
      // user is actively scrolling in the therapy section — so scrolling
      // gives a taste of the next chapter rather than a flat overlay.
      let scrollActivity = 0;
      let lastScrollTime = 0;
      const onScroll = () => {
        lastScrollTime = performance.now();
      };
      window.addEventListener('scroll', onScroll, { passive: true });

      let time = 0;
      let rotX = 0;
      let rotY = 0;

      const displaceMain = () => {
        const pos = mainGeom.attributes.position;
        const count = pos.count;
        for (let i = 0; i < count; i++) {
          const ix = i * 3;
          const bx = mainBase[ix];
          const by = mainBase[ix + 1];
          const bz = mainBase[ix + 2];
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
          pos.array[ix] = bx + nx * wave;
          pos.array[ix + 1] = by + ny * wave;
          pos.array[ix + 2] = bz + nz * wave;
        }
        pos.needsUpdate = true;
        mainGeom.computeVertexNormals();
      };

      const updateFluidGold = (f: FluidGold, live: Live) => {
        const world = ndcToWorld(live.x, live.y);
        // Hard cap — keeps individual metaballs small enough that the
        // low-poly MC facets never become obvious
        const cappedScale = Math.min(0.4, Math.max(0.001, live.scale));
        const s = cappedScale;
        // The MC unit cube spans [-0.5, 0.5] internally; scale up for the drip size
        const volScale = 1.6 * s;
        f.mesh.position.set(world.x, world.y, 0);
        f.mesh.scale.setScalar(volScale);
        f.mesh.visible = live.scale > 0.02;

        f.mesh.reset();
        const fallCycle = 0.5 + 0.5 * Math.sin(time * 0.45);
        const pulse = Math.pow(fallCycle, 2.4);
        const subtract = 12;

        // Uniform orbit multiplier. Transition window is narrow (0.34→0.4):
        // below the window → tight merged cluster (top-of-page state);
        // within the window → gold's hero moments, balls disperse into
        // individual drops or pairs.
        const t = Math.max(0, Math.min(1, (live.scale - 0.34) / 0.06));
        const heroProgress = t * t * (3 - 2 * t);
        const orbitMult = 0.7 + heroProgress * 1.8; // 0.7 merged → 2.5 dispersed

        for (const b of f.balls) {
          const a = time * b.orbitSpeed + b.orbitPhase;
          const orbR = Math.min(0.36, b.orbitRadius * orbitMult);
          const cx = 0.5 + Math.cos(a) * orbR;
          const cz = 0.5 + Math.sin(a) * orbR * b.orbitEllipse;
          const cy =
            0.5 +
            Math.sin(time * b.bobSpeed + b.bobPhase) * 0.05 +
            b.fallBias * pulse;
          const strength =
            b.strengthMin +
            (Math.sin(time * 0.9 + b.strengthPhase) * 0.5 + 0.5) *
              (b.strengthMax - b.strengthMin);
          f.mesh.addBall(cx, cy, cz, strength, subtract);
        }

        // Slow overall drift of the cluster axis for living movement
        f.mesh.rotation.z = Math.sin(time * 0.3) * 0.15;
        f.mesh.rotation.y = time * 0.08;

        // Rebuild the isosurface for this frame
        f.mesh.update();
      };

      const positionMain = () => {
        const world = ndcToWorld(liveMain.x, liveMain.y);
        mainMesh.position.x = world.x;
        mainMesh.position.y = world.y;
        const s = Math.max(0.001, liveMain.scale);
        mainMesh.scale.setScalar(s);
        /*
          Background-fill clipping guard: when the orb is scaled
          past ~1.5 its surface starts approaching the camera
          plane (camera at z=3.2; sphere radius = 1 * scale; plus
          the `MeshPhysicalMaterial` displacement can push the
          surface an extra ~0.3 forward). Pin the front surface
          at z = 1.5 (1.7 away from the camera) whenever the scale
          would otherwise carry it closer. Only kicks in for the
          `fullBleed` / oversized use case; hero-scale orbs (~1)
          keep their default z=0 placement.
        */
        const SURFACE_LIMIT_Z = 1.5;
        mainMesh.position.z = s > SURFACE_LIMIT_Z ? SURFACE_LIMIT_Z - s : 0;
        mainMesh.visible = liveMain.scale > 0.02;

        rotX += (pointerY * 0.18 - rotX) * 0.04;
        rotY += (pointerX * 0.22 - rotY) * 0.04;
        mainMesh.rotation.x = rotX + Math.sin(time * 0.3) * 0.06;
        mainMesh.rotation.y = rotY + time * 0.15;
      };

      const positionGem = (d: GemState, live: Live, wobbleAmp: number) => {
        // Keep gem in front of everything else — project NDC at this forward z
        const forwardZ = 1.0;
        const world = ndcToWorld(live.x, live.y, forwardZ);
        const bob = Math.sin(time * 0.8 + d.orbitPhase) * 0.05 * wobbleAmp;
        const side = Math.cos(time * 0.55 + d.orbitPhase) * 0.035 * wobbleAmp;

        d.mesh.position.x = world.x + side;
        d.mesh.position.y = world.y + bob;
        /*
          Same camera-clipping guard as `positionMain`: when the
          gem is scaled past ~1.5 (fullBleed / cover-background)
          its surface crosses the camera plane. Pin the front
          surface at `baseZ + 1.5` so the gem stays in front of
          the camera regardless of how oversized it gets.
        */
        const baseZ = forwardZ + Math.sin(time * 0.4 + d.orbitPhase) * 0.08;
        const scaleNow = Math.max(0.001, live.scale);
        const GEM_SURFACE_LIMIT = 1.5;
        d.mesh.position.z =
          scaleNow > GEM_SURFACE_LIMIT
            ? baseZ - (scaleNow - GEM_SURFACE_LIMIT)
            : baseZ;

        d.mesh.scale.setScalar(scaleNow);
        // Slow tumble around all three axes for a jewel catching light
        d.mesh.rotation.x = time * 0.22 + d.orbitPhase;
        d.mesh.rotation.y = time * 0.31 + d.stretchPhase;
        d.mesh.rotation.z = Math.sin(time * 0.4 + d.fallPhase) * 0.35;
        d.mesh.visible = live.scale > 0.02;
      };

      // Critically-damped smoothing via double-lerp for extra silky easing.
      // Works in two stages: target → smoothed → live, both with slow k.
      const smoothedMain: Live = { ...liveMain };
      const smoothedD1: Live = { ...liveDrip1 };
      const smoothedD2: Live = { ...liveDrip2 };
      let smoothedIntensity = liveIntensity;

      const lerpLive = (live: Live, target: Live, k: number) => {
        live.x += (target.x - live.x) * k;
        live.y += (target.y - live.y) * k;
        live.scale += (target.scale - live.scale) * k;
      };

      const tick = () => {
        if (disposed) return;
        requestAnimationFrame(tick);
        if (document.hidden) return;

        time += 0.005;

        const t = blendTargets();

        // Very slow critically-damped tracking — prioritises readability
        const k1 = 0.012;
        lerpLive(smoothedMain, t.main, k1);
        lerpLive(smoothedD1, t.drip1, k1);
        lerpLive(smoothedD2, t.drip2, k1);
        smoothedIntensity += (t.intensity - smoothedIntensity) * k1;

        const k2 = 0.015;
        lerpLive(liveMain, smoothedMain, k2);
        lerpLive(liveDrip1, smoothedD1, k2);
        lerpLive(liveDrip2, smoothedD2, k2);
        liveIntensity += (smoothedIntensity - liveIntensity) * k2;

        renderer.toneMappingExposure = 0.9 + liveIntensity * 0.25;

        // Chapter palette transition (therapy → konsulent). While the user
        // is actively scrolling in the therapy section, the scrollActivity
        // value biases the effective chapter toward konsulent — so the
        // scroll feedback is "a glimpse of the next chapter" rather than
        // a flat cream duotone.
        const scrollBias = 0.55;
        const effectiveChapter = Math.min(
          1,
          chapterMode + (1 - chapterMode) * scrollActivity * scrollBias
        );
        // Asymmetric lerp — engage quickly (while the user is still
        // scrolling) so the hint is visible, return gently at rest.
        const chapRate = effectiveChapter > liveChapter ? 0.08 : 0.03;
        liveChapter += (effectiveChapter - liveChapter) * chapRate;
        mainMat.color.lerpColors(mainTintTerapi, mainTintKonsulent, liveChapter);
        // Fade the holographic iridescence out — in konsulent the main orb
        // joins the same pure-chrome family as the metaballs and gem.
        mainMat.iridescence = 1.0 - liveChapter;
        // Env crossfade — each material's shader was patched at mount to
        // sample BOTH its therapy env AND the shared chromeEnvMap, mixing
        // by `uEnvMix`. Setting it equal to `liveChapter` means env maps
        // blend continuously with the material-colour lerp above. No more
        // threshold swap, no shader recompile, no uniform thrashing.
        mainEnvUniforms.uEnvMix.value = liveChapter;
        goldEnvUniforms.uEnvMix.value = liveChapter;
        gemEnvUniforms.uEnvMix.value = liveChapter;

        // --- METALS (all three share the same chrome recipe in konsulent) ---
        goldMat.color.lerpColors(goldTerapi, goldKonsulent, liveChapter);
        goldMat.roughness = 0.15 - liveChapter * 0.09;
        goldMat.envMapIntensity = 1.85 - liveChapter * 0.15;

        // GEM morphs from dielectric amethyst → faceted chrome (same
        // material recipe as the metaballs, just with a flat-shaded
        // icosahedron instead of marching-cubes).
        gemMat.color.lerpColors(gemTerapi, gemKonsulent, liveChapter);
        gemMat.metalness = 0.15 + liveChapter * 0.85;
        gemMat.roughness = 0.14 - liveChapter * 0.08;
        gemMat.envMapIntensity = 1.6 + liveChapter * 0.2;
        // Chrome is opaque — don't touch transmission/iridescence here,
        // leaving them zero-at-init so the corresponding shader variants
        // were never compiled in the first place.
        gemMat.sheen = 0.8 * (1 - liveChapter);
        gemMat.specularIntensity = 1.2 - liveChapter * 0.2;
        gemMat.clearcoat = 1.0 - liveChapter * 0.5;
        gemMat.clearcoatRoughness = 0.03;

        // Skip per-frame CPU work on elements that won't draw this frame.
        // The mainGeom displacement + computeVertexNormals is the single
        // heaviest CPU task in the tick (~12k verts); skipping it when
        // mainMesh is offscreen-small gives a measurable recovery.
        const mainVisible = liveMain.scale > 0.02;
        const goldVisible = liveDrip1.scale > 0.02;
        const gemVisible = liveDrip2.scale > 0.02;

        if (mainVisible) {
          displaceMain();
          positionMain();
          // Animate iridescence thickness for a shifting holographic shimmer
          const tLow = 150 + Math.sin(time * 0.6) * 80;
          const tHigh = 600 + Math.sin(time * 0.4 + 1.3) * 200;
          mainMat.iridescenceThicknessRange = [tLow, tHigh];
        } else {
          mainMesh.visible = false;
        }

        if (goldVisible) {
          updateFluidGold(fluidGold, liveDrip1);
        } else {
          fluidGold.mesh.visible = false;
        }

        if (gemVisible) {
          positionGem(drip2, liveDrip2, 1.3);
        } else {
          drip2.mesh.visible = false;
        }

        // Scroll activity — drives the scrollBias applied to `effectiveChapter`
        // above. Ramps in ~270 ms, decays ~1 s after the user stops scrolling.
        const isScrolling = performance.now() - lastScrollTime < 90;
        const actTarget = isScrolling ? 1 : 0;
        const actRate = actTarget > scrollActivity ? 0.09 : 0.035;
        scrollActivity += (actTarget - scrollActivity) * actRate;

        renderer.render(scene, camera);
      };
      // Preload shader programs for every material variant we might use
      // (full konsulent state included) so there's no first-use compile
      // hitch when the user crosses the chapter boundary. `renderer.compile`
      // walks the scene and compiles each material's shader upfront.
      renderer.compile(scene, camera);

      tick();

      cleanup = () => {
        disposed = true;
        window.removeEventListener('resize', onResize);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('scroll', onScroll);
        mainGeom.dispose();
        mainMat.dispose();
        fluidGold.mesh.geometry.dispose();
        drip2.geom.dispose();
        goldMat.dispose();
        gemMat.dispose();
        envMap.dispose();
        goldEnvMap.dispose();
        gemEnvMap.dispose();
        chromeEnvMap.dispose();
        pmrem.dispose();
        renderer.dispose();
        renderer.domElement.remove();
      };
    })();

    return () => cleanup?.();
  });
</script>

<div bind:this={host} class="flod-stage" aria-hidden="true"></div>

<style>
  .flod-stage {
    position: fixed;
    inset: 0;
    pointer-events: none;
    /* z-index: -1 so the canvas paints BELOW all in-flow block-level
       content (sections, text). Otherwise only positioned sections
       (.hero, .contact, .foot) stack above — non-positioned sections
       like .manifest get painted over by the canvas. */
    z-index: -1;
    width: 100vw;
    height: 100vh;
    background: transparent;
    /* Force a GPU layer so iOS Safari keeps the canvas composited during
       scroll-driven repaints and doesn't flash the element bg. */
    transform: translateZ(0);
    -webkit-backface-visibility: hidden;
    backface-visibility: hidden;
  }
</style>
