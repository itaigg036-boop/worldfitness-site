(() => {
  "use strict";

  const totalSourceFrames = 40;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmallScreen = window.matchMedia("(max-width: 640px)").matches;
  const frameStep = isSmallScreen ? 2 : 1;
  const frameNumbers = Array.from({ length: totalSourceFrames }, (_, index) => index + 1)
    .filter((number) => number === totalSourceFrames || (number - 1) % frameStep === 0);
  const framePaths = frameNumbers.map((number) => `frames/frame_${String(number).padStart(4, "0")}.jpg`);
  const firstPriorityFrames = Math.min(30, framePaths.length);

  const state = {
    images: [],
    loaded: 0,
    currentFrame: 0,
    targetFrame: 0,
    ticking: false,
    countersStarted: false,
  };

  const canvas = document.querySelector("#heroCanvas");
  const context = canvas.getContext("2d", { alpha: false });
  const frameSection = document.querySelector("#frameSection");
  const loader = document.querySelector("#pageLoader");
  const loaderProgress = document.querySelector("#loaderProgress");
  const loaderPercent = document.querySelector("#loaderPercent");
  const scrollProgress = document.querySelector(".scroll-progress span");
  const cursorDot = document.querySelector(".cursor-dot");
  const cursorRing = document.querySelector(".cursor-ring");

  document.body.classList.add("is-loading");

  // Build SplitText-like word reveal without external dependencies.
  function prepareSplitText() {
    document.querySelectorAll(".split-title").forEach((title) => {
      const words = title.textContent.trim().split(/\s+/);
      title.innerHTML = words
        .map((word, index) => `<span class="word"><span style="transition-delay:${index * 55}ms">${word}</span></span>`)
        .join(" ");
    });
  }

  function updateLoader() {
    const progress = Math.round((state.loaded / framePaths.length) * 100);
    loaderProgress.style.width = `${progress}%`;
    loaderPercent.textContent = `${progress}%`;
  }

  function loadImage(path, index) {
    return new Promise((resolve) => {
      const image = new Image();
      image.decoding = "async";
      image.onload = () => {
        state.loaded += 1;
        state.images[index] = image;
        updateLoader();
        resolve(image);
      };
      image.onerror = () => {
        state.loaded += 1;
        updateLoader();
        resolve(null);
      };
      image.src = path;
    });
  }

  async function preloadFrames() {
    // The first 30 frames are requested first so the scroll hero becomes usable quickly.
    const priority = framePaths.slice(0, firstPriorityFrames);
    const rest = framePaths.slice(firstPriorityFrames);

    await Promise.all(priority.map((path, index) => loadImage(path, index)));
    drawFrame(0);

    if (rest.length) {
      await Promise.all(rest.map((path, restIndex) => loadImage(path, firstPriorityFrames + restIndex)));
    }

    hideLoader();
  }

  function hideLoader() {
    drawFrame(0);
    loader.classList.add("is-hidden");
    document.body.classList.remove("is-loading");
    requestAnimationFrame(updateFrameFromScroll);
  }

  function resizeCanvas() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    drawFrame(state.currentFrame);
  }

  function drawFrame(frameIndex) {
    const image = state.images[frameIndex] || state.images.find(Boolean);
    if (!image) return;

    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight;
    const imageRatio = image.naturalWidth / image.naturalHeight;
    const canvasRatio = canvasWidth / canvasHeight;
    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;

    if (imageRatio > canvasRatio) {
      drawHeight = canvasHeight;
      drawWidth = drawHeight * imageRatio;
    } else {
      drawWidth = canvasWidth;
      drawHeight = drawWidth / imageRatio;
    }

    const x = (canvasWidth - drawWidth) / 2;
    const y = (canvasHeight - drawHeight) / 2;
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    context.filter = "contrast(1.08) saturate(1.08)";
    context.drawImage(image, x, y, drawWidth, drawHeight);
    context.filter = "none";
  }

  function getScrollProgressInFrameSection() {
    const rect = frameSection.getBoundingClientRect();
    const sectionHeight = frameSection.offsetHeight;
    const windowHeight = window.innerHeight;
    const scrollY = Math.min(Math.max(-rect.top, 0), sectionHeight - windowHeight);
    return sectionHeight <= windowHeight ? 0 : scrollY / (sectionHeight - windowHeight);
  }

  function updateFrameFromScroll() {
    const scrollFraction = getScrollProgressInFrameSection();
    const frameIndex = Math.min(framePaths.length - 1, Math.floor(scrollFraction * framePaths.length));
    state.targetFrame = frameIndex;

    if (!state.ticking) {
      state.ticking = true;
      requestAnimationFrame(renderFrameLoop);
    }
  }

  function renderFrameLoop() {
    state.currentFrame += (state.targetFrame - state.currentFrame) * 0.28;
    const roundedFrame = Math.round(state.currentFrame);
    drawFrame(roundedFrame);

    if (Math.abs(state.targetFrame - state.currentFrame) > 0.01) {
      requestAnimationFrame(renderFrameLoop);
      return;
    }

    state.currentFrame = state.targetFrame;
    drawFrame(state.currentFrame);
    state.ticking = false;
  }

  function updateScrollProgress() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? (window.scrollY / maxScroll) * 100 : 0;
    scrollProgress.style.width = `${progress}%`;
  }

  function initLenis() {
    if (prefersReducedMotion || !window.Lenis) return;

    const lenis = new Lenis({
      duration: 1.18,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.92,
    });

    function raf(time) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);
  }

  function initRevealObservers() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );

    document.querySelectorAll(".reveal, .split-title").forEach((element) => observer.observe(element));
  }

  function initCounters() {
    const stats = document.querySelector("#proof");
    const counters = document.querySelectorAll("[data-counter]");
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || state.countersStarted) return;
        state.countersStarted = true;
        counters.forEach(animateCounter);
        observer.disconnect();
      },
      { threshold: 0.35 }
    );

    observer.observe(stats);
  }

  function animateCounter(counter) {
    const target = Number(counter.dataset.counter);
    const hasDecimal = !Number.isInteger(target);
    const duration = 1600;
    const start = performance.now();

    function tick(now) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = target * eased;
      counter.textContent = hasDecimal ? value.toFixed(1) : Math.round(value);

      if (progress < 1) {
        requestAnimationFrame(tick);
      }
    }

    requestAnimationFrame(tick);
  }

  function initMagneticButtons() {
    if (prefersReducedMotion || isSmallScreen) return;

    document.querySelectorAll(".magnetic").forEach((element) => {
      element.addEventListener("mousemove", (event) => {
        const rect = element.getBoundingClientRect();
        const x = event.clientX - rect.left - rect.width / 2;
        const y = event.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate(${x * 0.18}px, ${y * 0.18}px)`;
      });

      element.addEventListener("mouseleave", () => {
        element.style.transform = "";
      });
    });
  }

  function initCustomCursor() {
    if (prefersReducedMotion || isSmallScreen || !cursorDot || !cursorRing) return;

    let mouseX = window.innerWidth / 2;
    let mouseY = window.innerHeight / 2;
    let ringX = mouseX;
    let ringY = mouseY;

    window.addEventListener("mousemove", (event) => {
      mouseX = event.clientX;
      mouseY = event.clientY;
      cursorDot.style.transform = `translate3d(${mouseX}px, ${mouseY}px, 0) translate(-50%, -50%)`;
    });

    document.querySelectorAll("a, button, .project-card, .feature-card").forEach((element) => {
      element.addEventListener("mouseenter", () => cursorRing.classList.add("is-active"));
      element.addEventListener("mouseleave", () => cursorRing.classList.remove("is-active"));
    });

    function animateCursor() {
      ringX += (mouseX - ringX) * 0.18;
      ringY += (mouseY - ringY) * 0.18;
      cursorRing.style.transform = `translate3d(${ringX}px, ${ringY}px, 0) translate(-50%, -50%)`;
      requestAnimationFrame(animateCursor);
    }

    animateCursor();
  }

  function initParallax() {
    if (prefersReducedMotion) return;

    const layers = document.querySelectorAll("[data-parallax]");

    function update() {
      layers.forEach((layer) => {
        const speed = Number(layer.dataset.parallax);
        const rect = layer.parentElement.getBoundingClientRect();
        const offset = rect.top * speed;
        layer.style.transform = `translate3d(0, ${offset}px, 0)`;
      });
    }

    window.addEventListener("scroll", () => requestAnimationFrame(update), { passive: true });
    update();
  }

  function initFilterTags() {
    document.querySelectorAll(".tag").forEach((tag) => {
      tag.addEventListener("click", () => {
        document.querySelectorAll(".tag").forEach((item) => item.classList.remove("active"));
        tag.classList.add("active");
      });
    });
  }

  function initIcons() {
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  function onScroll() {
    updateFrameFromScroll();
    updateScrollProgress();
  }

  prepareSplitText();
  resizeCanvas();
  initLenis();
  initRevealObservers();
  initCounters();
  initMagneticButtons();
  initCustomCursor();
  initParallax();
  initFilterTags();
  initIcons();
  preloadFrames();

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", resizeCanvas);
  window.addEventListener("load", () => {
    updateScrollProgress();
    updateFrameFromScroll();
  });
})();
