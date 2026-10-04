/** All layers share the same tiny displacement, keeping axons and impulses aligned. */
const tissueGLSL = `
  vec3 tissuePosition(vec3 p, float time) {
    return p * (1.0 + 0.004 * sin(time * 0.38));
  }
  float tissueDepth(float viewZ) {
    return smoothstep(-5.3, -3.2, viewZ);
  }
`

/** Pearlescent, translucent anatomy: relief shadows, two soft lights and a violet rim. */
export const cortexVertex = `
  uniform float uTime;
  attribute float aRelief;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPosition;
  varying float vFissure;
  varying float vRelief;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vPosition = position;
    vRelief = aRelief;
    vFissure = (1.0 - smoothstep(0.026, 0.12, abs(position.x)))
      * smoothstep(-0.15, 0.45, position.y);
    gl_Position = projectionMatrix * view;
  }
`

export const cortexFragment = `
  uniform vec3 uCortexLight;
  uniform vec3 uCortexShadow;
  uniform vec3 uViolet;
  uniform float uCortexOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying vec3 vPosition;
  varying float vFissure;
  varying float vRelief;
  void main() {
    vec3 normal = normalize(vNormal);
    vec3 view = normalize(vView);
    vec3 keyLight = normalize(vec3(-0.55, 0.9, 1.0));
    float light = max(0.0, dot(normal, keyLight));
    float fill = max(0.0, dot(normal, normalize(vec3(0.8, -0.2, 0.5))));
    float rim = pow(1.0 - max(0.0, dot(normal, view)), 2.4);
    float pearl = pow(max(0.0, dot(normal, normalize(keyLight + view))), 24.0);
    // Relief is sampled from the same folded cortical sheet, avoiding a painted
    // texture that could drift away from the actual anatomical geometry.
    float folds = smoothstep(0.12, 0.95, vRelief);
    float grain = sin(vPosition.x * 157.0 + vPosition.z * 81.0)
      * sin(vPosition.y * 181.0 - vPosition.z * 97.0);
    vec3 color = mix(uCortexShadow, uCortexLight, 0.2 + light * 0.65 + fill * 0.12);
    color = mix(color, uCortexShadow, folds * 0.3);
    color += uCortexLight * pearl * 0.28 + uViolet * rim * 0.16 + grain * 0.012;
    // A soft occlusion cue along the medial rim makes the sulcus readable on
    // pale canvases too, where a transparent gap alone would disappear.
    color = mix(color, uCortexShadow, vFissure * 0.8);
    float alpha = uCortexOpacity * (0.68 + rim * 0.32);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export const nodeVertex = `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSeed;
  attribute float aDensity;
  varying float vDensity;
  varying float vDepth;
  varying float vSeed;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    vDensity = aDensity;
    vSeed = aSeed;
    vDepth = tissueDepth(view.z);
    gl_Position = projectionMatrix * view;
    gl_PointSize = (1.1 + aDensity * 0.45 + pow(aSeed, 9.0) * 2.0)
      * uPixelRatio * (4.0 / -view.z);
  }
`

export const nodeFragment = `
  uniform vec3 uTissue;
  uniform vec3 uDepthColor;
  uniform vec3 uViolet;
  uniform float uNodeOpacity;
  varying float vDensity;
  varying float vDepth;
  varying float vSeed;
  void main() {
    float radius = length(gl_PointCoord * 2.0 - 1.0);
    if (radius > 1.0) discard;
    float halo = exp(-radius * radius * 3.5) * (1.0 - smoothstep(0.65, 1.0, radius));
    float core = exp(-radius * radius * 19.0);
    float alpha = (halo * 0.6 + core * 0.4) * uNodeOpacity
      * mix(0.24, 1.0, vDepth) * (0.65 + vDensity * 0.35);
    vec3 color = mix(uDepthColor, uTissue, 0.35 + vDepth * 0.5 + vSeed * 0.15);
    color = mix(color, uViolet, smoothstep(0.94, 1.0, vSeed) * core * 0.5);
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`

export const fiberVertex = `
  uniform float uTime;
  attribute float aSeed;
  attribute float aDensity;
  varying float vDepth;
  varying float vDensity;
  varying float vSeed;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    vDepth = tissueDepth(view.z);
    vDensity = aDensity;
    vSeed = aSeed;
    gl_Position = projectionMatrix * view;
  }
`

export const fiberFragment = `
  uniform vec3 uTissue;
  uniform vec3 uDepthColor;
  uniform float uFiberOpacity;
  varying float vDepth;
  varying float vDensity;
  varying float vSeed;
  void main() {
    float alpha = uFiberOpacity * mix(0.12, 1.0, vDepth)
      * (0.55 + 0.45 * vDensity) * (0.72 + 0.28 * vSeed);
    gl_FragColor = vec4(mix(uDepthColor, uTissue, vDepth), alpha);
    #include <colorspace_fragment>
  }
