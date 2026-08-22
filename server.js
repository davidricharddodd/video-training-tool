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

// Ensure public/uploads directory exists
if (!fs.existsSync("public/uploads")) {
  fs.mkdirSync("public/uploads", { recursive: true });
}

// In-memory job status store
const jobs = new Map();

// Lightweight JSON-based database for session/run history
class HistoryDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.history = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        this.history = JSON.parse(data);
      } else {
        this.save();
      }
    } catch (err) {
      console.error("[HistoryDB] Failed to initialize:", err);
      this.history = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.history, null, 2), "utf-8");
    } catch (err) {
      console.error("[HistoryDB] Failed to save history:", err);
    }
  }

  addOrUpdate(id, record) {
    const idx = this.history.findIndex(item => item.id === id);
    if (idx !== -1) {
      this.history[idx] = { ...this.history[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
      this.history.unshift({
        id,
        createdAt: new Date().toISOString(),
        ...record
      });
    }
    this.save();
  }

  getAll() {
    return this.history;
  }
}

const dbPath = path.join("public", "uploads", "history.json");
const db = new HistoryDB(dbPath);

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

import https from "https";

// Helper to download remote file to local path
function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(destPath, () => reject(err));
    });
  });
}

// Automatically resolve Kokoro language codes based on voice profile prefixes
function getLanguageCode(voice) {
  if (!voice) return "a";
  if (voice.startsWith("af_") || voice.startsWith("am_")) return "a"; // American English
  if (voice.startsWith("bf_") || voice.startsWith("bm_")) return "b"; // British English
  if (voice.startsWith("es_")) return "e"; // Spanish
  if (voice.startsWith("fr_")) return "f"; // French
  if (voice.startsWith("jf_")) return "j"; // Japanese
  if (voice.startsWith("zf_")) return "z"; // Mandarin Chinese
  return "a";
}

// Splits script text into smaller sentence-sized chunks (<250 chars) and pause durations
function splitTextIntoChunks(text, maxChars = 250) {
  const regex = /\[pause\s+(\d+(?:\.\d+)?)]/g;
  let match;
  let rawParts = [];
  let lastIndex = 0;

  while ((match = regex.exec(text)) !== null) {
    const textPart = text.substring(lastIndex, match.index);
    if (textPart) {
      rawParts.push({ type: "text", content: textPart });
    }
    const duration = parseFloat(match[1]);
    rawParts.push({ type: "pause", duration });
    lastIndex = regex.lastIndex;
  }
  const remainingText = text.substring(lastIndex);
  if (remainingText) {
    rawParts.push({ type: "text", content: remainingText });
  }

  let finalParts = [];
  for (const part of rawParts) {
    if (part.type === "pause") {
      finalParts.push(part);
      continue;
    }

    // Split text by paragraphs first
    const lines = part.content.split(/\n+/);
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) continue;

      // If line is short, add it directly
      if (trimmedLine.length <= maxChars) {
        finalParts.push({ type: "text", content: trimmedLine });
        continue;
      }

      // Split long line by sentences (., !, ?)
      const sentences = trimmedLine.match(/[^.!?]+[.!?]*/g) || [trimmedLine];
      let currentChunk = "";

      for (let sentence of sentences) {
        sentence = sentence.trim();
        if (!sentence) continue;

        if ((currentChunk + " " + sentence).trim().length <= maxChars) {
          currentChunk = (currentChunk + " " + sentence).trim();
        } else {
          if (currentChunk) {
            finalParts.push({ type: "text", content: currentChunk });
          }
          currentChunk = sentence;
        }
      }
      if (currentChunk) {
        finalParts.push({ type: "text", content: currentChunk });
      }
    }
  }
  return finalParts;
}

