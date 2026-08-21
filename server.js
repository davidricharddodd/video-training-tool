import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import Replicate from "replicate";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static("public"));

// Configure Multer memory storage for custom avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max limit
  },
});

// Main generate endpoint
app.post("/api/generate", upload.single("avatarFile"), async (req, res) => {
  try {
    const { text, voice, avatarType, avatarPreset, avatarUrl, customToken } = req.body;

    // 1. Resolve Replicate API Token
    const apiToken = customToken || process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: "Replicate API Token is missing. Provide it in .env or via client UI.",
      });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Text script cannot be empty.",
      });
    }

    // Initialize Replicate client dynamically for this request
    const replicate = new Replicate({ auth: apiToken });

    // 2. Resolve Avatar Video input
    let videoInput;
    if (avatarType === "upload") {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Avatar video file upload is selected, but no file was uploaded.",
        });
      }
      // Pass the uploaded file as a Buffer (the Replicate Node client handles uploading this automatically)
      videoInput = req.file.buffer;
    } else if (avatarType === "url") {
      if (!avatarUrl || avatarUrl.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Custom video URL is selected, but no URL was provided.",
        });
      }
      videoInput = avatarUrl;
    } else {
      // Preset Selection
      const presetUrls = {
        preset_female_1: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo1_video.mp4",
        preset_male_1: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo2_video.mp4",
        preset_female_2: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo3_video.mp4"
      };
      videoInput = presetUrls[avatarPreset] || presetUrls.preset_female_1;
    }

    console.log(`[1/2] Generating audio via Kokoro-82M TTS...`);
    // Step 1: Run Kokoro TTS to generate speech audio
    // Model version pinned to stable: alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5
    const audioOutput = await replicate.run(
      "alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5",
      {
        input: {
          text: text,
          voice: voice || "af_bella",
          speed: 1.0,
        },
      }
    );

    // Audio output is a FileOutput from Replicate. We cast to string to get its URL.
    const audioUrl = audioOutput.toString();
    console.log(`[1/2] Audio generation complete. Audio URL: ${audioUrl}`);

    console.log(`[2/2] Generating lip-sync video via LatentSync...`);
    // Step 2: Run LatentSync lip-sync model
    // Model version pinned to stable: bytedance/latentsync:637ce1919f807ca20da3a448ddc2743535d2853649574cd52a933120e9b9e293
    const videoOutput = await replicate.run(
      "bytedance/latentsync:637ce1919f807ca20da3a448ddc2743535d2853649574cd52a933120e9b9e293",
      {
        input: {
          video: videoInput,
          audio: audioUrl,
        },
      }
    );

    const videoUrl = videoOutput.toString();
    console.log(`[2/2] Video generation complete. Video URL: ${videoUrl}`);

    return res.status(200).json({
      success: true,
      audioUrl: audioUrl,
      videoUrl: videoUrl,
    });

  } catch (error) {
    console.error("Pipeline generation failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during the video generation process.",
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` AI Video Training Tool Server Running on Port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your browser`);
  console.log(`==================================================`);
});
