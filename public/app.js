document.addEventListener("DOMContentLoaded", () => {
  const generateAudioBtn = document.getElementById("generateAudioBtn");
  const audioSpinner = document.getElementById("audioSpinner");
  const generateVideoBtn = document.getElementById("generateVideoBtn");
  const videoSpinner = document.getElementById("videoSpinner");
  const videoActionContainer = document.getElementById("videoActionContainer");
  const audioPreviewPlayer = document.getElementById("audioPreviewPlayer");
  const audioPreviewSource = document.getElementById("audioPreviewSource");
  
  // Script and Scene elements
  const scriptText = document.getElementById("text");
  const voiceSelect = document.getElementById("voice");
  const pauseBtns = document.querySelectorAll(".pause-btn");
  const analyzeScriptBtn = document.getElementById("analyzeScriptBtn");
  const targetSceneCount = document.getElementById("targetSceneCount");
  const scenesContainer = document.getElementById("scenesContainer");
  const sceneCardsGrid = document.getElementById("sceneCardsGrid");
  const sceneCountLabel = document.getElementById("sceneCountLabel");
  let currentScenes = [];

  // Conditionally visible containers
  const avatarTypeRadios = document.querySelectorAll('input[name="avatarType"]');
  const avatarPresetContainer = document.getElementById("avatarPresetContainer");
  const avatarPreset = document.getElementById("avatarPreset");
  const lipsyncProvider = document.getElementById("lipsyncProvider");
  const lipsyncEngine = document.getElementById("lipsyncEngine");
  const avatarUrlContainer = document.getElementById("avatarUrlContainer");
  const avatarUploadContainer = document.getElementById("avatarUploadContainer");
  const avatarFile = document.getElementById("avatarFile");
  const uploadFilename = document.getElementById("uploadFilename");

  // Avatar Generation Elements
  const avatarGenerateContainer = document.getElementById("avatarGenerateContainer");
  const genAvatarGender = document.getElementById("genAvatarGender");
  const genAvatarFraming = document.getElementById("genAvatarFraming");
  const genAvatarEthnicity = document.getElementById("genAvatarEthnicity");
  const genAvatarAge = document.getElementById("genAvatarAge");
  const genAvatarBackground = document.getElementById("genAvatarBackground");
  const generateAvatarBtn = document.getElementById("generateAvatarBtn");
  const generateAvatarBtnLabel = document.getElementById("generateAvatarBtnLabel");
  const generateAvatarSpinner = document.getElementById("generateAvatarSpinner");
  const deleteCustomAvatarBtn = document.getElementById("deleteCustomAvatarBtn");
  const customAvatarsOptGroup = document.getElementById("customAvatarsOptGroup");
  let customAvatars = [];

  // Branding Elements
  const logoFile = document.getElementById("logoFile");
  const logoPosition = document.getElementById("logoPosition");

  // Summary labels
  const summaryVoiceLabel = document.getElementById("summaryVoiceLabel");
  const summaryEngineLabel = document.getElementById("summaryEngineLabel");
  const summaryScenesLabel = document.getElementById("summaryScenesLabel");

  // Output containers
  const idleState = document.getElementById("idleState");
  const loadingState = document.getElementById("loadingState");
  const successState = document.getElementById("successState");
  const currentStepTitle = document.getElementById("currentStepTitle");
  const currentStepDetail = document.getElementById("currentStepDetail");
  const progressBar = document.getElementById("progressBar");
  
  const outputVideoPlayer = document.getElementById("outputVideoPlayer");
  const videoSource = document.getElementById("videoSource");
  const downloadBtn = document.getElementById("downloadBtn");
  
  const consoleLogs = document.getElementById("consoleLogs");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Tab Navigation Manager
  const tabBtns = document.querySelectorAll(".wizard-tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  function switchTab(tabNum) {
    tabBtns.forEach(btn => {
      const isTarget = btn.getAttribute("data-tab") === String(tabNum);
      if (isTarget) {
        btn.classList.add("bg-violet-600", "text-white", "shadow-lg", "shadow-violet-600/20");
        btn.classList.remove("text-slate-400", "hover:text-slate-200", "hover:bg-slate-850");
      } else {
        btn.classList.remove("bg-violet-600", "text-white", "shadow-lg", "shadow-violet-600/20");
        btn.classList.add("text-slate-400", "hover:text-slate-200", "hover:bg-slate-850");
      }
    });

    tabContents.forEach(content => {
      const isTarget = content.id === `tabContent${tabNum}`;
      content.classList.toggle("hidden", !isTarget);
    });

    // Update Summary Card
    if (String(tabNum) === "4") {
      summaryVoiceLabel.textContent = voiceSelect.options[voiceSelect.selectedIndex].text;
      summaryEngineLabel.textContent = lipsyncEngine.options[lipsyncEngine.selectedIndex] ? lipsyncEngine.options[lipsyncEngine.selectedIndex].text : lipsyncProvider.value;
      summaryScenesLabel.textContent = currentScenes.length > 0 ? `${currentScenes.length} Scenes Ready` : "Full Script (1 Scene)";
    }
  }

  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab")));
  });

  document.querySelectorAll(".nav-next-btn, .nav-prev-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.getAttribute("data-target");
      if (target) switchTab(target);
    });
  });

  // Initialize LocalStorage Tokens
  const savedToken = localStorage.getItem("replicate_token");
  if (savedToken) document.getElementById("customToken").value = savedToken;
  const savedFalToken = localStorage.getItem("fal_token");
  if (savedFalToken) document.getElementById("falToken").value = savedFalToken;
  const savedDeepgramToken = localStorage.getItem("deepgram_token");
  if (savedDeepgramToken) document.getElementById("deepgramToken").value = savedDeepgramToken;

  // AI Scene Breakdown Trigger
  analyzeScriptBtn.addEventListener("click", async () => {
    const rawText = scriptText.value;
    if (!rawText || !rawText.trim()) {
      alert("Please enter a speech script first.");
      return;
    }

    analyzeScriptBtn.disabled = true;
    analyzeScriptBtn.innerHTML = `<span>⏳ Analyzing script into ${targetSceneCount.value} scenes...</span>`;

    try {
      const response = await fetch("/api/breakdown-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          targetSceneCount: targetSceneCount.value
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to analyze scenes.");
      }

      currentScenes = data.scenes;
      renderSceneCards(currentScenes);
      logMessage(`Successfully analyzed script into ${currentScenes.length} scenes with 3-4 key highlight overlays!`, "success");
    } catch (err) {
      console.error(err);
      alert(err.message);
      logMessage(`Error breaking down scenes: ${err.message}`, "error");
    } finally {
      analyzeScriptBtn.disabled = false;
      analyzeScriptBtn.innerHTML = `<span>⚡ Analyze &amp; Generate Scene Breakdown</span>`;
    }
  });

  function renderSceneCards(scenes) {
    sceneCardsGrid.innerHTML = "";
    if (!scenes || scenes.length === 0) {
      scenesContainer.classList.add("hidden");
      return;
    }

    sceneCountLabel.textContent = `${scenes.length} Scenes Active`;
    scenesContainer.classList.remove("hidden");

    scenes.forEach((scene, index) => {
      const card = document.createElement("div");
      card.className = "bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner";

      const highlightsHtml = (scene.highlights || []).map((hl, hIdx) => `
        <div class="flex items-center space-x-2">
          <span class="h-2 w-2 rounded-full bg-violet-400 flex-shrink-0"></span>
          <input type="text" value="${hl.replace(/"/g, '&quot;')}" data-scene="${index}" data-highlight="${hIdx}"
            class="scene-highlight-input w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-violet-500 focus:outline-none transition-all" />
        </div>
      `).join("");

      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-850 pb-2">
          <input type="text" value="${scene.title.replace(/"/g, '&quot;')}" data-scene="${index}" field="title"
            class="scene-title-input font-semibold text-xs text-violet-300 bg-transparent border-none focus:outline-none w-full" />
          <span class="text-[10px] bg-violet-950/60 text-violet-300 px-2 py-0.5 rounded border border-violet-800 font-semibold flex-shrink-0">Scene ${index + 1}</span>
        </div>
        <div>
          <label class="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Scene Script Segment</label>
          <textarea data-scene="${index}" field="script" rows="2"
            class="scene-script-input w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:border-violet-500 focus:outline-none resize-none">${scene.script}</textarea>
        </div>
        <div>
          <label class="block text-[9px] uppercase font-semibold text-slate-500 mb-1.5">3-4 On-Screen Key Highlights</label>
          <div class="space-y-1.5">
            ${highlightsHtml}
          </div>
        </div>
      `;
      sceneCardsGrid.appendChild(card);
    });

    document.querySelectorAll(".scene-title-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.getAttribute("data-scene"), 10);
        currentScenes[idx].title = e.target.value;
      });
    });

    document.querySelectorAll(".scene-script-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const idx = parseInt(e.target.getAttribute("data-scene"), 10);
        currentScenes[idx].script = e.target.value;
      });
    });

    document.querySelectorAll(".scene-highlight-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const sIdx = parseInt(e.target.getAttribute("data-scene"), 10);
        const hIdx = parseInt(e.target.getAttribute("data-highlight"), 10);
        currentScenes[sIdx].highlights[hIdx] = e.target.value;
      });
    });
  }

  // Load Custom Avatars
  async function loadCustomAvatars() {
    try {
      const response = await fetch("/api/custom-avatars");
      const data = await response.json();
      if (data.success) {
        customAvatars = data.avatars;
        renderCustomAvatarOptions();
      }
    } catch (err) {
      console.error("Failed to load custom avatars:", err);
    }
  }

  function renderCustomAvatarOptions() {
    customAvatarsOptGroup.innerHTML = "";
    if (customAvatars.length === 0) {
      const emptyOpt = document.createElement("option");
      emptyOpt.disabled = true;
      emptyOpt.textContent = "No saved custom avatars yet";
      customAvatarsOptGroup.appendChild(emptyOpt);
      deleteCustomAvatarBtn.classList.add("hidden");
      return;
    }

    customAvatars.forEach(avt => {
      const opt = document.createElement("option");
      opt.value = avt.id;
      opt.textContent = `⭐ ${avt.name}`;
      customAvatarsOptGroup.appendChild(opt);
    });

    updateDeleteBtnVisibility();
  }

  // Presenter preview video player
  const presenterPreviewPlayer = document.getElementById("presenterPreviewPlayer");
  const presenterPreviewName = document.getElementById("presenterPreviewName");

  const presetVideoMap = {
    preset_female_1: { src: "/presets/female_1.mp4", name: "Sarah - Professional Corporate" },
    preset_female_2: { src: "/presets/female_2.mp4", name: "Emma - Warm & Friendly" },
    preset_female_3: { src: "/presets/female_3.mp4", name: "Jessica - Executive Leadership" },
    preset_female_4: { src: "/presets/female_4.mp4", name: "Chloe - Casual Tech Presenter" },
    preset_female_5: { src: "/presets/female_5.mp4", name: "Amara - Black Presenter" },
    preset_female_6: { src: "/presets/female_6.mp4", name: "Mei - Asian Presenter" },
    preset_male_1:   { src: "/presets/male_1.mp4",   name: "David - Corporate Executive" },
    preset_male_2:   { src: "/presets/male_2.mp4",   name: "James - Technical Trainer" },
    preset_male_3:   { src: "/presets/male_3.mp4",   name: "Marcus - Black Presenter" },
    preset_male_4:   { src: "/presets/male_4.mp4",   name: "Rohan - South Asian Presenter" },
    preset_male_5:   { src: "/presets/male_5.mp4",   name: "Alex - Creative Presenter" }
  };

  function updatePresenterPreview() {
    const val = avatarPreset.value;
    const info = presetVideoMap[val];
    if (info && presenterPreviewPlayer) {
      presenterPreviewPlayer.src = info.src;
      presenterPreviewPlayer.load();
      presenterPreviewPlayer.play().catch(() => {});
    }
    if (info && presenterPreviewName) {
      presenterPreviewName.textContent = info.name;
    } else if (presenterPreviewName) {
      presenterPreviewName.textContent = "Custom Avatar";
    }
  }

  function updateDeleteBtnVisibility() {
    const isCustomSelected = avatarPreset.value && avatarPreset.value.startsWith("custom_");
    deleteCustomAvatarBtn.classList.toggle("hidden", !isCustomSelected);
  }

  avatarPreset.addEventListener("change", () => {
    updateDeleteBtnVisibility();
    updatePresenterPreview();
  });

  deleteCustomAvatarBtn.addEventListener("click", async () => {
    const selectedId = avatarPreset.value;
    if (!selectedId || !selectedId.startsWith("custom_")) return;

    if (!confirm("Are you sure you want to delete this custom saved avatar?")) return;

    try {
      const res = await fetch(`/api/custom-avatars/${selectedId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        logMessage(`Deleted custom avatar: ${selectedId}`, "success");
        await loadCustomAvatars();
        avatarPreset.value = "preset_female_1";
        updateDeleteBtnVisibility();
      } else {
        alert(data.error || "Failed to delete custom avatar.");
      }
    } catch (err) {
      alert("Error deleting avatar: " + err.message);
    }
  });

  loadCustomAvatars();

  // Handle Radio button toggles for Avatar Source
  avatarTypeRadios.forEach(radio => {
    radio.addEventListener("change", (e) => {
      const val = e.target.value;
      avatarPresetContainer.classList.toggle("hidden", val !== "preset");
      avatarUrlContainer.classList.toggle("hidden", val !== "url");
      avatarUploadContainer.classList.toggle("hidden", val !== "upload");
      avatarGenerateContainer.classList.toggle("hidden", val !== "generate");
    });
  });

  // Kling AI Avatar Generator
  generateAvatarBtn.addEventListener("click", async () => {
    const falToken = document.getElementById("falToken").value;
    generateAvatarBtn.disabled = true;
    generateAvatarBtnLabel.textContent = "Generating... (1-3 min)";
    generateAvatarSpinner.classList.remove("hidden");

    try {
      logMessage(`Requesting avatar generation (${genAvatarGender.value}, ${genAvatarEthnicity.value}, ${genAvatarAge.value}, ${genAvatarFraming.value}, ${genAvatarBackground.value})...`);
      const startResponse = await fetch("/api/generate-avatar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gender: genAvatarGender.value,
          framing: genAvatarFraming.value,
          ethnicity: genAvatarEthnicity.value,
          age: genAvatarAge.value,
          background: genAvatarBackground.value,
          falToken: falToken
        })
      });
      const startData = await startResponse.json();
      if (!startResponse.ok || !startData.success) {
        throw new Error(startData.error || "Failed to start avatar generation.");
      }

      const jobId = startData.jobId;
      await new Promise((resolve, reject) => {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/jobs/${jobId}`);
            const statusData = await statusRes.json();
            if (statusData.success) {
              if (statusData.job.status === "completed") {
                clearInterval(pollInterval);
                generatedAvatarUrl = statusData.job.videoUrl;
                logMessage(`Avatar generated successfully: ${generatedAvatarUrl}`, "success");
                alert("Avatar generated! It is ready to use for lip-sync.");
                resolve();
              } else if (statusData.job.status === "failed") {
                clearInterval(pollInterval);
                reject(new Error(statusData.job.error || "Avatar generation failed."));
              }
            }
          } catch (err) {
            clearInterval(pollInterval);
            reject(err);
          }
        }, 5000);
      });

    } catch (err) {
      console.error(err);
      alert(`Avatar Generation Failed: ${err.message}`);
      logMessage(`Avatar generation error: ${err.message}`, "error");
    } finally {
      generateAvatarBtn.disabled = false;
      generateAvatarBtnLabel.textContent = "Generate Avatar Loop";
      generateAvatarSpinner.classList.add("hidden");
    }
  });

  // Dynamic Lip-Sync Engine Options
  function updateLipsyncEngines() {
    const provider = lipsyncProvider.value;
    lipsyncEngine.innerHTML = "";

    if (provider === "fal") {
      const engines = [
        { value: "fal_latentsync",  label: "LatentSync — ~$0.02/min · Reliable · Natural Expression" },
        { value: "fal_sync_labs",   label: "Sync Labs Lipsync-2 Pro — ~$0.08/min · Best Quality (may be unavailable)" },
        { value: "fal_wav2lip",     label: "Wav2Lip — ~$0.01/min · Fastest / Cheapest" }
      ];
      engines.forEach(eng => {
        const opt = document.createElement("option");
        opt.value = eng.value;
        opt.textContent = eng.label;
        lipsyncEngine.appendChild(opt);
      });
    } else {
      const engines = [
        { value: "sync_lipsync_2_pro", label: "Sync Labs Lipsync-2 Pro — ~$0.10/min · Best Quality" },
        { value: "sync_lipsync_2",     label: "Sync Labs Lipsync-2 — ~$0.05/min · Good Quality" },
        { value: "latentsync",         label: "ByteDance LatentSync — ~$0.03/min · Natural Expression" }
      ];
      engines.forEach(eng => {
        const opt = document.createElement("option");
        opt.value = eng.value;
        opt.textContent = eng.label;
        lipsyncEngine.appendChild(opt);
      });
    }

    // Update the cost hint below the dropdown
    updateEngineCostHint();
  }

  function updateEngineCostHint() {
    const hintEl = document.getElementById("engineCostHint");
    if (!hintEl) return;
    const costMap = {
      fal_sync_labs:      { cost: "~$0.08/min",  quality: "⭐ Best lip-sync fidelity" },
      fal_latentsync:     { cost: "~$0.02/min",  quality: "Natural head movement & expression" },
      fal_wav2lip:        { cost: "~$0.01/min",  quality: "Fast, slightly lower detail" },
      sync_lipsync_2_pro: { cost: "~$0.10/min",  quality: "⭐ Best lip-sync fidelity" },
      sync_lipsync_2:     { cost: "~$0.05/min",  quality: "Good general-purpose quality" },
      latentsync:         { cost: "~$0.03/min",  quality: "Natural head movement & expression" }
    };
    const info = costMap[lipsyncEngine.value];
    if (info) {
      hintEl.textContent = `Est. cost: ${info.cost} of output video · ${info.quality}`;
    }
  }

  lipsyncEngine.addEventListener("change", updateEngineCostHint);
  lipsyncProvider.addEventListener("change", updateLipsyncEngines);
  updateLipsyncEngines();

  // Pause Insert Buttons
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

  let generatedAudioFilename = null;

  // Step 2: Generate Audio Preview
  generateAudioBtn.addEventListener("click", async () => {
    const text = scriptText.value;
    const voice = voiceSelect.value;
    const customToken = document.getElementById("customToken").value;
    const falToken = document.getElementById("falToken").value;
    const deepgramToken = document.getElementById("deepgramToken").value;

    if (!text || !text.trim()) {
      alert("Please enter a speech script first.");
      return;
    }

    if (customToken) localStorage.setItem("replicate_token", customToken);
    else localStorage.removeItem("replicate_token");
    if (falToken) localStorage.setItem("fal_token", falToken);
    else localStorage.removeItem("fal_token");
    if (deepgramToken) localStorage.setItem("deepgram_token", deepgramToken);
    else localStorage.removeItem("deepgram_token");

    generateAudioBtn.disabled = true;
    audioSpinner.classList.remove("hidden");
    logMessage("Step 2: Generating audio preview...");

    try {
      const response = await fetch("/api/generate-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          text, 
          voice, 
          customToken, 
          customFalToken: falToken, 
          customDeepgramToken: deepgramToken,
          lipsyncProvider: lipsyncProvider.value 
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate audio.");
      }

      generatedAudioFilename = data.filename;
      logMessage(`Audio generated successfully! Preview URL: ${data.audioUrl}`, "success");
      loadHistory();

      audioPreviewSource.src = data.audioUrl;
      audioPreviewPlayer.load();
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

  // Step 4: Generate Final Video
  generateVideoBtn.addEventListener("click", async () => {
    if (!generatedAudioFilename) {
      alert("No approved audio available. Please generate audio in Step 2 first.");
      switchTab(2);
      return;
    }

    const customToken = document.getElementById("customToken").value;
    const falToken = document.getElementById("falToken").value;
    const avatarType = document.querySelector('input[name="avatarType"]:checked').value;
    const avatarPresetVal = avatarPreset.value;
    const avatarUrl = document.getElementById("avatarUrl").value;
    const provider = lipsyncProvider.value;
    const engine = lipsyncEngine.value;
    const faceEnhancer = document.getElementById("faceEnhancer").checked;

    const submittedAvatarType = avatarType === "generate" ? "url" : avatarType;

    const formData = new FormData();
    formData.append("audioFilename", generatedAudioFilename);
    formData.append("avatarType", submittedAvatarType);
    formData.append("lipsyncProvider", provider);
    formData.append("lipsyncEngine", engine);
    formData.append("customToken", customToken);
    formData.append("falToken", falToken);
    formData.append("faceEnhancer", faceEnhancer);
    formData.append("logoPosition", logoPosition.value);
    formData.append("bgPresenterAlign", "right");

    if (currentScenes && currentScenes.length > 0) {
      formData.append("scenes", JSON.stringify(currentScenes));
    }

    if (logoFile.files.length > 0) {
      formData.append("logoFile", logoFile.files[0]);
    }

    if (avatarType === "preset") {
      formData.append("avatarPreset", avatarPresetVal);
      logMessage(`Target avatar video preset: ${avatarPresetVal}`);
    } else if (avatarType === "url" || avatarType === "generate") {
      const finalUrl = avatarType === "generate" ? generatedAvatarUrl : avatarUrl;
      if (!finalUrl) {
        alert("Please generate or enter a valid avatar video URL first.");
        return;
      }
      formData.append("avatarUrl", finalUrl);
      logMessage(`Target avatar video URL: ${finalUrl}`);
    } else if (avatarType === "upload") {
      if (avatarFile.files.length === 0) {
        alert("Please select an MP4 avatar video to upload.");
        return;
      }
      formData.append("avatarFile", avatarFile.files[0]);
      logMessage(`Target avatar uploaded file: ${avatarFile.files[0].name}`);
    }

    // UI Loading state
    generateVideoBtn.disabled = true;
    idleState.classList.add("hidden");
    successState.classList.add("hidden");
    loadingState.classList.remove("hidden");
    videoSpinner.classList.remove("hidden");

    currentStepTitle.textContent = "Synthesizing Lip-Sync Video...";
    currentStepDetail.textContent = "Processing presenter video and overlays...";
    progressBar.style.width = "20%";

    logMessage("Step 4: Dispatching video synthesis request...");

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        body: formData
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to start video generation job.");
      }

      const jobId = data.jobId;
      logMessage(`Job created successfully (ID: ${jobId}). Polling progress...`);

      let pollAttempts = 0;
      const maxPollAttempts = 360;

      const pollInterval = setInterval(async () => {
        pollAttempts++;
        if (pollAttempts > maxPollAttempts) {
          clearInterval(pollInterval);
          throw new Error("Video generation timed out after 30 minutes.");
        }

        try {
          const statusRes = await fetch(`/api/jobs/${jobId}`);
          const statusData = await statusRes.json();

          if (!statusRes.ok || !statusData.success) {
            console.error("Status check failed:", statusData);
            return;
          }

          const job = statusData.job;
          progressBar.style.width = `${job.progress}%`;

          if (job.status === "completed") {
            clearInterval(pollInterval);
            generateVideoBtn.disabled = false;
            videoSpinner.classList.add("hidden");
            loadingState.classList.add("hidden");
            successState.classList.remove("hidden");

            videoSource.src = job.videoUrl;
            outputVideoPlayer.load();
            downloadBtn.href = job.videoUrl;

            logMessage(`Video processing complete! Output URL: ${job.videoUrl}`, "success");
            loadHistory();

          } else if (job.status === "failed") {
            clearInterval(pollInterval);
            generateVideoBtn.disabled = false;
            videoSpinner.classList.add("hidden");
            loadingState.classList.add("hidden");
            idleState.classList.remove("hidden");

            logMessage(`Video generation error: ${job.error}`, "error");
            alert(`Video Generation Failed: ${job.error}`);
          }
        } catch (pollErr) {
          console.error("Error polling job status:", pollErr);
        }
      }, 5000);

    } catch (err) {
      console.error(err);
      generateVideoBtn.disabled = false;
      videoSpinner.classList.add("hidden");
      loadingState.classList.add("hidden");
      idleState.classList.remove("hidden");
      logMessage(`Video generation submission error: ${err.message}`, "error");
      alert(`Video Generation Failed: ${err.message}`);
    }
  });

  // History loader
  async function loadHistory() {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (!data.success) return;

      const historyList = document.getElementById("historyList");
      historyList.innerHTML = "";

      if (data.history.length === 0) {
        historyList.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">No recent generations.</div>`;
        return;
      }

      data.history.forEach(item => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs";
        
        const dateStr = new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const textSnippet = item.text.length > 60 ? item.text.substring(0, 60) + "..." : item.text;

        let statusBadge = `<span class="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800 rounded text-[10px]">Audio Preview</span>`;
        if (item.videoUrl) {
          statusBadge = `<span class="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded text-[10px]">Video Complete</span>`;
        }

        itemDiv.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px] font-mono">${dateStr}</span>
            ${statusBadge}
          </div>
          <p class="text-slate-300 font-medium">${textSnippet}</p>
          <div class="flex items-center space-x-3 pt-1">
            ${item.audioUrl ? `<a href="${item.audioUrl}" target="_blank" class="text-violet-400 hover:underline text-[11px]">🎵 Audio Track</a>` : ''}
            ${item.videoUrl ? `<a href="${item.videoUrl}" target="_blank" class="text-fuchsia-400 hover:underline text-[11px]">🎥 Video MP4</a>` : ''}
          </div>
        `;
        historyList.appendChild(itemDiv);
      });
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  }

  document.getElementById("refreshHistoryBtn").addEventListener("click", loadHistory);
  loadHistory();

  // Activity Logger
  function logMessage(msg, type = "info") {
    const line = document.createElement("div");
    const timestamp = new Date().toLocaleTimeString();
    line.className = "font-mono text-[11px]";

    if (type === "error") {
      line.className += " text-rose-400";
    } else if (type === "success") {
      line.className += " text-emerald-400 font-semibold";
    } else {
      line.className += " text-slate-400";
    }

    line.textContent = `[${timestamp}] ${msg}`;
    consoleLogs.appendChild(line);
    consoleLogs.scrollTop = consoleLogs.scrollHeight;
  }

  clearLogsBtn.addEventListener("click", () => {
    consoleLogs.innerHTML = `<div class="text-slate-600">// Logs cleared.</div>`;
  });

});
