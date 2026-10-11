// ==========================================
// 1. 設定項目（必ずGASのURLに変更してください）
// ==========================================
const GAS_WEB_APP_URL = "https://script.google.com/macros/s/AKfycbz_0InveCZpijlRKRn9ooS1DPvyWgZ3zhU4nGPDFgUzru6YwGhxkj-8nrXIwoPSg1c18w/exec";

// ==========================================
// 2. 音響・拡張モジュール（Phase 1: スタブ）
// ==========================================
const AudioModule = {
    init: function() {
        console.log("AudioModule: Initialized.");
    },
    playThemeSound: function(emotionId) {
        console.log(`AudioModule: 仮想的にサウンド切り替え -> ${emotionId}`);
    },
    stop: function() {
        console.log("AudioModule: Stopped.");
    }
};

// ==========================================
// 3. テーマと状態管理
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
// 4. UI初期化とイベント設定
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    AudioModule.init();
    renderEmotionButtons();
    registerServiceWorker();

    document.getElementById("submit-btn").addEventListener("click", handleSubmit);
    document.getElementById("download-btn").addEventListener("click", downloadImage);
});

function renderEmotionButtons() {
    const container = document.getElementById("emotion-buttons");
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

    AudioModule.playThemeSound(themeId);
}

// ==========================================
// 5. API通信 (GAS経由でのGemini呼び出し)
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
// 6. 結果表示とCanvas画像生成
// ==========================================
function displayResult(data) {
    document.getElementById("res-labeling").innerText = data.labeling;
    document.getElementById("res-separation").innerText = data.separation;
    document.getElementById("res-compassion").innerText = data.compassion;
    
    const resultArea = document.getElementById("result-area");
    resultArea.classList.remove("hidden");
    setTimeout(() => resultArea.classList.remove("opacity-0"), 100);
}

function generateAmuletImage(phrase, theme) {
    const canvas = document.getElementById("amuletCanvas");
    const ctx = canvas.getContext("2d");
    
    // スマホ壁紙サイズ (9:16)
    canvas.width = 1080;
    canvas.height = 1920;

    // 背景グラデーション
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, theme.colorStart);
    grad.addColorStop(1, theme.colorEnd);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // テキスト設定
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // メインフレーズ（長すぎる場合は2行に分割）
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

    // サブタイトル
    ctx.shadowBlur = 0;
    ctx.font = "30px sans-serif";
    ctx.fillText("デジタル・マインド・シェルター", canvas.width / 2, canvas.height - 100);

    // プレビュー画像に反映
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
// 7. ユーティリティ・PWA登録
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
