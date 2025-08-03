"use client"

import { useEffect, useRef } from "react"

export default function AnimatedMinimalistBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const waves: Array<{
      amplitude: number
      frequency: number
      phase: number
      speed: number
      y: number
      color: string
      opacity: number
    }> = []

    const floatingDots: Array<{
      x: number
      y: number
      size: number
      vy: number
      opacity: number
      maxOpacity: number
      color: string
    }> = []

    // Create waves
    for (let i = 0; i < 5; i++) {
      waves.push({
        amplitude: Math.random() * 50 + 20,
        frequency: Math.random() * 0.02 + 0.005,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.02 + 0.01,
        y: (canvas.height / 6) * (i + 1),
        color: i % 2 === 0 ? "#ff4757" : "#ffd93d",
        opacity: 0.1 + Math.random() * 0.2,
      })
    }

    // Create floating dots
    for (let i = 0; i < 30; i++) {
      floatingDots.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 4 + 2,
        vy: -(Math.random() * 0.5 + 0.2),
        opacity: 0,
        maxOpacity: Math.random() * 0.3 + 0.1,
        color: Math.random() > 0.5 ? "#ff4757" : "#ffd93d",
      })
    }

    let time = 0

    function animate() {
      time += 0.016

      // Clear with gradient background
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height)
      gradient.addColorStop(0, "#f8fafc")
      gradient.addColorStop(1, "#e2e8f0")
      ctx.fillStyle = gradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // Draw waves
      waves.forEach((wave) => {
        wave.phase += wave.speed

        ctx.strokeStyle = wave.color
        ctx.globalAlpha = wave.opacity
        ctx.lineWidth = 3
        ctx.beginPath()

        for (let x = 0; x <= canvas.width; x += 5) {
          const y = wave.y + Math.sin(x * wave.frequency + wave.phase) * wave.amplitude
          if (x === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      })

      // Draw floating dots
      floatingDots.forEach((dot) => {
        dot.y += dot.vy
        dot.opacity = Math.sin(time * 2 + dot.x * 0.01) * dot.maxOpacity

        if (dot.y < -dot.size) {
          dot.y = canvas.height + dot.size
          dot.x = Math.random() * canvas.width
        }

        ctx.globalAlpha = Math.max(0, dot.opacity)
        ctx.fillStyle = dot.color
        ctx.beginPath()
        ctx.arc(dot.x, dot.y, dot.size, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.globalAlpha = 1
      requestAnimationFrame(animate)
    }

    animate()

    const handleResize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return (
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-b from-slate-50 to-slate-200">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
