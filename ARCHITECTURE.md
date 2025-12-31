
# Architecture Documentation: Abang Colek

## 1. System Overview

**Abang Colek** is a client-side, browser-based Augmented Reality (AR) arcade game. It combines real-time computer vision with generative AI to create an interactive experience where the user's physical hand movements control digital game elements.

The system operates on a hybrid architecture:
1.  **Local Loop (Real-time)**: Physics, rendering, and hand tracking run entirely in the browser at 60 FPS.
2.  **Cloud Loop (Asynchronous)**: Game state analysis and coaching run via the Google Gemini API.

## 2. High-Level Diagram

```mermaid
graph TD
    User[User] -->|Webcam Feed| Browser[Browser / Client App]
    User -->|Audio Output| Browser
    
    subgraph Client ["Client Side (React + Vite)"]
        MP[MediaPipe Hands] -->|Landmarks (x,y)| GameEngine[Game Engine / Canvas]
        GameEngine -->|Render| UI[User Interface]
        GameEngine -->|Trigger| Audio[Sound Service (Web Audio API)]
        GameEngine -->|Capture Frame| AIService[Gemini Service]
    end
    
    subgraph Cloud ["Google Cloud"]
        AIService -->|Image + Context| Gemini[Gemini 3 Flash API]
        Gemini -->|JSON Strategy| AIService
    end
```

## 3. Core Components

### 3.1. The Game Engine (`GeminiFruitSlicer.tsx`)
This is the "God Component" that manages the entire lifecycle of the application. It does not use a standard game engine (like Phaser) but instead implements a custom game loop using React `refs` and HTML5 Canvas.

*   **State Management**: Uses `useRef` for high-frequency mutable state (fruit positions, particles, blade trail) to avoid React re-render overhead. Uses `useState` only for UI updates (score, game over screens, AI hints).
*   **Physics Engine**: A simple Euler integration physics system handling gravity, velocity, and rotation.
*   **Collision Detection**: Implements line-segment-to-circle collision detection to determine when the "blade" (hand trail) intersects with fruit.

### 3.2. Computer Vision Integration (`MediaPipe`)
The app utilizes `@mediapipe/hands` loaded via CDN.
*   **Input**: Raw video stream from `<video>` element.
*   **Processing**: Runs inference on every animation frame.
*   **Output**: Normalized coordinates (0.0 to 1.0) of 21 hand landmarks.
*   **Mapping**: The app specifically tracks Landmark 8 (Index Finger Tip) to render the slicing blade.

### 3.3. AI "Sensei" Service (`geminiService.ts`)
This module handles communication with the Google Gemini API.
*   **Trigger**: The game loop triggers an analysis request based on specific game events or intervals.
*   **Payload**:
    1.  A base64 compressed JPEG screenshot of the current canvas.
    2.  Metadata about active fruits (types, positions).
    3.  Current score.
*   **Model**: Uses `gemini-3-flash-preview` for low-latency multimodal reasoning.
*   **Output**: Structured JSON containing "Sensei" advice, tactical rationale, and debug info.

### 3.4. Audio Synthesis (`soundService.ts`)
Instead of loading static MP3/WAV assets, the application synthesizes sound in real-time using the **Web Audio API**.
*   **Benefits**: Zero network latency for assets, extremely small bundle size, dynamic pitch/volume modulation.
*   **Implementation**:
    *   *Swoosh*: Bandpass-filtered white noise with automated gain ramps.
    *   *Slice*: Sawtooth oscillator mixed with low-passed noise.
    *   *Music/Stings*: Oscillators playing specific frequencies (arpeggios).

## 4. Data Flow Pipelines

### 4.1. The Rendering Loop
1.  **MediaPipe** calls `onResults` callback.
2.  **Canvas Clear**: The 2D context is cleared.
3.  **Video Draw**: The webcam feed is drawn to the canvas (mirrored).
4.  **Update Physics**: Fruit and particle positions are updated based on velocity and gravity.
5.  **Collision Check**: The vector between the last two hand positions is checked against all active fruits.
6.  **Draw Entities**: Fruits, particles, and the blade trail are rendered.
7.  **Overlay UI**: React renders the HTML HUD over the canvas.

### 4.2. The AI Analysis Loop
1.  **Capture**: An offscreen canvas draws the current frame and converts it to a Data URL (JPEG, 0.6 quality).
2.  **Send**: `GoogleGenAI` client sends the image + text prompt.
3.  **Reasoning**: Gemini analyzes the visual density of fruits and the player's score.
4.  **Feedback**: The response is parsed, and the React state `senseiHint` is updated, displaying the text on the HUD.

## 5. Technical Decisions & Trade-offs

| Decision | Choice | Rationale |
| :--- | :--- | :--- |
| **Rendering** | HTML5 Canvas 2D | Lightweight, sufficient for 2D sprites, easy to overlay on video. WebGL/Three.js was deemed overkill for 2D slicing. |
| **State** | `useRef` vs `useState` | `useRef` is mutable and doesn't trigger re-renders. This is crucial for the 60FPS game loop to prevent React reconciliation lag. |
| **AI Model** | Gemini 3 Flash | Chosen for speed. The game is fast-paced; waiting for a larger model (Pro) would make the advice stale by the time it arrives. |
| **Assets** | Programmatic Generation | Sound and Visuals (UI) are largely generated via code/CSS to keep the repository lightweight and self-contained. |

## 6. Directory Structure

*   `src/components/`: React UI components and the main game canvas.
*   `src/services/`: Singleton services for external logic (AI, Audio).
*   `src/types.ts`: Shared TypeScript interfaces for strict typing of Game Entities and API Responses.
*   `src/App.tsx`: Root layout and component mounting.
