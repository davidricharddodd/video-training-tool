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
  const downloadAudioBtn = document.getElementById("downloadAudioBtn");
  const downloadVttBtn = document.getElementById("downloadVttBtn");
  const previousAudioSelect = document.getElementById("previousAudioSelect");
  const usePreviousAudioBtn = document.getElementById("usePreviousAudioBtn");
  const tab1PreviousAudioSelect = document.getElementById("tab1PreviousAudioSelect");
  const tab1LoadAudioBtn = document.getElementById("tab1LoadAudioBtn");
  const tab1DirectToPresenterBtn = document.getElementById("tab1DirectToPresenterBtn");
  const avatarUrlInput = document.getElementById("avatarUrl");
  
  const consoleLogs = document.getElementById("consoleLogs");
  const clearLogsBtn = document.getElementById("clearLogsBtn");

  // Draft Preview Mode controls
  const draftModeToggle = document.getElementById("draftModeToggle");
  const generateVideoBtnText = document.getElementById("generateVideoBtnText");
  const draftSuccessBanner = document.getElementById("draftSuccessBanner");
  const proceedToFinalBtn = document.getElementById("proceedToFinalBtn");

  function updateDraftModeUI() {
    if (!draftModeToggle) return;
    const isDraft = draftModeToggle.checked;
    if (generateVideoBtnText) {
      generateVideoBtnText.textContent = isDraft
        ? "⚡ Generate Free Draft Preview (~3s)"
        : "🎬 Render Complete Training Video";
    }
    if (summaryEngineLabel) {
      summaryEngineLabel.textContent = isDraft
        ? "Draft Mode (Looped Avatar - 0 Credits)"
        : (lipsyncEngine && lipsyncEngine.options[lipsyncEngine.selectedIndex] ? lipsyncEngine.options[lipsyncEngine.selectedIndex].text : "Fal.ai Sync Labs");
    }
  }

  if (draftModeToggle) {
    draftModeToggle.addEventListener("change", updateDraftModeUI);
    updateDraftModeUI();
  }

  if (proceedToFinalBtn) {
    proceedToFinalBtn.addEventListener("click", () => {
      if (draftModeToggle) {
        draftModeToggle.checked = false;
        updateDraftModeUI();
      }
      generateVideoBtn.click();
    });
  }

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

    const falTokenInput = document.getElementById("falToken");
    const customFalToken = falTokenInput ? falTokenInput.value.trim() : (localStorage.getItem("fal_token") || "");

    try {
      const response = await fetch("/api/breakdown-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: rawText,
          targetSceneCount: targetSceneCount.value,
          customFalToken: customFalToken
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

    const formatTime = (sec) => {
      const m = Math.floor(sec / 60);
      const s = Math.floor(sec % 60);
      return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Calculate speech duration per scene (approx. 2.45 words/sec + pauses)
    const sceneDurations = scenes.map(s => {
      const text = (s.script || "").replace(/\[pause[^\]]*\]/gi, " ");
      const words = text.trim().split(/\s+/).filter(Boolean).length;
      let pauseSec = 0;
      const pauseMatches = (s.script || "").matchAll(/\[pause(?:\s*:\s*|\s+)?(\d+(?:\.\d+)?)?\s*s?\]/gi);
      for (const m of pauseMatches) {
        pauseSec += m[1] ? parseFloat(m[1]) : 1.0;
      }
      return Math.max(3.0, (words / 2.45) + pauseSec);
    });

    let cumulativeSec = 0;

    scenes.forEach((scene, index) => {
      const card = document.createElement("div");
      card.className = "bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 shadow-inner relative group";

      const sceneDur = sceneDurations[index];
      const startStr = formatTime(cumulativeSec);
      const endStr = formatTime(cumulativeSec + sceneDur);
      const sceneStartSec = cumulativeSec;
      cumulativeSec += sceneDur;

      const highlights = scene.highlights || [];
      const leadTime = Math.min(1.0, sceneDur * 0.15);
      const availDur = Math.max(1.0, sceneDur - leadTime);

      const highlightsHtml = highlights.map((hl, hIdx) => {
        const offsetSec = leadTime + (hIdx * (availDur / Math.max(1, highlights.length)));
        const revealTimeStr = formatTime(sceneStartSec + offsetSec);
        return `
        <div class="flex items-center space-x-2 group/item">
          <span class="text-[9px] font-mono text-violet-400 bg-violet-950/70 border border-violet-800/60 px-1.5 py-0.5 rounded flex-shrink-0" title="Bullet reveals in video at ${revealTimeStr}">⏱️ ${revealTimeStr}</span>
          <input type="text" value="${hl.replace(/"/g, '&quot;')}" data-scene="${index}" data-highlight="${hIdx}"
            class="scene-highlight-input w-full px-2.5 py-1 bg-slate-900 border border-slate-800 rounded text-xs text-slate-200 focus:border-violet-500 focus:outline-none transition-all" />
          <button type="button" class="delete-highlight-btn text-slate-500 hover:text-rose-400 p-1 text-xs rounded transition-all cursor-pointer"
            data-scene="${index}" data-highlight="${hIdx}" title="Remove bullet point">
            ✕
          </button>
        </div>
      `;
      }).join("");

      card.innerHTML = `
        <div class="flex items-center justify-between border-b border-slate-850 pb-2 gap-2">
          <div class="flex items-center space-x-2 flex-1 min-w-0">
            <span class="text-[10px] bg-violet-950/60 text-violet-300 px-2 py-0.5 rounded border border-violet-800 font-semibold flex-shrink-0">Scene ${index + 1}</span>
            <span class="text-[10px] bg-slate-900 text-slate-400 px-1.5 py-0.5 rounded border border-slate-800 font-mono font-medium flex-shrink-0">⏱️ ${startStr} - ${endStr}</span>
            <input type="text" value="${scene.title.replace(/"/g, '&quot;')}" data-scene="${index}" field="title"
              class="scene-title-input font-semibold text-xs text-violet-300 bg-transparent border-none focus:outline-none w-full truncate" />
          </div>
          <button type="button" class="delete-scene-btn text-slate-500 hover:text-rose-400 p-1 text-xs rounded transition-all cursor-pointer flex-shrink-0"
            data-scene="${index}" title="Delete Scene ${index + 1}">
            🗑️
          </button>
        </div>
        <div>
          <label class="block text-[9px] uppercase font-semibold text-slate-500 mb-1">Scene Script Segment</label>
          <textarea data-scene="${index}" field="script" rows="2"
            class="scene-script-input w-full px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-300 focus:border-violet-500 focus:outline-none resize-none">${scene.script}</textarea>
        </div>
        <div>
          <div class="flex items-center justify-between mb-1.5">
            <label class="block text-[9px] uppercase font-semibold text-slate-500">On-Screen Key Highlights (Speech-Synced)</label>
            <button type="button" class="add-highlight-btn text-[10px] text-violet-400 hover:text-violet-300 font-semibold flex items-center space-x-0.5 transition-all cursor-pointer"
              data-scene="${index}">
              <span>+ Add Bullet</span>
            </button>
          </div>
          <div class="space-y-1.5">
            ${highlightsHtml || '<p class="text-[11px] text-slate-600 italic">No bullet points. Click + Add Bullet to add one.</p>'}
          </div>
        </div>
      `;
      sceneCardsGrid.appendChild(card);
    });

    // Add "Add New Scene" button card at the end
    const addCard = document.createElement("button");
    addCard.type = "button";
    addCard.id = "addNewSceneBtn";
    addCard.className = "border-2 border-dashed border-slate-800 hover:border-violet-500/60 rounded-xl p-6 flex flex-col items-center justify-center space-y-1 text-xs font-semibold text-slate-400 hover:text-violet-300 transition-all cursor-pointer bg-slate-950/40 min-h-[160px]";
    addCard.innerHTML = `
      <span class="text-xl">➕</span>
      <span>Add New Scene</span>
      <span class="text-[10px] font-normal text-slate-500">Insert an extra scene slide into this video</span>
    `;
    sceneCardsGrid.appendChild(addCard);

    // Event Listeners for scene cards
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
        scriptText.value = currentScenes.map(s => s.script).join("\n\n");
      });
    });

    document.querySelectorAll(".scene-highlight-input").forEach(input => {
      input.addEventListener("input", (e) => {
        const sIdx = parseInt(e.target.getAttribute("data-scene"), 10);
        const hIdx = parseInt(e.target.getAttribute("data-highlight"), 10);
        currentScenes[sIdx].highlights[hIdx] = e.target.value;
      });
    });

    // Delete Highlight Button Handler
    document.querySelectorAll(".delete-highlight-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const sIdx = parseInt(btn.getAttribute("data-scene"), 10);
        const hIdx = parseInt(btn.getAttribute("data-highlight"), 10);
        currentScenes[sIdx].highlights.splice(hIdx, 1);
        renderSceneCards(currentScenes);
      });
    });

    // Add Highlight Button Handler
    document.querySelectorAll(".add-highlight-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const sIdx = parseInt(btn.getAttribute("data-scene"), 10);
        if (!currentScenes[sIdx].highlights) currentScenes[sIdx].highlights = [];
        if (currentScenes[sIdx].highlights.length >= 5) {
          alert("Maximum 5 highlights per scene card to maintain slide legibility.");
          return;
        }
        currentScenes[sIdx].highlights.push("Key takeaway point");
        renderSceneCards(currentScenes);
      });
    });

    // Delete Scene Button Handler
    document.querySelectorAll(".delete-scene-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        const sIdx = parseInt(btn.getAttribute("data-scene"), 10);
        if (currentScenes.length <= 1) {
          alert("Video requires at least 1 scene.");
          return;
        }
        currentScenes.splice(sIdx, 1);
        // Re-index scenes
        currentScenes.forEach((s, i) => { s.sceneIndex = i + 1; });
        scriptText.value = currentScenes.map(s => s.script).join("\n\n");
        renderSceneCards(currentScenes);
      });
    });

    // Add New Scene Button Handler
    document.getElementById("addNewSceneBtn").addEventListener("click", () => {
      const newIdx = currentScenes.length + 1;
      currentScenes.push({
        sceneIndex: newIdx,
        title: `Scene ${newIdx}: Topic & Objectives`,
        script: `Enter the spoken narrative for Scene ${newIdx} here.`,
        highlights: [
          "Primary objective or action item",
          "Secondary operational guideline"
        ]
      });
      scriptText.value = currentScenes.map(s => s.script).join("\n\n");
      renderSceneCards(currentScenes);
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
      if (val === "preset") {
        updatePresenterPreview();
      }
    });
  });

  // Live Preview for Uploaded Avatar Video File
  if (avatarFile) {
    avatarFile.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) {
        if (uploadFilename) uploadFilename.textContent = `Selected: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`;
        const objectUrl = URL.createObjectURL(file);
        if (presenterPreviewPlayer) {
          presenterPreviewPlayer.src = objectUrl;
          presenterPreviewPlayer.load();
          presenterPreviewPlayer.play().catch(() => {});
        }
        if (presenterPreviewName) {
          presenterPreviewName.textContent = `Uploaded File: ${file.name}`;
        }
        logMessage(`Selected local avatar video: ${file.name}`, "info");
      }
    });
  }

  // Live Preview for Remote Avatar URL
  if (avatarUrlInput) {
    avatarUrlInput.addEventListener("input", (e) => {
      const url = e.target.value.trim();
      if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
        if (presenterPreviewPlayer) {
          presenterPreviewPlayer.src = url;
          presenterPreviewPlayer.load();
          presenterPreviewPlayer.play().catch(() => {});
        }
        if (presenterPreviewName) {
          presenterPreviewName.textContent = "Remote URL Avatar";
        }
      }
    });
  }

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

  // Helper to activate an audio track (either newly generated or loaded from history)
  function selectActiveAudio(audioUrl, filename, textSnippet, scenesData = null) {
    if (!audioUrl) return;
    const cleanFilename = filename || audioUrl.split("/").pop();
    generatedAudioFilename = cleanFilename;
    audioPreviewSource.src = audioUrl;
    audioPreviewPlayer.load();
    videoActionContainer.classList.remove("hidden");
    if (downloadAudioBtn) downloadAudioBtn.href = audioUrl;
    
    if (scenesData && Array.isArray(scenesData) && scenesData.length > 0) {
      currentScenes = scenesData;
      renderSceneCards(currentScenes);
      scriptText.value = currentScenes.map(s => s.script).join("\n\n");
      logMessage(`Restored ${currentScenes.length} synchronized scenes for this audio track.`, "success");
    } else if (textSnippet) {
      scriptText.value = textSnippet;
    }

    logMessage(`Audio selected: ${cleanFilename} ${textSnippet ? `("${textSnippet.substring(0, 35)}...")` : ""}`, "success");
  }

  // Previous Audio Selection Handler (Tab 2)
  if (usePreviousAudioBtn && previousAudioSelect) {
    usePreviousAudioBtn.addEventListener("click", () => {
      const selectedOpt = previousAudioSelect.options[previousAudioSelect.selectedIndex];
      if (!selectedOpt || !selectedOpt.value) {
        alert("Please choose a previous audio track from the dropdown first.");
        return;
      }
      const scenesAttr = selectedOpt.getAttribute("data-scenes");
      let parsedScenes = null;
      if (scenesAttr) {
        try { parsedScenes = JSON.parse(decodeURIComponent(scenesAttr)); } catch(e){}
      }
      selectActiveAudio(selectedOpt.value, null, selectedOpt.getAttribute("data-text"), parsedScenes);
      alert("Previous audio track loaded with matching scenes! You can now continue to Step 3 to select presenter & generate video.");
    });

    previousAudioSelect.addEventListener("change", () => {
      const selectedOpt = previousAudioSelect.options[previousAudioSelect.selectedIndex];
      if (selectedOpt && selectedOpt.value) {
        const scenesAttr = selectedOpt.getAttribute("data-scenes");
        let parsedScenes = null;
        if (scenesAttr) {
          try { parsedScenes = JSON.parse(decodeURIComponent(scenesAttr)); } catch(e){}
        }
        selectActiveAudio(selectedOpt.value, null, selectedOpt.getAttribute("data-text"), parsedScenes);
      }
    });
  }

  // Quick Start Audio Reuse Handlers (Tab 1)
  if (tab1LoadAudioBtn && tab1PreviousAudioSelect) {
    tab1LoadAudioBtn.addEventListener("click", () => {
      const selectedOpt = tab1PreviousAudioSelect.options[tab1PreviousAudioSelect.selectedIndex];
      if (!selectedOpt || !selectedOpt.value) {
        alert("Please choose a previous audio track from the dropdown first.");
        return;
      }
      const audioUrl = selectedOpt.value;
      const text = selectedOpt.getAttribute("data-text") || "";
      const scenesAttr = selectedOpt.getAttribute("data-scenes");
      let parsedScenes = null;
      if (scenesAttr) {
        try { parsedScenes = JSON.parse(decodeURIComponent(scenesAttr)); } catch(e){}
      }
      selectActiveAudio(audioUrl, null, text, parsedScenes);
      if (parsedScenes && parsedScenes.length > 0) {
        logMessage(`Loaded audio track and restored ${parsedScenes.length} synchronized scenes!`, "success");
      } else if (text) {
        scriptText.value = text;
        analyzeScriptBtn.click(); // Auto-generates scene cards for immediate editing!
        logMessage(`Loaded audio track and auto-generated scenes for editing.`, "success");
      } else {
        alert("Audio track loaded! You can now customize scenes or continue to Step 3.");
      }
    });
  }

  if (tab1DirectToPresenterBtn && tab1PreviousAudioSelect) {
    tab1DirectToPresenterBtn.addEventListener("click", () => {
      const selectedOpt = tab1PreviousAudioSelect.options[tab1PreviousAudioSelect.selectedIndex];
      if (!selectedOpt || !selectedOpt.value) {
        alert("Please choose a previous audio track from the dropdown first.");
        return;
      }
      const audioUrl = selectedOpt.value;
      const text = selectedOpt.getAttribute("data-text") || "";
      const scenesAttr = selectedOpt.getAttribute("data-scenes");
      let parsedScenes = null;
      if (scenesAttr) {
        try { parsedScenes = JSON.parse(decodeURIComponent(scenesAttr)); } catch(e){}
      }
      selectActiveAudio(audioUrl, null, text, parsedScenes);
      switchTab(3); // Jump straight to Step 3: Video & Presenter!
      logMessage("Audio loaded! Jumped directly to Step 3. Pick your presenter and generate video.", "info");
    });
  }

  // Step 2: Generate Audio Preview
  generateAudioBtn.addEventListener("click", async () => {
    let text = scriptText.value;
    if (currentScenes && currentScenes.length > 0) {
      text = currentScenes.map(s => s.script).join("\n\n");
      scriptText.value = text;
    }
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
          lipsyncProvider: lipsyncProvider.value,
          scenes: currentScenes && currentScenes.length > 0 ? JSON.stringify(currentScenes) : null
        })
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to generate audio.");
      }

      selectActiveAudio(data.audioUrl, data.filename, text, currentScenes);

      let pauseReport = "";
      if (data.pauseCount > 0) {
        pauseReport = ` [${data.pauseCount} pause(s) injected, ~${data.totalPauseDuration}s silence]`;
      }
      logMessage(`Audio preview ready!${pauseReport} (URL: ${data.audioUrl})`, "success");
      loadHistory();

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
    const isDraft = draftModeToggle ? draftModeToggle.checked : false;

    const formData = new FormData();
    formData.append("draftMode", isDraft);
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

    currentStepTitle.textContent = isDraft ? "Generating Free Draft Preview..." : "Synthesizing Lip-Sync Video...";
    currentStepDetail.textContent = isDraft ? "Looping presenter and rendering synchronized slide bullet overlays..." : "Processing presenter video and overlays...";
    progressBar.style.width = isDraft ? "40%" : "20%";

    logMessage(isDraft ? "Step 4: Dispatching free draft preview request (0 Credits)..." : "Step 4: Dispatching video synthesis request...");

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
            if (downloadAudioBtn && generatedAudioFilename) {
              downloadAudioBtn.href = `/uploads/${generatedAudioFilename}`;
            }

            if (job.isDraft) {
              if (draftSuccessBanner) draftSuccessBanner.classList.remove("hidden");
              logMessage(`Draft Preview complete! Slide timings and text overlays verified (0 credits used).`, "success");
            } else {
              if (draftSuccessBanner) draftSuccessBanner.classList.add("hidden");
              logMessage(`Video processing complete! Output URL: ${job.videoUrl}`, "success");
            }

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

  // Helper: Format history item timestamps gracefully (resolving Invalid Date)
  function formatHistoryDate(item) {
    const raw = item.timestamp || item.createdAt || item.updatedAt;
    if (!raw) return "Recent";
    const d = new Date(raw);
    if (isNaN(d.getTime())) return "Recent";
    return d.toLocaleDateString([], { month: "short", day: "numeric" }) + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  // Format seconds to WebVTT timestamp (HH:MM:SS.mmm)
  function formatVttTimestamp(seconds) {
    const s = Math.max(0, parseFloat(seconds) || 0);
    const hrs = Math.floor(s / 3600);
    const mins = Math.floor((s % 3600) / 60);
    const secs = Math.floor(s % 60);
    const ms = Math.floor((s % 1) * 1000);
    return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  }

  // Generate WebVTT subtitles synchronized to scenes
  function generateVttContent(scenes, totalDuration) {
    let vtt = "WEBVTT - Training Video Subtitles\n\n";
    if (!scenes || scenes.length === 0) {
      const fallbackText = scriptText.value.trim() || "Training Video Module";
      vtt += `1\n00:00:00.000 --> ${formatVttTimestamp(totalDuration || 60)}\n${fallbackText}\n\n`;
      return vtt;
    }

    const dur = parseFloat(totalDuration) || (scenes.length * 10);
    const sceneWeights = scenes.map(s => {
      const words = (s.script || "").trim().split(/\s+/).filter(Boolean).length;
      return Math.max(3, words);
    });
    const totalWeight = sceneWeights.reduce((a, b) => a + b, 0);

    let currentTime = 0;
    scenes.forEach((scene, index) => {
      const sceneDur = (sceneWeights[index] / totalWeight) * dur;
      const start = currentTime;
      const end = (index === scenes.length - 1) ? dur : (currentTime + sceneDur);
      currentTime = end;

      const title = scene.title || `Scene ${index + 1}`;
      const bullets = (scene.highlights || []).map(h => `• ${h}`).join("\n");
      const textBlock = bullets ? `${title}\n${bullets}` : `${title}\n${scene.script}`;

      vtt += `${index + 1}\n`;
      vtt += `${formatVttTimestamp(start)} --> ${formatVttTimestamp(end)}\n`;
      vtt += `${textBlock}\n\n`;
    });

    return vtt;
  }

  // VTT Subtitles Download Button
  if (downloadVttBtn) {
    downloadVttBtn.addEventListener("click", () => {
      const dur = outputVideoPlayer.duration || 60;
      const vttData = generateVttContent(currentScenes, dur);
      const blob = new Blob([vttData], { type: "text/vtt;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const tempLink = document.createElement("a");
      tempLink.href = url;
      tempLink.download = "training_video_subtitles.vtt";
      document.body.appendChild(tempLink);
      tempLink.click();
      document.body.removeChild(tempLink);
      URL.revokeObjectURL(url);
      logMessage("VTT Subtitle file generated and downloaded successfully!", "success");
    });
  }

  // History loader
  async function loadHistory() {
    try {
      const response = await fetch("/api/history");
      const data = await response.json();
      if (!data.success) return;

      // Populate Previous Audio dropdowns in Tab 1 and Tab 2
      const audioItems = (data.history || []).filter(h => h.audioUrl);
      const audioOptions = [`<option value="">-- Choose an audio file from history --</option>`];
      audioItems.forEach(item => {
        const snippet = (item.text || "").replace(/"/g, '&quot;');
        const shortText = item.text && item.text.length > 42 ? item.text.substring(0, 42) + "..." : (item.text || "Audio Track");
        const encodedScenes = encodeURIComponent(JSON.stringify(item.scenes || []));
        audioOptions.push(`<option value="${item.audioUrl}" data-text="${snippet}" data-scenes="${encodedScenes}">${formatHistoryDate(item)} — "${shortText}"</option>`);
      });
      const optionsHtml = audioOptions.join("");
      if (previousAudioSelect) previousAudioSelect.innerHTML = optionsHtml;
      if (tab1PreviousAudioSelect) tab1PreviousAudioSelect.innerHTML = optionsHtml;

      const historyList = document.getElementById("historyList");
      historyList.innerHTML = "";

      if (data.history.length === 0) {
        historyList.innerHTML = `<div class="text-xs text-slate-500 text-center py-4">No recent generations.</div>`;
        return;
      }

      data.history.forEach(item => {
        const itemDiv = document.createElement("div");
        itemDiv.className = "p-3 bg-slate-950/60 border border-slate-800 rounded-xl space-y-2 text-xs";
        
        const dateStr = formatHistoryDate(item);
        const textSnippet = item.text && item.text.length > 60 ? item.text.substring(0, 60) + "..." : (item.text || "Audio track");
        const encodedScenes = encodeURIComponent(JSON.stringify(item.scenes || []));

        let statusBadge = `<span class="px-2 py-0.5 bg-amber-950/60 text-amber-400 border border-amber-800 rounded text-[10px]">Audio Preview</span>`;
        if (item.videoUrl) {
          statusBadge = item.isDraft
            ? `<span class="px-2 py-0.5 bg-violet-950/60 text-violet-400 border border-violet-800 rounded text-[10px]">⚡ Draft Preview</span>`
            : `<span class="px-2 py-0.5 bg-emerald-950/60 text-emerald-400 border border-emerald-800 rounded text-[10px]">Video Complete</span>`;
        }

        itemDiv.innerHTML = `
          <div class="flex items-center justify-between">
            <span class="text-slate-400 text-[10px] font-mono">${dateStr}</span>
            ${statusBadge}
          </div>
          <p class="text-slate-300 font-medium">${textSnippet}</p>
          <div class="flex items-center justify-between pt-1">
            <div class="flex items-center space-x-3">
              ${item.audioUrl ? `<a href="${item.audioUrl}" target="_blank" class="text-violet-400 hover:underline text-[11px]">🎵 Audio Track</a>` : ''}
              ${item.videoUrl ? `<a href="${item.videoUrl}" target="_blank" class="text-fuchsia-400 hover:underline text-[11px]">🎥 Video MP4</a>` : ''}
            </div>
            ${item.audioUrl ? `
              <button type="button" class="use-audio-btn px-2 py-0.5 bg-violet-950/80 hover:bg-violet-900 border border-violet-800/80 text-violet-300 hover:text-white rounded text-[10px] font-semibold transition-all cursor-pointer"
                data-audio="${item.audioUrl}" data-text="${(item.text || '').replace(/"/g, '&quot;')}" data-scenes="${encodedScenes}">
                ⚡ Use Audio
              </button>
            ` : ''}
          </div>
        `;
        historyList.appendChild(itemDiv);
      });

      // Attach click handlers to "Use Audio" buttons in History cards
      document.querySelectorAll(".use-audio-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const audioUrl = btn.getAttribute("data-audio");
          const text = btn.getAttribute("data-text");
          const scenesAttr = btn.getAttribute("data-scenes");
          let parsedScenes = null;
          if (scenesAttr) {
            try { parsedScenes = JSON.parse(decodeURIComponent(scenesAttr)); } catch (e) {}
          }
          selectActiveAudio(audioUrl, null, text, parsedScenes);
          switchTab(3); // Navigate user directly to Presenter selection!
          logMessage("Loaded previous audio & restored synchronized scenes! Choose your presenter in Step 3.", "info");
        });
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
