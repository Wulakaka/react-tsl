import {useMemo} from "react";
import {mx_cell_noise_float} from "three/src/nodes/TSL.js";
import {
  add,
  Fn,
  mx_noise_vec3,
  positionLocal,
  time,
  uniform,
  vec3,
} from "three/tsl";

function Ball() {
  const {nodes, uniforms} = useMemo(() => {
    const updatePos = Fn(([pos, t]) => {
      const noise = mx_noise_vec3(pos.add(vec3(t))).mul(0.2);
      return add(pos, noise);
    });

    const positionNode = Fn(() => {
      const pos = positionLocal;
      const updatedPos = updatePos(pos, time);
      return updatedPos;
    })();
    // const time = uniform(0.0);

    // const positionNode = Fn(() => {})();

    // const normalNode = Fn(() => {})();

    return {
      nodes: {
        positionNode,
      },
      // uniforms: {
      //   time,
      // },
    };
  }, []);

  return (
    <mesh>
      <sphereGeometry args={[1, 256]} />
      <meshPhongNodeMaterial positionNode={nodes.positionNode} />
    </mesh>
  );
}

export default Ball;
