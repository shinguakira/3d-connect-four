"use client"

import { useEffect, useRef } from "react"

export default function AnimatedGeometricBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight

    const hexagons: Array<{
      x: number
      y: number
      size: number
      rotation: number
      rotationSpeed: number
      opacity: number
      color: string
    }> = []

    // Create hexagons
    for (let i = 0; i < 50; i++) {
      hexagons.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        size: Math.random() * 30 + 10,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.02,
        opacity: Math.random() * 0.5 + 0.1,
        color: Math.random() > 0.5 ? "#ff4757" : "#ffd93d",
      })
    }

    function drawHexagon(x: number, y: number, size: number, rotation: number) {
      if (!ctx) return
      ctx.save()
      ctx.translate(x, y)
      ctx.rotate(rotation)
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI) / 3
        const px = Math.cos(angle) * size
        const py = Math.sin(angle) * size
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.restore()
    }

    function animate() {
      ctx.fillStyle = "rgba(15, 23, 42, 0.1)"
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      hexagons.forEach((hex) => {
        hex.rotation += hex.rotationSpeed
        hex.y += 0.5
        if (hex.y > canvas.height + hex.size) {
          hex.y = -hex.size
          hex.x = Math.random() * canvas.width
        }

        ctx.globalAlpha = hex.opacity
        ctx.strokeStyle = hex.color
        ctx.lineWidth = 2
        drawHexagon(hex.x, hex.y, hex.size, hex.rotation)
        ctx.stroke()
      })

      requestAnimationFrame(animate)
    }

    // Initial background
    ctx.fillStyle = "linear-gradient(135deg, #1e293b, #334155)"
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
    <div className="w-full h-screen relative overflow-hidden bg-gradient-to-br from-slate-800 to-slate-600">
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  )
}
