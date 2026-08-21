# AI Video Training Tool

This is a web application that takes a text prompt (script) and generates a training video with a human-realistic avatar speaking the script. It works by combining a Text-To-Speech (TTS) engine and an audio-conditioned lip-sync model hosted on Replicate.

## Features

1. **Text to Audio (Speech Synthesis)**: Uses the ultra-fast and natural **Kokoro-82M** TTS model.
2. **Lip-Sync Engine**: Uses **LatentSync** by ByteDance to synchronize a front-facing avatar video to the generated audio track.
3. **Avatar Selection**:
   - Use the high-quality pre-configured preset avatar video.
   - Enter a custom public video URL.
   - Upload your own front-facing MP4 video file.
4. **Interactive Dashboard**: Real-time logging console, step-by-step progress bars, and an HTML5 video playback/download interface.

## Prerequisites

- **Node.js** (v18 or higher recommended)
- **Replicate API Token**: Create an account and get a token at [Replicate Settings](https://replicate.com/account). Note: Running these models requires billing/credit on your Replicate account.

## Setup Instructions

1. **Configure Environment Variables**:
   Open the `.env` file in the project directory and verify/add your Replicate API Token:
   ```env
   PORT=3000
   REPLICATE_API_TOKEN=your_replicate_token_here
   ```

2. **Install Dependencies**:
   Navigate to the project directory in your terminal and run:
   ```bash
   npm install
   ```

3. **Start the Server**:
   Launch the Express server:
   ```bash
   npm start
   ```

4. **Access the App**:
   Open your browser and navigate to:
   ```
   http://localhost:3000
   ```

## Development and Structure

- `server.js`: The Express backend handling Replicate integration, Multer file upload stream, and the generation pipeline.
- `public/index.html`: The interface styled with Tailwind CSS.
- `public/app.js`: Client-side logic that manages states, updates progress meters, and prints console logs in the UI.

## Troubleshooting

- **429 Rate Limits / Free Tier**: If you see a `429 Throttle` error in the logs, it means your Replicate token has free tier limits. Add a payment method on Replicate or wait a few seconds and try again.
- **402 Insufficient Credit**: Replicate requires active billing credits to run GPU-based models. Ensure your Replicate account has a positive balance.
- **Avatar Uploads**: Ensure your uploaded videos are MP4 files under 100MB, front-facing, and feature a single speaker with their mouth closed at the start for optimal synchronization.
