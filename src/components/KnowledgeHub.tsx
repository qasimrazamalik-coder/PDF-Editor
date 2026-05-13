import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Text, MeshDistortMaterial, PerspectiveCamera, OrbitControls, Stars } from '@react-three/drei';
import * as THREE from 'three';

interface DocumentNodeProps {
  position: [number, number, number];
  name: string;
  onClick: () => void;
  color: string;
}

const DocumentNode = ({ position, name, onClick, color }: DocumentNodeProps) => {
  const mesh = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    if (mesh.current) {
      mesh.current.rotation.x = Math.sin(state.clock.getElapsedTime()) * 0.2;
      mesh.current.rotation.y += 0.01;
    }
  });

  return (
    <Float speed={2} rotationIntensity={1} floatIntensity={1}>
      <mesh position={position} ref={mesh} onClick={onClick}>
        <boxGeometry args={[1.2, 1.6, 0.2]} />
        <MeshDistortMaterial color={color} speed={2} distort={0.2} roughness={0} metalness={0.8} />
        <Text
          position={[0, 0, 0.15]}
          fontSize={0.15}
          color="white"
          anchorX="center"
          anchorY="middle"
          maxWidth={1}
        >
          {name}
        </Text>
      </mesh>
    </Float>
  );
};

export const KnowledgeHub = ({ files, onFileSelect }: { files: File[], onFileSelect: (f: File) => void }) => {
  const nodes = useMemo(() => {
    return files.map((file, i) => ({
      id: file.name,
      file,
      position: [
        Math.cos((i / files.length) * Math.PI * 2) * 5,
        Math.sin((i / files.length) * Math.PI * 2) * 2,
        Math.sin((i / files.length) * Math.PI * 2) * 5,
      ] as [number, number, number],
      color: `hsl(${Math.random() * 360}, 70%, 50%)`
    }));
  }, [files]);

  return (
    <div className="w-full h-full min-h-[400px] bg-[#0a0a0a] rounded-sm overflow-hidden relative">
      <div className="absolute top-8 left-8 z-10">
        <h2 className="text-amber-500 font-bold text-[10px] uppercase tracking-[0.3em] opacity-50 mb-2">Spatial Lattice</h2>
        <p className="text-white font-serif italic text-2xl">Knowledge Hub</p>
      </div>

      <Canvas shadows dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 0, 12]} fov={50} />
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={1} castShadow />
        
        <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
        
        {nodes.map((node) => (
          <DocumentNode 
            key={node.id} 
            position={node.position} 
            name={node.file.name} 
            color={node.color}
            onClick={() => onFileSelect(node.file)}
          />
        ))}

        <OrbitControls enableZoom={false} autoRotate autoRotateSpeed={0.5} />
      </Canvas>
      
      {files.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="font-mono text-white/20 text-xs uppercase tracking-[0.3em]">No resonance detected. Upload a PDF.</p>
        </div>
      )}
    </div>
  );
};
