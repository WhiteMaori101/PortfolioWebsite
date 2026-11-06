// Always open on the reel rather than a restored scroll position
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// Fade sections in as they scroll into view
const io = new IntersectionObserver(
  (entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add("in");
        io.unobserve(e.target);
      }
    }
  },
  { threshold: 0.12 }
);
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Tile videos: fetch only when first near the viewport, and play only while visible,
// so they don't compete with the landing reel on first load
const videoIO = new IntersectionObserver(
  (entries) => {
    for (const { target: v, isIntersecting } of entries) {
      if (isIntersecting) {
        if (!v.src) v.src = v.dataset.src;
        v.play().catch(() => {});
      } else if (v.src) {
        v.pause();
      }
    }
  },
  { rootMargin: "200px 0px" }
);
document.querySelectorAll(".lazy-video").forEach((v) => videoIO.observe(v));

// ------------------------------------------------------------------
// Landing reel
// ------------------------------------------------------------------
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Intro counter 00 -> 99, then reveal the landing
(() => {
  const loader = document.querySelector(".loader");
  const count = document.querySelector(".loader-count");
  const finish = () => {
    loader.classList.add("done");
    document.body.classList.remove("is-loading");
    document.body.classList.add("ready");
  };
  if (reduceMotion) { finish(); return; }
  const duration = 1800;
  const start = performance.now();
  const step = (now) => {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    count.textContent = String(Math.round(eased * 99)).padStart(2, "0");
    if (t < 1) requestAnimationFrame(step);
    else setTimeout(finish, 250);
  };
  requestAnimationFrame(step);
})();

// Film-edge ruler ticks (duplicated so the loop is seamless)
document.querySelectorAll(".ruler-track").forEach((track, i) => {
  const base = i === 0 ? 240 : 380;
  const ticks = Array.from({ length: 24 }, (_, n) => `<span>${base + n * 10}</span>`).join("");
  track.innerHTML = ticks + ticks;
});

// Reel: loop only the moments Joshua is on screen.
// Times are in seconds into the YouTube video. Adjust start/end to trim.
const CLIPS = [
  { start: 77, end: 83 },   // 1:18
  { start: 103, end: 110 }, // 1:44 and 1:47
];

const pad = (n) => String(n).padStart(2, "0");
const tc = document.getElementById("timecode");
const clipIndex = document.getElementById("clip-index");
document.getElementById("clip-count").textContent = "." + pad(CLIPS.length);

let player = null;
let current = 0;
let seekedAt = 0;

const playClip = (i) => {
  current = i % CLIPS.length;
  seekedAt = Date.now();
  player.seekTo(CLIPS[current].start, true);
  // Only nudge play when needed; calling it while playing flashes YouTube's pause icon
  if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
  clipIndex.textContent = pad(current + 1) + ".";
};

// Called by the YouTube IFrame API script once it loads
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("reel-frame", {
    events: {
      onReady: (e) => {
        e.target.mute();
        playClip(0);
        setInterval(() => {
          const t = player.getCurrentTime() || 0;
          const s = Math.floor(t);
          tc.textContent = `00:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
          if (Date.now() - seekedAt < 1000) return;
          const clip = CLIPS[current];
          if (t >= clip.end || t < clip.start - 1) playClip(current + 1);
        }, 200);
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED) playClip(current + 1);
      },
    },
  });
};

// Sound toggle
(() => {
  const btn = document.querySelector(".l-sound");
  const label = btn.querySelector("span");
  btn.addEventListener("click", () => {
    if (!player) return;
    const on = btn.getAttribute("aria-pressed") !== "true";
    if (on) { player.unMute(); player.setVolume(80); player.playVideo(); }
    else player.mute();
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "Mute" : "Play with sound";
  });
})();
