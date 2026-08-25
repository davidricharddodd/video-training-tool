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

// Auth Middleware
app.use((req, res, next) => {
  // Allow login page, assets, and api login endpoint without authentication
  if (req.path === "/login" || req.path === "/api/login" || req.path === "/favicon.ico" || req.path.startsWith("/uploads/")) {
    return next();
  }

  const cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split("; ").map(c => {
    const parts = c.split("=");
    return [parts[0], parts.slice(1).join("=")];
  })) : {};

  const token = cookies.auth_token;
  const expectedPassword = process.env.APP_PASSWORD || "1234";
  const expectedToken = Buffer.from(`admin:${expectedPassword}`).toString("base64");

  if (token === expectedToken) {
    return next();
  }

  // Redirect to login page
  return res.redirect("/login");
});

// GET Login Page
app.get("/login", (req, res) => {
  const cookies = req.headers.cookie ? Object.fromEntries(req.headers.cookie.split("; ").map(c => {
    const parts = c.split("=");
    return [parts[0], parts.slice(1).join("=")];
  })) : {};
  const token = cookies.auth_token;
  const expectedPassword = process.env.APP_PASSWORD || "1234";
  const expectedToken = Buffer.from(`admin:${expectedPassword}`).toString("base64");

  if (token === expectedToken) {
    return res.redirect("/");
  }

  res.send(`
<!DOCTYPE html>
<html lang="en" class="h-full bg-slate-950 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Login | AI Video Training Tool</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="h-full flex items-center justify-center relative overflow-hidden font-sans">
  <!-- Neon Background Glows -->
  <div class="absolute top-1/4 left-1/4 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>
  <div class="absolute bottom-1/4 right-1/4 translate-x-1/2 translate-y-1/2 w-96 h-96 bg-fuchsia-600/10 rounded-full blur-[100px] pointer-events-none"></div>

  <div class="w-full max-w-md p-8 bg-slate-900/60 border border-slate-800/80 backdrop-blur-xl shadow-2xl rounded-2xl relative z-10 mx-4">
    <div class="flex flex-col items-center mb-8">
      <div class="h-12 w-12 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-900/30 mb-4">
        <svg class="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <h2 class="text-2xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">Welcome Back</h2>
      <p class="text-xs text-slate-500 mt-1 font-medium font-mono">admin @ AI Video Training Tool</p>
    </div>

    <form id="loginForm" class="space-y-4">
      <div>
        <label for="username" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Username</label>
        <input type="text" id="username" name="username" required 
          class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-all duration-200" />
      </div>

      <div>
        <label for="password" class="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
        <input type="password" id="password" name="password" required 
          class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-all duration-200" />
      </div>

      <div id="errorMessage" class="text-rose-400 text-xs font-semibold hidden text-center pt-1"></div>

      <button type="submit" class="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white font-semibold rounded-xl text-sm shadow-lg shadow-violet-950/20 hover:shadow-violet-500/10 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:ring-offset-slate-950 transition-all duration-200 flex items-center justify-center space-x-2">
        <span>Log In</span>
      </button>
    </form>
  </div>

  <script>
    const form = document.getElementById("loginForm");
    const errorMsg = document.getElementById("errorMessage");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      errorMsg.classList.add("hidden");
      
      const username = document.getElementById("username").value;
      const password = document.getElementById("password").value;

      try {
        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password })
        });
        const data = await response.json();

        if (response.ok && data.success) {
          // Set cookie manually
          document.cookie = "auth_token=" + data.token + "; path=/; max-age=86400; SameSite=Strict";
          window.location.href = "/";
        } else {
          errorMsg.textContent = data.error || "Invalid username or password.";
          errorMsg.classList.remove("hidden");
        }
      } catch (err) {
        errorMsg.textContent = "An error occurred. Please try again.";
        errorMsg.classList.remove("hidden");
      }
    });
  </script>
</body>
</html>
  `);
});

// POST Login API
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const expectedPassword = process.env.APP_PASSWORD || "1234";

  if (username === "admin" && password === expectedPassword) {
    const token = Buffer.from(`admin:${expectedPassword}`).toString("base64");
    return res.status(200).json({
      success: true,
      token: token
    });
  }

  return res.status(401).json({
    success: false,
    error: "Invalid username or password."
  });
});

// Serve static frontend files from 'public' directory
app.use(express.static("public"));

// Ensure public/uploads directory exists
if (!fs.existsSync("public/uploads")) {
  fs.mkdirSync("public/uploads", { recursive: true });
}

// In-memory job status store
const jobs = new Map();

