class CalorieDashboard {
  constructor() {
    this.database = [];
    this.searchResults = [];
    this.dailyLog = [];
    this.dailyGoal = 2000;
    this.totalConsumed = 0;
    this.displayLimit = 25;

    this.aiModelsLoaded = false;
    this.isScanning = false;

    this.ui = {
      input: document.getElementById("searchInput"),
      searchBtn: document.getElementById("searchBtn"),
      clearBtn: document.getElementById("clearBtn"),
      resultsList: document.getElementById("resultsList"),
      loadMoreBtn: document.getElementById("loadMoreBtn"),
      statusBox: document.getElementById("statusBox"),
      resultsHeader: document.getElementById("resultsHeader"),
      matchCount: document.getElementById("matchCount"),

      calcGoalBtn: document.getElementById("calcGoalBtn"),
      goalDisplay: document.getElementById("goalDisplay"),
      consumedDisplay: document.getElementById("consumedDisplay"),
      remainingDisplay: document.getElementById("remainingDisplay"),
      progressBar: document.getElementById("progressBar"),
      dailyLogList: document.getElementById("dailyLogList"),
      clearLogBtn: document.getElementById("clearLogBtn"),

      startAIBtn: document.getElementById("startAIBtn"),
      videoFeed: document.getElementById("videoFeed"),
      cameraContainer: document.getElementById("cameraContainer"),
      moodResult: document.getElementById("moodResult"),
      moodLabel: document.getElementById("moodLabel"),
      moodRecommendation: document.getElementById("moodRecommendation"),

      navBtns: document.querySelectorAll("button.nav-btn"),
      views: document.querySelectorAll(".view-section"),
    };

    this.init();
  }

  async init() {
    this.bindEvents();
    this.updateDashboardUI();
    await this.loadData();
  }

