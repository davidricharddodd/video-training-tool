document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("generatorForm");
  const generateBtn = document.getElementById("generateBtn");
  const spinner = document.getElementById("spinner");
  
  // Conditionally visible containers
  const avatarTypeRadios = document.querySelectorAll('input[name="avatarType"]');
  const avatarPresetContainer = document.getElementById("avatarPresetContainer");
  const avatarPreset = document.getElementById("avatarPreset");
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

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const text = document.getElementById("text").value;
    const voice = document.getElementById("voice").value;
    const customToken = document.getElementById("customToken").value;
    const avatarType = document.querySelector('input[name="avatarType"]:checked').value;
    const avatarPreset = document.getElementById("avatarPreset").value;
    const avatarUrl = document.getElementById("avatarUrl").value;

    // Save token locally for session convenience
    if (customToken) {
      localStorage.setItem("replicate_token", customToken);
    } else {
      localStorage.removeItem("replicate_token");
    }

    // Set UI to loading state
    generateBtn.disabled = true;
    spinner.classList.remove("hidden");
    
    // Switch preview container to progress
    idleState.classList.add("hidden");
    successState.classList.add("hidden");
    progressState.classList.remove("hidden");
    
    // Progress Step 1: Audio Generation
    updateProgress("Generating Speech Audio", "Requesting text-to-speech from Replicate...", 30);
    logMessage(`Initializing generation pipeline...`);
    logMessage(`Text script length: ${text.length} characters.`);
    logMessage(`Voice profile selected: ${voice}`);
    logMessage(`Avatar source: ${avatarType}`);

    // Build Form Data to handle potential file uploads
    const formData = new FormData();
    formData.append("text", text);
    formData.append("voice", voice);
    formData.append("avatarType", avatarType);
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
        resetUI();
        alert("Please select a file to upload first.");
        return;
      }
      formData.append("avatarFile", file);
      logMessage(`Uploading custom avatar video: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`);
    } else {
      logMessage(`Using default talking head avatar preset.`);
    }

    try {
      logMessage(`Step 1/2: Triggering Kokoro-82M TTS model...`);
      
      // We start a background timer to update progress text during wait
      let progressTimer = setTimeout(() => {
        updateProgress("Generating Speech Audio", "Processing text segments. Generating natural voice curves...", 50);
      }, 5000);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      clearTimeout(progressTimer);
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Generation pipeline failed on server.");
      }

      logMessage(`Speech audio track generated successfully.`, "success");
      logMessage(`Audio Link: ${data.audioUrl}`);

      // Progress Step 2: Lip Syncing
      updateProgress("Synchronizing Lips (LatentSync)", "Applying facial audio-conditioned diffusion. This may take up to 2-3 minutes...", 75);
      logMessage(`Step 2/2: Starting LatentSync lip-sync model on Replicate...`);

      // Mock update to keep user engaged during LatentSync generation (which takes a little longer)
      let lipSyncTimer1 = setTimeout(() => {
        updateProgress("Synchronizing Lips (LatentSync)", "Running Whisper audio extractor and temporal layers...", 85);
        logMessage("LatentSync pipeline: Extracting Whisper audio embeddings...");
      }, 10000);

      let lipSyncTimer2 = setTimeout(() => {
        updateProgress("Synchronizing Lips (LatentSync)", "Generating facial expression changes in latent space...", 95);
        logMessage("LatentSync pipeline: Generating temporal mouth frames...");
      }, 30000);

      // We complete the request
      const finalVideoUrl = data.videoUrl;
      clearTimeout(lipSyncTimer1);
      clearTimeout(lipSyncTimer2);

      // Done! Displaying results
      updateProgress("Complete", "Rendering final video...", 100);
      logMessage(`Avatar training video created successfully!`, "success");
      logMessage(`Output Video URL: ${finalVideoUrl}`);

      // Load video in player
      videoSource.src = finalVideoUrl;
      outputVideoPlayer.load();
      
      // Update download and link URLs
      downloadBtn.href = finalVideoUrl;
      rawLinkBtn.href = finalVideoUrl;
      rawAudioLink.href = data.audioUrl;

      // Switch to success view
      progressState.classList.add("hidden");
      successState.classList.remove("hidden");

    } catch (err) {
      console.error(err);
      logMessage(`Generation error: ${err.message}`, "error");
      alert(`Pipeline Failed: ${err.message}`);
      resetUI();
    } finally {
      // Re-enable form
      generateBtn.disabled = false;
      spinner.classList.add("hidden");
    }
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
});
