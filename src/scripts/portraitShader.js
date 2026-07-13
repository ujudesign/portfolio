import { Renderer, Triangle, Program, Mesh, Texture, Vec2 } from "ogl";
import { gsap } from "gsap";

const vertex = /* glsl */ `
  attribute vec2 uv;
  attribute vec2 position;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform sampler2D uTexture;
  uniform vec2 uImageSize;
  uniform vec2 uCanvasSize;
  uniform vec2 uMouse;   // 0..1, y up
  uniform float uHover;  // 0..1
  uniform float uTime;
  varying vec2 vUv;

  void main() {
    // "cover" fit the image into the canvas.
    vec2 s = uCanvasSize / uImageSize;
    float scale = max(s.x, s.y);
    vec2 size = uImageSize * scale;
    vec2 offset = (uCanvasSize - size) * 0.5;
    vec2 uv = (vUv * uCanvasSize - offset) / size;

    // Ripple displacement radiating from the cursor, strongest on hover.
    vec2 toMouse = uv - uMouse;
    float dist = length(toMouse);
    float falloff = smoothstep(0.5, 0.0, dist);
    float amp = falloff * uHover;
    vec2 dir = normalize(toMouse + 1e-4);
    float wave = sin(dist * 28.0 - uTime * 3.2);
    vec2 disp = dir * wave * 0.018 * amp;

    // Chromatic aberration that grows with the displacement.
    float ca = 0.010 * amp;
    vec2 duv = uv + disp;
    float r = texture2D(uTexture, duv + dir * ca).r;
    float g = texture2D(uTexture, duv).g;
    float b = texture2D(uTexture, duv - dir * ca).b;
    vec3 color = vec3(r, g, b);

    // Keep sampling inside the image to avoid smeared edges.
    if (duv.x < 0.0 || duv.x > 1.0 || duv.y < 0.0 || duv.y > 1.0) {
      color = texture2D(uTexture, clamp(uv, 0.0, 1.0)).rgb;
    }

    gl_FragColor = vec4(color, 1.0);
  }
`;

/**
 * Attaches a WebGL hover-displacement shader over the portrait's <img>.
 * Returns true if it initialised, false if it fell back (caller keeps the img).
 */
export function initPortraitShader(container) {
  const img = container.querySelector("img");
  if (!img) return false;

  let renderer;
  try {
    renderer = new Renderer({
      alpha: true,
      dpr: Math.min(window.devicePixelRatio || 1, 2),
    });
  } catch (e) {
    return false; // no WebGL — keep the static image
  }

  const gl = renderer.gl;
  const canvas = gl.canvas;
  Object.assign(canvas.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
  });
  container.appendChild(canvas);

  const texture = new Texture(gl, { generateMipmaps: false });
  const program = new Program(gl, {
    vertex,
    fragment,
    uniforms: {
      uTexture: { value: texture },
      uImageSize: { value: new Vec2(1, 1) },
      uCanvasSize: { value: new Vec2(1, 1) },
      uMouse: { value: new Vec2(0.5, 0.5) },
      uHover: { value: 0 },
      uTime: { value: 0 },
    },
  });
  const mesh = new Mesh(gl, { geometry: new Triangle(gl), program });

  // Load the texture from the already-rendered <img>.
  const src = img.currentSrc || img.src;
  const bitmap = new Image();
  bitmap.crossOrigin = "anonymous";
  bitmap.onload = () => {
    texture.image = bitmap;
    program.uniforms.uImageSize.value.set(bitmap.naturalWidth, bitmap.naturalHeight);
    img.style.opacity = "0"; // reveal the canvas once the texture is ready
  };
  bitmap.src = src;

  const resize = () => {
    const rect = container.getBoundingClientRect();
    renderer.setSize(rect.width, rect.height);
    program.uniforms.uCanvasSize.value.set(gl.canvas.width, gl.canvas.height);
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(container);

  const target = new Vec2(0.5, 0.5);
  container.addEventListener("pointermove", (e) => {
    const rect = container.getBoundingClientRect();
    target.set((e.clientX - rect.left) / rect.width, 1 - (e.clientY - rect.top) / rect.height);
  });
  container.addEventListener("pointerenter", () =>
    gsap.to(program.uniforms.uHover, { value: 1, duration: 0.45, ease: "power2.out" })
  );
  container.addEventListener("pointerleave", () =>
    gsap.to(program.uniforms.uHover, { value: 0, duration: 0.6, ease: "power2.out" })
  );

  const mouse = program.uniforms.uMouse.value;
  gsap.ticker.add((time) => {
    program.uniforms.uTime.value = time;
    mouse.x += (target.x - mouse.x) * 0.1;
    mouse.y += (target.y - mouse.y) * 0.1;
    renderer.render({ scene: mesh });
  });

  return true;
}
