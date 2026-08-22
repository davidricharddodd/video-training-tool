import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import Replicate from "replicate";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import os from "os";
import path from "path";

const execPromise = promisify(exec);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files from 'public' directory
app.use(express.static("public"));

// In-memory job status store
const jobs = new Map();

// Configure Multer memory storage for custom avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max limit
  },
});

// Helper to get media duration using ffprobe
async function getDuration(mediaPath) {
  const { stdout } = await execPromise(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`
  );
  return parseFloat(stdout.trim());
}

// Helper to loop video if it is shorter than target audio
async function loopVideoIfNeeded(videoSource, targetDuration) {
  const duration = await getDuration(videoSource);
  console.log(`[Video Prep] Video duration: ${duration}s, Target audio duration: ${targetDuration}s`);
  
  if (targetDuration <= duration) {
    console.log(`[Video Prep] Video is long enough. No looping needed.`);
    return videoSource;
  }

  const N = Math.ceil(targetDuration / duration) - 1;
  console.log(`[Video Prep] Looping video ${N} times to match target duration...`);

  const tempOutputDir = os.tmpdir();
  const tempOutputFile = path.join(tempOutputDir, `looped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`);
  
  await execPromise(
    `ffmpeg -y -stream_loop ${N} -i "${videoSource}" -c copy "${tempOutputFile}"`
  );
  
  console.log(`[Video Prep] Loop complete. Temporary file: ${tempOutputFile}`);
  return tempOutputFile;
}

// Helper to clean up temporary files
function cleanUpTempFiles(paths) {
  for (const filePath of paths) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Cleanup] Deleted temporary file: ${filePath}`);
      }
    } catch (err) {
      console.error(`[Cleanup] Failed to delete file: ${filePath}`, err);
    }
  }
}

