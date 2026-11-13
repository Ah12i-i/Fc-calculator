/* Purpose: shared constants and asset paths used across the app. */

(function (global) {
  global.FC = global.FC || {};

  global.FC.ASSETS = {
    images: {
      bg: "assets/images/bg-fc27.jpg",
      coins: "assets/images/fc-coins-small.png"
    },
    videos: {
      base: "assets/videos/"
    },
    audio: {
      base: "assets/audio/"
    }
  };

  global.FC.TAX_RATE = 0.05;
  global.FC.NET_RATE = 0.95;
  global.FC.DEFAULTS = {
    playersCount: 1,
    buyPrice: "",
    sellPrice: ""
  };

  global.FC.VISITOR_API_URL = "https://fc-calculator-visitors.fc-calculator.workers.dev/api/visitors";
  global.FC.PRESENCE_API_URL = "https://fc-calculator-visitors.fc-calculator.workers.dev/api/presence";
})(window);
