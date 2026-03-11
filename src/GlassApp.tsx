import {OrbitControls} from "@react-three/drei";
import {Canvas, extend, useThree, useFrame} from "@react-three/fiber";
import {Suspense, useEffect, useMemo, useRef} from "react";
import * as THREE from "three/webgpu";
import {
  length,
  clamp,
  mix,
  max,
  pow,
  cross,
  float,
  Fn,
  normalize,
  normalLocal,
  normalWorld,
  positionWorld,
  positionLocal,
  uv,
  viewportUV,
  varying,
  transformNormalToView,
  vec3,
  abs,
  If,
  negate,
  add,
  sub,
  dot,
  rand,
  texture,
  uniform,
} from "three/tsl";
import {v4 as uuidv4} from "uuid";

import {cnoise} from "./perlin";
import "./scene.css";

extend(THREE);

const Core = () => {
  const meshRef = useRef();
  const {scene, gl} = useThree();

  const lightPosition = [10, 10, 10];

  useEffect(() => {
    const dirLight = new THREE.DirectionalLight(0xffffff, 5.0);
    dirLight.position.set(lightPosition[0], lightPosition[1], lightPosition[2]);
    scene.add(dirLight);
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.5);
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

  const {nodes, uniforms, utils} = useMemo(() => {
    const time = uniform(0.0);
    const cameraPosition = uniform(vec3(0, 0, 0));
    const vNormal = varying(vec3(), "vNormal");

    const sceneTexture = texture(new THREE.Texture());

    const updatePos = Fn(([pos, time]) => {
      const noise = cnoise(vec3(pos).add(vec3(time.mul(1.1)))).mul(0.15);
      return add(pos, noise);
    });

    const orthogonal = Fn(() => {
      const pos = normalLocal;
      If(abs(pos.x).greaterThan(abs(pos.z)), () => {
        return normalize(vec3(negate(pos.y), pos.x, 0.0));
      });

      return normalize(vec3(0.0, negate(pos.z), pos.y));
    });

    const positionNode = Fn(() => {
      const pos = positionLocal;

      const updatedPos = updatePos(pos, time);
      const theta = float(0.001); // Smaller epsilon for better accuracy

      const vecTangent = orthogonal();
      const vecBiTangent = normalize(cross(normalLocal, vecTangent));

      const neighbour1 = pos.add(vecTangent.mul(theta));
      const neighbour2 = pos.add(vecBiTangent.mul(theta));

      const displacedNeighbour1 = updatePos(neighbour1, time);
      const displacedNeighbour2 = updatePos(neighbour2, time);

      const displacedTangent = displacedNeighbour1.sub(updatedPos);
      const displacedBitangent = displacedNeighbour2.sub(updatedPos);

      const normal = normalize(cross(displacedTangent, displacedBitangent));

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

    const classicFresnel = Fn(({viewVector, worldNormal, power}) => {
      const cosTheta = abs(dot(viewVector, worldNormal));
      const inversefresnelFactor = sub(1.0, cosTheta);
      return pow(inversefresnelFactor, power);
    });

    const sat = Fn(([col]) => {
      const W = vec3(0.2125, 0.7154, 0.0721);
      const intensity = vec3(dot(col, W));
      return mix(intensity, col, 1.265);
    });

    const refract = Fn(({sceneTex}) => {
      const absorption = 0.1;
      const refractionIntensity = 0.25;
      const shininess = 100.0;
      const LOOP = 8;
      const noiseIntensity = 0.015;

      const refractNormal = normalWorld.xy
        .mul(sub(1.0, normalWorld.z.mul(0.85)))
        .add(0.05);

      const refractCol = vec3(0.0, 0.0, 0.0).toVar();

      for (let i = 0; i < LOOP; i++) {
        const noise = rand(viewportUV).mul(noiseIntensity);
        const slide = float(i).div(float(LOOP)).mul(0.18).add(noise);

        const refractUvR = viewportUV.sub(
          refractNormal
            .mul(slide.mul(1.0).add(refractionIntensity))
            .mul(absorption),
        );
        const refractUvG = viewportUV.sub(
          refractNormal
            .mul(slide.mul(2.5).add(refractionIntensity))
            .mul(absorption),
        );
        const refractUvB = viewportUV.sub(
          refractNormal
            .mul(slide.mul(4.0).add(refractionIntensity))
            .mul(absorption),
        );

        const red = texture(sceneTex, refractUvR).r;
        const green = texture(sceneTex, refractUvG).g;
        const blue = texture(sceneTex, refractUvB).b;

        refractCol.assign(refractCol.add(vec3(red, green, blue)));
      }

      refractCol.assign(refractCol.div(float(LOOP)));

      const lightVector = vec3(
        lightPosition[0],
        lightPosition[1],
        lightPosition[2],
      );
      const viewVector = normalize(cameraPosition.sub(positionWorld));
      const normalVector = normalize(normalWorld);

      const halfVector = normalize(viewVector.add(lightVector));

      const NdotL = dot(normalVector, lightVector);
      const NdotH = dot(normalVector, halfVector);

      const kDiffuse = max(0.0, NdotL);

      const NdotH2 = NdotH.mul(NdotH);
      const kSpecular = pow(NdotH2, shininess);

      const fresnel = classicFresnel({
        viewVector: viewVector,
        worldNormal: normalVector,
        power: 5.0,
      });

      refractCol.assign(
        refractCol.add(kSpecular.add(kDiffuse).mul(0.01).add(fresnel)),
      );

      return vec3(sat(refractCol));
    });

    return {
      nodes: {
        positionNode,
        normalNode,
      },
      uniforms: {
        time,
        cameraPosition,
        sceneTexture,
      },
      utils: {
        refract,
      },
    };
  }, []);

  const backRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio,
  );

  const mainRenderTarget = new THREE.WebGLRenderTarget(
    window.innerWidth * window.devicePixelRatio,
    window.innerHeight * window.devicePixelRatio,
  );

  useFrame((state) => {
    const {clock, gl, scene, camera} = state;

    uniforms.time.value = clock.getElapsedTime();
    uniforms.cameraPosition.value = camera.position;

    if (!meshRef.current) return;

    meshRef.current.material.visible = false;
    gl.setRenderTarget(backRenderTarget);
    gl.render(scene, camera);

    meshRef.current.material.side = THREE.BackSide;
    meshRef.current.material.visible = true;

    uniforms.sceneTexture.value = backRenderTarget.texture;

    meshRef.current.material.colorNode = utils.refract({
      sceneTex: uniforms.sceneTexture,
    });

    gl.setRenderTarget(mainRenderTarget);
    gl.render(scene, camera);

    meshRef.current.material.side = THREE.FrontSide;
    uniforms.sceneTexture.value = mainRenderTarget.texture;

    meshRef.current.material.colorNode = utils.refract({
      sceneTex: uniforms.sceneTexture,
    });

    gl.setRenderTarget(null);
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
      <mesh ref={meshRef}>
        <icosahedronGeometry args={[1.5, 200]} />
        <meshStandardMaterial
          key={uuidv4()}
          color={new THREE.Color("white").multiplyScalar(1.2)}
          normalNode={nodes.normalNode}
          positionNode={nodes.positionNode}
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
