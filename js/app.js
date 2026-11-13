/* Purpose: DOM wiring, rendering, and interaction logic for the calculator. */

(function (global) {
  /* --- DOM references --- */
  const fc = global.FC;
  const elements = {
    buyPrice: document.getElementById("buy-price"),
    sellPrice: document.getElementById("sell-price"),
    playersCount: document.getElementById("players-count"),
    capitalTotal: document.getElementById("capital-total"),
    chips: Array.from(document.querySelectorAll(".chip")),
    stepButtons: Array.from(document.querySelectorAll(".player-stepper")),
    priceStepButtons: Array.from(document.querySelectorAll("[data-price-target]")),
    resetButton: document.getElementById("reset-btn"),
    profitCard: document.getElementById("profit-card"),
    lossCard: document.getElementById("loss-card"),
    profitTotal: document.getElementById("profit-total"),
    lossTotal: document.getElementById("loss-total"),
    profitPerPlayer: document.getElementById("profit-per-player"),
    lossPerPlayer: document.getElementById("loss-per-player"),
    profitCoinsTotal: document.getElementById("profit-coins-total"),
    lossCoinsTotal: document.getElementById("loss-coins-total"),
    profitPercent: document.getElementById("profit-percent"),
    lossPercent: document.getElementById("loss-percent"),
    breakEvenProfit: document.getElementById("break-even-profit"),
    visitorCount: document.getElementById("visitor-count"),
    onlineCounter: document.getElementById("online-counter"),
    onlineCount: document.getElementById("online-count")
  };

  let renderFrameId = null;
  let presenceSessionId = null;
  let presenceRequestPending = false;

  function animateNumber(element, endValue, decimals) {
    if (element._rafId) {
      cancelAnimationFrame(element._rafId);
    }

    const startValue = Number(element.dataset.value || 0);
    const from = Number.isFinite(startValue) ? startValue : 0;
    const to = Number.isFinite(endValue) ? endValue : 0;
    const duration = 400;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = from + (to - from) * eased;
      const nextText = Number(current.toFixed(decimals)).toLocaleString("en-US");
      element.textContent = nextText;

      if (progress < 1) {
        element._rafId = requestAnimationFrame(tick);
      } else {
        element.textContent = Number(to.toFixed(decimals)).toLocaleString("en-US");
        element.dataset.value = String(to);
        element._rafId = null;
      }
    }

    element._rafId = requestAnimationFrame(tick);
  }

  function syncChipState(selectedPlayers) {
    elements.chips.forEach(function (chip) {
      const matches = Number(chip.dataset.players) === Number(selectedPlayers);
      chip.classList.toggle("is-active", matches);
    });
  }

  function setPlayersValue(value) {
    const safeValue = Math.max(1, Number(fc.digitsOnly(value)) || 1);
    elements.playersCount.value = fc.formatNumber(String(safeValue));
    syncChipState(safeValue);
    render();
  }

  function getMarketPriceStep(price, direction) {
    if (direction > 0) {
      if (price < 1000) {
        return Math.min(1000, (Math.floor(price / 50) + 1) * 50);
      }
      if (price < 10000) {
        return 1000 + (Math.floor((price - 1000) / 100) + 1) * 100;
      }
      if (price < 50000) {
        return 10000 + (Math.floor((price - 10000) / 250) + 1) * 250;
      }
      if (price < 100000) {
        return 50000 + (Math.floor((price - 50000) / 500) + 1) * 500;
      }
      return 100000 + (Math.floor((price - 100000) / 1000) + 1) * 1000;
    }

    if (price <= 1000) {
      return Math.max(0, (Math.ceil(price / 50) - 1) * 50);
    }
    if (price <= 10000) {
      return 1000 + (Math.ceil((price - 1000) / 100) - 1) * 100;
    }
    if (price <= 50000) {
      return 10000 + (Math.ceil((price - 10000) / 250) - 1) * 250;
    }
    if (price <= 100000) {
      return 50000 + (Math.ceil((price - 50000) / 500) - 1) * 500;
    }
    return 100000 + (Math.ceil((price - 100000) / 1000) - 1) * 1000;
  }

  function setNeutralState() {
    animateNumber(elements.profitTotal, 0, 0);
    animateNumber(elements.lossTotal, 0, 0);
    animateNumber(elements.profitPerPlayer, 0, 0);
    animateNumber(elements.lossPerPlayer, 0, 0);
    animateNumber(elements.profitCoinsTotal, 0, 0);
    animateNumber(elements.lossCoinsTotal, 0, 0);
    elements.profitPercent.textContent = "+0.00%";
    elements.lossPercent.textContent = "+0.00%";
    animateNumber(elements.breakEvenProfit, 0, 0);

    elements.profitCard.classList.add("neutral-card");
    elements.lossCard.classList.add("neutral-card");
    elements.profitCard.classList.remove("is-active");
    elements.lossCard.classList.remove("is-active");
  }

  function applyNumericInputFormatting(input) {
    const digits = fc.digitsOnly(input.value);
    input.value = digits ? fc.formatNumber(digits) : "";

    if (input === elements.playersCount) {
      const count = Number(fc.digitsOnly(input.value)) || 0;
      syncChipState(count > 0 ? count : 1);
    }
  }

  function updateCardState(direction) {
    elements.profitCard.classList.remove("is-active");
    elements.lossCard.classList.remove("is-active");
    elements.profitCard.classList.add("neutral-card");
    elements.lossCard.classList.add("neutral-card");

    if (direction === "profit") {
      elements.profitCard.classList.remove("neutral-card");
      elements.profitCard.classList.add("is-active");
    }

    if (direction === "loss") {
      elements.lossCard.classList.remove("neutral-card");
      elements.lossCard.classList.add("is-active");
    }
  }

  function render() {
    const buyPrice = fc.parseNumericInput(elements.buyPrice.value);
    const sellPrice = fc.parseNumericInput(elements.sellPrice.value);
    const playersCount = Math.max(1, fc.parseNumericInput(elements.playersCount.value) || 1);

    elements.capitalTotal.textContent = fc.formatNumber(String(buyPrice * playersCount));

    const hasAnyValue = buyPrice > 0 || sellPrice > 0;
    if (!hasAnyValue) {
      setNeutralState();
      return;
    }

    const stats = fc.calculateStats({
      buyPrice: elements.buyPrice.value,
      sellPrice: elements.sellPrice.value,
      playersCount: playersCount
    });

    const positive = stats.profitPerPlayer > 0;
    const negative = stats.profitPerPlayer < 0;

    animateNumber(elements.profitTotal, Math.max(stats.totalProfit, 0), 0);
    animateNumber(elements.lossTotal, Math.max(stats.totalLoss, 0), 0);
    animateNumber(elements.profitPerPlayer, Math.max(stats.profitPerPlayer, 0), 0);
    animateNumber(elements.lossPerPlayer, Math.max(stats.lossPerPlayer, 0), 0);
    animateNumber(elements.profitCoinsTotal, positive ? stats.totalCoins : 0, 0);
    animateNumber(elements.lossCoinsTotal, negative ? stats.totalCoins : 0, 0);
    animateNumber(elements.breakEvenProfit, Math.max(stats.breakEven, 0), 0);

    elements.profitPercent.textContent = fc.formatSignedPercent(Math.max(stats.percentage, 0));
    elements.lossPercent.textContent = fc.formatSignedPercent(Math.min(stats.percentage, 0));

    if (positive) {
      updateCardState("profit");
    } else if (negative) {
      updateCardState("loss");
    } else {
      elements.profitCard.classList.add("neutral-card");
      elements.lossCard.classList.add("neutral-card");
      elements.profitCard.classList.remove("is-active");
      elements.lossCard.classList.remove("is-active");
    }
  }

  function scheduleRender() {
    if (renderFrameId) {
      cancelAnimationFrame(renderFrameId);
    }

    renderFrameId = requestAnimationFrame(function () {
      render();
      renderFrameId = null;
    });
  }

  function resetForm() {
    elements.buyPrice.value = "";
    elements.sellPrice.value = "";
    elements.playersCount.value = String(fc.DEFAULTS.playersCount);
    syncChipState(fc.DEFAULTS.playersCount);
    render();
  }

  async function loadVisitorCount() {
    if (!fc.VISITOR_API_URL) {
      if (elements.visitorCount.dataset.hasCachedValue !== "true") {
        elements.visitorCount.textContent = "غير مفعّل";
      }
      return;
    }

    try {
      const response = await fetch(fc.VISITOR_API_URL, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Visitor counter returned HTTP " + response.status);
      }

      const result = await response.json();
      if (!Number.isSafeInteger(result.total) || result.total < 0) {
        throw new Error("Visitor counter returned an invalid total");
      }

      elements.visitorCount.textContent = result.total.toLocaleString("en-US");
      elements.visitorCount.dataset.hasCachedValue = "true";
      try {
        localStorage.setItem(elements.visitorCount.dataset.cacheKey, String(result.total));
      } catch (error) {
        console.warn("تعذر حفظ العدد الأخير للزوار:", error);
      }
    } catch (error) {
      if (elements.visitorCount.dataset.hasCachedValue !== "true") {
        elements.visitorCount.textContent = "غير متاح";
      }
      console.error("تعذر تحميل عداد الزوار:", error);
    }
  }

  function getPresenceSessionId() {
    if (presenceSessionId) {
      return presenceSessionId;
    }

    try {
      const savedSessionId = localStorage.getItem("fc-presence-session");
      if (savedSessionId && /^[a-f0-9]{32}$/.test(savedSessionId)) {
        presenceSessionId = savedSessionId;
        return presenceSessionId;
      }
    } catch (error) {
      console.warn("تعذر قراءة معرّف جلسة الاتصال:", error);
    }

    const bytes = global.crypto.getRandomValues(new Uint8Array(16));
    presenceSessionId = Array.from(bytes, function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");

    try {
      localStorage.setItem("fc-presence-session", presenceSessionId);
    } catch (error) {
      console.warn("تعذر حفظ معرّف جلسة الاتصال:", error);
    }

    return presenceSessionId;
  }

  async function sendPresenceHeartbeat() {
    if (presenceRequestPending || !fc.PRESENCE_API_URL) {
      return;
    }

    presenceRequestPending = true;
    try {
      const response = await fetch(fc.PRESENCE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getPresenceSessionId() }),
        cache: "no-store"
      });
      if (!response.ok) {
        throw new Error("Presence counter returned HTTP " + response.status);
      }

      const result = await response.json();
      if (!Number.isSafeInteger(result.total) || result.total < 0) {
        throw new Error("Presence counter returned an invalid total");
      }

      elements.onlineCount.textContent = result.total.toLocaleString("en-US");
      elements.onlineCounter.classList.add("is-connected");
      elements.onlineCounter.classList.remove("is-unavailable");
    } catch (error) {
      const wasUnavailable = elements.onlineCounter.classList.contains("is-unavailable");
      elements.onlineCount.textContent = "غير متاح";
      elements.onlineCounter.classList.remove("is-connected");
      elements.onlineCounter.classList.add("is-unavailable");
      if (!wasUnavailable) {
        console.error("تعذر تحديث عدد المتصلين:", error);
      }
    } finally {
      presenceRequestPending = false;
    }
  }

  function startPresenceCounter() {
    if (!fc.PRESENCE_API_URL) {
      elements.onlineCount.textContent = "غير مفعّل";
      elements.onlineCounter.classList.add("is-unavailable");
      return;
    }

    async function heartbeatLoop() {
      await sendPresenceHeartbeat();
      global.setTimeout(heartbeatLoop, 5000);
    }

    heartbeatLoop();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) {
        sendPresenceHeartbeat();
      }
    });
  }

  elements.buyPrice.addEventListener("input", function () {
    applyNumericInputFormatting(this);
    scheduleRender();
  });

  elements.sellPrice.addEventListener("input", function () {
    applyNumericInputFormatting(this);
    scheduleRender();
  });

  elements.playersCount.addEventListener("input", function () {
    applyNumericInputFormatting(this);
    scheduleRender();
  });

  elements.playersCount.addEventListener("keydown", function (event) {
    if (["e", "E", "+", "-", "."].includes(event.key)) {
      event.preventDefault();
    }
  });

  elements.stepButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const currentValue = Number(fc.digitsOnly(elements.playersCount.value)) || 1;
      const step = Number(button.dataset.step) || 0;
      setPlayersValue(currentValue + step);
    });
  });

  elements.priceStepButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      const input = document.getElementById(button.dataset.priceTarget);
      const currentPrice = fc.parseNumericInput(input.value);
      const direction = Number(button.dataset.priceDirection);
      const nextPrice = getMarketPriceStep(currentPrice, direction);
      input.value = fc.formatNumber(String(nextPrice));
      render();
    });
  });

  elements.chips.forEach(function (chip) {
    chip.addEventListener("click", function () {
      setPlayersValue(chip.dataset.players);
    });
  });

  elements.resetButton.addEventListener("click", resetForm);

  elements.playersCount.value = String(fc.DEFAULTS.playersCount);
  syncChipState(fc.DEFAULTS.playersCount);
  render();
  loadVisitorCount();
  startPresenceCounter();
})(window);