// Route 1: Generate Audio Preview (supporting custom [pause X.X] markers and long-form scripts)
app.post("/api/generate-audio", async (req, res) => {
  try {
    console.log(`[Audio Generation Request] Received body:`, req.body);
    const { text, voice, customToken } = req.body;

    const apiToken = customToken || process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: "Replicate API Token is missing.",
      });
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Text script cannot be empty.",
      });
    }

    const replicate = new Replicate({ auth: apiToken });
    const resolvedLang = getLanguageCode(voice);
    console.log(`[Audio Generation] Resolved language code: "${resolvedLang}" for voice: "${voice}"`);

    // Parse and split text into sentence-sized segments and pauses
    const parts = splitTextIntoChunks(text, 250);
    console.log(`[Audio Generation] Script split into ${parts.length} segments.`);

    // Generate output jobId
    const audioJobId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const outputFilename = `audio-${audioJobId}.wav`;
    const finalOutputPath = path.join("public", "uploads", outputFilename);

    // If there is only one short text chunk, execute a single quick TTS call
    if (parts.length === 1 && parts[0].type === "text") {
      console.log(`[Audio Generation] Short text detected. Running single TTS generation...`);
      const audioOutput = await replicate.run(
        "alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5",
        {
          input: {
            text: text,
            voice: voice || "af_bella",
            speed: 1.0,
            language_code: resolvedLang
          },
        }
      );
      const audioUrl = audioOutput.toString();
      await downloadFile(audioUrl, finalOutputPath);

      // Save to database history
      db.addOrUpdate(audioJobId, {
        text: text,
        voice: voice || "af_bella",
        audioUrl: `/uploads/${outputFilename}`,
        videoUrl: null,
        lipsyncEngine: null,
        avatarPreset: null,
        status: "audio_preview"
      });

      return res.status(200).json({
        success: true,
        audioUrl: `/uploads/${outputFilename}`,
        filename: outputFilename
      });
    }

    // Process parts sequentially to construct the stitched audio
    console.log(`[Audio Generation] Processing ${parts.length} segments sequentially...`);
    const tempOutputDir = os.tmpdir();
    const segmentFiles = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const segmentFile = path.join(tempOutputDir, `seg_${audioJobId}_${i}.wav`);
      
      if (part.type === "text") {
        console.log(`[Audio Generation] Generating TTS chunk ${i + 1}/${parts.length}: "${part.content.substring(0, 40)}..."`);
        const audioOutput = await replicate.run(
          "alphanumericuser/kokoro-82m:89b6fa84e4fa2dd6bd3a96be3e1f12827a3516c9fda8fddbac7a0be131c9a6f5",
          {
            input: {
              text: part.content,
              voice: voice || "af_bella",
              speed: 1.0,
              language_code: resolvedLang
            },
          }
        );
        const audioUrl = audioOutput.toString();
        await downloadFile(audioUrl, segmentFile);
        segmentFiles.push(segmentFile);
      } else if (part.type === "pause") {
        console.log(`[Audio Generation] Injecting ${part.duration}s silence chunk ${i + 1}/${parts.length}...`);
        await execPromise(
          `ffmpeg -y -f lavfi -i anullsrc=r=24000:cl=mono -t ${part.duration} "${segmentFile}"`
        );
        segmentFiles.push(segmentFile);
      }
    }

    // Merge segment files using ffmpeg complex filter
    console.log(`[Audio Generation] Merging ${segmentFiles.length} segments...`);
    let ffmpegArgs = [];
    let filterInputs = "";
    for (let i = 0; i < segmentFiles.length; i++) {
      ffmpegArgs.push(`-i "${segmentFiles[i]}"`);
      filterInputs += `[${i}:a]`;
    }
    const filterComplex = `"${filterInputs}concat=n=${segmentFiles.length}:v=0:a=1[a]"`;
    await execPromise(
      `ffmpeg -y ${ffmpegArgs.join(" ")} -filter_complex ${filterComplex} -map "[a]" "${finalOutputPath}"`
    );

    // Cleanup temp segment files
    cleanUpTempFiles(segmentFiles);

    console.log(`[Audio Generation] Merge complete. Output saved to: ${finalOutputPath}`);

    // Save to database history
    db.addOrUpdate(audioJobId, {
      text: text,
      voice: voice || "af_bella",
      audioUrl: `/uploads/${outputFilename}`,
      videoUrl: null,
      lipsyncEngine: null,
      avatarPreset: null,
      status: "audio_preview"
    });

    return res.status(200).json({
      success: true,
      audioUrl: `/uploads/${outputFilename}`,
      filename: outputFilename
    });

  } catch (error) {
    console.error("Audio generation failed:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during audio generation.",
    });
  }
});