// Helper to append progress logs to an active job
const addJobLog = (jobId, message) => {
  const job = jobs.get(jobId);
  if (job) {
    if (!job.logs) job.logs = [];
    const timestamp = new Date().toLocaleTimeString();
    job.logs.push(`[${timestamp}] ${message}`);
    console.log(`[Job ${jobId}] ${message}`);
  }
};

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

// Helper to apply branded background and logo watermarks using FFmpeg
function applyBrandingAndWatermark(inputVideoPath, bgPath, bgPresenterAlign, logoPath, logoPosition, outputVideoPath) {
  return new Promise((resolve, reject) => {
    if (!bgPath && !logoPath) {
      fs.copyFileSync(inputVideoPath, outputVideoPath);
      return resolve();
    }

    const inputs = [];
    const filterParts = [];
    let audioMap = "-map 0:a";

    if (bgPath) {
      inputs.push(`-i "${bgPath}"`);
      inputs.push(`-i "${inputVideoPath}"`);
      audioMap = "-map 1:a";

      let xPos = "W-w-100";
      if (bgPresenterAlign === "left") xPos = "100";
      else if (bgPresenterAlign === "center") xPos = "(W-w)/2";

      filterParts.push(`[0:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[bg]`);
      filterParts.push(`[1:v]scale=-2:1080[fg]`);
      
      if (logoPath) {
        inputs.push(`-i "${logoPath}"`);
        filterParts.push(`[bg][fg]overlay=x=${xPos}:y=(H-h)/2[tmp]`);
        filterParts.push(`[2:v]scale=180:-1[logo]`);
        
        let logoOverlay = "W-w-20:20";
        if (logoPosition === "top_left") logoOverlay = "20:20";
        else if (logoPosition === "bottom_right") logoOverlay = "W-w-20:H-h-20";
        else if (logoPosition === "bottom_left") logoOverlay = "20:H-h-20";

        filterParts.push(`[tmp][logo]overlay=${logoOverlay}[outv]`);
      } else {
        filterParts.push(`[bg][fg]overlay=x=${xPos}:y=(H-h)/2[outv]`);
      }
    } else if (logoPath) {
      inputs.push(`-i "${inputVideoPath}"`);
      inputs.push(`-i "${logoPath}"`);
      audioMap = "-map 0:a";

      filterParts.push(`[1:v]scale=180:-1[logo]`);
      
      let logoOverlay = "W-w-20:20";
      if (logoPosition === "top_left") logoOverlay = "20:20";
      else if (logoPosition === "bottom_right") logoOverlay = "W-w-20:H-h-20";
      else if (logoPosition === "bottom_left") logoOverlay = "20:H-h-20";

      filterParts.push(`[0:v][logo]overlay=${logoOverlay}[outv]`);
    }

    const filterComplex = `-filter_complex "${filterParts.join('; ')}" -map "[outv]" ${audioMap}`;
    const command = `ffmpeg -y ${inputs.join(' ')} ${filterComplex} -c:v libx264 -c:a aac -pix_fmt yuv420p "${outputVideoPath}"`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg branding error:", error);
        console.error("FFmpeg stderr:", stderr);
        return reject(error);
      }
      resolve();
    });
  });
}


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

    // Normalize line breaks and extra spaces within each text part
    const cleanContent = part.content.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();
    if (!cleanContent) continue;

    // If clean text is short, add it directly
    if (cleanContent.length <= maxChars) {
      finalParts.push({ type: "text", content: cleanContent });
      continue;
    }

    // Split long line by sentences (., !, ?)
    const sentences = cleanContent.match(/[^.!?]+[.!?]*/g) || [cleanContent];
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
  return finalParts;
}

