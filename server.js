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

// Global Process Exception Handlers to prevent container crashes
process.on("uncaughtException", (err) => {
  console.error("[CRITICAL] Uncaught Exception:", err);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("[CRITICAL] Unhandled Rejection at:", promise, "reason:", reason);
});

// Health check routes (unauthenticated)
app.get("/health", (req, res) => res.status(200).send("OK"));
app.get("/api/health", (req, res) => res.status(200).json({ status: "ok", timestamp: new Date().toISOString() }));

// Serve static frontend files from 'public' directory with no-cache headers for scripts
app.use(express.static("public", {
  etag: false,
  maxAge: 0,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".js") || filePath.endsWith(".html")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
    }
  }
}));

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

// Persistent database for custom saved avatars
class CustomAvatarsDB {
  constructor(filePath) {
    this.filePath = filePath;
    this.avatars = [];
    this.init();
  }

  init() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = fs.readFileSync(this.filePath, "utf-8");
        this.avatars = JSON.parse(data);
      } else {
        this.save();
      }
    } catch (err) {
      console.error("[CustomAvatarsDB] Failed to initialize:", err);
      this.avatars = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.avatars, null, 2), "utf-8");
    } catch (err) {
      console.error("[CustomAvatarsDB] Failed to save custom avatars:", err);
    }
  }

  add(name, videoUrl) {
    const id = "custom_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 5);
    const newAvatar = { id, name, videoUrl, createdAt: new Date().toISOString() };
    this.avatars.push(newAvatar);
    this.save();
    return newAvatar;
  }

  delete(id) {
    const idx = this.avatars.findIndex(item => item.id === id);
    if (idx !== -1) {
      const avatar = this.avatars[idx];
      if (avatar.videoUrl && avatar.videoUrl.startsWith("/uploads/")) {
        const filePath = path.join("public", avatar.videoUrl);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log(`[CustomAvatarsDB] Deleted physical video file: ${filePath}`);
          }
        } catch (err) {
          console.error(`[CustomAvatarsDB] Failed to delete file: ${filePath}`, err);
        }
      }
      this.avatars.splice(idx, 1);
      this.save();
      return true;
    }
    return false;
  }

  getAll() {
    return this.avatars;
  }
}

const dbPath = path.join("public", "uploads", "history.json");
const db = new HistoryDB(dbPath);

const customAvatarsPath = path.join("public", "uploads", "custom_avatars.json");
const customAvatarsDb = new CustomAvatarsDB(customAvatarsPath);

// Configure Multer memory storage for custom avatar uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max limit
  },
});