// Route 2: Generate Lip-Synced Video using Approved Audio
app.post("/api/generate-video", upload.single("avatarFile"), async (req, res) => {
  try {
    const { audioFilename, avatarType, avatarPreset, avatarUrl, customToken, lipsyncEngine } = req.body;

    const apiToken = customToken || process.env.REPLICATE_API_TOKEN;
    if (!apiToken) {
      return res.status(400).json({
        success: false,
        error: "Replicate API Token is missing.",
      });
    }

    if (!audioFilename) {
      return res.status(400).json({
        success: false,
        error: "Approved audio filename is missing.",
      });
    }

    const replicate = new Replicate({ auth: apiToken });

    // 1. Resolve Audio File input
    const localAudioPath = path.join("public", "uploads", audioFilename);
    if (!fs.existsSync(localAudioPath)) {
      return res.status(400).json({
        success: false,
        error: "Audio file not found on server.",
      });
    }

    // Read audio file as a Buffer (so Replicate client uploads it automatically)
    const audioBuffer = fs.readFileSync(localAudioPath);

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

    // Resolve database history job ID (maps video to the original audio record)
    const audioJobIdMatch = audioFilename.match(/audio-(.+)\.wav/);
    const dbJobId = audioJobIdMatch ? audioJobIdMatch[1] : jobId;

    // Update history DB to reflect starting video generation stage
    db.addOrUpdate(dbJobId, {
      lipsyncEngine: lipsyncEngine,
      avatarType: avatarType,
      avatarPreset: avatarPreset || null,
      status: "video_generating"
    });

    // Initialize job status
    jobs.set(jobId, {
      status: "processing",
      step: "latentsync", // Start directly on the lip-sync step since audio is already generated!
      progress: 60,
      audioUrl: `/uploads/${audioFilename}`,
      videoUrl: null,
      error: null
    });

    // Automatically clean up job after 1 hour
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
        let finalVideoInput;
        let videoUrl;

        // Sync Labs
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
                audio: audioBuffer, // Pass local audio buffer directly
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
          const audioDuration = await getDuration(localAudioPath);
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
                audio: audioBuffer, // Pass local audio buffer directly
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
          audioUrl: `/uploads/${audioFilename}`,
          videoUrl: videoUrl,
          error: null
        });

        // Update history DB to reflect completed run
        db.addOrUpdate(dbJobId, {
          videoUrl: videoUrl,
          status: "completed"
        });

      } catch (error) {
        console.error(`[Job ${jobId}] Video generation failed:`, error);
        cleanUpTempFiles(tempFilesToCleanup);
        jobs.set(jobId, {
          status: "failed",
          step: "error",
          progress: 0,
          audioUrl: `/uploads/${audioFilename}`,
          videoUrl: null,
          error: error.message || "Video generation failed."
        });

        // Update history DB to reflect failure
        db.addOrUpdate(dbJobId, {
          status: "failed",
          error: error.message
        });
      }
    })();
  } catch (error) {
    console.error("Video generation failed initiation:", error);
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

// Get history endpoint
app.get("/api/history", (req, res) => {
  return res.status(200).json({
    success: true,
    history: db.getAll()
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(` AI Video Training Tool Server Running on Port ${PORT}`);
  console.log(` Open http://localhost:${PORT} in your browser`);
  console.log(`==================================================`);
});