// Helper to run Replicate prediction with automatic rate-limit retry pacing
async function runWithRetry(replicate, model, options, retries = 6, delay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      return await replicate.run(model, options);
    } catch (err) {
      const errStr = err.message || "";
      const isRateLimit = errStr.includes("429") || 
                          errStr.includes("throttled") || 
                          errStr.includes("rate limit") ||
                          errStr.includes("Requests");
      
      if (isRateLimit && i < retries - 1) {
        let waitTime = delay;
        const match = errStr.match(/retry_after":\s*(\d+)/) || 
                      errStr.match(/retry-after:\s*(\d+)/) || 
                      errStr.match(/in\s*~(\d+)s/);
        if (match) {
          waitTime = (parseInt(match[1]) * 1000) + 1000; // convert to ms + 1s safety buffer
        }
        console.warn(`[Rate Limit] Hit 429 rate limit. Retrying in ${waitTime}ms... (Attempt ${i + 1}/${retries})`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      throw err;
    }
  }
}

// Resolve the correct language-specific Fal.ai Kokoro endpoint
function getFalTtsEndpoint(voice) {
  if (!voice) return "fal-ai/kokoro";
  if (voice.startsWith("bf_") || voice.startsWith("bm_")) return "fal-ai/kokoro/british-english";
  if (voice.startsWith("es_")) return "fal-ai/kokoro/spanish";
  if (voice.startsWith("fr_")) return "fal-ai/kokoro/french";
  if (voice.startsWith("jf_")) return "fal-ai/kokoro/japanese";
  if (voice.startsWith("zf_")) return "fal-ai/kokoro/mandarin-chinese";
  return "fal-ai/kokoro";
}

// Helper to run Fal.ai TTS prediction using fal-ai/kokoro
async function runFalTTS(text, voice, apiKey, jobId = null) {
  const endpoint = getFalTtsEndpoint(voice);
  
  const payload = {
    voice: voice || "af_bella",
    speed: 1.0
  };

  if (endpoint === "fal-ai/kokoro") {
    payload.text = text;
  } else {
    payload.prompt = text; // Variant endpoints expect "prompt" instead of "text"
  }

  const queueInfo = await startFalPrediction(
    endpoint,
    payload,
    apiKey
  );
  const result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, apiKey, jobId);
  const audioUrl = result.audio ? result.audio.url : result.output;
  if (!audioUrl) {
    throw new Error(`Fal.ai TTS prediction (${endpoint}) did not return a valid audio URL.`);
  }
  return audioUrl;
}