  bindEvents() {
    this.ui.searchBtn.addEventListener("click", () => this.handleSearch());
    this.ui.clearBtn.addEventListener("click", () => this.clearSearch());
    this.ui.loadMoreBtn.addEventListener("click", () => this.loadMore());
    this.ui.input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") this.handleSearch();
    });
    this.ui.calcGoalBtn.addEventListener("click", () => this.calculateGoal());
    this.ui.clearLogBtn.addEventListener("click", () => this.clearLog());
    this.ui.startAIBtn.addEventListener("click", () => this.toggleAI());

    this.ui.navBtns.forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const target = e.currentTarget.getAttribute("data-target");
        this.switchView(target);
      });
    });
  }

  switchView(targetId) {
    this.ui.views.forEach((view) => view.classList.remove("active"));
    this.ui.navBtns.forEach((btn) => btn.classList.remove("active"));

    document.getElementById(`view-${targetId}`).classList.add("active");
    const activeNavBtn = document.querySelector(
      `button.nav-btn[data-target="${targetId}"]`,
    );
    if (activeNavBtn) activeNavBtn.classList.add("active");
  }

  // --- AI Facial Emotion Logic ---
  async toggleAI() {
    if (this.isScanning) {
      const stream = this.ui.videoFeed.srcObject;
      if (stream) stream.getTracks().forEach((track) => track.stop());
      this.ui.cameraContainer.style.display = "none";
      this.ui.moodResult.style.display = "none";
      this.ui.startAIBtn.innerText = "Enable AI Camera";
      this.isScanning = false;
    } else {
      this.ui.startAIBtn.innerText = "Loading AI Models...";
      this.ui.startAIBtn.disabled = true;
      await this.startVideoFeed();
    }
  }

  async startVideoFeed() {
    try {
      if (!this.aiModelsLoaded) {
        const MODEL_URL = "https://vladmandic.github.io/face-api/model/";
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        this.aiModelsLoaded = true;
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      this.ui.videoFeed.srcObject = stream;

      this.ui.cameraContainer.style.display = "block";
      this.ui.moodResult.style.display = "block";
      this.ui.startAIBtn.innerText = "Stop AI Camera";
      this.ui.startAIBtn.disabled = false;
      this.isScanning = true;

      this.ui.videoFeed.addEventListener("play", () => {
        this.analyzeMood();
      });
    } catch (err) {
      console.error(err);
      alert(
        "Could not access camera. Ensure you are running this on a local server (http://localhost:8000) and allow camera permissions.",
      );
      this.ui.startAIBtn.innerText = "Enable AI Camera";
      this.ui.startAIBtn.disabled = false;
    }
  }

  async analyzeMood() {
    if (!this.isScanning) return;

    const detections = await faceapi
      .detectSingleFace(
        this.ui.videoFeed,
        new faceapi.TinyFaceDetectorOptions(),
      )
      .withFaceExpressions();

    if (detections) {
      const expressions = detections.expressions;
      const highestEmotion = Object.keys(expressions).reduce((a, b) =>
        expressions[a] > expressions[b] ? a : b,
      );

      if (expressions[highestEmotion] > 0.6) {
        this.recommendFoodBasedOnMood(highestEmotion);
      }
    }
    setTimeout(() => this.analyzeMood(), 1000);
  }

  recommendFoodBasedOnMood(mood) {
    const moodMap = {
      happy: {
        text: "You're glowing! Keep the energy up with something vibrant.",
        query: "fruit",
        icon: "😄",
      },
      sad: {
        text: "Need a hug? Warm comfort food helps.",
        query: "soup",
        icon: "😢",
      },
      angry: {
        text: "Stressed? Crunchy foods relieve tension.",
        query: "nut",
        icon: "😠",
      },
      neutral: {
        text: "Balanced and ready! A healthy staple is perfect.",
        query: "chicken",
        icon: "😐",
      },
      surprised: {
        text: "Whoa! Settle down with something light.",
        query: "tea",
        icon: "😲",
      },
      fearful: {
        text: "Take a deep breath. Chocolate helps calm nerves.",
        query: "chocolate",
        icon: "😨",
      },
      disgusted: {
        text: "Let's cleanse the palate with some citrus.",
        query: "orange",
        icon: "🤢",
      },
    };

    const data = moodMap[mood] || moodMap.neutral;

    this.ui.moodLabel.innerText = `${mood.toUpperCase()} ${data.icon}`;
    this.ui.moodRecommendation.innerText = data.text;

    if (this.ui.input.value !== data.query) {
      this.switchView("database");
      this.ui.input.value = data.query;
      this.handleSearch();
    }
  }

  // --- Core App Logic ---
  async loadData() {
    try {
      const response = await fetch("food_data.json");
      if (!response.ok) throw new Error("Data file not found");
      this.database = await response.json();
    } catch (error) {
      this.showStatus(
        "Error: Could not load food database. Make sure you are running a local server.",
        "error",
      );
    }
  }

  handleSearch() {
    const term = this.ui.input.value.trim().toLowerCase();
    if (!term) return;

    const escapeRegex = (str) => str.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
    const pattern = term.split("*").map(escapeRegex).join(".*");
    const regex = new RegExp(pattern, "i");

    this.searchResults = this.database.filter((food) => regex.test(food.name));

    if (this.searchResults.length === 0) {
      this.showStatus(`No matches found for "${term}".`, "error");
      this.clearResultsList();
      return;
    }

    this.ui.statusBox.style.display = "none";
    this.displayLimit = 25;
    this.renderResults();
  }

  renderResults() {
    const cards = this.ui.resultsList.querySelectorAll(".result-card");
    cards.forEach((card) => card.remove());

    this.ui.resultsHeader.style.display = "flex";
    this.ui.matchCount.innerText = `Showing ${Math.min(this.displayLimit, this.searchResults.length)} of ${this.searchResults.length} matches`;

    const itemsToRender = this.searchResults.slice(0, this.displayLimit);
    const fragment = document.createDocumentFragment();

    itemsToRender.forEach((food) => {
      const card = document.createElement("div");
      card.className = "result-card";
      const cals = Math.round(food.calories);

      const descHtml = food.description
        ? `<div class="food-desc">${food.description}</div>`
        : "";

      card.innerHTML = `
                <div class="food-info">
                    <h4>${food.name}</h4>
                    <div class="food-portion">Portion: ${food.portion}</div>
                    ${descHtml}
                </div>
                <div class="action-area">
                    <div class="calories-badge">${cals} kcal</div>
                    <button class="btn-add" title="Add to Daily Log">+</button>
                </div>
            `;

      card.querySelector(".btn-add").addEventListener("click", () => {
        this.addToLog(food.name, cals);
      });

      fragment.appendChild(card);
    });

    this.ui.resultsList.insertBefore(fragment, this.ui.loadMoreBtn);
    this.ui.loadMoreBtn.style.display =
      this.searchResults.length > this.displayLimit ? "block" : "none";
  }

  calculateGoal() {
    const weight =
      parseFloat(document.getElementById("userWeight").value) || 70;
    const height =
      parseFloat(document.getElementById("userHeight").value) || 175;
    const age = parseFloat(document.getElementById("userAge").value) || 30;
    let bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    this.dailyGoal = Math.round(bmr * 1.2);
    this.updateDashboardUI();
  }

  addToLog(name, calories) {
    this.dailyLog.push({ id: Date.now(), name, calories });
    this.totalConsumed += calories;
    this.updateDashboardUI();
  }

  removeFromLog(id, calories) {
    this.dailyLog = this.dailyLog.filter((item) => item.id !== id);
    this.totalConsumed -= calories;
    this.updateDashboardUI();
  }

  clearLog() {
    this.dailyLog = [];
    this.totalConsumed = 0;
    this.updateDashboardUI();
  }

  updateDashboardUI() {
    this.ui.goalDisplay.innerText = `${this.dailyGoal.toLocaleString()} kcal`;
    this.ui.consumedDisplay.innerText = `${this.totalConsumed.toLocaleString()} kcal`;
    const remaining = this.dailyGoal - this.totalConsumed;
    this.ui.remainingDisplay.innerText = `${remaining > 0 ? remaining.toLocaleString() : 0} kcal`;
    this.ui.remainingDisplay.className =
      remaining > 0 ? "highlight-green" : "highlight";
    this.ui.remainingDisplay.style.color =
      remaining <= 0 ? "var(--danger)" : "";

    let percent = (this.totalConsumed / this.dailyGoal) * 100;
    if (percent > 100) percent = 100;
    this.ui.progressBar.style.width = `${percent}%`;
    this.ui.progressBar.style.background =
      this.totalConsumed > this.dailyGoal
        ? "var(--danger)"
        : "linear-gradient(90deg, var(--primary), var(--accent))";

    this.ui.dailyLogList.innerHTML = "";
    if (this.dailyLog.length === 0) {
      this.ui.dailyLogList.innerHTML =
        '<div class="empty-state">No food added yet.</div>';
      return;
    }

    this.dailyLog
      .slice()
      .reverse()
      .forEach((item) => {
        const div = document.createElement("div");
        div.className = "log-item";
        div.innerHTML = `
                <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:180px;">${item.name}</span>
                <span><strong>${item.calories}</strong> <button class="btn-icon" style="color:var(--danger); margin-left:8px;" data-id="${item.id}" data-cal="${item.calories}">×</button></span>
            `;
        div.querySelector("button").addEventListener("click", (e) => {
          this.removeFromLog(
            parseInt(e.target.getAttribute("data-id")),
            parseInt(e.target.getAttribute("data-cal")),
          );
        });
        this.ui.dailyLogList.appendChild(div);
      });
  }

  loadMore() {
    this.displayLimit += 25;
    this.renderResults();
  }
  clearSearch() {
    this.ui.input.value = "";
    this.searchResults = [];
    this.clearResultsList();
    this.ui.statusBox.style.display = "none";
  }
  clearResultsList() {
    const cards = this.ui.resultsList.querySelectorAll(".result-card");
    cards.forEach((card) => card.remove());
    this.ui.resultsHeader.style.display = "none";
    this.ui.loadMoreBtn.style.display = "none";
  }
  showStatus(message, type) {
    this.ui.statusBox.textContent = message;
    this.ui.statusBox.className = `status-message status-${type}`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new CalorieDashboard();
});
