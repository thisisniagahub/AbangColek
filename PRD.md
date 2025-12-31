
# Product Requirements Document (PRD)
# Abang Fruit Ninja 🥭⚔️

| **Version** | 1.1 |
| :--- | :--- |
| **Status** | Production Ready |
| **Product Type** | Web-based AR Game / GenAI Tech Demo |
| **Tech Stack** | React 19, Vite, MediaPipe, Google Gemini 3 Flash, Web Audio API |

---

## 1. Executive Summary

**Abang Fruit Ninja** is a high-fidelity, browser-based Augmented Reality (AR) arcade game. It leverages computer vision to transform the user's webcam feed into an interactive canvas where their physical hand movements act as a digital blade.

The core differentiator is the integration of **Google Gemini 3 Flash** as an AI "Sensei". Unlike static game hints, this AI analyzes real-time gameplay screenshots to provide context-aware tactical advice, psychological encouragement, and technique optimization, creating a unique "Human-AI" feedback loop.

## 2. Problem Statement & Goals

### 2.1 The Problem
*   **Static Gameplay**: Browser games often feel disconnected from the physical world.
*   **Dumb NPCs**: In-game "mentors" usually cycle through pre-written text regardless of player performance.
*   **Hardware Barrier**: AR experiences usually require expensive headsets or app installations.

### 2.2 The Solution
*   **Zero-Setup AR**: Runs instantly in a web browser using standard webcams.
*   **Multimodal AI**: Uses an LLM that "sees" the game state to give relevant advice.
*   **Engagement**: Combines physical activity with arcade dopamine loops (combos, sounds, visuals).

## 3. User Personas

1.  **The Casual Player**: Wants a fun, 60-second distraction. Enjoys the colorful "Abang" (Indonesian street vendor) aesthetic.
2.  **The Tech Developer**: Interested in the implementation of `gemini-3-flash-preview` for real-time video analysis and `@mediapipe` for hand tracking.
3.  **The High Scorer**: Obsessed with maximizing efficiency, specifically targeting high-value fruits (Sweet Mango) and avoiding Bombs.

## 4. Functional Requirements

### 4.1 Core Gameplay
*   **Hand Tracking**:
    *   Must track the user's **Index Finger Tip** (Landmark 8) via MediaPipe.
    *   Must render a visual "Blade Trail" following the finger coordinates.
    *   Must calculate velocity to trigger "Swoosh" sound effects.
*   **Fruit Mechanics**:
    *   **Spawning**: Fruits launch from the bottom of the screen with randomized X/Y velocity and rotation.
    *   **Gravity**: All entities must obey a gravity constant (`0.38`).
    *   **Slicing**: A slice occurs when the blade line segment intersects a fruit's radius.
    *   **Visuals**: Fruits must separate into Top/Bottom sprites upon slicing.
*   **Entities**:
    *   **Fruits**: Guava (10pts), Mango (20pts), Pineapple (50pts), Sweet Mango (150pts).
    *   **Hazards**: "Spicy Bottle" (Bomb) - Deducts 1 life and causes screen shake.
*   **Progression**:
    *   **Leveling**: Level increases based on score thresholds.
    *   **Difficulty**: Spawn rate increases and Bomb probability rises (1.5% per level) as the game progresses.

### 4.2 AI Sensei (Gemini Integration)
*   **Trigger**: The game captures a canvas snapshot (JPEG, 0.6 quality) during gameplay.
*   **Input**: Image + Text Context (Score, Active Fruits List).
*   **Processing**: Sent to `gemini-3-flash-preview`.
*   **Output**: JSON object containing:
    *   `message`: The Sensei's dialogue.
    *   `priorityFruit`: Which fruit the player should target next.
*   **Performance**: AI processing must be non-blocking to the 60FPS render loop.

### 4.3 Audio System
*   **Synthesis**: Use Web Audio API for all sounds (no external MP3s).
*   **Effects**:
    *   Slice (Sawtooth wave + Noise).
    *   Bomb (Low freq oscillator + distortion).
    *   Level Up (Arpeggio).

## 5. Non-Functional Requirements

*   **Privacy**: Webcam data is processed entirely client-side (Edge AI) via MediaPipe. Only discrete screenshots are sent to Gemini API; no continuous video stream is recorded.
*   **Performance**: Game loop must maintain 60 FPS on standard laptops/phones.
*   **Latency**: AI response time should aim for <1.5s (facilitated by Gemini Flash).
*   **Responsiveness**: HUD must adapt to mobile and desktop aspect ratios.

## 6. UI/UX Design

*   **Theme**: Dark Mode (`#050505`) with Neon Accents.
*   **HUD**:
    *   **Top Bar**: Hearts (Lives), Score, Level, Timer.
    *   **Center Overlay**: "Sensei Hint" box that glows the color of the priority fruit.
    *   **Game Over**: High contrast modal with Rank (Novice to Grandmaster).

## 7. Roadmap

*   **v1.0 (Current)**: Core Slicer, Gemini Sensei, Local Scoring.
*   **v1.1**: "Slingshot" Minigame Module (Experimental code exists).
*   **v1.2**: Leaderboards using Firebase.
*   **v2.0**: Multiplayer Duel Mode (WebRTC).

