
# Product Requirements Document (PRD)
# Abang Colek: Fruit Slicer (AR Arcade Edition)

| **Version** | 1.0 |
| :--- | :--- |
| **Status** | Active |
| **Product Type** | Web-based AR Game / AI Tech Demo |
| **Tech Stack** | React, Vite, MediaPipe, Google Gemini API, Web Audio API |

---

## 1. Executive Summary

**Abang Colek** is a browser-based augmented reality (AR) arcade game that transforms the user's webcam feed into an interactive play area. Using computer vision, the user's hand becomes a virtual blade to slice falling fruits.

What sets this application apart is the integration of the **Flash Engine (Google Gemini 3 Flash)**. An AI "Sensei" continuously observes the gameplay, analyzing screenshots in real-time to provide context-aware tactical advice, technique improvements, and encouragement, blending traditional arcade mechanics with Generative AI coaching.

## 2. Problem Statement & Goals

### 2.1 Problem
*   Traditional browser games often lack physical interactivity.
*   AI in games is usually pre-programmed logic (NPCs) rather than generative, context-aware reasoning.
*   "Fruit Ninja" style games usually require touchscreens or mouse input, lacking the immersion of physical movement.

### 2.2 Goals
*   **Immersion**: Create a seamless 60FPS AR experience where the digital and physical worlds align.
*   **Innovation**: Demonstrate the speed and multimodal capabilities of Gemini 3 Flash for real-time game commentary.
*   **Accessibility**: Run entirely in the browser without external hardware (VR headsets/controllers).
*   **Performance**: Maintain a lightweight footprint by synthesizing audio and procedural assets rather than loading heavy files.

## 3. User Personas

*   **The Casual Gamer**: Wants a quick, fun distraction during breaks. Appreciates the "Abang Colek" (Street Vendor) aesthetic.
*   **The Tech Enthusiast**: Interested in seeing how MediaPipe and LLMs can function together in a real-time web app.
*   **The Competitive Player**: Wants to achieve the "Diamond" rank and maximize high-score efficiency.

## 4. Functional Requirements

### 4.1 Gameplay Mechanics
*   **Hand Tracking**: The system must track the user's hand (specifically landmark 8 - Index Finger Tip) using MediaPipe Hands.
*   **The Blade**: A visual trail must follow the user's finger. A "swoosh" sound must play when the movement velocity exceeds a specific threshold.
*   **Spawning**: Fruits spawn from the bottom of the screen with varying velocities and rotation speeds.
*   **Slicing Physics**: 
    *   A slice is registered when the blade line segment intersects with a fruit's bounding circle.
    *   Fruits must split visually (rendering two clipped halves) and fall away.
    *   Particles (juice) must explode at the point of impact.
*   **Game Loop**:
    *   **Start Screen**: Instruction & Call to Action.
    *   **Play State**: 60-second timer.
    *   **Game Over**: Final score display and rank calculation.

### 4.2 Game Entities (Fruits)
| Type | Visual Color | Points | Behavior |
| :--- | :--- | :--- | :--- |
| **Guava** | Green (#4CAF50) | 10 | Common, slow moving. |
| **Mango** | Gold (#FFC107) | 20 | Standard speed. |
| **Pineapple** | Yellow (#FFEB3B) | 50 | Larger, faster fall speed. |
| **Sweet Mango** | Red-Orange (#FF5722) | 150 | Rare (7% spawn rate), high velocity. |

### 4.3 AI Sensei (Gemini Integration)
*   **Trigger**: The system sends a game screenshot (compressed JPEG) to Gemini 3 Flash when specific conditions are met (e.g., specific spawn intervals or user request).
*   **Context**: The prompt must include current score, active fruit list, and game rules.
*   **Output**: The AI must return a JSON object containing:
    *   `message`: A short, punchy coaching tip.
    *   `rationale`: Why this tip was given.
    *   `priorityFruit`: Which fruit type to focus on.
    *   `techniqueTip`: Physical movement advice.
*   **Latency**: The UI must handle "Thinking" states without freezing the game loop.

### 4.4 Audio System
*   **Technology**: Web Audio API (No external assets).
*   **SFX**:
    *   *Swoosh*: Filtered white noise.
    *   *Slice*: Sawtooth oscillator + low-pass noise.
    *   *Level Up*: Major Arpeggio.
    *   *Game Over*: Diminished run + Kick drum.
*   **Controls**: Global Mute toggle.

## 5. Non-Functional Requirements

*   **Privacy**: Webcam data must be processed locally via MediaPipe. Only screenshots (game canvas) are sent to Gemini; no raw video stream is stored or transmitted.
*   **Performance**: The game loop must maintain 60FPS. AI requests must be asynchronous and non-blocking.
*   **Responsiveness**: The canvas must resize to fit the container.
*   **Error Handling**: If the camera is denied, a clear, user-friendly error message ("Akses kamera ditolak") must be displayed with reload instructions.

## 6. User Interface (UI) & UX

### 6.1 Visual Style
*   **Theme**: Cyber-Arcade meets Indonesian Street Vendor ("Abang Colek").
*   **Palette**: Dark Mode (Background #0a0a0a) with Neon Accents (Cyan #03A9F4, Yellow #FFD700).
*   **Typography**: `Roboto` with bold, italicized, uppercase headers for high impact.

### 6.2 HUD Elements
*   **Top Left**: "Abang Colek" branding.
*   **Left Sidebar**: 
    *   **Sensei Box**: Displays dynamic AI text. Changes border color based on priority fruit.
    *   **Real-time Data**: Current Level, Debug view (optional).
    *   **Vision**: Small thumbnail of what the AI "saw" (for transparency).
*   **Top Overlay**: Score, Timer, Level Indicator.

### 6.3 Feedback Systems
*   **Visual**: Screen shake or flash on level up. Floating text for points is not currently implemented but score updates immediately.
*   **Audio**: Immediate feedback on interaction.

## 7. Technical Architecture

### 7.1 Component Hierarchy
*   `App.tsx`: Root container.
*   `GeminiFruitSlicer.tsx`: The "God Component".
    *   Manages `useRef` for physics state (mutable, no re-render).
    *   Manages `useState` for UI (score, text).
    *   Handles `requestAnimationFrame` loop.
    *   Manages `navigator.mediaDevices.getUserMedia`.
*   `services/geminiService.ts`: Stateless service for API calls.
*   `services/soundService.ts`: Singleton class for audio context management.

### 7.2 External Dependencies
*   **@mediapipe/hands**: Hand tracking model.
*   **@google/genai**: Gemini API client.
*   **lucide-react**: Iconography.
*   **TailwindCSS**: Styling engine.

## 8. Future Roadmap

*   **v1.1**: Add "Bomb" fruits that deduct points.
*   **v1.2**: Voice Mode - Allow the user to shout "Start" or ask Sensei questions via microphone (Live API).
*   **v2.0**: Multiplayer - Compare scores with a friend side-by-side.

---
*End of Document*
