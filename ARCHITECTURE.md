
# System Architecture: Abang Fruit Ninja

## 1. High-Level Overview

Abang Fruit Ninja is a **Hybrid Client-Cloud Application**.
*   **Client (Browser)**: Handles the "Fast Loop" (60 FPS) including rendering, physics, input tracking, and audio synthesis.
*   **Cloud (Google)**: Handles the "Slow Loop" (Asynchronous) including visual analysis and strategy generation via LLM.

```mermaid
graph TD
    User[User Hand Movement] -->|Webcam| MediaPipe[MediaPipe Hands (Local)]
    MediaPipe -->|Landmarks| GameLoop[Game Loop (React/Canvas)]
    
    subgraph "Fast Loop (60 FPS)"
        GameLoop -->|Update| Physics[Physics Engine]
        Physics -->|Collision?| State[Game State (Score/Lives)]
        State -->|Render| Canvas[HTML5 Canvas]
        State -->|Trigger| Audio[Web Audio API]
    end
    
    subgraph "Slow Loop (Async)"
        Canvas -->|Snapshot (Base64)| GeminiClient[@google/genai SDK]
        State -->|Context Data| GeminiClient
        GeminiClient -->|API Call| GeminiCloud[Google Gemini 3 Flash]
        GeminiCloud -->|JSON Strategy| UI[React UI Overlay]
    end
```

## 2. Core Components

### 2.1 The "God Component" (`GeminiFruitSlicer.tsx`)
Because this is a canvas-based game within React, specific architectural patterns are used to avoid React's render cycle overhead:
*   **Refs (`useRef`)**: Used for all high-frequency mutable data (Fruit positions, Particle arrays, Blade trail). modifying these does *not* trigger a React re-render.
*   **State (`useState`)**: Used only for UI overlays (Score, Game Over screen, Hints).
*   **Loop**: Driven by `requestAnimationFrame` implicitly via the MediaPipe `onResults` callback.

### 2.2 Input Pipeline (Computer Vision)
*   **Library**: `@mediapipe/hands`.
*   **Configuration**:
    *   `maxNumHands`: 1 (Single player).
    *   `modelComplexity`: 1 (Balanced for speed/accuracy).
*   **Normalization**: Coordinates returned are 0.0-1.0. These are mapped to `canvas.width` and `canvas.height`.

### 2.3 The AI Pipeline (`geminiService.ts`)
This service acts as the bridge between the game state and the LLM.
1.  **Capture**: An offscreen canvas draws the current game frame.
2.  **Compression**: Converted to `image/jpeg` at 0.6 quality to reduce payload size.
3.  **Prompt Engineering**: A structured system prompt injects the game rules and scoring values into the context.
4.  **Schema**: The model is instructed to return `application/json` to ensure the frontend can parse the "Priority Fruit" programmatically.

### 2.4 Audio Engine (`soundService.ts`)
A singleton class wrapper around `AudioContext`.
*   **Oscillators**: Used for tonal sounds (Music, Slice tone).
*   **Buffers**: Noise buffers generated programmatically on init (used for explosions/swooshes).
*   **Gain Nodes**: Handle volume ramping (Envelopes) for realistic decay.

## 3. Data Flow & State Management

### 3.1 Physics Loop
The physics integration is **Euler-based**:
```typescript
velocity_y += gravity;
position_x += velocity_x;
position_y += velocity_y;
```
*   **Time Step**: Tied to screen refresh rate (typically 16ms).
*   **Collision**: Line-Segment to Circle intersection.
    *   Line: `(LastHandPos, CurrentHandPos)`
    *   Circle: `(FruitPos, Radius)`

### 3.2 Difficulty Curve
Difficulty is algorithmic, calculated locally:
*   **Spawn Rate**: `Math.max(300, INITIAL_SPAWN_INTERVAL - (level * 60))`
*   **Bomb Chance**: `Math.min(0.35, 0.05 + ((level - 3) * 0.015))` (Starts at Level 3).

## 4. Security & Environment

*   **API Keys**: Managed via `process.env.API_KEY` (Standard for Google GenAI SDK).
*   **Vercel Deployment**: Environment variables must be set in the Vercel Dashboard.
*   **CORS**: Not applicable as MediaPipe loads models from CDN and Gemini API handles standard web requests.

## 5. Experimental Modules

*   **Slingshot Mode**: The codebase contains `GeminiSlingshot.tsx`. This is an alternative game mode using the same AI/CV architecture but different physics (Elastic/Projectile). It is currently decoupled from the main entry point.
