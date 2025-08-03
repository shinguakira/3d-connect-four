"use client";

import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Float } from "@react-three/drei";
import { useRef } from "react";
import type * as THREE from "three";
import AnimatedGeometricBackground from "./animated-geometric-background";
import AnimatedNeonBackground from "./animated-neon-background";
import AnimatedMinimalistBackground from "./animated-minimalist-background";

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

function ThreeDScene() {
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

export const backgrounds = [
  {
    id: "floating-spheres",
    name: "浮遊する球体",
    description: "3D球体が浮遊するダイナミックなデザイン",
    component: () => (
      <div className="w-full h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
        <Canvas camera={{ position: [0, 0, 10], fov: 60 }}>
          <ThreeDScene />
          <OrbitControls
            enableZoom={false}
            enablePan={false}
            autoRotate
            autoRotateSpeed={0.5}
          />
        </Canvas>
      </div>
    ),
  },
  {
    id: "geometric-pattern",
    name: "幾何学パターン",
    description: "回転する六角形のアニメーション効果",
    component: AnimatedGeometricBackground,
  },
  {
    id: "neon-cyberpunk",
    name: "ネオン・サイバーパンク",
    description: "光る回路と浮遊パーティクルのアニメーション",
    component: AnimatedNeonBackground,
  },
  {
    id: "minimalist-texture",
    name: "ミニマリスト・テクスチャ",
    description: "優雅な波と浮遊ドットのアニメーション",
    component: AnimatedMinimalistBackground,
  },
];

export default function BackgroundPreviewSelector() {
  const [selectedBackground, setSelectedBackground] = useState(backgrounds[0]);

  const BackgroundComponent = selectedBackground.component;

  return (
    <div className="w-full h-screen relative overflow-hidden">
      {/* Animated Background */}
      <BackgroundComponent />

      {/* Controls */}
      <div className="absolute top-6 left-6 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-xl border">
          <h2 className="text-lg font-semibold mb-3 text-gray-800">
            アニメーション背景プレビュー
          </h2>

          <Select
            value={selectedBackground.id}
            onValueChange={(value) => {
              const bg = backgrounds.find((b) => b.id === value);
              if (bg) setSelectedBackground(bg);
            }}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="背景を選択" />
            </SelectTrigger>
            <SelectContent>
              {backgrounds.map((bg) => (
                <SelectItem key={bg.id} value={bg.id}>
                  {bg.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-sm text-gray-600 mt-2">
            {selectedBackground.description}
          </p>
        </div>
      </div>

      {/* Info Panel */}
      <div className="absolute bottom-6 right-6 z-10">
        <div className="bg-white/95 backdrop-blur-sm rounded-lg p-4 shadow-xl border max-w-xs">
          <h3 className="font-semibold text-gray-800 mb-2">
            {selectedBackground.name}
          </h3>
          <p className="text-sm text-gray-600">
            リアルタイムアニメーション付きのConnect
            4タイトル背景。各スタイルに独自のアニメーション効果があります。
          </p>
        </div>
      </div>
    </div>
  );
}
