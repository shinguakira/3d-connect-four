"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Float } from "@react-three/drei";
import { useRef } from "react";
import * as THREE from "three";

function FloatingOrb({
  position,
  color,
  size = 1,
}: {
  position: [number, number, number];
  color: string;
  size?: number;
}) {
  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={2}>
      <mesh position={position}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          metalness={0.3}
          roughness={0.2}
          emissive={color}
          emissiveIntensity={0.1}
        />
      </mesh>
    </Float>
  );
}

function Scene() {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={1} />
      <pointLight position={[-10, -10, -5]} color="#ff6b6b" intensity={0.5} />
      <pointLight position={[10, -10, -5]} color="#ffd93d" intensity={0.5} />

      <group ref={groupRef}>
        {/* Red orbs */}
        <FloatingOrb position={[-4, 2, -2]} color="#ff4757" size={0.8} />
        <FloatingOrb position={[-2, -1, 1]} color="#ff3838" size={1.2} />
        <FloatingOrb position={[-6, -2, -1]} color="#ff6b6b" size={0.6} />
        <FloatingOrb position={[-1, 3, -3]} color="#ff4757" size={0.9} />

        {/* Yellow orbs */}
        <FloatingOrb position={[4, 1, -1]} color="#ffd93d" size={1.0} />
        <FloatingOrb position={[2, -2, 2]} color="#ffdd59" size={1.1} />
        <FloatingOrb position={[6, 0, -2]} color="#ffd93d" size={0.7} />
        <FloatingOrb position={[1, 4, -1]} color="#ffdd59" size={0.8} />

        {/* Additional accent orbs */}
        <FloatingOrb position={[0, -3, 0]} color="#ff8c94" size={0.5} />
        <FloatingOrb position={[-3, 1, 3]} color="#ffe066" size={0.6} />
        <FloatingOrb position={[3, -1, 3]} color="#ff6b6b" size={0.4} />
        <FloatingOrb position={[0, 2, 4]} color="#ffd93d" size={0.5} />
      </group>

      <Environment preset="sunset" />
    </>
  );
}

export default function Component() {
  return (
    <div className="w-full h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
        <Scene />
        <OrbitControls
          enableZoom={false}
          enablePan={false}
          autoRotate
          autoRotateSpeed={0.5}
        />
      </Canvas>
    </div>
  );
}
