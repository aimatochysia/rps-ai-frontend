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

@app.post("/detect")
async def detect(file: UploadFile = File(...)):
    img = Image.open(file.file).convert("RGB")
    img = np.array(img).transpose(2, 0, 1) / 255.0
    img = img[None].astype(np.float32)
    # IMPORTANT: The ONNX model expects the input tensor to be named "images"
    outputs = session.run(None, {"images": img})
    return {"detections": outputs[0].tolist()}
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
