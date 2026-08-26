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
  const lipsyncProvider = document.getElementById("lipsyncProvider");
  const lipsyncEngine = document.getElementById("lipsyncEngine");
  const presetPreviewVideo = document.getElementById("presetPreviewVideo");
  const presetPreviewContainer = document.getElementById("presetPreviewContainer");
  const previewLogoOverlay = document.getElementById("previewLogoOverlay");
  const avatarUrlContainer = document.getElementById("avatarUrlContainer");
  const avatarUploadContainer = document.getElementById("avatarUploadContainer");
  const avatarFile = document.getElementById("avatarFile");
  const uploadFilename = document.getElementById("uploadFilename");

  // Avatar Generation Elements
  const avatarGenerateContainer = document.getElementById("avatarGenerateContainer");
  const genAvatarGender = document.getElementById("genAvatarGender");
  const genAvatarFraming = document.getElementById("genAvatarFraming");
  const genAvatarBackground = document.getElementById("genAvatarBackground");
  const generateAvatarBtn = document.getElementById("generateAvatarBtn");
  const generateAvatarBtnLabel = document.getElementById("generateAvatarBtnLabel");
  const generateAvatarSpinner = document.getElementById("generateAvatarSpinner");
  const generatedAvatarPreviewContainer = document.getElementById("generatedAvatarPreviewContainer");
  const generatedAvatarPreviewVideo = document.getElementById("generatedAvatarPreviewVideo");
  const saveAvatarName = document.getElementById("saveAvatarName");
  const saveAvatarBtn = document.getElementById("saveAvatarBtn");
  const deleteCustomAvatarBtn = document.getElementById("deleteCustomAvatarBtn");
  const customLibraryGroup = document.getElementById("customLibraryGroup");
  let generatedAvatarUrl = null;
  let customAvatars = [];

  // Branding Elements
  const logoFile = document.getElementById("logoFile");
  const logoFilename = document.getElementById("logoFilename");
  const logoPosition = document.getElementById("logoPosition");
  const bgFile = document.getElementById("bgFile");
  const bgFilename = document.getElementById("bgFilename");
  const bgPresenterAlign = document.getElementById("bgPresenterAlign");

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

  // Initialize: Set local tokens if saved in localStorage
  const savedToken = localStorage.getItem("replicate_token");
  if (savedToken) {
    document.getElementById("customToken").value = savedToken;
  }
  const savedFalToken = localStorage.getItem("fal_token");
  if (savedFalToken) {
    document.getElementById("falToken").value = savedFalToken;
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

  // Live Preview compositor for Watermark Logo and Background
  function updateBrandingPreview() {
    // 1. Process Background Image preview
    if (bgFile.files && bgFile.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        presetPreviewContainer.style.backgroundImage = `url('${e.target.result}')`;
      };
      reader.readAsDataURL(bgFile.files[0]);

      // Align presenter video based on selection
      presetPreviewVideo.style.height = "100%";
      presetPreviewVideo.style.width = "auto";
      presetPreviewVideo.style.position = "absolute";
      presetPreviewVideo.style.top = "0";
      
      const align = bgPresenterAlign.value;
      if (align === "left") {
        presetPreviewVideo.style.left = "8%";
        presetPreviewVideo.style.right = "auto";
        presetPreviewVideo.style.transform = "none";
      } else if (align === "right") {
        presetPreviewVideo.style.left = "auto";
        presetPreviewVideo.style.right = "8%";
        presetPreviewVideo.style.transform = "none";
      } else { // Center
        presetPreviewVideo.style.left = "50%";
        presetPreviewVideo.style.right = "auto";
        presetPreviewVideo.style.transform = "translateX(-50%)";
      }
    } else {
      presetPreviewContainer.style.backgroundImage = "none";
      presetPreviewVideo.style.position = "static";
      presetPreviewVideo.style.width = "100%";
      presetPreviewVideo.style.height = "100%";
      presetPreviewVideo.style.transform = "none";
    }

    // 2. Process Logo Watermark preview
    if (logoFile.files && logoFile.files.length > 0) {
      const reader = new FileReader();
      reader.onload = (e) => {
        previewLogoOverlay.src = e.target.result;
        previewLogoOverlay.classList.remove("hidden");
      };
      reader.readAsDataURL(logoFile.files[0]);

      // Position watermark logo preview
      const pos = logoPosition.value;
      // Reset positions first
      previewLogoOverlay.style.top = "auto";
      previewLogoOverlay.style.bottom = "auto";
      previewLogoOverlay.style.left = "auto";
      previewLogoOverlay.style.right = "auto";

      if (pos === "top_left") {
        previewLogoOverlay.style.top = "8px";
        previewLogoOverlay.style.left = "8px";
      } else if (pos === "top_right") {
        previewLogoOverlay.style.top = "8px";
        previewLogoOverlay.style.right = "8px";
      } else if (pos === "bottom_left") {
        previewLogoOverlay.style.bottom = "8px";
        previewLogoOverlay.style.left = "8px";
      } else if (pos === "bottom_right") {
        previewLogoOverlay.style.bottom = "8px";
        previewLogoOverlay.style.right = "8px";
      }
    } else {
      previewLogoOverlay.classList.add("hidden");
      previewLogoOverlay.src = "";
    }
  }

  logoFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      logoFilename.textContent = `Selected: ${e.target.files[0].name}`;
      logoFilename.classList.remove("text-slate-400");
      logoFilename.classList.add("text-violet-400", "font-semibold");
    } else {
      logoFilename.textContent = "Select logo image";
      logoFilename.classList.remove("text-violet-400", "font-semibold");
      logoFilename.classList.add("text-slate-400");
    }
    updateBrandingPreview();
  });

  logoPosition.addEventListener("change", updateBrandingPreview);

  bgFile.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      bgFilename.textContent = `Selected: ${e.target.files[0].name}`;
      bgFilename.classList.remove("text-slate-400");
      bgFilename.classList.add("text-violet-400", "font-semibold");
    } else {
      bgFilename.textContent = "Select background image";
      bgFilename.classList.remove("text-violet-400", "font-semibold");
      bgFilename.classList.add("text-slate-400");
    }
    updateBrandingPreview();
  });

  bgPresenterAlign.addEventListener("change", updateBrandingPreview);

  // Toggle visible inputs based on Avatar Type radio select
  avatarTypeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      avatarPresetContainer.classList.toggle("hidden", val !== "preset");
      avatarUrlContainer.classList.toggle("hidden", val !== "url");
      avatarUploadContainer.classList.toggle("hidden", val !== "upload");
      avatarGenerateContainer.classList.toggle("hidden", val !== "generate");
    });
  });

  // Generate a base avatar loop video via Fal.ai text-to-video
  generateAvatarBtn.addEventListener("click", async () => {
    const falToken = document.getElementById("falToken").value;
    generateAvatarBtn.disabled = true;
    generateAvatarBtnLabel.textContent = "Generating... (1-3 min)";
    generateAvatarSpinner.classList.remove("hidden");
    generatedAvatarUrl = null;
    generatedAvatarPreviewContainer.classList.add("hidden");

    try {
      logMessage(`Requesting avatar generation (${genAvatarGender.value}, ${genAvatarFraming.value}, ${genAvatarBackground.value})...`);
      const startResponse = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: genAvatarGender.value,
          framing: genAvatarFraming.value,
          background: genAvatarBackground.value,
          falToken: falToken
        })
      });
      const startData = await startResponse.json();
      if (!startResponse.ok || !startData.success) {
        throw new Error(startData.error || "Failed to start avatar generation.");
      }

      const jobId = startData.jobId;
      let lastLogIndex = 0;

      await new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const statusResponse = await fetch(`/api/jobs/${jobId}`);
            const statusData = await statusResponse.json();
            if (!statusResponse.ok || !statusData.success) {
              throw new Error(statusData.error || "Lost track of avatar generation job.");
            }
            const job = statusData.job;

            if (job.logs && job.logs.length > lastLogIndex) {
              for (let i = lastLogIndex; i < job.logs.length; i++) {
                const cleanMsg = job.logs[i].replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, "");
                logMessage(cleanMsg);
              }
              lastLogIndex = job.logs.length;
            }

            if (job.status === "completed") {
              clearInterval(pollInterval);
              resolve(job.videoUrl);
            } else if (job.status === "failed") {
              clearInterval(pollInterval);
              reject(new Error(job.error || "Avatar generation failed on server."));
            }
          } catch (pollErr) {
            clearInterval(pollInterval);
            reject(pollErr);
          }
        }, 3000);
      }).then((videoUrl) => {
        generatedAvatarUrl = videoUrl;
        generatedAvatarPreviewVideo.src = videoUrl;
        generatedAvatarPreviewContainer.classList.remove("hidden");
        logMessage(`Avatar loop generated successfully!`, "success");
      });
    } catch (err) {
      console.error(err);
      logMessage(`Avatar generation error: ${err.message}`, "error");
      alert(`Avatar Generation Failed: ${err.message}`);
    } finally {
      generateAvatarBtn.disabled = false;
      generateAvatarBtnLabel.textContent = "Generate Avatar Loop";
      generateAvatarSpinner.classList.add("hidden");
    }
  });

  // Save generated avatar to custom library presets
  saveAvatarBtn.addEventListener("click", async () => {
    const name = saveAvatarName.value.trim();
    if (!name) {
      alert("Please enter a name for this custom avatar loop.");
      return;
    }
    if (!generatedAvatarUrl) {
      alert("No generated avatar loop to save.");
      return;
    }

    saveAvatarBtn.disabled = true;
    saveAvatarBtn.textContent = "Saving...";

    try {
      const response = await fetch("/api/custom-avatars", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, videoUrl: generatedAvatarUrl })
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to save custom avatar.");
      }

      logMessage(`Custom avatar "${name}" saved to presets library!`, "success");
      saveAvatarName.value = "";
      
      // Reload custom presets and select the newly saved one
      await loadCustomAvatars();
      avatarPreset.value = data.avatar.id;
      
      // Switch active avatar selector type radio to "preset"
      const presetRadio = document.querySelector('input[name="avatarType"][value="preset"]');
      if (presetRadio) {
        presetRadio.checked = true;
        presetRadio.dispatchEvent(new Event("change"));
      }
      
      // Trigger preset change listener to load preview and show delete button
      avatarPreset.dispatchEvent(new Event("change"));
      
    } catch (err) {
      console.error(err);
      alert(`Save Failed: ${err.message}`);
    } finally {
      saveAvatarBtn.disabled = false;
      saveAvatarBtn.textContent = "Save to Presets";
    }
  });

  // Delete custom saved avatar loop
  deleteCustomAvatarBtn.addEventListener("click", async () => {
    const selectedPreset = avatarPreset.value;
    if (!selectedPreset || !selectedPreset.startsWith("custom_")) {
      return;
    }

    const match = customAvatars.find(a => a.id === selectedPreset);
    const name = match ? match.name : "this custom avatar";

    if (!confirm(`Are you sure you want to delete "${name}"? This will physically remove the saved video file from the server.`)) {
      return;
    }

    deleteCustomAvatarBtn.disabled = true;

    try {
      const response = await fetch(`/api/custom-avatars/${selectedPreset}`, {
        method: "DELETE"
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to delete custom avatar.");
      }

      logMessage(`Custom avatar "${name}" deleted from library.`, "success");
      
      // Reload presets list and default back to first standard preset
      await loadCustomAvatars();
      avatarPreset.value = "preset_female_1";
      avatarPreset.dispatchEvent(new Event("change"));

    } catch (err) {
      console.error(err);
      alert(`Delete Failed: ${err.message}`);
    } finally {
      deleteCustomAvatarBtn.disabled = false;
    }
  });

  // Dynamic model options selection based on provider
  const modelOptions = {
    fal: [
      { value: "fal_kling", text: "Kling LipSync (Cost: ~$0.17/min | Quality: Studio Grade)" },
      { value: "fal_sync_lipsync_3", text: "Sync Labs Lipsync v3 (Cost: ~$3.00/min | Quality: Cinema Grade)" },
      { value: "fal_wav2lip", text: "Wav2Lip (Cost: ~$0.70/min | Quality: Standard)" },
      { value: "fal_latentsync", text: "LatentSync (Cost: ~$0.20 for 40s, then $0.005/s | Quality: Good)" }
    ],
    replicate: [
      { value: "sync_lipsync_2", text: "Sync Labs Lipsync 2 (Cost: ~$3.00/min | Quality: Studio Grade)" },
      { value: "sync_lipsync_2_pro", text: "Sync Labs Lipsync 2 Pro (Cost: ~$5.00/min | Quality: Cinema Grade)" },
      { value: "latentsync", text: "LatentSync (Cost: ~$0.05 total | Quality: Standard)" }
    ]
  };

  function updateModelOptions() {
    const provider = lipsyncProvider.value;
    const options = modelOptions[provider] || [];
    lipsyncEngine.innerHTML = "";
    options.forEach(opt => {
      const el = document.createElement("option");
      el.value = opt.value;
      el.textContent = opt.text;
      lipsyncEngine.appendChild(el);
    });
  }

  lipsyncProvider.addEventListener("change", updateModelOptions);
  updateModelOptions(); // Initialize default list on load

  // Load custom avatars from library
  async function loadCustomAvatars() {
    try {
      const response = await fetch("/api/custom-avatars");
      const data = await response.json();
      if (response.ok && data.success) {
        customAvatars = data.avatars;
        
        // Populate option group
        customLibraryGroup.innerHTML = "";
        if (customAvatars.length === 0) {
          const placeholder = document.createElement("option");
          placeholder.disabled = true;
          placeholder.textContent = "(No saved custom avatars)";
          customLibraryGroup.appendChild(placeholder);
        } else {
          customAvatars.forEach(avatar => {
            const option = document.createElement("option");
            option.value = avatar.id;
            option.className = "text-slate-200 normal-case";
            option.textContent = avatar.name;
            customLibraryGroup.appendChild(option);
          });
        }
      }
    } catch (err) {
      console.error("Failed to load custom avatars:", err);
    }
  }

  // Load custom avatars on startup
  loadCustomAvatars();

  // Map presets to their raw video URLs for frontend previewing
  const presetVideoUrls = {
    preset_female_1: "/presets/female_1.mp4",
    preset_female_2: "/presets/female_2.mp4",
    preset_female_3: "/presets/female_3.mp4",
    preset_female_4: "/presets/female_4.mp4",
    preset_female_5: "/presets/female_5.mp4",
    preset_female_6: "/presets/female_6.mp4",
    preset_male_1: "/presets/male_1.mp4",
    preset_male_2: "/presets/male_2.mp4",
    preset_male_3: "/presets/male_3.mp4",
    preset_male_4: "/presets/male_4.mp4",
    preset_male_5: "/presets/male_5.mp4"
  };

  // Change preset preview when selection changes
  avatarPreset.addEventListener("change", (e) => {
    const selectedPreset = e.target.value;
    let url;
    if (selectedPreset && selectedPreset.startsWith("custom_")) {
      const match = customAvatars.find(a => a.id === selectedPreset);
      url = match ? match.videoUrl : null;
      deleteCustomAvatarBtn.classList.remove("hidden");
    } else {
      url = presetVideoUrls[selectedPreset];
      deleteCustomAvatarBtn.classList.add("hidden");
    }

    if (url) {
      presetPreviewVideo.src = url;
      presetPreviewVideo.load();
      presetPreviewVideo.play().catch(err => console.log("Auto-play blocked:", err));
      updateBrandingPreview();
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
    const falToken = document.getElementById("falToken").value;

    if (!text || text.trim() === "") {
      alert("Please enter a speech script first.");
      return;
    }

    if (customToken) {
      localStorage.setItem("replicate_token", customToken);
    } else {
      localStorage.removeItem("replicate_token");
    }

    if (falToken) {
      localStorage.setItem("fal_token", falToken);
    } else {
      localStorage.removeItem("fal_token");
    }

    // UI Loading state
    generateAudioBtn.disabled = true;
    audioSpinner.classList.remove("hidden");
    logMessage("Step 1: Generating audio preview...");

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          voice, 
          customToken, 
          customFalToken: falToken, 
          lipsyncProvider: lipsyncProvider.value 
        })
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
    const falToken = document.getElementById("falToken").value;
    const avatarType = document.querySelector('input[name="avatarType"]:checked').value;
    const avatarPreset = document.getElementById("avatarPreset").value;
    const avatarUrl = document.getElementById("avatarUrl").value;
    const provider = lipsyncProvider.value;
    const engine = lipsyncEngine.value;
    const faceEnhancer = document.getElementById("faceEnhancer").checked;

    if (customToken) {
      localStorage.setItem("replicate_token", customToken);
    } else {
      localStorage.removeItem("replicate_token");
    }

    if (falToken) {
      localStorage.setItem("fal_token", falToken);
    } else {
      localStorage.removeItem("fal_token");
    }

    // The backend only knows preset/url/upload - a generated avatar is submitted as a URL
    const submittedAvatarType = avatarType === "generate" ? "url" : avatarType;

    // Build Form Data to handle potential file uploads
    const formData = new FormData();
    formData.append("audioFilename", generatedAudioFilename);
    formData.append("avatarType", submittedAvatarType);
    formData.append("lipsyncProvider", provider);
    formData.append("lipsyncEngine", engine);
    formData.append("customToken", customToken);
    formData.append("falToken", falToken);
    formData.append("faceEnhancer", faceEnhancer);
    formData.append("logoPosition", logoPosition.value);
    formData.append("bgPresenterAlign", bgPresenterAlign.value);

    if (logoFile.files.length > 0) {
      formData.append("logoFile", logoFile.files[0]);
    }
    if (bgFile.files.length > 0) {
      formData.append("bgFile", bgFile.files[0]);
    }

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
    } else if (avatarType === "generate") {
      if (!generatedAvatarUrl) {
        logMessage("Validation error: No avatar has been generated yet.", "error");
        alert("Please click \"Generate Avatar Loop\" first, or switch to a different Avatar Video Source.");
        return;
      }
      const absoluteAvatarUrl = window.location.origin + generatedAvatarUrl;
      formData.append("avatarUrl", absoluteAvatarUrl);
      logMessage(`Using generated avatar video: ${absoluteAvatarUrl}`);
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
      let lastLogIndex = 0;
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

          // Stream backend logs to frontend console
          if (job.logs && job.logs.length > lastLogIndex) {
            for (let i = lastLogIndex; i < job.logs.length; i++) {
              const cleanMsg = job.logs[i].replace(/^\[\d{1,2}:\d{2}:\d{2}\]\s*/, "");
              logMessage(cleanMsg);
            }
            lastLogIndex = job.logs.length;
          }
          
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
        let actionButtons = [];

        if (item.status === "completed" && item.videoUrl) {
          statusBadge = `<span class="px-2 py-0.5 bg-emerald-950 text-emerald-400 border border-emerald-900 rounded-md text-[10px] font-semibold">Video Ready</span>`;
          actionButtons.push(`
            <button class="load-video-btn px-2.5 py-1 bg-violet-600 border border-violet-500 hover:bg-violet-500 rounded-lg text-white font-medium text-[11px] transition-colors" 
              data-video="${item.videoUrl}" data-audio="${item.audioUrl}">
              Load Video
            </button>
          `);
        } else if (item.status === "failed") {
          statusBadge = `<span class="px-2 py-0.5 bg-rose-950/80 text-rose-450 border border-rose-900 rounded-md text-[10px] font-semibold">Failed</span>`;
        } else if (item.status === "video_generating") {
          statusBadge = `<span class="px-2 py-0.5 bg-amber-950 text-amber-400 border border-amber-900 rounded-md text-[10px] font-semibold animate-pulse">Syncing...</span>`;
        } else {
          statusBadge = `<span class="px-2 py-0.5 bg-slate-900 text-slate-400 border border-slate-800 rounded-md text-[10px] font-semibold">Audio Preview</span>`;
        }

        // Always show "Use Audio" if audio URL exists, so they can retry or build another video run
        if (item.audioUrl) {
          actionButtons.push(`
            <button class="use-audio-btn px-2.5 py-1 bg-slate-900 border border-slate-800 hover:border-violet-500 hover:text-violet-400 rounded-lg font-medium text-[11px] transition-colors"
              data-filename="${item.audioUrl.split('/').pop()}" data-url="${item.audioUrl}">
              Use Audio
            </button>
          `);
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
            <div class="flex items-center space-x-1">
              ${actionButtons.join("")}
            </div>
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

          // Reset main player/status states back to idle config
          resetUI();

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
