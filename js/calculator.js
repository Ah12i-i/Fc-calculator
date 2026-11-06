/* Purpose: pure calculation logic and numeric formatting helpers. */

(function (global) {
  const englishDigits = {
    "٠": "0",
    "١": "1",
    "٢": "2",
    "٣": "3",
    "٤": "4",
    "٥": "5",
    "٦": "6",
    "٧": "7",
    "٨": "8",
    "٩": "9",
    "۰": "0",
    "۱": "1",
    "۲": "2",
    "۳": "3",
    "۴": "4",
    "۵": "5",
    "۶": "6",
    "۷": "7",
    "۸": "8",
    "۹": "9"
  };

  function normalizeDigits(value) {
    return String(value || "").replace(/[٠-٩۰-۹]/g, function (char) {
      return englishDigits[char] || char;
    });
  }

  function digitsOnly(value) {
    return normalizeDigits(value).replace(/\D/g, "");
  }

  function parseNumericInput(value) {
    const digits = digitsOnly(value);
    return digits ? Number(digits) : 0;
  }

  function formatNumber(value) {
    const numeric = parseNumericInput(value);
    if (!numeric && numeric !== 0) {
      return "";
    }
    return Number(numeric).toLocaleString("en-US");
  }

  function formatSignedPercent(value) {
    if (!Number.isFinite(value)) {
      return "+0.00%";
    }

    const sign = value > 0 ? "+" : value < 0 ? "-" : "+";
    return sign + Math.abs(value).toFixed(2) + "%";
  }

  function calculateStats(input) {
    const buyPrice = parseNumericInput(input.buyPrice);
    const sellPrice = parseNumericInput(input.sellPrice);
    const playersCount = Math.max(1, parseNumericInput(input.playersCount) || 1);

    const netSell = sellPrice * global.FC.NET_RATE;
    const taxAmount = sellPrice * global.FC.TAX_RATE;
    const profitPerPlayer = netSell - buyPrice;
    const lossPerPlayer = Math.max(-profitPerPlayer, 0);
    const totalProfit = Math.max(profitPerPlayer, 0) * playersCount;
    const totalLoss = lossPerPlayer * playersCount;
    const percentage = buyPrice > 0 ? (profitPerPlayer / buyPrice) * 100 : 0;
    const breakEven = buyPrice > 0 ? buyPrice / global.FC.NET_RATE : 0;

    return {
      netSell,
      taxAmount,
      profitPerPlayer,
      lossPerPlayer,
      totalProfit,
      totalLoss,
      percentage,
      breakEven,
      playersCount
    };
  }

  global.FC = global.FC || {};
  global.FC.normalizeDigits = normalizeDigits;
  global.FC.digitsOnly = digitsOnly;
  global.FC.parseNumericInput = parseNumericInput;
  global.FC.formatNumber = formatNumber;
  global.FC.formatSignedPercent = formatSignedPercent;
  global.FC.calculateStats = calculateStats;
})(window);
