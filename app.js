// ==========================================
// 1. 設定項目（GASのURL）
// ==========================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_0InveCZpijlRKRn9ooS1DPvyWgZ3zhU4nGPDFgUzru6YwGhxkj-8nrXIwoPSg1c18w/exec";

// ==========================================
// 2. 音響・休息モジュール (Web Audio API による超軽量サウンド合成)
// ==========================================
const AudioModule = {
    ctx: null,
    currentType: "rain", // rain, wave, 528
    isPlaying: false,
    gainNode: null,
    sourceNodes: [],

    init: function() {
        console.log("AudioModule: Initialized.");
    },

    getAudioContext: function() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioCtx();
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(0.5, this.ctx.currentTime);
            this.gainNode.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        return this.ctx;
    },

    setVolume: function(val) {
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
        }
    },

    togglePlay: function() {
        if (this.isPlaying) {
            this.stop();
        } else {
            this.play(this.currentType);
        }
    },

    selectSound: function(type) {
        this.currentType = type;
        if (this.isPlaying) {
            this.stop();
            this.play(type);
        } else {
            this.updateButtonsUI();
        }
    },

    stop: function() {
        this.sourceNodes.forEach(node => {
            try { node.stop(); } catch(e) {}
            try { node.disconnect(); } catch(e) {}
        });
        this.sourceNodes = [];
        this.isPlaying = false;
        this.updatePlayBtnUI();
    },

    play: function(type) {
        const ctx = this.getAudioContext();
        this.stop();

        if (type === "rain") {
            // 雨の音: ノイズバッファ + ローパスフィルター
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            let b0 = 0, b1 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99 * b0 + white * 0.05;
                b1 = 0.95 * b1 + white * 0.1;
                output[i] = (b0 + b1) * 0.35;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(1200, ctx.currentTime);

            noise.connect(filter);
            filter.connect(this.gainNode);
            noise.start();
            this.sourceNodes.push(noise);

        } else if (type === "wave") {
            // 波の音: ピンクノイズに低周波LFOで周期的なモジュレーション
            const bufferSize = ctx.sampleRate * 2;
            const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
            const output = buffer.getChannelData(0);
            for (let i = 0; i < bufferSize; i++) {
                output[i] = (Math.random() * 2 - 1) * 0.35;
            }
            const noise = ctx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;

            const filter = ctx.createBiquadFilter();
            filter.type = "lowpass";
            filter.frequency.setValueAtTime(650, ctx.currentTime);

            const waveGain = ctx.createGain();
            waveGain.gain.setValueAtTime(0.2, ctx.currentTime);

            // LFO: 約7.5秒周期で波の満ち引き
            const lfo = ctx.createOscillator();
            lfo.frequency.setValueAtTime(0.13, ctx.currentTime);
            const lfoGain = ctx.createGain();
            lfoGain.gain.setValueAtTime(0.25, ctx.currentTime);
            lfo.connect(lfoGain);
            lfoGain.connect(waveGain.gain);

            noise.connect(filter);
            filter.connect(waveGain);
            waveGain.connect(this.gainNode);

            noise.start();
            lfo.start();
            this.sourceNodes.push(noise, lfo);

        } else if (type === "528") {
            // 528Hz ソルフェジオ周波数の純音 + わずかなゆらぎ
            const osc1 = ctx.createOscillator();
            osc1.type = "sine";
            osc1.frequency.setValueAtTime(528, ctx.currentTime);

            const osc2 = ctx.createOscillator();
            osc2.type = "sine";
            osc2.frequency.setValueAtTime(528.5, ctx.currentTime);

            const sineGain = ctx.createGain();
            sineGain.gain.setValueAtTime(0.12, ctx.currentTime);

            osc1.connect(sineGain);
            osc2.connect(sineGain);
            sineGain.connect(this.gainNode);

            osc1.start();
            osc2.start();
            this.sourceNodes.push(osc1, osc2);
        }

        this.isPlaying = true;
        this.updatePlayBtnUI();
        this.updateButtonsUI();
    },

    updatePlayBtnUI: function() {
        const btn = document.getElementById("sound-play-toggle");
        const status = document.getElementById("sound-status-text");
        if (!btn || !status) return;

        if (this.isPlaying) {
            btn.innerText = "■ 停止";
            btn.className = "px-3 py-1 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition";
            const labels = { rain: "雨音を再生中", wave: "波音を再生中", "528": "528Hzを再生中" };
            status.innerText = labels[this.currentType] || "再生中";
        } else {
            btn.innerText = "▶ 再生";
            btn.className = "px-3 py-1 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-700 transition";
            status.innerText = "停止中";
        }
    },

    updateButtonsUI: function() {
        const types = ["rain", "wave", "528"];
        types.forEach(t => {
            const btn = document.getElementById(`btn-sound-${t}`);
            if (!btn) return;
            if (t === this.currentType) {
                btn.className = "sound-select-btn p-2 rounded-xl border border-blue-300 bg-blue-50 text-blue-900 font-bold transition flex flex-col items-center ring-2 ring-blue-300";
            } else {
                btn.className = "sound-select-btn p-2 rounded-xl border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition flex flex-col items-center";
            }
        });
    }
};