// Helper to apply branded background, logo watermarks, and scene highlight overlays using FFmpeg
async function applySceneOverlaysAndBranding(inputVideoPath, bgPath, bgPresenterAlign, logoPath, logoPosition, scenes, audioDuration, outputVideoPath) {
  if ((!scenes || scenes.length === 0) && !bgPath && !logoPath) {
    fs.copyFileSync(inputVideoPath, outputVideoPath);
    return;
  }

  const tempOutputDir = os.tmpdir();
  const tempFiles = [];

  try {
    const inputs = [`-i "${inputVideoPath}"`];
    let nextInputIdx = 1;
    const filterParts = [];
    let currentStream = "0:v";
    let audioMapStream = "0:a";

    // 1. Prepare Background Canvas (use uploaded bgPath or default high-end corporate dark blue gradient)
    let bgInputIdx;
    if (bgPath) {
      inputs.push(`-i "${bgPath}"`);
      bgInputIdx = nextInputIdx++;
      filterParts.push(`[${bgInputIdx}:v]scale=1920:1080:force_original_aspect_ratio=increase,crop=1920:1080[bg_canvas]`);
    } else {
      const bgSvgPath = path.join(tempOutputDir, `bg_canvas_${Date.now()}.svg`);
      const bgSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
        <defs>
          <linearGradient id="corpBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#0b1329"/>
            <stop offset="50%" stop-color="#111c3d"/>
            <stop offset="100%" stop-color="#19254d"/>
          </linearGradient>
        </defs>
        <rect width="1920" height="1080" fill="url(#corpBg)"/>
      </svg>`;
      fs.writeFileSync(bgSvgPath, bgSvgContent);
      tempFiles.push(bgSvgPath);
      inputs.push(`-i "${bgSvgPath}"`);
      bgInputIdx = nextInputIdx++;
      filterParts.push(`[${bgInputIdx}:v]scale=1920:1080[bg_canvas]`);
    }

    // 2. Generate Rounded Corner Alpha Mask for Presenter Video Box (Width: 700px, Height: 940px, Radius: 32px)
    const presenterWidth = 700;
    const presenterHeight = 940;
    const maskSvgPath = path.join(tempOutputDir, `presenter_mask_${Date.now()}.svg`);
    const maskSvgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${presenterWidth}" height="${presenterHeight}">
      <rect x="0" y="0" width="${presenterWidth}" height="${presenterHeight}" rx="32" ry="32" fill="white"/>
    </svg>`;
    fs.writeFileSync(maskSvgPath, maskSvgContent);
    tempFiles.push(maskSvgPath);

    inputs.push(`-i "${maskSvgPath}"`);
    const maskInputIdx = nextInputIdx++;

    // Scale & Crop Presenter Video to 700x940, apply rounded mask via alphamerge
    filterParts.push(`[0:v]scale=${presenterWidth}:${presenterHeight}:force_original_aspect_ratio=increase,crop=${presenterWidth}:${presenterHeight}[fg_raw]`);
    filterParts.push(`[${maskInputIdx}:v]scale=${presenterWidth}:${presenterHeight}[mask_raw]`);
    filterParts.push(`[fg_raw][mask_raw]alphamerge[fg_rounded]`);

    // Determine presenter alignment on canvas (default right side at x=1160, y=70)
    let xPos = "1160";
    if (bgPresenterAlign === "left") xPos = "60";
    else if (bgPresenterAlign === "center") xPos = "(W-w)/2";

    filterParts.push(`[bg_canvas][fg_rounded]overlay=x=${xPos}:y=70[v_comp]`);
    currentStream = "v_comp";

    // 3. Add Scene Highlight Overlays if scenes are provided
    if (scenes && scenes.length > 0) {
      const sceneDuration = (audioDuration || 60) / scenes.length;

      for (let i = 0; i < scenes.length; i++) {
        const scene = scenes[i];
        const svgContent = generateSceneOverlaySvg(scene.highlights, scene.title, scene.sceneIndex || (i + 1));
        const svgPath = path.join(tempOutputDir, `scene_overlay_${Date.now()}_${i}.svg`);
        fs.writeFileSync(svgPath, svgContent);
        tempFiles.push(svgPath);

        inputs.push(`-i "${svgPath}"`);
        const overlayIdx = nextInputIdx++;
        const startTime = (i * sceneDuration).toFixed(2);
        const endTime = ((i + 1) * sceneDuration).toFixed(2);
        const outStreamName = `v_scene_${i}`;

        filterParts.push(`[${currentStream}][${overlayIdx}:v]overlay=0:0:enable='between(t,${startTime},${endTime})'[${outStreamName}]`);
        currentStream = outStreamName;
      }
    }

    // 4. Add Logo Watermark if provided
    if (logoPath) {
      inputs.push(`-i "${logoPath}"`);
      const logoIdx = nextInputIdx++;
      filterParts.push(`[${logoIdx}:v]scale=220:-1[logo]`);
      let logoOverlay = "80:60"; // Default top left to match REC logo placement in screenshot
      if (logoPosition === "top_right") logoOverlay = "W-w-60:60";
      else if (logoPosition === "bottom_right") logoOverlay = "W-w-60:H-h-60";
      else if (logoPosition === "bottom_left") logoOverlay = "80:H-h-60";

      filterParts.push(`[${currentStream}][logo]overlay=${logoOverlay}[v_final]`);
      currentStream = "v_final";
    }

    const filterComplexStr = filterParts.join("; ");
    const command = `ffmpeg -y ${inputs.join(" ")} -filter_complex "${filterComplexStr}" -map "[${currentStream}]" -map ${audioMapStream} -c:v libx264 -c:a aac -pix_fmt yuv420p "${outputVideoPath}"`;

    console.log(`[Video Composition] Executing rounded presenter box & scene overlay filter...`);
    await execPromise(command);

  } finally {
    cleanUpTempFiles(tempFiles);
  }
}


// Helper to get media duration using ffprobe
async function getDuration(mediaPath) {
  const { stdout } = await execPromise(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`
  );
  return parseFloat(stdout.trim());
}

// Helper to get total video frame count using ffprobe
async function getFrameCount(mediaPath) {
  const { stdout } = await execPromise(
    `ffprobe -v error -select_streams v:0 -count_packets -show_entries stream=nb_read_packets -of default=noprint_wrappers=1:nokey=1 "${mediaPath}"`
  );
  return parseInt(stdout.trim(), 10);
}

// Helper to loop video if it is shorter than target audio
async function loopVideoIfNeeded(videoSource, targetDuration) {
  const duration = await getDuration(videoSource);
  console.log(`[Video Prep] Video duration: ${duration}s, Target audio duration: ${targetDuration}s`);
  
  if (targetDuration <= duration) {
    console.log(`[Video Prep] Video is long enough. No looping needed.`);
    return videoSource;
  }

  // Determine frame count of source to avoid boundary frame duplication
  let frameCount = 250; // fallback
  try {
    frameCount = await getFrameCount(videoSource);
    console.log(`[Video Prep] Detected source frame count: ${frameCount}`);
  } catch (err) {
    console.error("[Video Prep] Failed to detect frame count, using 250 frames fallback:", err);
  }

  // Create a seamless ping-pong block (forward + reverse trim to prevent duplicate end/start frames)
  const tempOutputDir = os.tmpdir();
  const pingpongFile = path.join(tempOutputDir, `pingpong_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`);
  
  console.log(`[Video Prep] Generating seamless frame-trimmed ping-pong block...`);
  // Forward segment: frames 0 to N-1 (trim=end_frame=N)
  // Reversed segment: drop first reversed frame (index 0, which is frame N-1) and drop last reversed frame (index N-1, which is frame 0)
  // Therefore, reversed trim: start_frame=1:end_frame=N-1
  await execPromise(
    `ffmpeg -y -i "${videoSource}" -filter_complex "[0:v]scale='if(gt(iw,ih),720,-2)':'if(gt(iw,ih),-2,720)',trim=start_frame=0:end_frame=${frameCount},setpts=PTS-STARTPTS[f];[0:v]scale='if(gt(iw,ih),720,-2)':'if(gt(iw,ih),-2,720)',reverse,trim=start_frame=1:end_frame=${frameCount - 1},setpts=PTS-STARTPTS[r];[f][r]concat=n=2:v=1:a=0[outv]" -map "[outv]" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${pingpongFile}"`
  );

  const pingpongDuration = duration * 2;
  const N = Math.ceil(targetDuration / pingpongDuration) - 1;
  console.log(`[Video Prep] Looping ping-pong block ${N} times to match target duration...`);

  const tempOutputFile = path.join(tempOutputDir, `looped_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.mp4`);
  
  await execPromise(
    `ffmpeg -y -stream_loop ${N} -i "${pingpongFile}" -c copy "${tempOutputFile}"`
  );

  // Clean up the intermediate ping-pong file
  try {
    if (fs.existsSync(pingpongFile)) {
      fs.unlinkSync(pingpongFile);
    }
  } catch (err) {
    console.error("[Video Prep] Failed to delete intermediate pingpong file:", err);
  }
  
  console.log(`[Video Prep] Seamless loop complete. Temporary file: ${tempOutputFile}`);
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

// Helper: Format bullet point strings cleanly
function formatHighlightString(str) {
  let cleaned = str.replace(/^[^a-zA-Z0-9"'\(\)]+/, "").trim();
  cleaned = cleaned.replace(/[\s\t\n]+/g, " ");
  cleaned = cleaned.replace(/[,;—–:\.!?]+$/, "").trim();
  if (cleaned.length > 58) {
    cleaned = cleaned.substring(0, 55).trim() + "...";
  }
  if (!cleaned) return "";
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}

// Helper: Extract 3-4 concise bullet points from a scene's text without stripping key words
function extractHighlightsFromText(text) {
  const cleanRaw = text.replace(/\[pause \d+(\.\d+)?\]/gi, "").trim();
  if (!cleanRaw) return [];

  const rawUnits = cleanRaw.split(/[\n;—–\.\!\?]+|,\s+/);
  const candidatePhrases = [];

  for (let unit of rawUnits) {
    unit = unit.trim();
    if (!unit) continue;

    if (unit.length > 65) {
      const subParts = unit.split(/\b(?:and|with|that|which|before|after|including|for)\b/i);
      for (let sub of subParts) {
        const cleaned = formatHighlightString(sub);
        if (cleaned.length >= 10) candidatePhrases.push(cleaned);
      }
    } else {
      const cleaned = formatHighlightString(unit);
      if (cleaned.length >= 10) candidatePhrases.push(cleaned);
    }
  }

  const unique = [];
  for (const p of candidatePhrases) {
    if (!unique.includes(p) && unique.length < 4) {
      unique.push(p);
    }
  }

  if (unique.length < 3) {
    const sentences = cleanRaw.split(/[\.\!\?]+/).filter(Boolean);
    for (const sent of sentences) {
      const cleaned = formatHighlightString(sent);
      if (cleaned && !unique.includes(cleaned) && unique.length < 4) {
        unique.push(cleaned);
      }
    }
  }

  while (unique.length < 3) {
    const idx = unique.length + 1;
    unique.push(`Key Highlight ${idx} for this section`);
  }

  return unique.slice(0, 4);
}

// Helper: Intelligent Scene Breakdown into targetCount scenes (default 6)
function breakdownScriptIntoScenes(rawText, targetCount = 6) {
  if (!rawText || !rawText.trim()) return [];

  const cleanText = rawText.replace(/\r?\n/g, "\n").trim();
  let units = [];
  const paragraphs = cleanText.split(/\n+/).map(p => p.trim()).filter(Boolean);
  for (const para of paragraphs) {
    const sents = para.split(/[\.\!\?]+/).map(s => s.trim()).filter(Boolean);
    for (const s of sents) {
      if (s.trim()) units.push(s.trim());
    }
  }

  // If units < targetCount, split long units at clause boundaries to reach targetCount
  while (units.length < targetCount) {
    let longestIdx = -1;
    let maxLen = 0;
    for (let i = 0; i < units.length; i++) {
      if (units[i].length > maxLen) {
        maxLen = units[i].length;
        longestIdx = i;
      }
    }
    if (longestIdx === -1 || maxLen < 35) break;

    const targetUnit = units[longestIdx];
    const splitMatch = targetUnit.split(/[,;—–]\s+/);
    if (splitMatch.length > 1) {
      const mid = Math.floor(splitMatch.length / 2);
      const part1 = splitMatch.slice(0, mid).join(" ");
      const part2 = splitMatch.slice(mid).join(" ");
      units.splice(longestIdx, 1, part1, part2);
    } else {
      break;
    }
  }

  let sceneChunks = [];
  if (units.length <= targetCount) {
    sceneChunks = units.map(u => [u]);
  } else {
    const unitsPerScene = Math.ceil(units.length / targetCount);
    for (let i = 0; i < targetCount; i++) {
      const start = i * unitsPerScene;
      const chunk = units.slice(start, start + unitsPerScene);
      if (chunk.length > 0) {
        sceneChunks.push(chunk);
      }
    }
  }

  return sceneChunks.map((chunkSentences, index) => {
    const sceneText = chunkSentences.join(" ");
    const highlights = extractHighlightsFromText(sceneText);
    const words = sceneText.split(/\s+/).filter(Boolean);
    const titleWords = words.slice(0, 4).join(" ").replace(/[^a-zA-Z0-9 ]/g, "");
    const title = `Scene ${index + 1}: ${titleWords.charAt(0).toUpperCase() + titleWords.slice(1)}...`;

    return {
      sceneIndex: index + 1,
      title: title,
      script: sceneText,
      highlights: highlights
    };
  });
}

// Helper to generate a clean, modern SVG slide overlay card with 3-4 bullet points
function generateSceneOverlaySvg(highlights, title, sceneIndex) {
  const rawTitle = title || `Scene ${sceneIndex}`;
  const cleanTitle = rawTitle.replace(/^Scene \d+:\s*/i, "").trim();
  const safeTitle = cleanTitle.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  
  const bulletLines = (highlights || []).slice(0, 4).map((h, i) => {
    const yText = 430 + (i * 90);
    const yDot = yText - 8;
    const safeH = String(h).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `
    <circle cx="92" cy="${yDot}" r="8" fill="#8b5cf6" />
    <text x="118" y="${yText}" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="600" fill="#f8fafc">${safeH}</text>
    `;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
  <defs>
    <linearGradient id="titleAccent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>

  <!-- Left-Side Scene Card Content -->
  <!-- Scene Badge -->
  <rect x="80" y="240" width="120" height="32" rx="8" fill="#7c3aed" fill-opacity="0.35" stroke="#8b5cf6" stroke-width="1.5"/>
  <text x="140" y="261" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="bold" fill="#ddd6fe" text-anchor="middle" letter-spacing="1">SCENE ${sceneIndex}</text>

  <!-- Scene Title Headline -->
  <text x="80" y="335" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="40" font-weight="bold" fill="#ffffff">${safeTitle}</text>
  <rect x="80" y="360" width="220" height="6" rx="3" fill="url(#titleAccent)"/>

  <!-- On-Screen Key Bullet Highlights -->
  ${bulletLines}
</svg>`;
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

// Helper to run Deepgram TTS prediction using v1/speak
async function runDeepgramTTS(text, voice, apiKey, outputPath) {
  const model = voice || "aura-asteria-en";
  const url = `https://api.deepgram.com/v1/speak?model=${encodeURIComponent(model)}&encoding=linear16&container=wav`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Token ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Deepgram TTS API error (${response.status}): ${errorText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

// Route: Analyze script and break down into N scenes with 3-4 key highlights
app.post("/api/breakdown-scenes", (req, res) => {
  try {
    const { text, targetSceneCount } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, error: "Text script cannot be empty." });
    }

    const count = parseInt(targetSceneCount, 10) || 6;
    const scenes = breakdownScriptIntoScenes(text, count);

    return res.status(200).json({
      success: true,
      scenes: scenes,
      totalScenes: scenes.length
    });
  } catch (err) {
    console.error("Scene breakdown error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Route 1: Generate Audio Preview (supporting custom [pause X.X] markers and long-form scripts)
app.post("/api/generate-audio", async (req, res) => {
  let activeProvider = "replicate";
  try {
    console.log(`[Audio Generation Request] Received body:`, req.body);
    const { text, voice, customToken, customFalToken, customDeepgramToken, lipsyncProvider } = req.body;

    const isDeepgram = voice && voice.startsWith("aura-");
    let deepgramApiKey = "";
    let apiToken = "";

    if (isDeepgram) {
      activeProvider = "deepgram";
      deepgramApiKey = customDeepgramToken || process.env.DEEPGRAM_API_KEY;
      if (!deepgramApiKey) {
        return res.status(400).json({
          success: false,
          error: "Deepgram API Key is missing. Please enter it in Developer Settings or configure DEEPGRAM_API_KEY in Railway.",
        });
      }
    } else {
      activeProvider = lipsyncProvider || "replicate";
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
      if (isDeepgram) {
        await runDeepgramTTS(text, voice, deepgramApiKey, finalOutputPath);
      } else if (activeProvider === "fal") {
        const audioUrl = await runFalTTS(text, voice, apiToken, audioJobId);
        await downloadFile(audioUrl, finalOutputPath);
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
        await downloadFile(audioOutput.toString(), finalOutputPath);
      }

      // Save to database history
      db.addOrUpdate(audioJobId, {
        text: text,
        voice: voice || "aura-asteria-en",
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
        if (isDeepgram) {
          await runDeepgramTTS(part.content, voice, deepgramApiKey, segmentFile);
        } else if (activeProvider === "fal") {
          const audioUrl = await runFalTTS(part.content, voice, apiToken, audioJobId);
          await downloadFile(audioUrl, segmentFile);
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
          await downloadFile(audioOutput.toString(), segmentFile);
        }
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
      voice: voice || "aura-asteria-en",
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
    } else if (activeProvider === "deepgram" && (errorMsg.includes("401") || errorMsg.includes("Unauthorized") || errorMsg.includes("Invalid credentials") || errorMsg.includes("Key"))) {
      errorMsg = "Your Deepgram API Key is invalid or expired. Please check your token in Developer Settings or configure DEEPGRAM_API_KEY in Railway.";
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
  const maxAttempts = 4;
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Key ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(input)
    });

    if (response.ok) {
      const data = await response.json();
      return {
        requestId: data.request_id,
        statusUrl: data.status_url,
        responseUrl: data.response_url
      };
    }

    const errorText = await response.text();
    lastError = new Error(`Fal.ai API error (${response.status}): ${errorText}`);

    // Retry on 5xx (transient), fail fast on 4xx
    if (response.status < 500 || attempt === maxAttempts) throw lastError;

    const backoffMs = 5000 * attempt;
    console.log(`[Fal.ai] Submission failed (${response.status}), retrying in ${backoffMs / 1000}s... (attempt ${attempt}/${maxAttempts})`);
    await new Promise(resolve => setTimeout(resolve, backoffMs));
  }
  throw lastError;
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
      const maxAttempts = 12;
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

        const backoffMs = Math.min(5000 * attempt, 30000); // ramp up to 30s cap
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
function buildAvatarGenerationPrompt(gender, framing, background, ethnicity, age) {
  // Translate ethnicity selection
  let ethnicityDesc = "";
  if (ethnicity === "black") ethnicityDesc = "Black ";
  else if (ethnicity === "east_asian") ethnicityDesc = "East Asian ";
  else if (ethnicity === "south_asian") ethnicityDesc = "South Asian ";
  else if (ethnicity === "hispanic") ethnicityDesc = "Hispanic ";
  else if (ethnicity === "white") ethnicityDesc = "White ";

  // Translate age selection
  let ageDesc = "in their 30s";
  if (age === "young") ageDesc = "in their late 20s or early 30s";
  else if (age === "middle") ageDesc = "in their late 40s or early 50s";
  else if (age === "mature") ageDesc = "in their mid 60s";

  const genderDesc = gender === "male"
    ? `a professional ${ethnicityDesc}man ${ageDesc}`
    : `a professional ${ethnicityDesc}woman ${ageDesc}`;

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

// Get all custom saved avatars
app.get("/api/custom-avatars", (req, res) => {
  try {
    const list = customAvatarsDb.getAll();
    return res.status(200).json({ success: true, avatars: list });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Save a custom avatar loop
app.post("/api/custom-avatars", (req, res) => {
  try {
    const { name, videoUrl } = req.body;
    if (!name || !videoUrl) {
      return res.status(400).json({ success: false, error: "Name and videoUrl are required." });
    }
    const newAvatar = customAvatarsDb.add(name, videoUrl);
    return res.status(200).json({ success: true, avatar: newAvatar });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Delete a custom saved avatar
app.delete("/api/custom-avatars/:id", (req, res) => {
  try {
    const { id } = req.params;
    const success = customAvatarsDb.delete(id);
    if (success) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(404).json({ success: false, error: "Custom avatar not found." });
    }
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Route: Generate a base avatar loop video (silent idle shot) via Fal.ai Kling text-to-video
app.post("/api/generate-avatar", async (req, res) => {
  try {
    const { gender, framing, background, ethnicity, age, falToken } = req.body;

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
        const { prompt, negative_prompt } = buildAvatarGenerationPrompt(gender, framing, background, ethnicity, age);
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
    const { audioFilename, avatarType, avatarPreset, avatarUrl, customToken, falToken, lipsyncProvider, lipsyncEngine, faceEnhancer, logoPosition, bgPresenterAlign, scenes: scenesRaw } = req.body;
    let scenes = [];
    if (scenesRaw) {
      try {
        scenes = typeof scenesRaw === "string" ? JSON.parse(scenesRaw) : scenesRaw;
      } catch (e) {
        console.error("Failed to parse scenes parameter:", e);
      }
    }
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

      if (avatarPreset && avatarPreset.startsWith("custom_")) {
        const match = customAvatarsDb.getAll().find(a => a.id === avatarPreset);
        if (match) {
          rawVideoPath = path.join("public", match.videoUrl);
        } else {
          rawVideoPath = "public/presets/female_1.mp4";
        }
      } else {
        rawVideoPath = presetUrls[avatarPreset] || presetUrls.preset_female_1;
      }
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
            fal_kling:      "fal-ai/kling-video/lipsync/audio-to-video",
            fal_sync_labs:  "fal-ai/sync-lipsync/v3",
            fal_wav2lip:    "fal-ai/wav2lip",
            fal_latentsync: "fal-ai/latentsync"
          };
          const endpointId = falEndpoints[lipsyncEngine] || falEndpoints.fal_latentsync;
          addJobLog(jobId, `Resolved fal endpoint: ${endpointId} for engine: ${lipsyncEngine}`);

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

          // Auto-Splitting Pipeline — all fal engines have a ~60s per-call limit
          if (audioDuration > 58) {
            addJobLog(jobId, `Audio duration ${audioDuration.toFixed(1)}s exceeds 60s limit. Auto-splitting into segments...`);
            
            const numSegments = Math.ceil(audioDuration / 58);
            const segmentPromises = [];

            for (let i = 0; i < numSegments; i++) {
              const start = i * 58;
              const duration = Math.min(58, audioDuration - start);

              // Slice audio segment
              const audioSegFilename = `aud_seg_${jobId}_${i}.wav`;
              const audioSegPath = path.join("public", "uploads", audioSegFilename);
              await execPromise(`ffmpeg -y -ss ${start} -t ${duration} -i "${localAudioPath}" "${audioSegPath}"`);
              tempFilesToCleanup.push(audioSegPath);

              // Slice video segment (transcoding to ensure correct keyframe alignments)
              const videoSegFilename = `vid_seg_${jobId}_${i}.mp4`;
              const videoSegPath = path.join("public", "uploads", videoSegFilename);
              await execPromise(`ffmpeg -y -ss ${start} -t ${duration} -i "${scaledVideoPath}" -c:v libx264 -pix_fmt yuv420p -c:a aac "${videoSegPath}"`);
              tempFilesToCleanup.push(videoSegPath);

              // Dispatch segment to Fal.ai
              segmentPromises.push((async () => {
                const publicSegAudioUrl = `${protocol}://${host}/uploads/${audioSegFilename}`;
                const publicSegVideoUrl = `${protocol}://${host}/uploads/${videoSegFilename}`;

                addJobLog(jobId, `Dispatching segment ${i + 1}/${numSegments} (${duration.toFixed(1)}s) to ${endpointId}...`);

                const buildSegInput = (ep, vUrl, aUrl) => {
                  const inp = { audio_url: aUrl };
                  if (ep.includes("wav2lip"))        inp.face_url = vUrl;
                  else if (ep.includes("latentsync")) { inp.video_url = vUrl; inp.loop_mode = "loop"; }
                  else                               { inp.video_url = vUrl; inp.sync_mode = "loop"; }
                  return inp;
                };

                let result;
                try {
                  const queueInfo = await startFalPrediction(endpointId, buildSegInput(endpointId, publicSegVideoUrl, publicSegAudioUrl), falApiKey);
                  result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
                } catch (err) {
                  const isDownstream = err.message.includes("downstream_service_unavailable") || err.message.includes("504");
                  if (isDownstream && !endpointId.includes("latentsync")) {
                    const fallbackEp = falEndpoints.fal_latentsync;
                    addJobLog(jobId, `⚠️ Segment ${i + 1}: ${endpointId} unavailable. Falling back to LatentSync...`);
                    const queueInfo = await startFalPrediction(fallbackEp, buildSegInput(fallbackEp, publicSegVideoUrl, publicSegAudioUrl), falApiKey);
                    result = await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
                  } else { throw err; }
                }

                const outUrl = result.video ? result.video.url : (result.output_video ? result.output_video.url : result.output);
                if (!outUrl) throw new Error(`Segment ${i + 1} prediction did not return a valid video URL.`);

                // Download segment locally for stitching
                const outputSegFilename = `out_seg_${jobId}_${i}.mp4`;
                const outputSegPath = path.join("public", "uploads", outputSegFilename);
                await downloadFile(outUrl, outputSegPath);
                tempFilesToCleanup.push(outputSegPath);

                return outputSegPath;
              })());
            }

            // Wait for all segments (run concurrently where possible)
            const completedSegs = await Promise.all(segmentPromises);

            // Stitch segments
            addJobLog(jobId, `Stitching ${completedSegs.length} segments together...`);
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
            addJobLog(jobId, `Auto-stitch complete. Local URL: ${videoUrl}`);

          } else {
            // Standard single-run prediction (audio <= 58s)
            addJobLog(jobId, `Running single Fal.ai prediction using model ${endpointId}...`);

            const buildFalInput = (ep, videoUrl, audioUrl) => {
              const input = { audio_url: audioUrl };
              if (ep.includes("wav2lip"))       input.face_url = videoUrl;
              else if (ep.includes("latentsync")) { input.video_url = videoUrl; input.loop_mode = "loop"; }
              else                              { input.video_url = videoUrl; input.sync_mode = "loop"; }
              return input;
            };

            const runWithFallback = async (primaryEndpoint) => {
              try {
                const queueInfo = await startFalPrediction(primaryEndpoint, buildFalInput(primaryEndpoint, publicVideoUrl, publicAudioUrl), falApiKey);
                return await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
              } catch (err) {
                const isDownstream = err.message.includes("downstream_service_unavailable") || err.message.includes("504");
                if (isDownstream && !primaryEndpoint.includes("latentsync")) {
                  const fallbackEp = falEndpoints.fal_latentsync;
                  addJobLog(jobId, `⚠️ ${primaryEndpoint} unavailable (downstream error). Auto-switching to LatentSync fallback...`);
                  const queueInfo = await startFalPrediction(fallbackEp, buildFalInput(fallbackEp, publicVideoUrl, publicAudioUrl), falApiKey);
                  return await pollFalPrediction(queueInfo.statusUrl, queueInfo.responseUrl, falApiKey, jobId);
                }
                throw err;
              }
            };

            const result = await runWithFallback(endpointId);
            videoUrl = result.video ? result.video.url : (result.output_video ? result.output_video.url : result.output);
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

        // 5. Apply Video Branding, Background Layouts & Scene Highlight Overlays
        if (videoUrl) {
          addJobLog(jobId, "Applying Video Branding & Scene Highlight Overlays...");
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
            const totalAudioDuration = await getDuration(localAudioPath);
            await applySceneOverlaysAndBranding(
              localProcessingVideoPath,
              bgPath,
              bgPresenterAlign,
              logoPath,
              logoPosition,
              scenes,
              totalAudioDuration,
              brandedOutputPath
            );
            videoUrl = `/uploads/${brandedFilename}`;
            addJobLog(jobId, `Branding and scene overlay composition complete. Final video path: ${videoUrl}`);
          } catch (brandingError) {
            console.error("Branding/Overlay failed:", brandingError);
            addJobLog(jobId, `Warning: Scene overlay composition failed: ${brandingError.message}. Using default output.`);
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