`

/** A continuous camera-facing ribbon, with a tapered tail and an integrated luminous head. */
export const cometVertex = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uTail;
  uniform float uWidth;
  attribute vec3 aTangent;
  attribute float aAlong;
  attribute float aSide;
  varying float vAlong;
  varying float vSide;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    vec2 tangent = (modelViewMatrix * vec4(aTangent, 0.0)).xy;
    // A stable fallback also handles fibers pointing almost directly at the camera.
    vec2 perpendicular = length(tangent) > 0.0001
      ? normalize(vec2(-tangent.y, tangent.x)) : vec2(0.0, 1.0);
    float behind = clamp((uProgress - aAlong) / uTail, 0.0, 1.0);
    float taper = mix(1.0, 0.15, smoothstep(0.0, 1.0, behind));
    view.xy += perpendicular * aSide * uWidth * taper;
    vAlong = aAlong;
    vSide = aSide;
    gl_Position = projectionMatrix * view;
  }
`

export const cometFragment = `
  uniform float uProgress;
  uniform float uTail;
  uniform float uEnvelope;
  uniform vec3 uEmber;
  uniform vec3 uFlame;
  uniform vec3 uCore;
  uniform vec3 uViolet;
  uniform float uTint;
  varying float vAlong;
  varying float vSide;
  void main() {
    float behind = uProgress - vAlong;
    float tailPosition = max(behind, 0.0) / uTail;
    float tail = exp(-tailPosition * 1.7)
      * (1.0 - smoothstep(0.65, 1.0, tailPosition))
      * smoothstep(-0.006, 0.014, behind);
    float headDistance = behind / 0.02;
    float head = exp(-headDistance * headDistance);
    float edge = 1.0 - smoothstep(0.72, 1.0, abs(vSide));
    float aura = exp(-vSide * vSide * 4.0) * edge;
    float filament = exp(-vSide * vSide * 80.0);
    float headCore = head * exp(-vSide * vSide * 28.0);
    float alpha = (tail * (filament * 0.95 + aura * 0.58)
      + head * aura * 0.65 + headCore * 0.85) * uEnvelope;
    if (alpha < 0.003) discard;
    vec3 color = mix(uEmber, uFlame, exp(-tailPosition * 1.6));
    color = mix(color, uViolet, uTint * 0.84 + (1.0 - uTint) * tailPosition * 0.3);
    color = mix(color, uCore, clamp(headCore + filament * tail * 0.28, 0.0, 1.0));
    gl_FragColor = vec4(color, min(alpha, 1.0));
    #include <colorspace_fragment>
  }
`

/** Sprite bloom is integrated into each route, so mobile needs no postprocessing pass. */
export const flareVertex = `
  uniform float uTime;
  uniform float uProgress;
  uniform float uPixelRatio;
  attribute float aAlong;
  attribute float aSide;
  varying float vStrength;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    float distance = (uProgress - aAlong) / 0.008;
    vStrength = exp(-distance * distance) * step(0.0, aSide);
    gl_Position = projectionMatrix * view;
    // Hidden route samples remain one pixel instead of shading empty 32px squares.
    gl_PointSize = vStrength < 0.035 ? 1.0
      : clamp(16.0 * uPixelRatio * (4.0 / -view.z), 1.0, 26.0);
  }
`

export const flareFragment = `
  uniform vec3 uFlame;
  uniform vec3 uCore;
  uniform vec3 uViolet;
  uniform float uEnvelope;
  uniform float uTint;
  varying float vStrength;
  void main() {
    if (vStrength < 0.035) discard;
    vec2 point = gl_PointCoord * 2.0 - 1.0;
    float radius = length(point);
    if (radius > 1.0) discard;
    float halo = exp(-radius * radius * 5.0) * (1.0 - smoothstep(0.6, 1.0, radius));
    float core = exp(-radius * radius * 85.0);
    // Fine anisotropic rays give the leading neuron a lens-like glint.
    float rays = exp(-abs(point.x) * 60.0) * exp(-abs(point.y) * 5.0)
      + exp(-abs(point.y) * 60.0) * exp(-abs(point.x) * 5.0);
    float alpha = (halo * 0.26 + core * 0.9 + rays * 0.16) * vStrength * uEnvelope;
    vec3 color = mix(mix(uFlame, uViolet, uTint), uCore, clamp(core + rays * 0.65, 0.0, 1.0));
    gl_FragColor = vec4(color, min(1.0, alpha));
    #include <colorspace_fragment>
  }
`