// ==========================================
// 3. 呼吸アート・マインドフルネスガイド
// ==========================================
const BreatheGuide = {
    isRunning: false,
    timer: null,
    phaseIndex: 0,
    phases: [
        { text: "吸って...", duration: 4000, scale: "scale-125", bg: "from-cyan-400 to-blue-500", shadow: "shadow-blue-400/50" },
        { text: "止めて...", duration: 4000, scale: "scale-125", bg: "from-blue-400 to-indigo-500", shadow: "shadow-indigo-400/50" },
        { text: "吐いて...", duration: 4000, scale: "scale-90", bg: "from-indigo-400 to-purple-500", shadow: "shadow-purple-400/50" },
        { text: "止めて...", duration: 4000, scale: "scale-90", bg: "from-teal-400 to-emerald-500", shadow: "shadow-teal-400/50" }
    ],

    toggle: function() {
        if (this.isRunning) {
            this.stop();
        } else {
            this.start();
        }
    },

    start: function() {
        this.isRunning = true;
        this.phaseIndex = 0;
        const btn = document.getElementById("breathe-toggle-btn");
        if (btn) btn.innerText = "呼吸ガイドを終了する";
        this.step();
    },

    step: function() {
        if (!this.isRunning) return;
        const phase = this.phases[this.phaseIndex];
        const circle = document.getElementById("breathe-circle");
        const text = document.getElementById("breathe-text");

        if (circle && text) {
            text.innerText = phase.text;
            circle.className = `w-24 h-24 rounded-full bg-gradient-to-tr ${phase.bg} opacity-90 shadow-xl ${phase.shadow} flex items-center justify-center text-white font-bold text-sm transition-all duration-[4000ms] ease-in-out transform ${phase.scale}`;
        }

        this.phaseIndex = (this.phaseIndex + 1) % this.phases.length;
        this.timer = setTimeout(() => this.step(), phase.duration);
    },

    stop: function() {
        this.isRunning = false;
        if (this.timer) clearTimeout(this.timer);
        const btn = document.getElementById("breathe-toggle-btn");
        const circle = document.getElementById("breathe-circle");
        const text = document.getElementById("breathe-text");
        if (btn) btn.innerText = "呼吸ガイドを始める";
        if (text) text.innerText = "準備";
        if (circle) {
            circle.className = "w-24 h-24 rounded-full bg-gradient-to-tr from-cyan-400 to-blue-500 opacity-80 shadow-lg shadow-blue-300/50 flex items-center justify-center text-white font-bold text-sm transition-all duration-[1000ms] ease-in-out transform scale-100";
        }
    }
};

