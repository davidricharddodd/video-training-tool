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
      logMessage(`Submitting generation request to server...`);
      
      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to initiate generation pipeline.");
      }

      const jobId = data.jobId;
      logMessage(`Generation job initiated successfully. Job ID: ${jobId}`);
      logMessage(`Step 1/2: Triggering Kokoro-82M TTS model...`);
      updateProgress("Generating Speech Audio", "Requesting text-to-speech from Replicate...", 30);

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
              if (job.step === "tts") {
                updateProgress("Generating Speech Audio", "Processing text segments. Generating natural voice curves...", 40);
              } else if (job.step === "latentsync") {
                logMessage(`Step 1/2 complete. Speech audio generated.`, "success");
                logMessage(`Step 2/2: Starting LatentSync lip-sync model on Replicate...`);
                logMessage(`This process takes 1-3 minutes. Checking progress...`);
                updateProgress("Synchronizing Lips (LatentSync)", "Applying facial audio-conditioned diffusion. This may take up to 2-3 minutes...", 70);
              }
            } else if (job.step === "latentsync") {
              // Periodically update the progress bar to show activity during lip sync
              updateProgress("Synchronizing Lips (LatentSync)", "Generating facial expression changes in latent space...", 85);
            }
          } else if (job.status === "completed") {
            clearInterval(pollInterval);
            
            logMessage(`Audio generated successfully.`, "success");
            logMessage(`Audio Link: ${job.audioUrl}`);
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
            
            // Re-enable form
            generateBtn.disabled = false;
            spinner.classList.add("hidden");
          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            throw new Error(job.error || "Generation failed on server.");
          }
        } catch (pollErr) {
          clearInterval(pollInterval);
          console.error(pollErr);
          logMessage(`Polling error: ${pollErr.message}`, "error");
          alert(`Pipeline Failed: ${pollErr.message}`);
          resetUI();
          generateBtn.disabled = false;
          spinner.classList.add("hidden");
        }
      }, 3000);

    } catch (err) {
      console.error(err);
      logMessage(`Generation error: ${err.message}`, "error");
      alert(`Pipeline Failed: ${err.message}`);
      resetUI();
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
