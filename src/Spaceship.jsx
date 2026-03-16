import {useGLTF} from "@react-three/drei";
import {forwardRef, useEffect} from "react";
import * as THREE from "three";

const SPACESHIP_GEOMETRY_URL =
  "https://cdn.maximeheckel.com/models/spaceship-optimized.glb";

const Spaceship = forwardRef((_, ref) => {
  // Original model by Sousinho
  // Their work: https://sketchfab.com/sousinho
  // The original model: https://sketchfab.com/3d-models/rusty-spaceship-orange-18541ebed6ce44a9923f9b8dc30d87f5
  const gltf = useGLTF(SPACESHIP_GEOMETRY_URL);

  useEffect(() => {
    if (gltf) {
      function alphaFix(material) {
        material.transparent = true;
        material.alphaToCoverage = true;
        material.depthFunc = THREE.LessEqualDepth;
        material.depthTest = true;
        material.depthWrite = true;
      }
      alphaFix(gltf.materials.spaceship_racer);
      alphaFix(gltf.materials.cockpit);
    }
  }, [gltf]);

  return (
    <group ref={ref}>
      <group
        scale={0.005}
        rotation={[0, -Math.PI * 0.5, 0]}
        position={[1.583, 0, -3.725]}
      >
        <mesh
          castShadow
          receiveShadow
          geometry={gltf.nodes.Cube001_spaceship_racer_0.geometry}
          material={gltf.materials.spaceship_racer}
          position={[739.26, -64.81, 64.77]}
        />
        <mesh
          castShadow
          receiveShadow
          geometry={gltf.nodes.Cube005_cockpit_0.geometry}
          material={gltf.materials.spaceship_racer}
          position={[739.26, 0, 0]}
        />
      </group>
    </group>
  );
});

export default Spaceship;
