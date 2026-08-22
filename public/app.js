document.addEventListener("DOMContentLoaded", () => {
  const generateAudioBtn = document.getElementById("generateAudioBtn");
  const audioSpinner = document.getElementById("audioSpinner");
  const generateVideoBtn = document.getElementById("generateVideoBtn");
  const videoSpinner = document.getElementById("videoSpinner");
  const audioActionContainer = document.getElementById("audioActionContainer");
  const videoActionContainer = document.getElementById("videoActionContainer");
  const audioPreview = document.getElementById("audioPreview");
  const resetBtn = document.getElementById("resetBtn");

  // Conditionally visible containers
  const avatarTypeRadios = document.querySelectorAll('input[name="avatarType"]');
  const avatarPresetContainer = document.getElementById("avatarPresetContainer");
  const avatarPreset = document.getElementById("avatarPreset");
  const lipsyncEngine = document.getElementById("lipsyncEngine");
  const presetPreviewVideo = document.getElementById("presetPreviewVideo");
  const avatarUrlContainer = document.getElementById("avatarUrlContainer");
  const avatarUploadContainer = document.getElementById("avatarUploadContainer");
  const avatarFile = document.getElementById("avatarFile");
  const uploadFilename = document.getElementById("uploadFilename");

  // Output containers
  const idleState = document.getElementById("idleState");
  const progressState = document.getElementById("progressState");
  const successState = document.getElementById("successState");
  const currentStepTitle = document.getElementById("currentStepTitle");
  const currentStepDetail = document.getElementById("currentStepDetail");
  const progressBar = document.getElementById("progressBar");
  
  const outputVideoPlayer = document.getElementById("outputVideoPlayer");
  const videoSource = document.getElementById("videoSource");
  const downloadBtn = document.getElementById("downloadBtn");
  const rawLinkBtn = document.getElementById("rawLinkBtn");
  const rawAudioLink = document.getElementById("rawAudioLink");
  
  const consoleLogs = document.getElementById("consoleLogs");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Initialize: Set local token if saved in localStorage
  const savedToken = localStorage.getItem("replicate_token");
  if (savedToken) {
    document.getElementById("customToken").value = savedToken;
  }

  // Handle upload filename display
  avatarFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      uploadFilename.textContent = `Selected: ${e.target.files[0].name}`;
      uploadFilename.classList.remove("text-slate-400");
      uploadFilename.classList.add("text-violet-400", "font-semibold");
    } else {
      uploadFilename.textContent = "Click to select MP4 video";
      uploadFilename.classList.remove("text-violet-400", "font-semibold");
      uploadFilename.classList.add("text-slate-400");
    }
  });

  // Toggle visible inputs based on Avatar Type radio select
  avatarTypeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val === "url") {
        avatarPresetContainer.classList.add("hidden");
        avatarUrlContainer.classList.remove("hidden");
        avatarUploadContainer.classList.add("hidden");
      } else if (val === "upload") {
        avatarPresetContainer.classList.add("hidden");
        avatarUrlContainer.classList.add("hidden");
        avatarUploadContainer.classList.remove("hidden");
      } else {
        avatarPresetContainer.classList.remove("hidden");
        avatarUrlContainer.classList.add("hidden");
        avatarUploadContainer.classList.add("hidden");
      }
    });
  });

  // Map presets to their raw video URLs for frontend previewing
  const presetVideoUrls = {
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

  // Change preset preview when selection changes
  avatarPreset.addEventListener("change", (e) => {
    const selectedPreset = e.target.value;
    const url = presetVideoUrls[selectedPreset];
    if (url) {
      presetPreviewVideo.src = url;
      presetPreviewVideo.load();
      presetPreviewVideo.play().catch(err => console.log("Auto-play blocked:", err));
    }
  });

  // Logging utility function
  function logMessage(message, type = "info") {
    const timestamp = new Date().toLocaleTimeString();
    const logDiv = document.createElement("div");
    
    if (type === "error") {
      logDiv.className = "text-rose-400 font-medium";
      logDiv.innerHTML = `<span class="text-rose-500">[${timestamp}] ERROR:</span> ${message}`;
    } else if (type === "success") {
      logDiv.className = "text-emerald-400 font-semibold";
      logDiv.innerHTML = `<span class="text-emerald-500">[${timestamp}] SUCCESS:</span> ${message}`;
    } else {
      logDiv.className = "text-slate-400";
      logDiv.innerHTML = `<span class="text-slate-600">[${timestamp}]</span> ${message}`;
    }
    
    consoleLogs.appendChild(logDiv);
    // Auto-scroll to bottom of the console
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  // Clear logs button
  clearLogsBtn.addEventListener("click", () => {
    consoleLogs.innerHTML = `<div class="text-slate-600">// Console cleared. Ready.</div>`;
  });

  // Variables to hold current audio filename from Step 1
  let generatedAudioFilename = "";

  // Wire up Pause buttons
  const pauseBtns = document.querySelectorAll(".pause-btn");
  const scriptText = document.getElementById("text");
  const voiceSelect = document.getElementById("voice");

  pauseBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const pauseVal = btn.getAttribute("data-pause");
      const cursorPosition = scriptText.selectionStart;
      const originalText = scriptText.value;
      const beforeText = originalText.substring(0, cursorPosition);
      const afterText = originalText.substring(cursorPosition);
      const insertStr = `[pause ${pauseVal}]`;

      scriptText.value = beforeText + insertStr + afterText;
      scriptText.focus();
      const newCursorPos = cursorPosition + insertStr.length;
      scriptText.setSelectionRange(newCursorPos, newCursorPos);
    });
  });

  // Step 1: Generate Audio Preview
  generateAudioBtn.addEventListener("click", async () => {
    const text = scriptText.value;
    const voice = voiceSelect.value;
    const customToken = document.getElementById("customToken").value;

    if (!text || text.trim() === "") {
      alert("Please enter a speech script first.");
      return;
    }

    if (customToken) {
      localStorage.setItem("replicate_token", customToken);
    } else {
      localStorage.removeItem("replicate_token");
    }

    // UI Loading state
    generateAudioBtn.disabled = true;
    audioSpinner.classList.remove("hidden");
    logMessage("Step 1: Generating audio preview...");

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice, customToken })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate audio.");
      }

      generatedAudioFilename = data.filename;
      logMessage(`Audio generated successfully! Preview URL: ${data.audioUrl}`, "success");

      // Reload history to display newly created audio preview run
      loadHistory();

      // Setup audio preview element
      audioPreview.src = data.audioUrl;
      audioPreview.load();

      // Lock inputs to prevent mismatches
      scriptText.disabled = true;
      voiceSelect.disabled = true;
      pauseBtns.forEach(btn => btn.disabled = true);

      // Toggle action containers
      audioActionContainer.classList.add("hidden");
      videoActionContainer.classList.remove("hidden");

    } catch (err) {
      console.error(err);
      logMessage(`Audio generation error: ${err.message}`, "error");
      alert(`Audio Generation Failed: ${err.message}`);
    } finally {
      generateAudioBtn.disabled = false;
      audioSpinner.classList.add("hidden");
    }
  });

  // Step 2: Generate Video
  generateVideoBtn.addEventListener("click", async () => {
    if (!generatedAudioFilename) {
      alert("No approved audio available. Please generate audio first.");
      return;
    }

    const customToken = document.getElementById("customToken").value;
    const avatarType = document.querySelector('input[name="avatarType"]:checked').value;
    const avatarPreset = document.getElementById("avatarPreset").value;
    const avatarUrl = document.getElementById("avatarUrl").value;
    const engine = lipsyncEngine.value;

    // Build Form Data to handle potential file uploads
    const formData = new FormData();
    formData.append("audioFilename", generatedAudioFilename);
    formData.append("avatarType", avatarType);
    formData.append("lipsyncEngine", engine);
    formData.append("customToken", customToken);

    if (avatarType === "preset") {
      formData.append("avatarPreset", avatarPreset);
      logMessage(`Target avatar video preset: ${avatarPreset}`);
    } else if (avatarType === "url") {
      formData.append("avatarUrl", avatarUrl);
      logMessage(`Target avatar video URL: ${avatarUrl}`);
    } else if (avatarType === "upload") {
      const file = avatarFile.files[0];
      if (!file) {
        logMessage("Validation error: No file selected for upload.", "error");
        alert("Please select a file to upload first.");
        return;
      }
      formData.append("avatarFile", file);
      logMessage(`Uploading custom avatar video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
    }

    // Set UI to loading state
    generateVideoBtn.disabled = true;
    videoSpinner.classList.remove("hidden");
    resetBtn.disabled = true;

    // Switch preview container to progress
    idleState.classList.add("hidden");
    successState.classList.add("hidden");
    progressState.classList.remove("hidden");

    logMessage(`Initializing video generation pipeline...`);
    logMessage(`Lip-Sync Engine: ${engine}`);
    updateProgress("Synchronizing Lips", "Requesting model inference from Replicate...", 60);

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate video generation.");
      }

      const jobId = data.jobId;
      logMessage(`Video generation job initiated. Job ID: ${jobId}`);

      // Start polling the job status
      let lastStep = "init";
      const pollInterval = setInterval(async () => {
        try {
          const pollResponse = await fetch(`/api/jobs/${jobId}`);
          if (!pollResponse.ok) {
            throw new Error(`Failed to contact server (Status: ${pollResponse.status})`);
          }
          const pollData = await pollResponse.json();
          if (!pollData.success) {
            throw new Error(pollData.error || "Job status check failed.");
          }
          
          const job = pollData.job;
          
          if (job.status === "processing") {
            if (job.step !== lastStep) {
              lastStep = job.step;
              if (job.step === "latentsync") {
                logMessage(`Starting lip-sync execution...`);
                updateProgress("Synchronizing Lips", "Applying audio-conditioned diffusion. This may take 1-3 minutes...", 75);
              }
            } else if (job.step === "latentsync") {
              updateProgress("Synchronizing Lips", "Generating facial expression changes in latent space...", 85);
            }
          } else if (job.status === "completed") {
            clearInterval(pollInterval);
            
            logMessage(`Avatar training video created successfully!`, "success");
            logMessage(`Output Video URL: ${job.videoUrl}`);
            
            updateProgress("Complete", "Rendering final video...", 100);

            // Load video in player
            videoSource.src = job.videoUrl;
            outputVideoPlayer.load();
            
            // Update download and link URLs
            downloadBtn.href = job.videoUrl;
            rawLinkBtn.href = job.videoUrl;
            rawAudioLink.href = job.audioUrl;

            // Switch to success view
            progressState.classList.add("hidden");
            successState.classList.remove("hidden");
            
            // Re-enable buttons
            generateVideoBtn.disabled = false;
            videoSpinner.classList.add("hidden");
            resetBtn.disabled = false;

            loadHistory();
          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            loadHistory();
            throw new Error(job.error || "Video generation failed on server.");
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          console.error(pollErr);
          logMessage(`Polling error: ${pollErr.message}`, "error");
          alert(`Video Generation Failed: ${pollErr.message}`);
          resetUI();
          generateVideoBtn.disabled = false;
          videoSpinner.classList.add("hidden");
          resetBtn.disabled = false;
          loadHistory();
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      logMessage(`Generation error: ${err.message}`, "error");
      alert(`Video Generation Failed: ${err.message}`);
      resetUI();
      generateVideoBtn.disabled = false;
      videoSpinner.classList.add("hidden");
      resetBtn.disabled = false;
    }
  });

  // Reset / Start Over Handler
  resetBtn.addEventListener("click", () => {
    generatedAudioFilename = "";
    
    // Reset inputs
    scriptText.disabled = false;
    voiceSelect.disabled = false;
    pauseBtns.forEach(btn => btn.disabled = false);

    // Reset audio player
    audioPreview.src = "";
    audioPreview.load();

    // Toggle action containers
    videoActionContainer.classList.add("hidden");
    audioActionContainer.classList.remove("hidden");

    resetUI();
    logMessage("Session reset. Ready for new audio generation.");
  });

  // Reset UI back to idle state
  function resetUI() {
    progressState.classList.add("hidden");
    successState.classList.add("hidden");
    idleState.classList.remove("hidden");
    progressBar.style.width = "0%";
  }

  // Progress update helper
  function updateProgress(title, detail, percentage) {
    currentStepTitle.textContent = title;
    currentStepDetail.textContent = detail;
    progressBar.style.width = `${percentage}%`;
  }

  // Database History Management
  const historyList = document.getElementById("historyList");
  const refreshHistoryBtn = document.getElementById("refreshHistoryBtn");

  async function loadHistory() {
    try {
      const res = await fetch("/api/history");
      const data = await res.json();
      if (!data.success) return;

      const history = data.history;
      if (history.length === 0) {
        historyList.innerHTML = `
          <div class="text-center py-6 text-slate-600 text-xs">
            No past generations stored in database.
          </div>
        `;
        return;
      }

      historyList.innerHTML = "";
      history.forEach(item => {
        const dateStr = new Date(item.createdAt).toLocaleString();
        const textPreview = item.text.length > 80 ? item.text.substring(0, 80) + "..." : item.text;
        
        let statusBadge = "";
        let actionBtn = "";

        if (item.status === "completed" && item.videoUrl) {
          statusBadge = `<span class="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-md text-[10px] font-semibold">Video Ready</span>`;
          actionBtn = `
            <button class="load-video-btn px-2.5 py-1 bg-violet-600 border border-violet-500 hover:bg-violet-500 rounded-lg text-white font-medium text-[11px] transition-colors" 
              data-video="${item.videoUrl}" data-audio="${item.audioUrl}">
              Load Video
            </button>
          `;
        } else if (item.status === "failed") {
          statusBadge = `<span class="px-2 py-0.5 bg-rose-950/80 text-rose-450 border border-rose-900 rounded-md text-[10px] font-semibold">Failed</span>`;
        } else if (item.status === "video_generating") {
          statusBadge = `<span class="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-900 rounded-md text-[10px] font-semibold animate-pulse">Syncing...</span>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded-md text-[10px] font-semibold">Audio Preview</span>`;
          actionBtn = `
            <button class="use-audio-btn px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-violet-500 hover:text-violet-400 rounded-lg font-medium text-[11px] transition-colors"
              data-filename="${item.audioUrl.split('/').pop()}" data-url="${item.audioUrl}">
              Use Audio
            </button>
          `;
        }

        const card = document.createElement("div");
        card.className = "p-3.5 bg-slate-950/50 border border-slate-900 hover:border-slate-800 rounded-xl space-y-2.5 transition-all duration-150 text-left";
        card.innerHTML = `
          <div class="flex items-start justify-between">
            <div class="space-y-0.5 pr-2">
              <span class="text-[9px] text-slate-650 font-bold uppercase tracking-wider">${item.voice} • ${dateStr}</span>
              <p class="text-xs text-slate-300 leading-relaxed font-medium" title="${item.text}">${textPreview}</p>
            </div>
            ${statusBadge}
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-slate-900/60">
            <audio src="${item.audioUrl}" controls class="h-6 w-40 bg-slate-950 rounded border border-slate-900 p-0.5 text-xs"></audio>
            ${actionBtn}
          </div>
        `;
        historyList.appendChild(card);
      });

      // Bind Load Video buttons
      document.querySelectorAll(".load-video-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const videoUrl = btn.getAttribute("data-video");
          const audioUrl = btn.getAttribute("data-audio");
          
          videoSource.src = videoUrl;
          outputVideoPlayer.load();
          downloadBtn.href = videoUrl;
          rawLinkBtn.href = videoUrl;
          rawAudioLink.href = audioUrl;

          idleState.classList.add("hidden");
          progressState.classList.add("hidden");
          successState.classList.remove("hidden");
          logMessage(`Loaded history video run. Playback initialized.`);
        });
      });

      // Bind Use Audio buttons (allows restarting from the approved audio step)
      document.querySelectorAll(".use-audio-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const filename = btn.getAttribute("data-filename");
          const url = btn.getAttribute("data-url");
          
          generatedAudioFilename = filename;
          audioPreview.src = url;
          audioPreview.load();

          // Lock inputs
          scriptText.disabled = true;
          voiceSelect.disabled = true;
          pauseBtns.forEach(p => p.disabled = true);

          audioActionContainer.classList.add("hidden");
          videoActionContainer.classList.remove("hidden");
          logMessage(`Selected audio preview from history: ${filename}. Ready to generate video.`);
        });
      });

    } catch (err) {
      console.error("Failed to load history list:", err);
    }
  }

  // Refresh history button listener
  refreshHistoryBtn.addEventListener("click", loadHistory);

  // Load history initially
  loadHistory();
});
