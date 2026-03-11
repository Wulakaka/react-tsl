import {OrbitControls} from "@react-three/drei";
import {Canvas, extend, useThree, useFrame} from "@react-three/fiber";
import {Suspense, useEffect, useMemo} from "react";
import * as THREE from "three/webgpu";
import {
  length,
  clamp,
  uv,
  mix,
  cross,
  float,
  Fn,
  normalize,
  normalLocal,
  positionLocal,
  varying,
  transformNormalToView,
  vec3,
  abs,
  If,
  negate,
  add,
  uniform,
} from "three/tsl";
import {cnoise} from "./perlin.ts";
import "./scene.css";

extend(THREE);

const Core = () => {
  const {scene, gl} = useThree();

  useEffect(() => {
    const dirLight = new THREE.DirectionalLight(0xffffff, 4.0);
    dirLight.position.set(10, 10, 10);
    scene.add(dirLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
  }, []);

  const {nodes: backgroundNodes} = useMemo(() => {
    const gradientNode = Fn(() => {
      const color1 = vec3(0.01, 0.22, 0.98);
      const color2 = vec3(0.36, 0.68, 1.0);
      const t = clamp(length(abs(uv().sub(0.5))), 0.0, 0.8);
      return mix(color1, color2, t);
    });

    const sphereColorNode = gradientNode();

    return {
      nodes: {
        sphereColorNode,
      },
    };
  }, []);

  const {nodes, uniforms} = useMemo(() => {
    const time = uniform(0.0);
    // 这里必须要用 varying
    // 因为 normal 是在 vertex shader 里计算的，并且自动插值
    // 然后在 fragment shader 里读取
    const vNormal = varying(vec3(), "vNormal");

    const updatePos = Fn(([pos, time]) => {
      const noise = cnoise(vec3(pos).add(vec3(time))).mul(0.2);
      return add(pos, noise);
    });

    /**
     * 计算并返回与给定法线向量 `normalLocal` 正交的单位向量。
     *
     * 该方法首先判断 `normalLocal` 的 x 分量绝对值是否大于 z 分量绝对值：
     * - 如果是，则返回一个在 x-y 平面内、与 `normalLocal` 正交的单位向量。
     * - 否则，返回一个在 y-z 平面内、与 `normalLocal` 正交的单位向量。
     *
     * @returns 一个与 `normalLocal` 正交的归一化三维向量。
     */
    const orthogonal = Fn(() => {
      const pos = normalLocal;
      If(abs(pos.x).greaterThan(abs(pos.z)), () => {
        return normalize(vec3(negate(pos.y), pos.x, 0.0));
      });

      return normalize(vec3(0.0, negate(pos.z), pos.y));
    });

    const positionNode = Fn(() => {
      // 获取当前顶点局部坐标
      const pos = positionLocal;

      // 加入 noise 更新位置
      const updatedPos = updatePos(pos, time);
      const theta = float(0.001); // Smaller epsilon for better accuracy

      // 得到与法线正交的单位向量
      const vecTangent = orthogonal();
      // 得到另一个正交方向
      const vecBiTangent = normalize(cross(normalLocal, vecTangent));

      // 取两个微小偏移后的点
      const neighbour1 = pos.add(vecTangent.mul(theta));
      const neighbour2 = pos.add(vecBiTangent.mul(theta));

      // 加入 noise
      const displacedNeighbour1 = updatePos(neighbour1, time);
      const displacedNeighbour2 = updatePos(neighbour2, time);

      // 计算切线和副切线的位移向量
      const displacedTangent = displacedNeighbour1.sub(updatedPos);
      const displacedBitangent = displacedNeighbour2.sub(updatedPos);

      // 计算新的法线向量
      const normal = normalize(cross(displacedTangent, displacedBitangent));

      // 保证新法线方向与原法线一致
      // 如果新法线与原法线夹角大于90度，则取反，保证方向一致。
      const displacedNormal = normal
        .dot(normalLocal)
        .lessThan(0.0)
        .select(normal.negate(), normal);
      vNormal.assign(displacedNormal);

      return updatedPos;
    })();

    const normalNode = Fn(() => {
      const normal = vNormal;
      return transformNormalToView(normal);
    })();

    return {
      nodes: {
        positionNode,
        normalNode,
      },
      uniforms: {
        time,
      },
    };
  }, []);

  useFrame((state) => {
    const {clock} = state;

    uniforms.time.value = clock.getElapsedTime();
  });

  return (
    <>
      <mesh>
        <sphereGeometry args={[50, 16, 16]} />
        <meshBasicNodeMaterial
          colorNode={backgroundNodes.sphereColorNode}
          side={THREE.BackSide}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[1.5, 200]} />
        <meshPhongMaterial
          color="white"
          normalNode={nodes.normalNode}
          positionNode={nodes.positionNode}
          emissive={new THREE.Color("white").multiplyScalar(0.25)}
          shininess={400.0}
        />
      </mesh>
    </>
  );
};

const Scene = () => {
  return (
    <>
      <Canvas
        shadows
        gl={async (props) => {
          const renderer = new THREE.WebGPURenderer(props);
          await renderer.init();
          return renderer;
        }}
      >
        <Suspense>
          <OrbitControls />
          <Core />
        </Suspense>
      </Canvas>
    </>
  );
};

export default Scene;