// ==========================================
// 4. シェルター休息メニューのUIコントローラー
// ==========================================
function initShelterMenu() {
    const toggleBtn = document.getElementById("menu-toggle-btn");
    const panel = document.getElementById("shelter-menu-panel");
    const icon = document.getElementById("menu-toggle-icon");

    if (toggleBtn && panel) {
        toggleBtn.addEventListener("click", () => {
            const isHidden = panel.classList.contains("hidden");
            if (isHidden) {
                panel.classList.remove("hidden");
                if (icon) icon.innerText = "▲ 閉じる";
            } else {
                panel.classList.add("hidden");
                if (icon) icon.innerText = "▼ 開く";
            }
        });
    }

    // タブ切り替え
    const tabs = ["sound", "art", "meditation"];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        if (btn) {
            btn.addEventListener("click", () => switchShelterTab(tab));
        }
    });

    // サウンド選択・再生
    document.getElementById("btn-sound-rain")?.addEventListener("click", () => AudioModule.selectSound("rain"));
    document.getElementById("btn-sound-wave")?.addEventListener("click", () => AudioModule.selectSound("wave"));
    document.getElementById("btn-sound-528")?.addEventListener("click", () => AudioModule.selectSound("528"));
    document.getElementById("sound-play-toggle")?.addEventListener("click", () => AudioModule.togglePlay());
    document.getElementById("sound-volume")?.addEventListener("input", (e) => AudioModule.setVolume(parseFloat(e.target.value)));

    // 呼吸ガイド
    document.getElementById("breathe-toggle-btn")?.addEventListener("click", () => BreatheGuide.toggle());
}

function switchShelterTab(activeTab) {
    const tabs = ["sound", "art", "meditation"];
    tabs.forEach(tab => {
        const btn = document.getElementById(`tab-btn-${tab}`);
        const content = document.getElementById(`tab-content-${tab}`);
        if (!btn || !content) return;
        if (tab === activeTab) {
            btn.className = "flex-1 py-1.5 rounded-lg text-center bg-white text-gray-800 shadow-sm transition";
            content.classList.remove("hidden");
        } else {
            btn.className = "flex-1 py-1.5 rounded-lg text-center transition text-gray-500 hover:text-gray-700";
            content.classList.add("hidden");
        }
    });
}

// ==========================================
// 5. 感情テーマと状態管理
// ==========================================
const themes = {
    tension: {
        id: "tension", label: "焦り・過緊張", 
        colorStart: "#4facfe", colorEnd: "#00f2fe", 
        bgClass: "from-blue-100 to-cyan-100", btnClass: "bg-blue-100 hover:bg-blue-200 text-blue-800"
    },
    anger: {
        id: "anger", label: "理不尽への怒り", 
        colorStart: "#a18cd1", colorEnd: "#fbc2eb", 
        bgClass: "from-purple-100 to-indigo-100", btnClass: "bg-purple-100 hover:bg-purple-200 text-purple-800"
    },
    fatigue: {
        id: "fatigue", label: "疲労・頭重", 
        colorStart: "#ffc3a0", colorEnd: "#ffafbd", 
        bgClass: "from-orange-100 to-rose-100", btnClass: "bg-orange-100 hover:bg-orange-200 text-orange-800"
    },
    anxiety: {
        id: "anxiety", label: "漠然とした不安", 
        colorStart: "#667eea", colorEnd: "#764ba2", 
        bgClass: "from-indigo-200 to-purple-300", btnClass: "bg-indigo-100 hover:bg-indigo-200 text-indigo-800"
    }
};

let currentEmotion = null;

// ==========================================
// 6. UI初期化とイベント設定
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    AudioModule.init();
    initShelterMenu();
    renderEmotionButtons();
    registerServiceWorker();

    document.getElementById("submit-btn").addEventListener("click", handleSubmit);
    document.getElementById("download-btn").addEventListener("click", downloadImage);
});

function renderEmotionButtons() {
    const container = document.getElementById("emotion-buttons");
    container.innerHTML = ""; // 重複防止
    Object.values(themes).forEach(theme => {
        const btn = document.createElement("button");
        btn.className = `py-2 px-4 rounded-xl font-medium transition ${theme.btnClass} border-2 border-transparent`;
        btn.innerText = theme.label;
        btn.onclick = () => selectEmotion(theme.id, btn);
        container.appendChild(btn);
    });
}

function selectEmotion(themeId, btnElement) {
    currentEmotion = themes[themeId];
    
    const buttons = document.getElementById("emotion-buttons").children;
    for (let btn of buttons) {
        btn.classList.remove("border-gray-500", "ring-2", "ring-offset-2");
    }
    btnElement.classList.add("border-gray-500", "ring-2", "ring-offset-2");

    const body = document.getElementById("app-body");
    body.className = `min-h-screen bg-gradient-to-br text-gray-800 font-sans p-4 transition-colors duration-1000 ${currentEmotion.bgClass}`;
}