// Route 1: Generate Audio Preview (supporting custom [pause X.X] markers and long-form scripts)
app.post("/api/generate-audio", async (req, res) => {
  let activeProvider = "replicate";
  try {
    console.log(`[Audio Generation Request] Received body:`, req.body);
    const { text, voice, customToken, customFalToken, lipsyncProvider } = req.body;

    activeProvider = lipsyncProvider || "replicate";
    let apiToken = "";
    if (activeProvider === "fal") {
      apiToken = customFalToken || process.env.FAL_KEY;
      if (!apiToken) {
        return res.status(400).json({
          success: false,
          error: "Fal.ai API Key is missing. Please enter it in Developer Settings or set FAL_KEY in Railway.",
        });
      }
    } else {
      apiToken = customToken || process.env.REPLICATE_API_TOKEN;
      if (!apiToken) {
        return res.status(400).json({
          success: false,
          error: "Replicate API Token is missing. Please enter it in Developer Settings or configure REPLICATE_API_TOKEN in Railway.",
        });
      }
    }

    if (!text || text.trim() === "") {
      return res.status(400).json({
        success: false,
        error: "Text script cannot be empty.",
      });
    }

    const replicate = activeProvider === "replicate" ? new Replicate({ auth: apiToken }) : null;
    const resolvedLang = getLanguageCode(voice);
    console.log(`[Audio Generation] Resolved language code: "${resolvedLang}" for voice: "${voice}" (Provider: ${activeProvider})`);

    // Parse and split text into sentence-sized segments and pauses (using larger 1000-char limits to prevent rate limits)
    const parts = splitTextIntoChunks(text, 1000);
    console.log(`[Audio Generation] Script split into ${parts.length} segments.`);

    // Generate output jobId
    const audioJobId = Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const outputFilename = `audio-${audioJobId}.wav`;
    const finalOutputPath = path.join("public", "uploads", outputFilename);

    // If there is only one short text chunk, execute a single quick TTS call
    if (parts.length === 1 && parts[0].type === "text") {
      console.log(`[Audio Generation] Short text detected. Running single TTS generation...`);
      let audioUrl = "";
      if (activeProvider === "fal") {
        audioUrl = await runFalTTS(text, voice, apiToken, audioJobId);
      } else {
        const audioOutput = await runWithRetry(
          replicate,
          "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
          {
            input: {
              text: text,
              voice: voice || "af_bella",
              speed: 1.0
            },
          }
        );
        audioUrl = audioOutput.toString();
      }
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
        let audioUrl = "";
        if (activeProvider === "fal") {
          audioUrl = await runFalTTS(part.content, voice, apiToken, audioJobId);
        } else {
          const audioOutput = await runWithRetry(
            replicate,
            "jaaari/kokoro-82m:f559560eb822dc509045f3921a1921234918b91739db4bf3daab2169b71c7a13",
            {
              input: {
                text: part.content,
                voice: voice || "af_bella",
                speed: 1.0
              },
            }
          );
          audioUrl = audioOutput.toString();
        }
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
    let errorMsg = error.message || "An unexpected error occurred during audio generation.";
    if (errorMsg.includes("TOP_UP") || errorMsg.includes("locked") || errorMsg.includes("403")) {
      errorMsg = "Your Fal.ai account is locked due to insufficient funds (TOP_UP required). Please log in to your Fal.ai dashboard to top up your balance.";
    } else if (activeProvider === "fal" && (errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("Unauthenticated") || errorMsg.includes("Key"))) {
      errorMsg = "Your Fal.ai API Key is invalid or expired. Please check your token in Developer Settings or set FAL_KEY in Railway.";
    } else if (activeProvider === "replicate" && (errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("Unauthenticated"))) {
      errorMsg = "Your Replicate API Token is invalid or expired. Please check your token in Developer Settings or configure REPLICATE_API_TOKEN in Railway.";
    }
    return res.status(500).json({
      success: false,
      error: errorMsg,
    });
  }
});

// Helper to start Fal.ai async queue prediction
async function startFalPrediction(endpointId, input, apiKey) {
  const url = `https://queue.fal.run/${endpointId}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Fal.ai API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  return {
    requestId: data.request_id,
    statusUrl: data.status_url,
    responseUrl: data.response_url
  };
}

// Helper to poll Fal.ai async queue prediction until completion
async function pollFalPrediction(statusUrl, responseUrl, apiKey, jobId = null) {
  let lastStatus = null;
  while (true) {
    const response = await fetch(statusUrl, {
      method: "GET",
      headers: {
        "Authorization": `Key ${apiKey}`
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Fal.ai status check error (${response.status}): ${errorText}`);
    }

    const statusData = await response.json();
    const status = statusData.status;

    if (status !== lastStatus) {
      if (jobId) {
        addJobLog(jobId, `Fal.ai Queue Status: ${status}`);
      } else {
        console.log(`[Fal.ai Queue] Status: ${status}`);
      }
      lastStatus = status;
    }

    if (status === "COMPLETED") {
      // The job already finished rendering on Fal's side at this point, so a transient
      // 5xx here (e.g. 504 downstream_service_unavailable) shouldn't sink an already-paid-for
      // result. Retry a few times with backoff before giving up.
      const maxAttempts = 5;
      let lastError;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const resultResponse = await fetch(responseUrl, {
          method: "GET",
          headers: {
            "Authorization": `Key ${apiKey}`
          }
        });

        if (resultResponse.ok) {
          return await resultResponse.json();
        }

        const errorText = await resultResponse.text();
        lastError = new Error(`Fal.ai result fetch error (${resultResponse.status}): ${errorText}`);

        // Only retry on server-side/transient errors; fail fast on 4xx (auth, bad request, etc.)
        if (resultResponse.status < 500 || attempt === maxAttempts) {
          throw lastError;
        }

        const backoffMs = 3000 * attempt;
        const msg = `Fal.ai result fetch failed (${resultResponse.status}), retrying in ${backoffMs / 1000}s... (attempt ${attempt}/${maxAttempts})`;
        if (jobId) {
          addJobLog(jobId, msg);
        } else {
          console.log(`[Fal.ai Queue] ${msg}`);
        }
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
      throw lastError;
    } else if (status === "FAILED") {
      throw new Error(statusData.error || "Fal.ai prediction failed.");
    }
    
    await new Promise(resolve => setTimeout(resolve, 3000));
  }
}

// Builds a prompt for generating a base avatar loop clip via text-to-video.
// The clip is a silent idle shot (mouth closed) since lip-sync is applied to it afterward,
// and the camera is explicitly locked off since the pipeline loops this clip via ffmpeg
// to match the audio duration - any camera drift or motion would make the loop jarring.
function buildAvatarGenerationPrompt(gender, framing, background) {
  const genderDesc = gender === "male"
    ? "a professional man in his 30s"
    : "a professional woman in her 30s";

  const framingDesc = framing === "standing"
    ? "Medium-wide shot, standing upright and facing the camera, visible from roughly the waist up, relaxed professional posture"
    : "Medium close-up shot, framed from the chest and shoulders up";

  const backgrounds = {
    office_modern: "a bright modern open-plan office with soft natural light and softly blurred desks in the background",
    office_executive: "an upscale executive office with a wooden desk, bookshelf, and a city skyline visible through a window, softly blurred",
    office_studio: "a clean neutral corporate studio backdrop with soft gradient lighting, subtly evoking a modern office setting"
  };
  const backgroundDesc = backgrounds[background] || backgrounds.office_modern;

  const prompt = `Photorealistic corporate video presenter, ${genderDesc}, facing directly into a static locked-off camera and making direct eye contact with the lens. ${framingDesc}. Positioned in ${backgroundDesc}. Mouth gently closed in a calm, neutral, professional resting expression - not speaking. Only subtle, natural idle movement: soft blinking, gentle breathing, a very slight relaxed head tilt or shift of weight, minimal natural hand movement if visible. Even, flattering studio-quality lighting with sharp focus on the face. The camera never pans, zooms, or moves. This is a stable base shot intended to loop seamlessly and have lip-sync animation added afterward, so the mouth must stay closed and relaxed throughout.`;

  const negative_prompt = "talking, open mouth, mouth moving, speaking, shouting, extreme facial expression, camera movement, panning, zooming, shaking, handheld camera, jump cuts, text, watermark, subtitles, blurry, distorted, deformed face, multiple people, cropped head, low quality";

  return { prompt, negative_prompt };
}

