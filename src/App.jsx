import { useState, useRef } from 'react'
import './App.css'

const API_URL = 'https://rps-ai-sf3w.onrender.com/detect'

const CLASS_COLORS = {
  diaphragm: { bg: 'rgba(59, 130, 246, 0.2)', border: '#3b82f6', text: '#93c5fd' },
  heart: { bg: 'rgba(239, 68, 68, 0.2)', border: '#ef4444', text: '#fca5a5' },
  left_lobe: { bg: 'rgba(34, 197, 94, 0.2)', border: '#22c55e', text: '#86efac' },
  right_lobe: { bg: 'rgba(168, 85, 247, 0.2)', border: '#a855f7', text: '#d8b4fe' },
}

const CLASS_ICONS = {
  diaphragm: '〰️',
  heart: '❤️',
  left_lobe: '◀️',
  right_lobe: '▶️',
}

function App() {
  const [detections, setDetections] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  
  const fileInputRef = useRef(null)

  const handleImageUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    
    setIsLoading(true)
    setError(null)
    setDetections([])
    
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

  const getClassColor = (className) => {
    const normalizedClass = className?.toLowerCase()
    return CLASS_COLORS[normalizedClass] || { bg: 'rgba(156, 163, 175, 0.3)', border: '#9ca3af', text: '#d1d5db' }
  }

  const getClassIcon = (className) => {
    const normalizedClass = className?.toLowerCase()
    return CLASS_ICONS[normalizedClass] || '🔍'
  }

  const renderBoundingBoxes = () => {
    return detections.map((det, idx) => {
      const colors = getClassColor(det.class)
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
    <div className="min-h-screen bg-neutral-950">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-900 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-900 rounded-full mix-blend-multiply filter blur-3xl opacity-15 animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-red-900 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-black text-white mb-2">
            🩻 CXR AI
          </h1>
          <p className="text-neutral-400 text-lg">Chest X-Ray Analysis</p>
        </header>

        <div className="max-w-4xl mx-auto">
          <div className="bg-neutral-900/70 backdrop-blur-xl rounded-3xl p-6 border border-neutral-700/50 shadow-2xl">
            
            {!imagePreview && (
              <label className="block cursor-pointer">
                <div className="border-2 border-dashed border-neutral-600 hover:border-blue-500 rounded-2xl p-12 text-center transition-colors">
                  <div className="text-6xl mb-4">🩻</div>
                  <p className="text-white text-lg mb-2">Click to upload a Chest X-Ray</p>
                  <p className="text-neutral-500 text-sm">Supports JPG, PNG, WebP</p>
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

            {imagePreview && (
              <div className="space-y-4">
                <div className="relative aspect-square max-h-[60vh] mx-auto bg-neutral-950 rounded-2xl overflow-hidden border border-neutral-700">
                  <img
                    src={imagePreview}
                    alt="Uploaded X-Ray"
                    className="w-full h-full object-contain"
                  />
                  <div className="absolute inset-0">
                    {renderBoundingBoxes()}
                  </div>
                  {isLoading && (
                    <div className="absolute inset-0 bg-neutral-950/70 flex items-center justify-center">
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-white">Analyzing X-Ray...</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex justify-center">
                  <button
                    onClick={() => {
                      setImagePreview(null)
                      setDetections([])
                      setError(null)
                      if (fileInputRef.current) fileInputRef.current.value = ''
                    }}
                    className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all hover:scale-105"
                  >
                    Upload New X-Ray
                  </button>
                </div>

                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-white mb-3">Detected Structures</h3>
                  {error && (
                    <p className="text-red-400 mb-3">{error}</p>
                  )}
                  {detections.length === 0 && !isLoading ? (
                    <p className="text-neutral-500">No structures detected in this image.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {detections.map((det, idx) => {
                        const colors = getClassColor(det.class)
                        const icon = getClassIcon(det.class)
                        return (
                          <div
                            key={idx}
                            className="p-4 rounded-xl border backdrop-blur-sm bg-neutral-800/50"
                            style={{ borderColor: colors.border }}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-2xl">{icon}</span>
                              <div className="text-right">
                                <div className="font-bold text-white capitalize" style={{ color: colors.text }}>
                                  {det.class?.replace('_', ' ')}
                                </div>
                                <div className="text-sm text-neutral-400">
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

                <div className="mt-6 p-4 bg-neutral-800/30 rounded-xl">
                  <h4 className="text-sm font-semibold text-neutral-400 mb-3">Detection Classes</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(CLASS_COLORS).map(([className, colors]) => (
                      <div key={className} className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: colors.border }}
                        ></div>
                        <span className="text-xs text-neutral-400 capitalize">
                          {className.replace('_', ' ')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <footer className="mt-12 text-center text-neutral-500 text-sm">
          <p>Powered by ONNX Runtime | Deployed on Render</p>
        </footer>
      </div>
    </div>
  )
}

export default App
