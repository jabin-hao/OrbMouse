import { useEffect, useRef, type MutableRefObject } from 'react'

export type OrbMode = 'idle' | 'pressed' | 'dragging' | 'listening'

export type OrbMotion = {
  x: number
  y: number
  vx: number
  vy: number
}

export type OrbImpact = {
  x: number
  y: number
  at: number
  variation: number
} | null

type OrbRendererProps = {
  mode: OrbMode
  motionRef: MutableRefObject<OrbMotion>
  impactRef: MutableRefObject<OrbImpact>
  onReady: (ready: boolean) => void
}

const vertexSource = `
attribute vec2 a_position;
void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`

const fragmentSource = `
precision highp float;

uniform vec2 u_resolution;
uniform vec2 u_rotation;
uniform vec3 u_impact;
uniform float u_impactVariation;
uniform float u_time;
uniform float u_mode;

vec3 rotateX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

// A small air pocket seen through the front surface of the water.
vec2 airPocket(vec2 point, vec3 center, float radius, float time) {
  vec2 offset = point - center.xy;
  float angle = atan(offset.y, offset.x);
  float organicRadius = radius * (1.0 + 0.035 * sin(angle * 3.0 + time * 0.6));
  float distanceToCenter = length(offset);
  float inside = 1.0 - smoothstep(organicRadius - 0.007, organicRadius + 0.004, distanceToCenter);
  float z = sqrt(max(1.0 - distanceToCenter * distanceToCenter / (organicRadius * organicRadius), 0.0));
  vec3 bubbleNormal = normalize(vec3(offset / organicRadius, z));
  vec3 light = normalize(vec3(-0.5, 0.7, 0.5));
  float facing = max(dot(bubbleNormal, light), 0.0);
  float rim = pow(1.0 - z, 1.5);
  float glint = pow(max(dot(reflect(-light, bubbleNormal), vec3(0.0, 0.0, 1.0)), 0.0), 22.0);
  float visible = smoothstep(-0.3, 0.15, center.z);
  return vec2(inside * visible * rim * (0.55 - facing * 0.3), inside * visible * (glint * 0.55 + rim * facing * 0.2));
}

void main() {
  vec2 uv = (gl_FragCoord.xy / u_resolution - 0.5) * 2.0;
  uv.x *= u_resolution.x / u_resolution.y;

  float listening = step(2.5, u_mode);
  float pulse = 0.5 + 0.5 * sin(u_time * 2.15);
  float radius = 0.78 + listening * (0.013 * pulse);

  float impactAge = u_impact.z;
  vec2 touchDirection = length(u_impact.xy) > 0.08 ? normalize(u_impact.xy) : vec2(cos(u_impactVariation * 6.28), sin(u_impactVariation * 6.28));
  vec2 direction = normalize(uv + vec2(0.0001));
  float angleDistance = 1.0 - dot(direction, touchDirection);
  float dent = exp(-angleDistance * (7.5 + u_impactVariation * 4.0));
  float lobePosition = 0.25 + u_impactVariation * 0.16;
  float displacedLobe = exp(-(angleDistance - lobePosition) * (angleDistance - lobePosition) * 24.0);
  float envelope = exp(-impactAge * (1.15 + u_impactVariation * 0.35));
  float oscillation = cos(impactAge * (5.8 + u_impactVariation * 2.2));
  float edgeOffset = envelope * oscillation * (-(0.14 + u_impactVariation * 0.09) * dent + (0.04 + u_impactVariation * 0.035) * displacedLobe);
  float theta = atan(uv.y, uv.x);
  float ambientFlow = (sin(theta * 3.0 + u_time * 0.7) * 0.009 + sin(theta * 5.0 - u_time * 0.43) * 0.005)
    * (1.0 - listening * 0.3);
  float voiceFlow = listening * (sin(theta * 4.0 + u_time * 2.4) * 0.021
    + sin(theta * 7.0 - u_time * 3.1) * 0.011
    + sin(theta * 11.0 + u_time * 4.2) * 0.004);
  float surfaceRadius = radius + edgeOffset + ambientFlow + voiceFlow;
  float radialDistance = length(uv);
  float sphereAlpha = 1.0 - smoothstep(surfaceRadius - 0.006, surfaceRadius + 0.008, radialDistance);
  vec2 sphereUv = uv * (radius / max(surfaceRadius, 0.48));
  vec2 fromTouch = sphereUv - u_impact.xy;
  float touchFalloff = exp(-dot(fromTouch, fromTouch) * 11.0);
  sphereUv += fromTouch * envelope * oscillation * touchFalloff * 0.09;
  sphereUv += listening * vec2(
    sin(sphereUv.y * 7.0 + u_time * 2.0),
    cos(sphereUv.x * 6.0 - u_time * 2.3)
  ) * 0.016;
  float z = sqrt(max(radius * radius - dot(sphereUv, sphereUv), 0.0));
  vec3 normal = normalize(vec3(sphereUv / radius + fromTouch * envelope * oscillation * touchFalloff * 0.34, z / radius - envelope * oscillation * touchFalloff * 0.18));
  vec3 surface = rotateY(rotateX(normal, u_rotation.x), u_rotation.y);

  // Broad reflected light cards avoid the hard bands and longitude seam of a stripe pattern.
  float reflectionA = pow(max(dot(surface, normalize(vec3(-0.7, 0.42, 0.58))), 0.0), 5.0);
  float reflectionB = pow(max(dot(surface, normalize(vec3(0.68, -0.47, 0.56))), 0.0), 8.0);
  float refraction = reflectionA * 0.72 + reflectionB * 0.45;
  float liquidDepth = pow(max(dot(surface, normalize(vec3(0.28, -0.76, 0.59))), 0.0), 3.0);
  vec3 bubblePositionA = rotateX(rotateY(vec3(-0.24, 0.19, 0.37), -u_rotation.y), -u_rotation.x);
  vec3 bubblePositionB = rotateX(rotateY(vec3(0.27, -0.24, 0.22), -u_rotation.y), -u_rotation.x);
  vec2 bubbleA = airPocket(sphereUv, bubblePositionA, 0.075, u_time);
  vec2 bubbleB = airPocket(sphereUv, bubblePositionB, 0.042, u_time + 1.7);
  float bubbleShade = bubbleA.x + bubbleB.x * 0.7;
  float bubbleSheen = bubbleA.y + bubbleB.y * 0.7;
  float upperSheen = exp(-pow((uv.x + 0.25) * 2.8, 2.0) - pow((uv.y - 0.48) * 5.0, 2.0));

  vec3 lightDirection = normalize(vec3(-0.48, 0.68, 0.86));
  vec3 viewDirection = vec3(0.0, 0.0, 1.0);
  float diffuse = max(dot(normal, lightDirection), 0.0);
  float specular = pow(max(dot(reflect(-lightDirection, normal), viewDirection), 0.0), 54.0);
  float broadHighlight = pow(max(dot(normal, normalize(vec3(-0.62, 0.72, 0.55))), 0.0), 7.0);
  float fresnel = pow(1.0 - max(normal.z, 0.0), 2.65);

  vec3 color = vec3(0.83, 0.91, 0.96);
  color = mix(color, vec3(0.53, 0.7, 0.81), fresnel * 0.35);
  color += vec3(0.12, 0.13, 0.14) * diffuse * 0.14;
  color += vec3(1.0) * specular * 0.8;
  color += vec3(1.0) * broadHighlight * 0.19;
  color = mix(color, vec3(0.62, 0.78, 0.86), refraction * 0.13 + liquidDepth * 0.08 + bubbleShade * 0.2);
  color += vec3(0.16, 0.15, 0.14) * (bubbleSheen + upperSheen);
  float edgeRim = exp(-pow((radialDistance - surfaceRadius + 0.013) * 105.0, 2.0));
  color = mix(color, vec3(0.6, 0.77, 0.87), edgeRim * 0.36);
  float materialOpacity = clamp(0.08 + fresnel * 0.35 + edgeRim * 0.28 + specular * 0.28 + broadHighlight * 0.11 + refraction * 0.13 + liquidDepth * 0.08 + bubbleShade * 0.2 + bubbleSheen * 0.13 + upperSheen * 0.18 + listening * pulse * 0.08, 0.07, 0.82);
  gl_FragColor = vec4(color, materialOpacity * sphereAlpha);
}
`

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function createProgram(gl: WebGLRenderingContext, pixelSource = fragmentSource) {
  const vertex = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragment = createShader(gl, gl.FRAGMENT_SHADER, pixelSource)
  if (!vertex || !fragment) return null

  const program = gl.createProgram()
  if (!program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.deleteShader(vertex)
  gl.deleteShader(fragment)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    return null
  }
  return program
}

