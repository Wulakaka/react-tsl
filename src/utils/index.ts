// Three.js Transpiler r183

import {
  float,
  vec2,
  dot,
  sin,
  fract,
  Fn,
  div,
  floor,
  mod,
  cos,
  sub,
  mul,
  mix,
  int,
  Break,
  If,
  Loop,
} from "three/tsl";

/*
 * Perlin noise
 * https://gist.github.com/patriciogonzalezvivo/670c22f3966e662d2f83
 */

const PI = float(3.141592653589793);

export const rand = /*@__PURE__*/ Fn(
  ([c]) => {
    return fract(sin(dot(c.xy, vec2(12.9898, 78.233))).mul(43758.5453));
  },
  {c: "vec2", return: "float"},
);

export const noise = /*@__PURE__*/ Fn(
  ([p, freq]) => {
    const unit = div(1, freq);
    const ij = floor(p.div(unit));
    const xy = mod(p, unit).div(unit);

    //xy = 3.*xy*xy-2.*xy*xy*xy;

    xy.assign(mul(0.5, sub(1, cos(PI.mul(xy)))));
    const a = rand(ij.add(vec2(0, 0)));
    const b = rand(ij.add(vec2(1, 0)));
    const c = rand(ij.add(vec2(0, 1)));
    const d = rand(ij.add(vec2(1, 1)));
    const x1 = mix(a, b, xy.x);
    const x2 = mix(c, d, xy.x);

    return mix(x1, x2, xy.y);
  },
  {p: "vec2", freq: "float", return: "float"},
);

export const pNoise = /*@__PURE__*/ Fn(
  ([p, res]) => {
    const persistence = float(0.5);
    const n = float(0);
    const normK = float(0);
    const f = float(4);
    const amp = float(1);
    const iCount = int(0);

    Loop({start: 0, end: 50}, ({i}) => {
      n.addAssign(amp.mul(noise(p, f)));
      f.mulAssign(2);
      normK.addAssign(amp);
      amp.mulAssign(persistence);

      If(iCount.equal(res), () => {
        Break();
      });

      iCount.incrementBefore();
    });

    const nf = n.div(normK);

    return nf.mul(nf).mul(nf).mul(nf);
  },
  {p: "vec2", res: "int", return: "float"},
);