// Route: Generate a base avatar loop video (silent idle shot) via Fal.ai Kling text-to-video
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const { gender, framing, background, falToken } = req.body;

    const falApiKey = falToken || process.env.FAL_KEY;
    if (!falApiKey) {
      return res.status(400).json({
        success: false,
        error: "Fal.ai API key is missing. Please provide it in Developer Settings or configure FAL_KEY in Railway.",
      });
    }
    if (!gender || !framing) {
      return res.status(400).json({
        success: false,
        error: "Gender and framing are required.",
      });
    }

    const jobId = "avt" + Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    jobs.set(jobId, {
      status: "processing",
      step: "avatar_generation",
      progress: 10,
      videoUrl: null,
      error: null,
      logs: []
    });
    setTimeout(() => {
      jobs.delete(jobId);
    }, 60 * 60 * 1000);

    res.status(200).json({
      success: true,
      jobId: jobId
    });

    (async () => {
      try {
        const { prompt, negative_prompt } = buildAvatarGenerationPrompt(gender, framing, background);
        addJobLog(jobId, `Generating base avatar loop via Kling 2.5 Turbo Pro (Text-to-Video)...`);

        const queueInfo = await startFalPrediction(
          "fal-ai/kling-video/v2.5-turbo/pro/text-to-video",
          { prompt, negative_prompt, duration: "5", aspect_ratio: "16:9" },
          falApiKey
        );

        const result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
        const resultVideoUrl = result.video ? result.video.url : result.output;
        if (!resultVideoUrl) {
          throw new Error("Avatar generation did not return a valid video URL.");
        }

        addJobLog(jobId, `Downloading generated avatar clip...`);
        const outFilename = `avatar_${jobId}.mp4`;
        const outPath = path.join("public", "uploads", outFilename);
        await downloadFile(resultVideoUrl, outPath);

        const job = jobs.get(jobId);
        if (job) {
          job.status = "completed";
          job.progress = 100;
          job.videoUrl = `/uploads/${outFilename}`;
        }
        addJobLog(jobId, `Avatar generation complete: /uploads/${outFilename}`);
      } catch (err) {
        console.error("Avatar generation error:", err);
        const job = jobs.get(jobId);
        if (job) {
          job.status = "failed";
          job.error = err.message || "Avatar generation failed.";
        }
        addJobLog(jobId, `Avatar generation failed: ${err.message}`);
      }
    })();

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message || "An unexpected error occurred during avatar generation.",
    });
  }
});

