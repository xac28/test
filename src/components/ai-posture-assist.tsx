"use client"

import { useEffect, useRef, useState } from "react"
import * as tf from "@tensorflow/tfjs-core"
import "@tensorflow/tfjs-backend-webgl"
import * as poseDetection from "@tensorflow-models/pose-detection"
import { Activity, X, Maximize2, Minimize2, ChevronDown } from "lucide-react"

// Math Helper: Calculate angle between 3 points (A-B-C, B is vertex)
function calculateAngle(a: {x: number, y: number}, b: {x: number, y: number}, c: {x: number, y: number}) {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x)
  let angle = Math.abs((radians * 180.0) / Math.PI)
  if (angle > 180.0) angle = 360 - angle
  return angle
}

const YOGA_POSES = [
  { id: "WARRIOR_2", name: "2. Savaşçı (Warrior II)" },
  { id: "DOWNWARD_DOG", name: "Aşağı Bakan Köpek" },
  { id: "TREE", name: "Ağaç Duruşu (Tree Pose)" },
  { id: "GENERAL_POSTURE", name: "Genel Dik Duruş (Spine)" }
]

export function AiPostureAssist({ onClose }: { onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [feedback, setFeedback] = useState("Duruş Analizi Başlatılıyor...")
  const [expanded, setExpanded] = useState(false)
  const [targetPose, setTargetPose] = useState(YOGA_POSES[3].id)
  
  const detectorRef = useRef<poseDetection.PoseDetector | null>(null)
  const reqRef = useRef<number>()

  useEffect(() => {
    let stream: MediaStream

    const initAI = async () => {
      try {
        await tf.ready()
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
        })
        detectorRef.current = detector

        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false })
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onloadedmetadata = () => {
            videoRef.current?.play()
            setIsLoaded(true)
            setFeedback("Pozunuzu alın, AI sizi izliyor. ✨")
            detectPose()
          }
        }
      } catch (err) {
        console.error("AI Error:", err)
        setFeedback("Kamera izni reddedildi veya AI yüklenemedi.")
      }
    }

    initAI()

    return () => {
      if (reqRef.current) cancelAnimationFrame(reqRef.current)
      if (stream) stream.getTracks().forEach(t => t.stop())
      if (detectorRef.current) detectorRef.current.dispose()
    }
  }, [targetPose])

  const detectPose = async () => {
    if (!videoRef.current || !canvasRef.current || !detectorRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext("2d")
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    const detect = async () => {
      if (video.readyState === 4) {
        const poses = await detectorRef.current!.estimatePoses(video)
        
        if (ctx) {
          ctx.clearRect(0, 0, canvas.width, canvas.height)
          
          if (poses.length > 0) {
            const keypoints = poses[0].keypoints
            const scoreThreshold = 0.4

            // Extract keypoints
            const getKp = (name: string) => keypoints.find(k => k.name === name && (k.score ?? 0) > scoreThreshold)
            
            const lShoulder = getKp("left_shoulder")
            const rShoulder = getKp("right_shoulder")
            const lElbow = getKp("left_elbow")
            const rElbow = getKp("right_elbow")
            const lWrist = getKp("left_wrist")
            const rWrist = getKp("right_wrist")
            const lHip = getKp("left_hip")
            const rHip = getKp("right_hip")
            const lKnee = getKp("left_knee")
            const rKnee = getKp("right_knee")
            const lAnkle = getKp("left_ankle")
            const rAnkle = getKp("right_ankle")
            const lEar = getKp("left_ear")

            let isPerfect = false
            let currentFeedback = "İskeletiniz analiz ediliyor..."
            let errorLines: [string, string][] = [] // Store which body parts are incorrectly angled

            // ============================================
            // MATH & YOGA POSTURE ALGORITHMS
            // ============================================
            if (targetPose === "WARRIOR_2") {
              if (lShoulder && lElbow && lWrist && rShoulder && rElbow && rWrist && lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
                const lArmAngle = calculateAngle(lShoulder, lElbow, lWrist)
                const rArmAngle = calculateAngle(rShoulder, rElbow, rWrist)
                const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle)
                const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle)

                // Arms should be straight (~180)
                const armsStraight = lArmAngle > 150 && rArmAngle > 150
                // One knee bent (~90), one straight (~180)
                const isLeftBent = lKneeAngle < 130 && rKneeAngle > 150
                const isRightBent = rKneeAngle < 130 && lKneeAngle > 150

                if (!armsStraight) {
                  currentFeedback = "Kollarınızı yere paralel ve dümdüz açın."
                  errorLines.push(["left_shoulder", "left_elbow"], ["left_elbow", "left_wrist"])
                  errorLines.push(["right_shoulder", "right_elbow"], ["right_elbow", "right_wrist"])
                } else if (!isLeftBent && !isRightBent) {
                  currentFeedback = "Öndeki dizinizi 90 derece bükün, arkadakini düz tutun."
                  errorLines.push(["left_hip", "left_knee"], ["right_hip", "right_knee"])
                } else {
                  isPerfect = true
                  currentFeedback = "Muazzam bir Savaşçı! Nefes alıp verin. ✨"
                }
              } else {
                currentFeedback = "Tüm vücudunuz kamerada görünmeli."
              }
            } 
            else if (targetPose === "DOWNWARD_DOG") {
              if (lWrist && lShoulder && lHip && lKnee && lAnkle) {
                const shoulderAngle = calculateAngle(lWrist, lShoulder, lHip)
                const hipAngle = calculateAngle(lShoulder, lHip, lKnee)
                const kneeAngle = calculateAngle(lHip, lKnee, lAnkle)

                if (shoulderAngle < 150) {
                  currentFeedback = "Kollarınız ve sırtınız tek bir düz çizgi olmalı."
                  errorLines.push(["left_wrist", "left_shoulder"], ["left_shoulder", "left_hip"])
                } else if (kneeAngle < 150) {
                  currentFeedback = "Dizlerinizi düzleştirmeye çalışın (topuklar yere)."
                  errorLines.push(["left_hip", "left_knee"], ["left_knee", "left_ankle"])
                } else if (hipAngle < 50 || hipAngle > 100) {
                  currentFeedback = "Kalçanızı gökyüzüne doğru iyice itin (V harfi)."
                  errorLines.push(["left_shoulder", "left_hip"], ["left_hip", "left_knee"])
                } else {
                  isPerfect = true
                  currentFeedback = "Mükemmel Aşağı Bakan Köpek! 🐕"
                }
              } else {
                currentFeedback = "Yandan görünecek şekilde kameraya geçin."
              }
            }
            else if (targetPose === "TREE") {
              if (lHip && lKnee && lAnkle && rHip && rKnee && rAnkle) {
                const lKneeAngle = calculateAngle(lHip, lKnee, lAnkle)
                const rKneeAngle = calculateAngle(rHip, rKnee, rAnkle)

                const isLeftBent = lKneeAngle < 130 && rKneeAngle > 160
                const isRightBent = rKneeAngle < 130 && lKneeAngle > 160

                if (isLeftBent || isRightBent) {
                  isPerfect = true
                  currentFeedback = "Harika denge! Köklenin ve odaklanın. 🌳"
                } else {
                  currentFeedback = "Bir dizinizi büküp ayağınızı diğer bacağınıza dayayın."
                  errorLines.push(["left_hip", "left_knee"], ["right_hip", "right_knee"])
                }
              }
            }
            else { // GENERAL_POSTURE
              if (lShoulder && lHip && lEar) { // Need ear to check neck posture
                 const spineAngle = calculateAngle({x: lShoulder.x, y: 0}, lShoulder, lHip)
                 if (spineAngle > 20) { // Should be close to vertical (0-15 degrees)
                   currentFeedback = "Çok fazla öne eğildiniz, dikleşin."
                   errorLines.push(["left_shoulder", "left_hip"])
                 } else {
                   isPerfect = true
                   currentFeedback = "Duruşunuz harika, omurga dik. 🧘‍♀️"
                 }
              } else if (lShoulder && lHip) {
                 currentFeedback = "Sırtınızı dik tutun."
              }
            }

            setFeedback(currentFeedback)

            // ============================================
            // DRAWING SKELETON
            // ============================================
            const adjacentPairs = poseDetection.util.getAdjacentPairs(poseDetection.SupportedModels.MoveNet)
            
            adjacentPairs.forEach(([i, j]) => {
              const kp1 = keypoints[i]
              const kp2 = keypoints[j]
              
              if ((kp1.score ?? 0) > scoreThreshold && (kp2.score ?? 0) > scoreThreshold) {
                // Determine if this specific bone is causing an error
                const isErrorLine = errorLines.some(pair => 
                  (pair[0] === kp1.name && pair[1] === kp2.name) || 
                  (pair[0] === kp2.name && pair[1] === kp1.name)
                )

                ctx.beginPath()
                ctx.moveTo(kp1.x, kp1.y)
                ctx.lineTo(kp2.x, kp2.y)
                ctx.lineWidth = isErrorLine ? 6 : 4
                
                // Color Code: Green if perfect, Red if error, Cyan if analyzing/neutral
                if (isPerfect) {
                  ctx.strokeStyle = "#10b981" // Emerald Glow
                } else if (isErrorLine) {
                  ctx.strokeStyle = "#ef4444" // Red Warning
                } else {
                  ctx.strokeStyle = "#06b6d4" // Cyan Default
                }
                
                // Add glow effect
                ctx.shadowBlur = 10
                ctx.shadowColor = ctx.strokeStyle
                
                ctx.stroke()
                ctx.shadowBlur = 0 // reset
              }
            })

            // Draw Joints
            keypoints.forEach(kp => {
              if ((kp.score ?? 0) > scoreThreshold) {
                ctx.beginPath()
                ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI)
                ctx.fillStyle = "#ffffff"
                ctx.fill()
              }
            })
          }
        }
      }
      reqRef.current = requestAnimationFrame(detect)
    }

    detect()
  }

  return (
    <div className={`fixed bottom-6 left-6 z-[100] bg-black/80 backdrop-blur-xl border border-white/20 shadow-2xl rounded-3xl overflow-hidden transition-all duration-300 ${expanded ? "w-[400px] h-[500px]" : "w-80 h-64"} flex flex-col`}>
      {/* Header */}
      <div className="w-full p-3 flex items-center justify-between z-10 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-sage-400 animate-pulse" />
          <span className="text-xs font-medium tracking-wider text-white uppercase">AI Duruş Asistanı</span>
        </div>
        
        <div className="flex items-center gap-2">
          <button onClick={() => setExpanded(!expanded)} className="text-white/60 hover:text-white transition">
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button onClick={onClose} className="text-white/60 hover:text-red-400 transition">
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Pose Selector */}
      <div className="px-3 pb-2 z-10">
        <div className="relative">
          <select 
            value={targetPose}
            onChange={(e) => setTargetPose(e.target.value)}
            className="w-full appearance-none bg-white/10 text-white text-xs font-medium rounded-lg px-3 py-2 pr-8 border border-white/20 focus:outline-none focus:border-sage-400"
          >
            {YOGA_POSES.map(pose => (
              <option key={pose.id} value={pose.id} className="bg-gray-900 text-white">{pose.name}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
        </div>
      </div>

      {/* Video Container */}
      <div className="relative flex-1 w-full bg-black/50 overflow-hidden">
        {!isLoaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-4 border-sage-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-white/60">Yapay Zeka Yükleniyor...</p>
            </div>
          </div>
        )}
        <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" playsInline muted />
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full object-cover scale-x-[-1]" />
      </div>

      {/* Feedback Banner */}
      <div className="w-full bg-black/80 backdrop-blur-md p-4 border-t border-white/10 min-h-[70px] flex items-center justify-center">
        <p className={`text-sm font-medium text-center animate-fade-in ${feedback.includes('Muazzam') || feedback.includes('Harika') || feedback.includes('Mükemmel') ? 'text-sage-400' : 'text-white/90'}`}>
          {feedback}
        </p>
      </div>
    </div>
  )
}