// ==========================================
// 7. API通信 (GAS経由でのGemini呼び出し)
// ==========================================
async function handleSubmit() {
    if (!currentEmotion) {
        showError("感情テーマを選択してください。");
        return;
    }
    const stressText = document.getElementById("stress-input").value.trim();
    if (!stressText) {
        showError("今のストレスや出来事を入力してください。");
        return;
    }

    if(GAS_WEB_APP_URL.includes("ここに_GAS_の")) {
        showError("開発者へ: app.js の GAS_WEB_APP_URL を設定してください。");
        return;
    }

    setLoading(true);
    showError("");

    try {
        const payload = {
            emotion: currentEmotion.label,
            text: stressText
        };

        const response = await fetch(GAS_WEB_APP_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        
        if (result.success) {
            displayResult(result.data);
            generateAmuletImage(result.data.phrase, currentEmotion);
        } else {
            throw new Error(result.error);
        }
    } catch (err) {
        showError("生成に失敗しました: " + err.message);
    } finally {
        setLoading(false);
    }
}

// ==========================================
// 8. 結果表示とCanvas画像生成
// ==========================================
function displayResult(data) {
    document.getElementById("res-labeling").innerText = data.labeling;
    document.getElementById("res-separation").innerText = data.separation;
    document.getElementById("res-compassion").innerText = data.compassion;
    document.getElementById("res-phrase").innerText = data.phrase;

    // おすすめの書籍・映画の表示
    if (data.recommendation && data.recommendation.title) {
        const rec = data.recommendation;
        const recWrap = document.getElementById("res-rec-wrap");
        if (recWrap) {
            recWrap.classList.remove("hidden");
            document.getElementById("res-rec-title").innerText = '『' + rec.title + '』';
            document.getElementById("res-rec-type").innerText = rec.type || "おすすめ作品";
            document.getElementById("res-rec-reason").innerText = rec.reason || "";
            document.getElementById("res-rec-google").href = rec.searchUrl || ('https://www.google.com/search?q=' + encodeURIComponent(rec.title));
            document.getElementById("res-rec-amazon").href = rec.amazonUrl || ('https://www.amazon.co.jp/s?k=' + encodeURIComponent(rec.title));
        }
    }
    
    const resultArea = document.getElementById("result-area");
    resultArea.classList.remove("hidden");
    setTimeout(() => resultArea.classList.remove("opacity-0"), 100);
}

function generateAmuletImage(phrase, theme) {
    const canvas = document.getElementById("amuletCanvas");
    const ctx = canvas.getContext("2d");
    
    canvas.width = 1080;
    canvas.height = 1920;

    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, theme.colorStart);
    grad.addColorStop(1, theme.colorEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "bold 80px sans-serif";
    ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;

    if (phrase.length > 8) {
        const line1 = phrase.substring(0, Math.ceil(phrase.length / 2));
        const line2 = phrase.substring(Math.ceil(phrase.length / 2));
        ctx.fillText(line1, canvas.width / 2, canvas.height / 2 - 60);
        ctx.fillText(line2, canvas.width / 2, canvas.height / 2 + 60);
    } else {
        ctx.fillText(phrase, canvas.width / 2, canvas.height / 2);
    }

    ctx.shadowBlur = 0;
    ctx.font = "30px sans-serif";
    ctx.fillText("デジタル・マインド・シェルター", canvas.width / 2, canvas.height - 100);

    const previewImg = document.getElementById("preview-image");
    previewImg.src = canvas.toDataURL("image/png");
}

function downloadImage() {
    const canvas = document.getElementById("amuletCanvas");
    const link = document.createElement("a");
    link.download = "mind_prescription.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
}

// ==========================================
// 9. ユーティリティ・PWA登録
// ==========================================
function setLoading(isLoading) {
    const btn = document.getElementById("submit-btn");
    const text = document.getElementById("btn-text");
    const spinner = document.getElementById("loading-spinner");
    
    if (isLoading) {
        btn.disabled = true;
        text.innerText = "生成中...";
        spinner.classList.remove("hidden");
    } else {
        btn.disabled = false;
        text.innerText = "処方箋を生成する";
        spinner.classList.add("hidden");
    }
}

function showError(msg) {
    const errorEl = document.getElementById("error-msg");
    errorEl.innerText = msg;
    if (msg) errorEl.classList.remove("hidden");
    else errorEl.classList.add("hidden");
}

function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch(err => console.error('Service Worker Failed', err));
    }
}
