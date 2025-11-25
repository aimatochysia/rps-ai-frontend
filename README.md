# RPS AI Frontend

A React application for real-time Rock Paper Scissors detection using camera feed or image upload.

## Features

- **Live Camera Feed**: Real-time detection with continuous analysis every 3 seconds
- **Image Upload**: Upload images for one-time gesture detection
- **Visual Bounding Boxes**: Display detection results with colored bounding boxes

## Getting Started

```bash
npm install
npm run dev
```

## Backend API Requirements

This frontend connects to a backend API at `/detect` endpoint that runs an ONNX model for gesture detection.

### Expected Response Format

The frontend expects detections in this format:

```json
{
  "detections": [
    { "class": "rock", "confidence": 0.95, "bbox": [x1, y1, x2, y2] },
    { "class": "paper", "confidence": 0.87, "bbox": [x1, y1, x2, y2] }
  ]
}
```

### Backend Code Example

```python
import onnxruntime as ort
from fastapi import FastAPI, File, UploadFile
import numpy as np
from PIL import Image
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

session = ort.InferenceSession("rps_ai.onnx")
CLASS_NAMES = ["rock", "paper", "scissors"]
CONFIDENCE_THRESHOLD = 0.5

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img = Image.open(file.file).convert("RGB")
    img = img.resize((640, 640))
    img_array = np.array(img).transpose(2, 0, 1) / 255.0
    img_array = img_array[None].astype(np.float32)
    
    # IMPORTANT: The ONNX model expects the input tensor to be named "images"
    outputs = session.run(None, {"images": img_array})
    
    # Post-process YOLO output: shape is typically (1, num_classes + 4, num_detections)
    # where first 4 values are x_center, y_center, width, height
    predictions = outputs[0][0]  # Remove batch dimension
    
    detections = []
    # Transpose to (num_detections, num_classes + 4) for easier processing
    predictions = predictions.T
    
    for pred in predictions:
        x_center, y_center, width, height = pred[:4]
        class_scores = pred[4:]
        
        class_id = np.argmax(class_scores)
        confidence = class_scores[class_id]
        
        if confidence >= CONFIDENCE_THRESHOLD:
            # Convert from center format to corner format
            x1 = x_center - width / 2
            y1 = y_center - height / 2
            x2 = x_center + width / 2
            y2 = y_center + height / 2
            
            detections.append({
                "class": CLASS_NAMES[class_id],
                "confidence": float(confidence),
                "bbox": [float(x1), float(y1), float(x2), float(y2)]
            })
    
    return {"detections": detections}
```

> **Note**: The ONNX model's input tensor is named `"images"`. Using `"input"` will result in the error:
> `ValueError: Required inputs (['images']) are missing from input feed (['input']).`

## Tech Stack

- React 19
- Vite 7
- Tailwind CSS 4

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
