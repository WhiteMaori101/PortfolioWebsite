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
// YouTube clips use seconds into the YouTube video; adjust start/end to trim.
// The local clip is media/landing-clip.mp4 (3:06 to 3:14 of the training
// footage); its offset only feeds the on-screen timecode.
const HERITAGE = { kind: "Commercial", title: "Stirling Sports — Our Heritage" };
const CLIPS = [
  { ...HERITAGE, start: 77, end: 83 },   // 1:18
  { ...HERITAGE, start: 103, end: 110 }, // 1:44 and 1:47
  { kind: "Stage combat", title: "Staff fight", local: true, offset: 186 },
];

const pad = (n) => String(n).padStart(2, "0");
const tc = document.getElementById("timecode");
const clipIndex = document.getElementById("clip-index");
const reelWrap = document.querySelector(".landing-video");
const localVideo = document.getElementById("reel-local");
const clipKind = document.getElementById("clip-kind");
const clipTitle = document.getElementById("clip-title");
const clipLink = document.getElementById("clip-link");
document.getElementById("clip-count").textContent = "." + pad(CLIPS.length);

let player = null;
let current = 0;
let seekedAt = 0;
let soundOn = false;

const showTime = (t) => {
  const s = Math.floor(t);
  tc.textContent = `00:${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
};

const playClip = (i) => {
  current = i % CLIPS.length;
  seekedAt = Date.now();
  const clip = CLIPS[current];
  clipIndex.textContent = pad(current + 1) + ".";
  clipKind.textContent = clip.kind;
  clipTitle.textContent = clip.title;
  // The YouTube link only makes sense while the YouTube footage is on screen
  clipLink.style.visibility = clip.local ? "hidden" : "";
  if (clip.local) {
    player.pauseVideo();
    localVideo.muted = !soundOn;
    localVideo.currentTime = 0;
    localVideo.play().catch(() => {});
    reelWrap.classList.add("is-local");
    return;
  }
  reelWrap.classList.remove("is-local");
  localVideo.pause();
  player.seekTo(clip.start, true);
  // Only nudge play when needed; calling it while playing flashes YouTube's pause icon
  if (player.getPlayerState() !== YT.PlayerState.PLAYING) player.playVideo();
};

localVideo.addEventListener("ended", () => {
  if (CLIPS[current].local) playClip(current + 1);
});

// Called by the YouTube IFrame API script once it loads
window.onYouTubeIframeAPIReady = () => {
  player = new YT.Player("reel-frame", {
    events: {
      onReady: (e) => {
        e.target.mute();
        playClip(0);
        setInterval(() => {
          const clip = CLIPS[current];
          if (clip.local) { showTime(clip.offset + localVideo.currentTime); return; }
          const t = player.getCurrentTime() || 0;
          showTime(t);
          if (Date.now() - seekedAt < 1000) return;
          if (t >= clip.end || t < clip.start - 1) playClip(current + 1);
        }, 200);
      },
      onStateChange: (e) => {
        if (e.data === YT.PlayerState.ENDED && !CLIPS[current].local) playClip(current + 1);
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
    soundOn = on;
    localVideo.muted = !on;
    if (on) {
      player.unMute();
      player.setVolume(80);
      if (!CLIPS[current].local) player.playVideo();
    } else player.mute();
    btn.setAttribute("aria-pressed", String(on));
    label.textContent = on ? "Mute" : "Play with sound";
  });
})();
