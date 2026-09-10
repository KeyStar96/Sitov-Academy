/** All layers share the same tiny displacement, keeping axons and impulses aligned. */
const tissueGLSL = `
  vec3 tissuePosition(vec3 p, float time) {
    return p * (1.0 + 0.004 * sin(time * 0.38));
  }
  float tissueDepth(float viewZ) {
    return smoothstep(-5.3, -3.2, viewZ);
  }
`

/** Quiet surface shading makes gyri readable while the network remains dominant. */
export const cortexVertex = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFissure;
  ${tissueGLSL}
  void main() {
    vec4 view = modelViewMatrix * vec4(tissuePosition(position, uTime), 1.0);
    vNormal = normalize(normalMatrix * normal);
    vView = normalize(-view.xyz);
    vFissure = (1.0 - smoothstep(0.026, 0.12, abs(position.x)))
      * smoothstep(-0.15, 0.45, position.y);
    gl_Position = projectionMatrix * view;
  }
`

export const cortexFragment = `
  uniform vec3 uCortexLight;
  uniform vec3 uCortexShadow;
  uniform float uCortexOpacity;
  varying vec3 vNormal;
  varying vec3 vView;
  varying float vFissure;
  void main() {
    vec3 normal = normalize(vNormal);
    float light = max(0.0, dot(normal, normalize(vec3(-0.55, 0.75, 1.0))));
    float rim = pow(1.0 - max(0.0, dot(normal, normalize(vView))), 2.0);
    vec3 color = mix(uCortexShadow, uCortexLight, light);
    // A soft occlusion cue along the medial rim makes the sulcus readable on
    // pale canvases too, where a transparent gap alone would disappear.
    color = mix(color, uCortexShadow, vFissure * 0.8);
    float alpha = uCortexOpacity * (0.7 + rim * 0.3);
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
    gl_PointSize = (1.15 + aDensity * 0.5 + pow(aSeed, 5.0) * 1.3)
      * uPixelRatio * (4.0 / -view.z);
  }
`

export const nodeFragment = `
  uniform vec3 uTissue;
  uniform vec3 uDepthColor;
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
    float alpha = uFiberOpacity * mix(0.16, 1.0, vDepth)
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
    float taper = mix(1.0, 0.28, smoothstep(0.0, 1.0, behind));
    view.xy += perpendicular * aSide * 0.045 * taper;
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
  varying float vAlong;
  varying float vSide;
  void main() {
    float behind = uProgress - vAlong;
    float tailPosition = max(behind, 0.0) / uTail;
    float tail = exp(-tailPosition * 2.5)
      * (1.0 - smoothstep(0.55, 1.0, tailPosition))
      * smoothstep(-0.006, 0.014, behind);
    float headDistance = behind / 0.014;
    float head = exp(-headDistance * headDistance);
    float edge = 1.0 - smoothstep(0.72, 1.0, abs(vSide));
    float aura = exp(-vSide * vSide * 5.0) * edge;
    float filament = exp(-vSide * vSide * 95.0);
    float headCore = head * exp(-vSide * vSide * 28.0);
    float alpha = (tail * (filament * 0.82 + aura * 0.24)
      + head * aura * 0.55 + headCore * 0.8) * uEnvelope;
    if (alpha < 0.003) discard;
    vec3 color = mix(uEmber, uFlame, exp(-tailPosition * 2.0));
    color = mix(color, uCore, clamp(headCore + filament * tail * 0.38, 0.0, 1.0));
    gl_FragColor = vec4(color, min(alpha, 1.0));
    #include <colorspace_fragment>
  }
`