app.post("/api/generate", upload.single("avatarFile"), async (req, res) => {
  try {
    const { text, voice, avatarType, avatarPreset, avatarUrl, customToken, lipsyncEngine } = req.body;

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

    // 2. Resolve Initial Avatar Video source
    let rawVideoPath;
    let tempFilesToCleanup = [];

    if (avatarType === "upload") {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: "Avatar video file upload is selected, but no file was uploaded.",
        });
      }
      // Save uploaded buffer to a temporary file for ffmpeg processing
      const tempUploadDir = os.tmpdir();
      const tempUploadPath = path.join(tempUploadDir, `upload_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`);
      fs.writeFileSync(tempUploadPath, req.file.buffer);
      rawVideoPath = tempUploadPath;
      tempFilesToCleanup.push(tempUploadPath);
    } else if (avatarType === "url") {
      if (!avatarUrl || avatarUrl.trim() === "") {
        return res.status(400).json({
          success: false,
          error: "Custom video URL is selected, but no URL was provided.",
        });
      }
      rawVideoPath = avatarUrl;
    } else {
      // Preset Selection
      const presetUrls = {
        preset_female_1: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo1_video.mp4",
        preset_male_1: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo2_video.mp4",
        preset_female_2: "https://raw.githubusercontent.com/bytedance/LatentSync/main/assets/demo3_video.mp4",
        preset_female_3: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/tys/gt.mp4",
        preset_speaker_4: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/short_case/10/gt.mp4",
        preset_speaker_5: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/3/gt.mp4",
        preset_speaker_6: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/5/gt.mp4",
        preset_speaker_7: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/7/gt.mp4",
        preset_speaker_8: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/9/gt.mp4",
        preset_speaker_9: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/11/gt.mp4",
        preset_speaker_10: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/13/gt.mp4",
        preset_speaker_11: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/15/gt.mp4",
        preset_speaker_12: "https://raw.githubusercontent.com/tencent-ailab/V-Express/main/test_samples/vasa-1/l5/gt.mp4"
      };
      rawVideoPath = presetUrls[avatarPreset] || presetUrls.preset_female_1;
    }

    // Generate jobId
    const jobId = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

    // Initialize job status
    jobs.set(jobId, {
      status: "processing",
      step: "tts",
      progress: 30,
      audioUrl: null,
      videoUrl: null,
      error: null
    });

    // Automatically clean up job after 1 hour to prevent memory leaks
    setTimeout(() => {
      jobs.delete(jobId);
    }, 60 * 60 * 1000);

    // Respond immediately with the jobId
    res.status(200).json({
      success: true,
      jobId: jobId
    });

    // Run the generation pipeline asynchronously in the background
    (async () => {
      try {
        console.log(`[Job ${jobId}] Step 1/2: Generating audio via Kokoro-82M TTS...`);
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

        const audioUrl = audioOutput.toString();
        console.log(`[Job ${jobId}] Step 1/2 complete. Audio URL: ${audioUrl}`);

        // Update job status to latentsync step
        jobs.set(jobId, {
          status: "processing",
          step: "latentsync",
          progress: 70,
          audioUrl: audioUrl,
          videoUrl: null,
          error: null
        });

        // 3. Process video input based on engine selection
        let finalVideoInput;
        let videoUrl;

        if (lipsyncEngine === "sync_lipsync_2" || lipsyncEngine === "sync_lipsync_2_pro") {
          const modelPath = lipsyncEngine === "sync_lipsync_2_pro" ? "sync/lipsync-2-pro" : "sync/lipsync-2";
          
          if (rawVideoPath.startsWith("http://") || rawVideoPath.startsWith("https://")) {
            finalVideoInput = rawVideoPath;
          } else {
            finalVideoInput = fs.readFileSync(rawVideoPath);
          }

          console.log(`[Job ${jobId}] Step 2/2: Generating lip-sync video via Sync Labs (${modelPath})...`);
          const videoOutput = await replicate.run(
            modelPath,
            {
              input: {
                video: finalVideoInput,
                audio: audioUrl,
                sync_mode: "loop"
              },
            }
          );
          videoUrl = videoOutput.toString();
          console.log(`[Job ${jobId}] Step 2/2 complete. Video URL: ${videoUrl}`);

          // Cleanup temporary files
          cleanUpTempFiles(tempFilesToCleanup);

        } else {
          // Default: LatentSync
          console.log(`[Job ${jobId}] Inspecting media durations for loop matching...`);
          const audioDuration = await getDuration(audioUrl);
          const processedVideoPath = await loopVideoIfNeeded(rawVideoPath, audioDuration);

          if (processedVideoPath.startsWith("http://") || processedVideoPath.startsWith("https://")) {
            finalVideoInput = processedVideoPath;
          } else {
            finalVideoInput = fs.readFileSync(processedVideoPath);
            tempFilesToCleanup.push(processedVideoPath); // Queue for cleanup
          }

          console.log(`[Job ${jobId}] Step 2/2: Generating lip-sync video via LatentSync...`);
          const videoOutput = await replicate.run(
            "bytedance/latentsync:637ce1919f807ca20da3a448ddc2743535d2853649574cd52a933120e9b9e293",
            {
              input: {
                video: finalVideoInput,
                audio: audioUrl,
              },
            }
          );
          videoUrl = videoOutput.toString();
          console.log(`[Job ${jobId}] Step 2/2 complete. Video URL: ${videoUrl}`);

          // Cleanup temporary files
          cleanUpTempFiles(tempFilesToCleanup);
        }

        // Update job to completed status
        jobs.set(jobId, {
          status: "completed",
          step: "done",
          progress: 100,
          audioUrl: audioUrl,
          videoUrl: videoUrl,
          error: null
        });

      } catch (error) {
        console.error(`[Job ${jobId}] Pipeline failed:`, error);
        cleanUpTempFiles(tempFilesToCleanup);
        jobs.set(jobId, {
          status: "failed",
          step: "error",
          progress: 0,
          audioUrl: null,
          videoUrl: null,
          error: error.message || "Generation failed."
        });
      }
    })();

  } catch (error) {
    console.error("Pipeline generation failed initiation:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during the video generation process.",
    });
  }
});

// Get job status endpoint
app.get("/api/jobs/:id", (req, res) => {
  const jobId = req.params.id;
  const job = jobs.get(jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Job not found or expired.",
    });
  }
  return res.status(200).json({
    success: true,
    job: job
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` AI Video Training Tool Server Running on Port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your browser`);
  console.log(`==================================================`);
});
