// src/components/MotorCanvas.tsx
import { useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';

// 3D Motor Inner Component
interface MotorModelProps {
  rpm: number;
  vibration: number;
  temperature: number;
  bearingHealth: number;
  cooling: number;
  state: string;
}

function MotorModel({ rpm, vibration, temperature, bearingHealth, cooling, state }: MotorModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Group>(null);
  const fanRef = useRef<THREE.Group>(null);

  // Active hover tooltip states
  const [activeSensor, setActiveSensor] = useState<string | null>(null);

  useFrame((_, delta) => {
    
    // 1. Rotation speed based on RPM
    const rotSpeed = (rpm / 60) * Math.PI * 2; // radians per second
    if (shaftRef.current) {
      // The motor shaft runs along Z, so rotate its parent around Z. Keeping
      // alignment and animation on separate transforms avoids Euler-axis drift.
      shaftRef.current.rotation.z -= rotSpeed * delta;
    }
    if (fanRef.current) {
      fanRef.current.rotation.z -= rotSpeed * delta;
    }

    // 2. Vibration shaking effect
    if (groupRef.current) {
      // Jitter magnitude based on vibration level
      // vibration is in mm/s, e.g. normal is < 3, critical can be 7+
      const jitter = vibration * 0.005;
      if (vibration > 1 && state === 'RUNNING') {
        groupRef.current.position.x = (Math.random() - 0.5) * jitter;
        groupRef.current.position.y = (Math.random() - 0.5) * jitter;
        groupRef.current.position.z = (Math.random() - 0.5) * jitter;
      } else {
        groupRef.current.position.set(0, 0, 0);
      }
    }
  });

  // Calculate emissive color based on temperature (60°C is normal/dark, 95°C is hot glowing red)
  const tempRatio = Math.max(0, Math.min(1, (temperature - 50) / 45)); // 0 at 50°C, 1 at 95°C
  const emissiveColor = new THREE.Color().lerpColors(
    new THREE.Color('#111317'),
    new THREE.Color('#ef4444'),
    tempRatio
  );
  const emissiveIntensity = tempRatio * 1.5;
  const wearRatio = Math.max(0, Math.min(1, (85 - bearingHealth) / 55));
  const bearingColor = new THREE.Color().lerpColors(
    new THREE.Color('#cbd5e1'),
    new THREE.Color('#ef4444'),
    wearRatio
  );
  const bearingEmissive = new THREE.Color().lerpColors(
    new THREE.Color('#000000'),
    new THREE.Color('#dc2626'),
    wearRatio
  );

  return (
    <group ref={groupRef}>
      {/* 3D Grid floor */}
      <gridHelper args={[20, 20, '#242933', '#111317']} position={[0, -1.8, 0]} />

      {/* Main Motor Body (Stator) */}
      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[1.2, 1.2, 2.4, 32]} />
        <meshStandardMaterial 
          color="#64748b" 
          roughness={0.4} 
          metalness={0.8}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
        />
      </mesh>

      {/* Stator Cooling Fins (Ribs around stator body) */}
      {Array.from({ length: 12 }).map((_, i) => {
        const angle = (i * Math.PI * 2) / 12;
        const radius = 1.25;
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        return (
          <mesh 
            key={i} 
            position={[x, y, 0]} 
            rotation={[0, 0, angle]}
          >
            <boxGeometry args={[0.08, 0.15, 2.4]} />
            <meshStandardMaterial 
              color="#475569" 
              roughness={0.6}
              emissive={emissiveColor}
              emissiveIntensity={emissiveIntensity * 0.7}
            />
          </mesh>
        );
      })}

      {/* Motor Feet / Mounting Base */}
      <mesh position={[-0.8, -1.2, 0.8]}>
        <boxGeometry args={[0.3, 0.4, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      <mesh position={[0.8, -1.2, 0.8]}>
        <boxGeometry args={[0.3, 0.4, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      <mesh position={[-0.8, -1.2, -0.8]}>
        <boxGeometry args={[0.3, 0.4, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      <mesh position={[0.8, -1.2, -0.8]}>
        <boxGeometry args={[0.3, 0.4, 0.5]} />
        <meshStandardMaterial color="#475569" roughness={0.7} />
      </mesh>
      {/* Baseplate */}
      <mesh position={[0, -1.4, 0]}>
        <boxGeometry args={[2.2, 0.15, 2.2]} />
        <meshStandardMaterial color="#334155" roughness={0.9} />
      </mesh>

      {/* Power Terminal Junction Box (Top) */}
      <mesh position={[0, 1.3, 0.2]}>
        <boxGeometry args={[0.8, 0.5, 0.8]} />
        <meshStandardMaterial color="#2e3542" roughness={0.5} metalness={0.5} />
      </mesh>

      {/* Front Shaft Output & Bearings */}
      <mesh position={[0, 0, 1.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.2, 16]} />
        <meshStandardMaterial
          color={bearingColor}
          emissive={bearingEmissive}
          emissiveIntensity={0.8 * wearRatio}
          roughness={0.28}
          metalness={0.75}
        />
      </mesh>
      {/* Main Shaft */}
      <group ref={shaftRef} position={[0, 0, 0.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.25, 0.25, 3.6, 24]} />
          <meshStandardMaterial color="#dbeafe" roughness={0.16} metalness={0.82} />
        </mesh>
        {/* High-contrast keyway running along the shaft makes rotation readable. */}
        <mesh position={[0.255, 0, 0]}>
          <boxGeometry args={[0.055, 0.09, 3.55]} />
          <meshStandardMaterial
            color="#fbbf24"
            emissive="#f59e0b"
            emissiveIntensity={0.65}
            roughness={0.25}
          />
        </mesh>
        <mesh position={[0, 0, 1.82]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.27, 0.27, 0.04, 24]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.8} roughness={0.14} />
        </mesh>
      </group>

      {/* Rear Fan Housing */}
      <mesh position={[0, 0, -1.3]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.1, 1.1, 0.4, 32]} />
        <meshStandardMaterial color="#334155" roughness={0.55} metalness={0.35} />
      </mesh>
      {/* Visual grill vents on housing */}
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh 
          key={i} 
          position={[0, 0, -1.51]} 
          rotation={[0, 0, (i * Math.PI) / 4]}
        >
          <boxGeometry args={[0.1, 1.6, 0.02]} />
          <meshBasicMaterial color="#94a3b8" />
        </mesh>
      ))}

      {/* Cooling Fan Blades (Inside rear shell) */}
      <group ref={fanRef} position={[0, 0, -1.1]}>
        {Array.from({ length: 6 }).map((_, i) => {
          const angle = (i * Math.PI * 2) / 6;
          return (
            <mesh 
              key={i} 
              position={[Math.cos(angle) * 0.4, Math.sin(angle) * 0.4, 0]}
              rotation={[0, 0.2, angle]}
            >
              <boxGeometry args={[0.15, 0.6, 0.04]} />
              <meshStandardMaterial
                color="#38bdf8"
                emissive="#075985"
                emissiveIntensity={0.5}
                roughness={0.4}
              />
            </mesh>
          );
        })}
      </group>

      {/* Sensor Hotspot 1: Front Bearing */}
      <group position={[0, 0.7, 1.25]}>
        <Html distanceFactor={5}>
          <div className="relative">
            <button 
              onClick={() => setActiveSensor(activeSensor === 'bearing' ? null : 'bearing')}
              className={`w-4 h-4 rounded-full border-2 border-white flex items-center justify-center transition-all ${
                bearingHealth > 75 
                  ? 'bg-success-500 animate-pulse' 
                  : bearingHealth > 45 
                    ? 'bg-warning-500 animate-pulse' 
                    : 'bg-danger-500 animate-ping'
              }`}
            />
            {activeSensor === 'bearing' && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-48 bg-industrial-900 border border-industrial-700 p-2 rounded shadow-2xl z-50 text-xs font-mono">
                <div className="text-industrial-300 font-bold border-b border-industrial-800 pb-1 mb-1">FRONT BEARING SENSOR</div>
                <div className="flex justify-between">
                  <span>Health:</span>
                  <span className={bearingHealth > 75 ? 'text-success-500' : bearingHealth > 45 ? 'text-warning-500' : 'text-danger-500'}>
                    {bearingHealth}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Vibration:</span>
                  <span className={vibration < 3.0 ? 'text-success-500' : vibration < 5.0 ? 'text-warning-500' : 'text-danger-500'}>
                    {vibration} mm/s
                  </span>
                </div>
              </div>
            )}
          </div>
        </Html>
      </group>

      {/* Sensor Hotspot 2: Thermal Sensor Stator */}
      <group position={[0, 1.25, -0.4]}>
        <Html distanceFactor={5}>
          <div className="relative">
            <button 
              onClick={() => setActiveSensor(activeSensor === 'stator' ? null : 'stator')}
              className={`w-4 h-4 rounded-full border-2 border-white flex items-center justify-center transition-all ${
                temperature < 75 
                  ? 'bg-success-500 animate-pulse' 
                  : temperature < 88 
                    ? 'bg-warning-500 animate-pulse' 
                    : 'bg-danger-500 animate-ping'
              }`}
            />
            {activeSensor === 'stator' && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-48 bg-industrial-900 border border-industrial-700 p-2 rounded shadow-2xl z-50 text-xs font-mono">
                <div className="text-industrial-300 font-bold border-b border-industrial-800 pb-1 mb-1">STATOR THERMISTOR</div>
                <div className="flex justify-between">
                  <span>Temperature:</span>
                  <span className={temperature < 75 ? 'text-success-500' : temperature < 88 ? 'text-warning-500' : 'text-danger-500'}>
                    {temperature}°C
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Cooling Eff:</span>
                  <span className={cooling > 75 ? 'text-success-500' : cooling > 45 ? 'text-warning-500' : 'text-danger-500'}>
                    {cooling}%
                  </span>
                </div>
              </div>
            )}
          </div>
        </Html>
      </group>

      {/* Sensor Hotspot 3: RPM Tachometer */}
      <group position={[0, -0.4, 1.6]}>
        <Html distanceFactor={5}>
          <div className="relative">
            <button 
              onClick={() => setActiveSensor(activeSensor === 'tacho' ? null : 'tacho')}
              className="w-4 h-4 bg-info-500 rounded-full border-2 border-white flex items-center justify-center animate-pulse"
            />
            {activeSensor === 'tacho' && (
              <div className="absolute left-6 top-1/2 -translate-y-1/2 w-48 bg-industrial-900 border border-industrial-700 p-2 rounded shadow-2xl z-50 text-xs font-mono">
                <div className="text-industrial-300 font-bold border-b border-industrial-800 pb-1 mb-1">OPTICAL TACHOMETER</div>
                <div className="flex justify-between">
                  <span>Rotor RPM:</span>
                  <span className="text-info-500 font-bold">{rpm} RPM</span>
                </div>
                <div className="flex justify-between">
                  <span>Duty Cycle:</span>
                  <span>
                    {state === 'FAULTED'
                      ? rpm > 0 ? 'COASTING — POWER OFF' : 'TRIPPED — STOPPED'
                      : state === 'STOPPED'
                        ? rpm > 0 ? 'COASTING' : 'STOPPED'
                        : 'POWERED / RUNNING'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </Html>
      </group>
    </group>
  );
}

// Outer wrapper setting up canvas
export default function MotorCanvas({ rpm, vibration, temperature, bearingHealth, cooling, state }: MotorModelProps) {
  return (
    <div className="w-full h-full relative bg-industrial-950 rounded-lg overflow-hidden border border-industrial-800 shadow-industrial-inner">
      <div className="absolute top-2 left-2 z-10 bg-industrial-900/80 backdrop-blur border border-industrial-700/50 px-2 py-1 rounded text-[10px] font-mono text-industrial-400">
        3D TELEMETRY CANVAS - CLICK MARKERS FOR DETAIL
      </div>
      <Canvas 
        camera={{ position: [3, 2, 4.5], fov: 40 }}
      >
        <ambientLight intensity={0.65} />
        <pointLight position={[10, 10, 10]} intensity={1.8} />
        <pointLight position={[-10, 5, -10]} intensity={0.9} color="#60a5fa" />
        <pointLight position={[0, 1, 5]} intensity={1.1} color="#ffffff" />
        <directionalLight position={[0, 5, 0]} intensity={1.0} />
        
        <MotorModel 
          rpm={rpm} 
          vibration={vibration} 
          temperature={temperature} 
          bearingHealth={bearingHealth}
          cooling={cooling}
          state={state}
        />
        
        <OrbitControls 
          enableZoom={true} 
          maxDistance={10} 
          minDistance={2} 
          enablePan={false}
        />
      </Canvas>
    </div>
  );
}
