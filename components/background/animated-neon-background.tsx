"use client"

import { useEffect, useRef } from "react"

export default function AnimatedNeonBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      color: string
      glow: number
    }> = []

    const circuits: Array<{
      x1: number
      y1: number
      x2: number
      y2: number
      pulse: number
      pulseSpeed: number
    }> = []

    // Create particles
    for (let i = 0; i < 100; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        size: Math.random() * 3 + 1,
        color: Math.random() > 0.5 ? "#00ffff" : "#ff00ff",
        glow: Math.random() * 10 + 5,
      })
    }

    // Create circuit lines
    for (let i = 0; i < 20; i++) {
      circuits.push({
        x1: Math.random() * canvas.width,
        y1: Math.random() * canvas.height,
        x2: Math.random() * canvas.width,
        y2: Math.random() * canvas.height,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: Math.random() * 0.05 + 0.02,
      })
    }

    function animate() {
      // Dark background with slight transparency for trail effect
      ctx.fillStyle = "rgba(0, 0, 0, 0.1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw circuit lines
      circuits.forEach((circuit) => {
        circuit.pulse += circuit.pulseSpeed
        const intensity = (Math.sin(circuit.pulse) + 1) * 0.5

        ctx.strokeStyle = `rgba(0, 255, 255, ${intensity * 0.5})`
        ctx.lineWidth = 2
        ctx.shadowColor = "#00ffff"
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(circuit.x1, circuit.y1)
        ctx.lineTo(circuit.x2, circuit.y2)
        ctx.stroke()
        ctx.shadowBlur = 0
      })

      // Draw particles
      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        // Bounce off edges
        if (particle.x < 0 || particle.x > canvas.width) particle.vx *= -1
        if (particle.y < 0 || particle.y > canvas.height) particle.vy *= -1

        // Keep particles in bounds
        particle.x = Math.max(0, Math.min(canvas.width, particle.x))
        particle.y = Math.max(0, Math.min(canvas.height, particle.y))

        ctx.shadowColor = particle.color
        ctx.shadowBlur = particle.glow
        ctx.fillStyle = particle.color
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      })

      requestAnimationFrame(animate)
    }

    // Initial background
    ctx.fillStyle = "black"
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="w-full h-screen relative overflow-hidden bg-black">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