export default function OrbRenderer({ mode, motionRef, impactRef, onReady }: OrbRendererProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      premultipliedAlpha: false,
      powerPreference: 'low-power',
    })
    if (!gl) {
      onReady(false)
      return
    }

    const fragmentPrecision = gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT)
    const supportedFragmentSource = fragmentPrecision?.precision
      ? fragmentSource
      : fragmentSource.replace('precision highp float;', 'precision mediump float;')
    const program = createProgram(gl, supportedFragmentSource)
    if (!program) {
      onReady(false)
      return
    }

    const buffer = gl.createBuffer()
    if (!buffer) {
      gl.deleteProgram(program)
      onReady(false)
      return
    }

    gl.useProgram(program)
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'a_position')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution')
    const rotationLocation = gl.getUniformLocation(program, 'u_rotation')
    const impactLocation = gl.getUniformLocation(program, 'u_impact')
    const impactVariationLocation = gl.getUniformLocation(program, 'u_impactVariation')
    const timeLocation = gl.getUniformLocation(program, 'u_time')
    const modeLocation = gl.getUniformLocation(program, 'u_mode')
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = motionPreference.matches
    let animationFrame = 0
    let startTime = performance.now()
    let lastFrame = startTime

    const onMotionPreferenceChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      startTime = performance.now()
      lastFrame = startTime
    }
    motionPreference.addEventListener('change', onMotionPreferenceChange)

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.round(bounds.width * pixelRatio))
      const height = Math.max(1, Math.round(bounds.height * pixelRatio))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
        gl.viewport(0, 0, width, height)
      }
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener('resize', resize)
    resize()
    gl.clearColor(0, 0, 0, 0)
    gl.disable(gl.BLEND)
    onReady(true)

    const render = (now: number) => {
      const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.05)
      lastFrame = now

      const motion = motionRef.current
      if (modeRef.current !== 'dragging') {
        if (!reducedMotion && modeRef.current === 'idle') motion.y += deltaSeconds * 0.11
        if (!reducedMotion) {
          motion.x += motion.vx * deltaSeconds
          motion.y += motion.vy * deltaSeconds
          const damping = Math.exp(-deltaSeconds * 3.0)
          motion.vx *= damping
          motion.vy *= damping
        } else {
          motion.vx = 0
          motion.vy = 0
        }
      }


      const impact = impactRef.current
      const impactAge = impact && !reducedMotion ? Math.max(0, (now - impact.at) / 1000) : 99
      const modeValue = modeRef.current === 'pressed' ? 1 : modeRef.current === 'dragging' ? 2 : modeRef.current === 'listening' ? 3 : 0
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(rotationLocation, motion.x, motion.y)
      gl.uniform3f(impactLocation, impact?.x ?? 0, impact?.y ?? 0, impactAge)
      gl.uniform1f(impactVariationLocation, impact?.variation ?? 0.5)
      gl.uniform1f(timeLocation, reducedMotion ? 0 : (now - startTime) / 1000)
      gl.uniform1f(modeLocation, modeValue)
      gl.uniform2f(resolutionLocation, canvas.width, canvas.height)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      animationFrame = window.requestAnimationFrame(render)
    }

    animationFrame = window.requestAnimationFrame(render)
    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener('resize', resize)
      motionPreference.removeEventListener('change', onMotionPreferenceChange)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
      onReady(false)
    }
  }, [impactRef, motionRef, onReady])

  return <canvas ref={canvasRef} className="orb-canvas" aria-hidden="true" />
}