// Route 2: Generate Lip-Synced Video using Approved Audio
app.post("/api/generate-video", upload.fields([
  { name: "avatarFile", maxCount: 1 },
  { name: "logoFile", maxCount: 1 },
  { name: "bgFile", maxCount: 1 }
]), async (req, res) => {
  try {
    const { audioFilename, avatarType, avatarPreset, avatarUrl, customToken, falToken, lipsyncProvider, lipsyncEngine, faceEnhancer, logoPosition, bgPresenterAlign } = req.body;
    const provider = lipsyncProvider || "replicate";
    const runFaceEnhancer = faceEnhancer === "true" || faceEnhancer === true;

    const apiToken = customToken || process.env.REPLICATE_API_TOKEN;
    if (provider === "replicate" && !apiToken) {
      return res.status(400).json({
        success: false,
        error: "Replicate API Token is missing.",
      });
    }
    if (runFaceEnhancer && provider === "replicate" && !apiToken) {
      return res.status(400).json({
        success: false,
        error: "Replicate API Token is required to run GFPGAN Face Restoration. Please provide it in Developer Settings or configure REPLICATE_API_TOKEN.",
      });
    }

    const falApiKey = falToken || process.env.FAL_KEY;
    if (provider === "fal" && !falApiKey) {
      return res.status(400).json({
        success: false,
        error: "Fal.ai API key is missing. Please provide it in Developer Settings or configure FAL_KEY in Railway.",
      });
    }
    if (runFaceEnhancer && provider === "fal" && !falApiKey) {
      return res.status(400).json({
        success: false,
        error: "Fal.ai API Key is required to run Topaz Video AI Face Enhancement. Please provide it in Developer Settings or configure FAL_KEY.",
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
    const host = req.get("host");
    const protocol = req.protocol;

    const avatarFile = req.files && req.files.avatarFile ? req.files.avatarFile[0] : null;
    const logoFile = req.files && req.files.logoFile ? req.files.logoFile[0] : null;
    const bgFile = req.files && req.files.bgFile ? req.files.bgFile[0] : null;

    let logoPath = null;
    if (logoFile) {
      const logoFilenameExt = logoFile.originalname.split(".").pop() || "png";
      const tempLogoFilename = `logo_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${logoFilenameExt}`;
      logoPath = path.join("public", "uploads", tempLogoFilename);
      fs.writeFileSync(logoPath, logoFile.buffer);
      tempFilesToCleanup.push(logoPath);
    }

    let bgPath = null;
    if (bgFile) {
      const bgFilenameExt = bgFile.originalname.split(".").pop() || "png";
      const tempBgFilename = `bg_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.${bgFilenameExt}`;
      bgPath = path.join("public", "uploads", tempBgFilename);
      fs.writeFileSync(bgPath, bgFile.buffer);
      tempFilesToCleanup.push(bgPath);
    }

    if (avatarType === "upload") {
      if (!avatarFile) {
        return res.status(400).json({
          success: false,
          error: "Avatar video file upload is selected, but no file was uploaded.",
        });
      }
      const uploadFilename = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
      const tempUploadPath = path.join("public", "uploads", uploadFilename);
      fs.writeFileSync(tempUploadPath, avatarFile.buffer);
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
        preset_female_1: "public/presets/female_1.mp4",
        preset_female_2: "public/presets/female_2.mp4",
        preset_female_3: "public/presets/female_3.mp4",
        preset_female_4: "public/presets/female_4.mp4",
        preset_female_5: "public/presets/female_5.mp4",
        preset_female_6: "public/presets/female_6.mp4",
        preset_male_1: "public/presets/male_1.mp4",
        preset_male_2: "public/presets/male_2.mp4",
        preset_male_3: "public/presets/male_3.mp4",
        preset_male_4: "public/presets/male_4.mp4",
        preset_male_5: "public/presets/male_5.mp4"
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
      error: null,
      logs: []
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

        // Fal.ai Provider Branch
        if (provider === "fal") {
          addJobLog(jobId, `Running Fal.ai pipeline...`);
          
          const falEndpoints = {
            fal_kling: "fal-ai/kling-video/lipsync/audio-to-video",
            fal_sync_lipsync_3: "fal-ai/sync-lipsync/v3",
            fal_wav2lip: "fal-ai/wav2lip",
            fal_latentsync: "fal-ai/latentsync"
          };
          const endpointId = falEndpoints[lipsyncEngine] || falEndpoints.fal_kling;

          const audioDuration = await getDuration(localAudioPath);

          // 1. Resolve Local Video Source
          let localVideoInputPath;
          if (rawVideoPath.startsWith("http://") || rawVideoPath.startsWith("https://")) {
            addJobLog(jobId, `Downloading remote avatar video locally to pre-process...`);
            const downloadedFilename = `downloaded_${jobId}.mp4`;
            const downloadedPath = path.join("public", "uploads", downloadedFilename);
            await downloadFile(rawVideoPath, downloadedPath);
            tempFilesToCleanup.push(downloadedPath);
            localVideoInputPath = downloadedPath;
          } else {
            localVideoInputPath = rawVideoPath;
          }

          // 2. Pre-process Input Video (Looping + Upscaling to min 512px even dimensions)
          const loopedVideoPath = await loopVideoIfNeeded(localVideoInputPath, audioDuration);
          if (loopedVideoPath !== localVideoInputPath) {
            tempFilesToCleanup.push(loopedVideoPath);
          }

          // Always upscale/scale to at least 720px with even dimensions
          const scaledVideoFilename = `scaled-${jobId}.mp4`;
          const scaledVideoPath = path.join("public", "uploads", scaledVideoFilename);
          addJobLog(jobId, `Pre-processing video: upscaling to min 720px height/width with even dimensions...`);
          await execPromise(`ffmpeg -y -i "${loopedVideoPath}" -vf "scale='if(lt(iw,ih),720,-2)':'if(lt(iw,ih),-2,720)'" -c:v libx264 -pix_fmt yuv420p "${scaledVideoPath}"`);
          tempFilesToCleanup.push(scaledVideoPath);

          // 3. Build Public URLs
          const publicAudioUrl = `${protocol}://${host}/uploads/${audioFilename}`;
          const publicVideoUrl = `${protocol}://${host}/uploads/${scaledVideoFilename}`;

          // Auto-Splitting Kling Pipeline (only if lipsyncEngine is fal_kling and duration > 60s)
          if (lipsyncEngine === "fal_kling" && audioDuration > 60) {
            addJobLog(jobId, `Kling Auto-Splitting enabled. Duration: ${audioDuration}s. Slicing into 60s segments...`);
            
            const numSegments = Math.ceil(audioDuration / 60);
            const segmentPromises = [];

            for (let i = 0; i < numSegments; i++) {
              const start = i * 60;
              const duration = Math.min(60, audioDuration - start);

              // Slice audio segment
              const audioSegFilename = `aud_seg_${jobId}_${i}.wav`;
              const audioSegPath = path.join("public", "uploads", audioSegFilename);
              await execPromise(`ffmpeg -y -ss ${start} -t ${duration} -i "${localAudioPath}" "${audioSegPath}"`);
              tempFilesToCleanup.push(audioSegPath);

              // Slice video segment (transcoding to ensure correct keyframe alignments!)
              const videoSegFilename = `vid_seg_${jobId}_${i}.mp4`;
              const videoSegPath = path.join("public", "uploads", videoSegFilename);
              await execPromise(`ffmpeg -y -ss ${start} -t ${duration} -i "${scaledVideoPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${videoSegPath}"`);
              tempFilesToCleanup.push(videoSegPath);

              // Dispatch segment to Fal.ai Kling
              segmentPromises.push((async () => {
                const publicSegAudioUrl = `${protocol}://${host}/uploads/${audioSegFilename}`;
                const publicSegVideoUrl = `${protocol}://${host}/uploads/${videoSegFilename}`;

                addJobLog(jobId, `Dispatching Kling segment ${i + 1}/${numSegments} (${duration}s)...`);
                const queueInfo = await startFalPrediction(
                  endpointId,
                  { video_url: publicSegVideoUrl, audio_url: publicSegAudioUrl },
                  falApiKey
                );

                const result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
                const outUrl = result.video ? result.video.url : result.output;
                if (!outUrl) {
                  throw new Error(`Kling segment prediction ${i + 1} did not return a valid video URL.`);
                }

                // Download segment locally so we can stitch them
                const outputSegFilename = `out_seg_${jobId}_${i}.mp4`;
                const outputSegPath = path.join("public", "uploads", outputSegFilename);
                await downloadFile(outUrl, outputSegPath);
                tempFilesToCleanup.push(outputSegPath);

                return outputSegPath;
              })());
            }

            // Wait for all segments to complete lip-sync rendering
            const completedSegs = await Promise.all(segmentPromises);

            // Stitch segments using ffmpeg complex filter concat
            addJobLog(jobId, `Stitching ${completedSegs.length} Kling segments together...`);
            let ffmpegArgs = [];
            let filterInputs = "";
            for (let i = 0; i < completedSegs.length; i++) {
              ffmpegArgs.push(`-i "${completedSegs[i]}"`);
              filterInputs += `[${i}:v][${i}:a]`;
            }
            const filterComplex = `"${filterInputs}concat=n=${completedSegs.length}:v=1:a=1[v][a]"`;
            const stitchedFilename = `stitched-${jobId}.mp4`;
            const finalStitchedPath = path.join("public", "uploads", stitchedFilename);

            await execPromise(`ffmpeg -y ${ffmpegArgs.join(" ")} -filter_complex ${filterComplex} -map "[v]" -map "[a]" "${finalStitchedPath}"`);
            
            videoUrl = `/uploads/${stitchedFilename}`;
            addJobLog(jobId, `Kling Auto-Stitching complete. Local URL: ${videoUrl}`);

          } else {
            // Standard single-run prediction for shorter assets or alternative engines
             addJobLog(jobId, `Running single Fal.ai prediction using model ${endpointId}...`);
             const falInput = { audio_url: publicAudioUrl };
             if (endpointId.includes("wav2lip")) {
               falInput.face_url = publicVideoUrl;
             } else if (endpointId.includes("latentsync")) {
               falInput.video_url = publicVideoUrl;
               falInput.loop_mode = "loop";
             } else {
               falInput.video_url = publicVideoUrl;
               falInput.sync_mode = "loop";
             }
             const queueInfo = await startFalPrediction(
               endpointId,
               falInput,
               falApiKey
             );
             const result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
             videoUrl = result.video ? result.video.url : result.output;
             addJobLog(jobId, `Fal.ai run complete. Video URL: ${videoUrl}`);
          }



        } else {
          // Replicate Provider Branch
          if (lipsyncEngine === "sync_lipsync_2" || lipsyncEngine === "sync_lipsync_2_pro") {
            const modelPath = lipsyncEngine === "sync_lipsync_2_pro" ? "sync/lipsync-2-pro" : "sync/lipsync-2";
            
            if (rawVideoPath.startsWith("http://") || rawVideoPath.startsWith("https://")) {
              finalVideoInput = rawVideoPath;
            } else {
              finalVideoInput = fs.readFileSync(rawVideoPath);
            }

            addJobLog(jobId, `Step 2/2: Generating lip-sync video via Sync Labs (${modelPath})...`);
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
            addJobLog(jobId, `Step 2/2 complete. Video URL: ${videoUrl}`);



          } else {
            // Default: LatentSync
            addJobLog(jobId, `Inspecting media durations for loop matching...`);
            const audioDuration = await getDuration(localAudioPath);
            const processedVideoPath = await loopVideoIfNeeded(rawVideoPath, audioDuration);

            if (processedVideoPath.startsWith("http://") || processedVideoPath.startsWith("https://")) {
              finalVideoInput = processedVideoPath;
            } else {
              finalVideoInput = fs.readFileSync(processedVideoPath);
              tempFilesToCleanup.push(processedVideoPath); // Queue for cleanup
            }

            addJobLog(jobId, `Step 2/2: Generating lip-sync video via LatentSync...`);
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
            addJobLog(jobId, `Step 2/2 complete. Video URL: ${videoUrl}`);

          }
        }

        // 4. Post-processing Face Enhancer (if requested)
        if (runFaceEnhancer && videoUrl) {
          const publicInputUrl = videoUrl.startsWith("/uploads/") ? `${protocol}://${host}${videoUrl}` : videoUrl;
          
          if (provider === "fal") {
            addJobLog(jobId, `Running post-processing: Topaz Video AI Face Preservation & Upscale on Fal.ai...`);
            const queueInfo = await startFalPrediction(
              "fal-ai/topaz/upscale/video/precision",
              { video_url: publicInputUrl },
              falApiKey
            );
            const result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
            videoUrl = result.video ? result.video.url : result.output;
            addJobLog(jobId, `Topaz Video AI complete. Enhanced video URL: ${videoUrl}`);
          } else {
            addJobLog(jobId, `Running post-processing: GFPGAN Video Face Restoration on Replicate...`);
            const gfpganOutput = await replicate.run(
              "pbarker/gfpgan-video:ea1116ce24126a411c7beb092e587bee24b25525c1b0e493e3a907904952ace3",
              {
                input: {
                  video: publicInputUrl,
                  version: "v1.4",
                  scale: 2
                }
              }
            );
            videoUrl = gfpganOutput.toString();
            addJobLog(jobId, `GFPGAN Face restoration complete. Enhanced video URL: ${videoUrl}`);
          }
        }

        // 5. Apply Video Branding & Background Layouts
        if ((logoPath || bgPath) && videoUrl) {
          addJobLog(jobId, "Applying Video Branding & Background Layouts...");
          const brandedFilename = `branded_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
          const brandedOutputPath = path.join("public", "uploads", brandedFilename);

          let localProcessingVideoPath = videoUrl;
          if (videoUrl.startsWith("http")) {
            addJobLog(jobId, "Downloading video to local server for branding compositions...");
            const tempDownloadName = `temp_dl_${Date.now()}_${Math.random().toString(36).substr(2, 5)}.mp4`;
            localProcessingVideoPath = path.join("public", "uploads", tempDownloadName);
            const response = await fetch(videoUrl);
            const buffer = await response.arrayBuffer();
            fs.writeFileSync(localProcessingVideoPath, Buffer.from(buffer));
            tempFilesToCleanup.push(localProcessingVideoPath);
          } else if (videoUrl.startsWith("/uploads/")) {
            localProcessingVideoPath = path.join("public", videoUrl);
          }

          try {
            await applyBrandingAndWatermark(
              localProcessingVideoPath,
              bgPath,
              bgPresenterAlign,
              logoPath,
              logoPosition,
              brandedOutputPath
            );
            videoUrl = `/uploads/${brandedFilename}`;
            addJobLog(jobId, `Branding and layout composition complete. Final video path: ${videoUrl}`);
          } catch (brandingError) {
            console.error("Branding failed:", brandingError);
            addJobLog(jobId, `Warning: Branding failed: ${brandingError.message}. Using default output.`);
          }
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

        // Cleanup temporary files once all steps (including branding) are done
        cleanUpTempFiles(tempFilesToCleanup);
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
