import { useEffect, useRef, useState } from 'react'

interface CaptchaProps {
  onVerify: (valid: boolean) => void
}

// 生成随机验证码文字
function generateCode(length = 4): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export function Captcha({ onVerify }: CaptchaProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [code, setCode] = useState('')
  const [input, setInput] = useState('')
  const [shaken, setShaken] = useState(false)

  const drawCaptcha = (text: string) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    // 背景
    ctx.fillStyle = '#f0f4ff'
    ctx.fillRect(0, 0, W, H)

    // 干扰线
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = `hsl(${Math.random() * 360},60%,75%)`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(Math.random() * W, Math.random() * H)
      ctx.bezierCurveTo(
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H,
        Math.random() * W, Math.random() * H
      )
      ctx.stroke()
    }

    // 干扰点
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `hsl(${Math.random() * 360},50%,70%)`
      ctx.beginPath()
      ctx.arc(Math.random() * W, Math.random() * H, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }

    // 文字
    const colors = ['#4f46e5', '#7c3aed', '#db2777', '#0891b2', '#059669']
    text.split('').forEach((char, i) => {
      ctx.save()
      ctx.font = `bold ${22 + Math.random() * 6}px Arial`
      ctx.fillStyle = colors[i % colors.length]
      const x = 14 + i * 28
      const y = H / 2 + 8
      ctx.translate(x, y)
      ctx.rotate((Math.random() - 0.5) * 0.5)
      ctx.fillText(char, 0, 0)
      ctx.restore()
    })
  }

  const refresh = () => {
    const newCode = generateCode()
    setCode(newCode)
    setInput('')
    onVerify(false)
    setTimeout(() => drawCaptcha(newCode), 10)
  }

  useEffect(() => {
    refresh()
  }, [])

  const handleInput = (val: string) => {
    setInput(val)
    const valid = val.toUpperCase() === code
    onVerify(valid)
    if (val.length === code.length && !valid) {
      // 输错了，抖动后刷新
      setShaken(true)
      setTimeout(() => {
        setShaken(false)
        refresh()
      }, 500)
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
      {/* 验证码画布 */}
      <div
        onClick={refresh}
        title="点击刷新"
        style={{
          cursor: 'pointer', borderRadius: '10px', overflow: 'hidden',
          border: '1.5px solid #e5e7eb', flexShrink: 0,
          animation: shaken ? 'shake 0.4s ease' : 'none'
        }}
      >
        <canvas ref={canvasRef} width={120} height={40} style={{ display: 'block' }} />
      </div>

      {/* 输入框 */}
      <input
        type="text"
        value={input}
        onChange={e => handleInput(e.target.value.toUpperCase())}
        maxLength={4}
        placeholder="验证码"
        style={{
          flex: 1, padding: '11px 12px', border: '1.5px solid #e5e7eb',
          borderRadius: '12px', fontSize: '15px', fontWeight: 600,
          letterSpacing: '4px', background: '#f9fafb', outline: 'none',
          textAlign: 'center', boxSizing: 'border-box'
        }}
      />

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  )
}
