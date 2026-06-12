// components/ui/QrScanner.tsx
"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { XMarkIcon } from "@heroicons/react/24/outline"
import jsQR from "jsqr"

interface QrScannerProps {
  /** Se invoca cuando se detecta un QR válido. El componente se cierra solo después. */
  onDetect: (result: string) => void
  /** Se invoca cuando el usuario cancela o cierra el modal. */
  onClose:  () => void
  /** Texto que ayuda al usuario a saber qué tipo de QR esperar. */
  hint?:    string
}

/**
 * Escáner de códigos QR usando la cámara del dispositivo.
 *
 * Requiere HTTPS (o localhost) para acceder a la cámara. Es un requisito
 * del navegador, no se puede saltar.
 *
 * Usa `getUserMedia` (Web API estándar) y `jsQR` para detectar el código.
 * Funciona en escritorio y móvil (Chrome, Safari, Firefox, Edge actuales).
 */
export function QrScanner({ onDetect, onClose, hint }: QrScannerProps) {
  const videoRef    = useRef<HTMLVideoElement>(null)
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const streamRef   = useRef<MediaStream | null>(null)
  const rafRef      = useRef<number | null>(null)
  const detectedRef = useRef(false)  // evita múltiples detecciones

  const [status, setStatus] = useState<"requesting" | "scanning" | "error">("requesting")
  const [errorMessage, setErrorMessage] = useState<string>("")

  // ── Liberar recursos al cerrar ───────────────────────────────────
  const cleanup = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
  }, [])

  // ── Iniciar cámara ──────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false

    async function startCamera() {
      try {
        // Pedir cámara trasera preferentemente (móvil)
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width:      { ideal: 1280 },
            height:     { ideal: 720 },
          },
          audio: false,
        })

        if (cancelled) {
          stream.getTracks().forEach(t => t.stop())
          return
        }

        streamRef.current = stream

        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play()
          setStatus("scanning")
          scanFrame()
        }
      } catch (e: unknown) {
        if (cancelled) return
        const err = e as DOMException
        let msg = "No se pudo acceder a la cámara"
        if (err.name === "NotAllowedError") {
          msg = "Permiso denegado. Permite el acceso a la cámara en los ajustes del navegador."
        } else if (err.name === "NotFoundError") {
          msg = "No se detectó ninguna cámara en este dispositivo."
        } else if (err.name === "NotReadableError") {
          msg = "La cámara está en uso por otra aplicación."
        } else if (err.name === "OverconstrainedError") {
          msg = "La cámara no soporta los parámetros solicitados."
        } else if (err.message) {
          msg = err.message
        }
        setErrorMessage(msg)
        setStatus("error")
      }
    }

    startCamera()

    return () => {
      cancelled = true
      cleanup()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Bucle de escaneo ────────────────────────────────────────────
  function scanFrame() {
    if (detectedRef.current) return

    const video  = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) {
      rafRef.current = requestAnimationFrame(scanFrame)
      return
    }

    const w = video.videoWidth
    const h = video.videoHeight
    canvas.width  = w
    canvas.height = h
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (!ctx) return

    ctx.drawImage(video, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)

    const result = jsQR(imageData.data, w, h, {
      inversionAttempts: "dontInvert",
    })

    if (result && result.data) {
      detectedRef.current = true
      cleanup()
      onDetect(result.data)
      return
    }

    rafRef.current = requestAnimationFrame(scanFrame)
  }

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position:       "fixed",
        inset:          0,
        background:     "rgba(0, 0, 0, 0.92)",
        zIndex:         1000,
        display:        "flex",
        flexDirection:  "column",
        alignItems:     "center",
        justifyContent: "center",
        padding:        "20px",
      }}
    >
      {/* Botón cerrar */}
      <button
        onClick={onClose}
        aria-label="Cerrar escáner"
        style={{
          position: "absolute",
          top:      "20px",
          right:    "20px",
          background: "rgba(255, 255, 255, 0.1)",
          border:     "1px solid rgba(255, 255, 255, 0.2)",
          color:      "white",
          width:  "44px",
          height: "44px",
          borderRadius: "50%",
          cursor:    "pointer",
          display:   "grid",
          placeItems: "center",
        }}
      >
        <XMarkIcon className="w-6 h-6" />
      </button>

      {/* Estado: pidiendo permiso */}
      {status === "requesting" && (
        <div style={{ color: "white", textAlign: "center", fontFamily: "var(--font-mono)" }}>
          <div style={{ fontSize: "14px", marginBottom: "8px" }}>Solicitando acceso a la cámara…</div>
          <div style={{ fontSize: "11px", opacity: 0.6 }}>Acepta el permiso del navegador</div>
        </div>
      )}

      {/* Estado: error */}
      {status === "error" && (
        <div style={{
          background:    "rgba(220, 38, 38, 0.1)",
          border:        "1px solid rgba(220, 38, 38, 0.3)",
          borderRadius:  "12px",
          padding:       "24px",
          maxWidth:      "400px",
          textAlign:     "center",
        }}>
          <div style={{ color: "#f87171", fontSize: "15px", fontWeight: 500, marginBottom: "8px" }}>
            Error al acceder a la cámara
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-mono)", fontSize: "12px", marginBottom: "16px" }}>
            {errorMessage}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "var(--rust)",
              color:      "white",
              border:     "none",
              borderRadius: "8px",
              padding:      "10px 20px",
              fontSize:     "13.5px",
              cursor:       "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Estado: escaneando */}
      {(status === "scanning" || status === "requesting") && (
        <div style={{
          position: "relative",
          maxWidth: "min(90vw, 480px)",
          aspectRatio: "1",
          width:    "100%",
          display:  status === "scanning" ? "block" : "none",
        }}>
          <video
            ref={videoRef}
            playsInline
            muted
            style={{
              width:        "100%",
              height:       "100%",
              objectFit:    "cover",
              borderRadius: "12px",
              background:   "#000",
            }}
          />
          <canvas ref={canvasRef} style={{ display: "none" }} />

          {/* Marco de objetivo */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset:    "12%",
              border:   "2px solid rgba(255, 255, 255, 0.8)",
              borderRadius: "12px",
              boxShadow:    "0 0 0 9999px rgba(0, 0, 0, 0.3)",
              pointerEvents: "none",
            }}
          />
        </div>
      )}

      {/* Pista para el usuario */}
      {status === "scanning" && (
        <div style={{
          marginTop:  "20px",
          color:      "white",
          fontFamily: "var(--font-mono)",
          fontSize:   "12px",
          textAlign:  "center",
          opacity:    0.8,
        }}>
          {hint ?? "Encuadra el código QR dentro del recuadro"}
        </div>
      )}
    </div>
  )
}
