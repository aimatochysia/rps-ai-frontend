import { useState, useRef, useEffect, useCallback } from 'react'
import './App.css'

const API_URL = 'https://rps-ai-sf3w.onrender.com/detect'

// Detection interval constants
const MIN_DETECTION_INTERVAL = 3000 // 3 seconds minimum between detections
const PROCESSING_BUFFER = 500 // Buffer time to add to last process time

// Colors for different classes
const CLASS_COLORS = {
  rock: { bg: 'rgba(239, 68, 68, 0.3)', border: '#ef4444', text: '#fca5a5' },
  paper: { bg: 'rgba(59, 130, 246, 0.3)', border: '#3b82f6', text: '#93c5fd' },
  scissors: { bg: 'rgba(34, 197, 94, 0.3)', border: '#22c55e', text: '#86efac' },
}

function App() {
  const [mode, setMode] = useState('select') // 'select', 'live', 'image'
  const [detections, setDetections] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [cameraActive, setCameraActive] = useState(false)
  const [lastProcessTime, setLastProcessTime] = useState(0)
  const [isProcessing, setIsProcessing] = useState(false)
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const fileInputRef = useRef(null)
  const processingRef = useRef(false)
  const intervalRef = useRef(null)

  // Capture frame from video and send to API
  const captureAndDetect = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || processingRef.current) return
    
    processingRef.current = true
    setIsProcessing(true)
    const startTime = Date.now()
    
    try {
      const video = videoRef.current
      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      
      // Set canvas to 640x640 for API
      canvas.width = 640
      canvas.height = 640
      
      // Calculate crop to maintain aspect ratio and center
      const videoAspect = video.videoWidth / video.videoHeight
      let sx = 0, sy = 0, sWidth = video.videoWidth, sHeight = video.videoHeight
      
      if (videoAspect > 1) {
        sWidth = video.videoHeight
        sx = (video.videoWidth - sWidth) / 2
      } else {
        sHeight = video.videoWidth
        sy = (video.videoHeight - sHeight) / 2
      }
      
      ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 640, 640)
      
      // Convert to blob
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8))
      
      // Create FormData and send to API
      const formData = new FormData()
      formData.append('file', blob, 'frame.jpg')
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) throw new Error('Detection failed')
      
      const result = await response.json()
      setDetections(result.detections || [])
      setError(null)
      setLastProcessTime(Date.now() - startTime)
    } catch (err) {
      setError(err.message)
    } finally {
      processingRef.current = false
      setIsProcessing(false)
    }
  }, [])

  // Start camera stream
  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        streamRef.current = stream
        setCameraActive(true)
        setError(null)
      }
    } catch (err) {
      console.error('Camera access error:', err)
      setError('Camera access denied. Please allow camera permissions.')
    }
  }, [])

  // Stop camera stream
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setCameraActive(false)
    setDetections([])
  }, [])

  // Handle mode changes
  useEffect(() => {
    if (mode === 'live') {
      startCamera()
    } else {
      stopCamera()
    }
    
    return () => stopCamera()
  }, [mode, startCamera, stopCamera])

  // Set up detection interval for live mode
  useEffect(() => {
    if (cameraActive && mode === 'live') {
      // Initial detection after a short delay to ensure video is ready
      const timeout = setTimeout(() => {
        captureAndDetect()
      }, 1000)
      
      // Set up interval (MIN_DETECTION_INTERVAL minimum, or longer if API is slow)
      intervalRef.current = setInterval(() => {
        captureAndDetect()
      }, Math.max(MIN_DETECTION_INTERVAL, lastProcessTime + PROCESSING_BUFFER))
      
      return () => {
        clearTimeout(timeout)
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [cameraActive, mode, captureAndDetect, lastProcessTime])

  // Handle image upload
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsLoading(true)
    setError(null)
    
    // Show preview
    const reader = new FileReader()
    reader.onload = (e) => setImagePreview(e.target.result)
    reader.readAsDataURL(file)
    
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await fetch(API_URL, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) throw new Error('Detection failed')
      
      const result = await response.json()
      setDetections(result.detections || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setIsLoading(false)
    }
  }

  // Get color for detection class
  const getClassColor = (className) => {
    const normalizedClass = className?.toLowerCase()
    return CLASS_COLORS[normalizedClass] || { bg: 'rgba(156, 163, 175, 0.3)', border: '#9ca3af', text: '#d1d5db' }
  }

  // Render bounding boxes
  const renderBoundingBoxes = () => {
    return detections.map((det, idx) => {
      const colors = getClassColor(det.class)
      // Assuming detection format: { class, confidence, bbox: [x1, y1, x2, y2] } or similar
      const bbox = det.bbox || det.box || [det.x1, det.y1, det.x2, det.y2]
      if (!bbox || bbox.length < 4) return null
      
      const [x1, y1, x2, y2] = bbox
      const confidence = det.confidence || det.score || 0
      
      return (
        <div
          key={idx}
          className="absolute pointer-events-none transition-all duration-200"
          style={{
            left: `${(x1 / 640) * 100}%`,
            top: `${(y1 / 640) * 100}%`,
            width: `${((x2 - x1) / 640) * 100}%`,
            height: `${((y2 - y1) / 640) * 100}%`,
            backgroundColor: colors.bg,
            border: `2px solid ${colors.border}`,
            borderRadius: '4px',
          }}
        >
          <div
            className="absolute -top-6 left-0 px-2 py-0.5 text-xs font-bold rounded whitespace-nowrap"
            style={{ backgroundColor: colors.border, color: '#fff' }}
          >
            {det.class} {(confidence * 100).toFixed(1)}%
          </div>
        </div>
      )
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            ✊ ✋ ✌️ RPS AI
          </h1>
          <p className="text-slate-400 text-lg">Real-time Rock Paper Scissors Detection</p>
        </header>

        {/* Mode Selection */}
        {mode === 'select' && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 border border-slate-700/50 shadow-2xl">
              <h2 className="text-2xl font-bold text-white mb-6 text-center">Choose Input Mode</h2>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Live Feed Option */}
                <button
                  onClick={() => setMode('live')}
                  className="group relative overflow-hidden bg-gradient-to-br from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/30 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-cyan-500/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 to-blue-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  <div className="text-5xl mb-4">📹</div>
                  <h3 className="text-xl font-bold text-white mb-2">Live Camera Feed</h3>
                  <p className="text-slate-400 text-sm">Real-time detection from your camera with continuous analysis every 3 seconds</p>
                </button>

                {/* Image Upload Option */}
                <button
                  onClick={() => setMode('image')}
                  className="group relative overflow-hidden bg-gradient-to-br from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 border border-purple-500/30 rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg hover:shadow-purple-500/20"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-400 to-pink-500 opacity-0 group-hover:opacity-10 transition-opacity"></div>
                  <div className="text-5xl mb-4">🖼️</div>
                  <h3 className="text-xl font-bold text-white mb-2">Upload Image</h3>
                  <p className="text-slate-400 text-sm">Upload a single image for one-time hand gesture detection</p>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Feed Mode */}
        {mode === 'live' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 shadow-2xl">
              {/* Back button */}
              <button
                onClick={() => setMode('select')}
                className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>←</span> Back to selection
              </button>

              {/* Video container - nearly half screen */}
              <div className="relative aspect-square max-h-[50vh] mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Bounding box overlay */}
                <div className="absolute inset-0">
                  {renderBoundingBoxes()}
                </div>
                {/* Loading indicator */}
                {isProcessing && (
                  <div className="absolute top-4 right-4">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full animate-ping"></div>
                  </div>
                )}
                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />
              </div>

              {/* Status bar */}
              <div className="mt-4 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-4">
                  <div className={`flex items-center gap-2 ${cameraActive ? 'text-green-400' : 'text-red-400'}`}>
                    <div className={`w-2 h-2 rounded-full ${cameraActive ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></div>
                    {cameraActive ? 'Camera Active' : 'Camera Inactive'}
                  </div>
                  {lastProcessTime > 0 && (
                    <span className="text-slate-500 text-sm">Last: {lastProcessTime}ms</span>
                  )}
                </div>
                {error && (
                  <p className="text-red-400 text-sm">{error}</p>
                )}
              </div>

              {/* Detections display */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-white mb-3">Detections</h3>
                {detections.length === 0 ? (
                  <p className="text-slate-500">No gestures detected. Show rock, paper, or scissors to the camera!</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {detections.map((det, idx) => {
                      const colors = getClassColor(det.class)
                      return (
                        <div
                          key={idx}
                          className="p-4 rounded-xl border backdrop-blur-sm"
                          style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-2xl">
                              {det.class?.toLowerCase() === 'rock' ? '✊' : det.class?.toLowerCase() === 'paper' ? '✋' : det.class?.toLowerCase() === 'scissors' ? '✌️' : '❓'}
                            </span>
                            <div className="text-right">
                              <div className="font-bold text-white capitalize">{det.class}</div>
                              <div className="text-sm" style={{ color: colors.text }}>
                                {((det.confidence || det.score || 0) * 100).toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Image Upload Mode */}
        {mode === 'image' && (
          <div className="max-w-4xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-6 border border-slate-700/50 shadow-2xl">
              {/* Back button */}
              <button
                onClick={() => {
                  setMode('select')
                  setImagePreview(null)
                  setDetections([])
                }}
                className="mb-4 flex items-center gap-2 text-slate-400 hover:text-white transition-colors"
              >
                <span>←</span> Back to selection
              </button>

              {/* Upload area */}
              {!imagePreview && (
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-2xl p-12 text-center transition-colors">
                    <div className="text-6xl mb-4">📤</div>
                    <p className="text-white text-lg mb-2">Click to upload an image</p>
                    <p className="text-slate-500 text-sm">Supports JPG, PNG, WebP</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}

              {/* Image preview with bounding boxes */}
              {imagePreview && (
                <div className="space-y-4">
                  <div className="relative aspect-square max-h-[50vh] mx-auto bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
                    <img
                      src={imagePreview}
                      alt="Uploaded"
                      className="w-full h-full object-contain"
                    />
                    {/* Bounding box overlay */}
                    <div className="absolute inset-0">
                      {renderBoundingBoxes()}
                    </div>
                    {/* Loading overlay */}
                    {isLoading && (
                      <div className="absolute inset-0 bg-slate-900/70 flex items-center justify-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                          <p className="text-white">Analyzing...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Upload new button */}
                  <div className="flex justify-center">
                    <button
                      onClick={() => {
                        setImagePreview(null)
                        setDetections([])
                        if (fileInputRef.current) fileInputRef.current.value = ''
                      }}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold rounded-xl transition-all hover:scale-105"
                    >
                      Upload New Image
                    </button>
                  </div>

                  {/* Detections display */}
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Detections</h3>
                    {error && (
                      <p className="text-red-400 mb-3">{error}</p>
                    )}
                    {detections.length === 0 && !isLoading ? (
                      <p className="text-slate-500">No gestures detected in this image.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {detections.map((det, idx) => {
                          const colors = getClassColor(det.class)
                          return (
                            <div
                              key={idx}
                              className="p-4 rounded-xl border backdrop-blur-sm"
                              style={{ backgroundColor: colors.bg, borderColor: colors.border }}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-2xl">
                                  {det.class?.toLowerCase() === 'rock' ? '✊' : det.class?.toLowerCase() === 'paper' ? '✋' : det.class?.toLowerCase() === 'scissors' ? '✌️' : '❓'}
                                </span>
                                <div className="text-right">
                                  <div className="font-bold text-white capitalize">{det.class}</div>
                                  <div className="text-sm" style={{ color: colors.text }}>
                                    {((det.confidence || det.score || 0) * 100).toFixed(1)}%
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <footer className="mt-12 text-center text-slate-500 text-sm">
          <p>Powered by ONNX Runtime • Deployed on Render</p>
        </footer>
      </div>
    </div>
  )
}

export default App
