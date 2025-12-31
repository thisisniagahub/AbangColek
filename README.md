
# Abang Fruit Ninja 🥭⚔️

**Abang Fruit Ninja** is an immersive, arcade-style fruit slicing game powered by **Google Gemini 3 Flash** and **MediaPipe Hand Tracking**.

Play as the "Tukang Colek" (The Slicer) using your actual hand movements captured via webcam. Slice fruits, build combos, and receive real-time tactical advice from an AI Sensei that analyzes your gameplay style.

## 🌟 Features

*   **👋 Hands-Free Gameplay**: Uses computer vision (MediaPipe) to track your hand. Your index finger becomes the blade!
*   **🧠 AI Sensei (Gemini 3 Flash)**: An integrated AI analyzes game screenshots in real-time to provide strategic advice, technique tips, and encouragement based on the fruits on screen.
*   **🔊 Synthesized Audio**: Custom-built sound engine using the Web Audio API for retro-arcade sound effects (slicing, swooshing, combos, game over) without external assets.
*   **🍎 Dynamic Fruit Physics**: Gravity-based physics engine with particle explosions and combo detection.
*   **🏆 Progression System**: Dynamic scoring, level-ups, and medal ranks (Bronze to Diamond).
*   **🎨 Arcade Aesthetics**: Stylized visuals, retro fonts, and smooth animations powered by Tailwind CSS.

## 🛠️ Tech Stack

*   **Framework**: React 19 + Vite
*   **Language**: TypeScript
*   **Styling**: Tailwind CSS
*   **AI**: Google GenAI SDK (`@google/genai`) - Model: `gemini-3-flash-preview`
*   **Computer Vision**: MediaPipe Hands & Camera Utils
*   **Audio**: Web Audio API (Native browser synthesis)

## 🚀 Getting Started

### Prerequisites

*   Node.js (v18 or higher)
*   A webcam connected to your computer.
*   A Google Gemini API Key. You can get one at [aistudio.google.com](https://aistudio.google.com).

### Installation

1.  **Clone the repository** (if applicable) or download the source.

2.  **Install dependencies**:
    ```bash
    npm install
    ```

3.  **Configure Environment Variables**:
    *   The application requires an API Key to power the Gemini Sensei feature.
    *   Set your `API_KEY` in your environment (e.g., via `.env` file or shell export).
    *   *Note: In the current setup, the API key is expected to be available via `process.env.API_KEY`.*

### Running the App

Start the development server:

```bash
npm run dev
```

Open your browser (usually `http://localhost:5173`) and allow camera permissions when prompted.

## 🎮 How to Play

1.  **Stand back**: Ensure your webcam can see your hand clearly.
2.  **Start Game**: Hover or click "Mulai Motong".
3.  **Slice**: Move your hand across the screen. Your index finger controls the blade trail.
4.  **Score**:
    *   **Guava**: 10 pts
    *   **Mango**: 20 pts
    *   **Pineapple**: 50 pts
    *   **Sweet Mango**: 150 pts (Rare!)
5.  **Avoid Gravity**: Don't let fruits fall unsliced (currently, the game ends on a timer, but efficiency matters!).
6.  **Listen to Sensei**: Watch the "Petuah Sensei" box for AI-generated tips based on your current performance.

## 📂 Project Structure

*   `src/components/GeminiFruitSlicer.tsx`: Main game logic, rendering loop, and MediaPipe integration.
*   `src/services/geminiService.ts`: Handles communication with the Google Gemini API for game analysis.
*   `src/services/soundService.ts`: Audio synthesizer for game SFX.
*   `src/types.ts`: TypeScript definitions for game entities.

## 📄 License

Apache-2.0

---

*Powered by Google Gemini API*
