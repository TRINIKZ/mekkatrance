function redpage() {
  window.location.href = "html/myFiles.html";
}

document.addEventListener('DOMContentLoaded', () => {

  const hyperdriveTitle = document.querySelector('.about-right h1');

  if (hyperdriveTitle) {
    const originalTitle = hyperdriveTitle.textContent.trim();
    const leetAlphabet = {
      A: ['A', '4'], B: ['B', '8'], C: ['C', '('], D: ['D'], E: ['E', '3'],
      F: ['F'], G: ['G', '6'], H: ['H', '#'], I: ['I', '1', '!'], J: ['J'],
      K: ['K'], L: ['L', '1'], M: ['M'], N: ['N'], O: ['O', '0'], P: ['P'],
      Q: ['Q'], R: ['R'], S: ['S', '5'], T: ['T', '7', '+'], U: ['U'],
      V: ['V'], W: ['W'], X: ['X'], Y: ['Y'], Z: ['Z', '2'],
    };
    const eligibleIndexes = [...originalTitle]
      .map((character, index) => (leetAlphabet[character] ? index : -1))
      .filter((index) => index >= 0);
    let leetPulseActive = false;

    hyperdriveTitle.setAttribute('aria-label', originalTitle);

    const pulseLeetTitle = () => {
      const characters = [...originalTitle];
      leetPulseActive = true;

      eligibleIndexes.forEach((index, order) => {
        setTimeout(() => {
          const options = leetAlphabet[characters[index]];
          const leetOptions = options.filter((option) => option !== characters[index]);
          characters[index] = leetOptions.length
            ? leetOptions[Math.floor(Math.random() * leetOptions.length)]
            : characters[index];
          hyperdriveTitle.textContent = characters.join('');

          if (order === eligibleIndexes.length - 1) {
            setTimeout(() => {
              eligibleIndexes.forEach((resetIndex, resetOrder) => {
                setTimeout(() => {
                  characters[resetIndex] = originalTitle[resetIndex];
                  hyperdriveTitle.textContent = characters.join('');

                  if (resetOrder === eligibleIndexes.length - 1) {
                    leetPulseActive = false;
                  }
                }, resetOrder * 16);
              });
            }, 90);
          }
        }, order * 16);
      });
    };

    hyperdriveTitle.textContent = originalTitle;
    setInterval(pulseLeetTitle, 3000);
  }

  const liquidCanvases = document.querySelectorAll('.about-voronoi-flow, .contact-liquid-flow');

  liquidCanvases.forEach((liquidCanvas) => {
    const aboutSection = liquidCanvas.closest('.container-home2, .contact-zone');
    const context = liquidCanvas.getContext('2d');
    const texture = document.createElement('canvas');
    const textureContext = texture.getContext('2d');
    const vortices = Array.from({ length: 6 }, (_, index) => ({
      x: 0.1 + ((index * 0.211) % 0.8),
      y: 0.12 + ((index * 0.337) % 0.76),
      phase: index * 1.93,
      direction: index % 2 ? 1 : -1,
    }));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let lastDraw = 0;
    let liquidVisible = true;
    let pageVisible = !document.hidden;
    let liquidAnimationFrame;

    const resizeLiquid = () => {
      const bounds = aboutSection.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(bounds.width));
      height = Math.max(1, Math.floor(bounds.height));
      liquidCanvas.width = Math.floor(width * ratio);
      liquidCanvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      texture.width = Math.max(160, Math.min(360, Math.round(width / 5.6)));
      texture.height = Math.max(120, Math.min(230, Math.round(height / 5.6)));
    };

    const drawLiquid = (time) => {
      if (!width || !height) return;
      const seconds = time * 0.00024;
      const image = textureContext.createImageData(texture.width, texture.height);
      const pixels = image.data;
      const activeVortices = vortices.map((vortex) => ({
        centerX: vortex.x + Math.sin(seconds * 3.1 + vortex.phase) * 0.13,
        centerY: vortex.y + Math.cos(seconds * 2.7 + vortex.phase) * 0.13,
        direction: vortex.direction,
      }));

      for (let y = 0; y < texture.height; y++) {
        for (let x = 0; x < texture.width; x++) {
          let pointX = x / texture.width;
          let pointY = y / texture.height;

          for (let vortexIndex = 0; vortexIndex < activeVortices.length; vortexIndex++) {
            const vortex = activeVortices[vortexIndex];
            const dx = pointX - vortex.centerX;
            const dy = pointY - vortex.centerY;
            const radiusSquared = (dx * dx) + (dy * dy);
            const twist = vortex.direction * 1.8 / (1 + radiusSquared * 11);
            pointX += dy * twist;
            pointY -= dx * twist;
          }

          const flow = pointX * 2.6
            + Math.sin(pointY * 2.6 + seconds * 5.2) * 1.35
            + Math.sin((pointX + pointY) * 1.6 - seconds * 3.7) * 0.75;
          const broadBand = Math.sin(flow * Math.PI * 1.45);
          const fineVein = Math.sin(flow * Math.PI * 10);
          const transparentBand = broadBand > 0.55;
          let tone = 11;
          let alpha = transparentBand ? 0 : 255;

          if (!transparentBand && Math.abs(fineVein) > 0.84) alpha = 0;
          if (transparentBand && Math.abs(fineVein) > 0.93) alpha = 185;

          const pixel = (y * texture.width + x) * 4;
          pixels[pixel] = tone;
          pixels[pixel + 1] = tone;
          pixels[pixel + 2] = tone;
          pixels[pixel + 3] = alpha;
        }
      }

      textureContext.putImageData(image, 0, 0);
      context.clearRect(0, 0, width, height);
      context.imageSmoothingEnabled = false;
      context.drawImage(texture, 0, 0, width, height);
    };

    const animateLiquid = (time) => {
      liquidAnimationFrame = undefined;
      if (!liquidVisible || !pageVisible) return;

      if (time - lastDraw > 16) {
        drawLiquid(time);
        lastDraw = time;
      }
      if (!reduceMotion) liquidAnimationFrame = requestAnimationFrame(animateLiquid);
    };

    const resumeLiquid = () => {
      if (!reduceMotion && liquidVisible && pageVisible && !liquidAnimationFrame) {
        lastDraw = 0;
        liquidAnimationFrame = requestAnimationFrame(animateLiquid);
      }
    };

    resizeLiquid();
    drawLiquid(250);
    new ResizeObserver(() => {
      resizeLiquid();
      if (liquidVisible && pageVisible) drawLiquid(250);
    }).observe(aboutSection);
    new IntersectionObserver(([entry]) => {
      liquidVisible = entry.isIntersecting;
      if (liquidVisible && pageVisible) resumeLiquid();
    }, { threshold: 0.05 }).observe(aboutSection);
    document.addEventListener('visibilitychange', () => {
      pageVisible = !document.hidden;
      if (pageVisible) resumeLiquid();
    });
    resumeLiquid();
  });

  const voronoiCanvas = null;

  if (voronoiCanvas) {
    const aboutSection = voronoiCanvas.closest('.container-home2');
    const context = voronoiCanvas.getContext('2d');
    const seeds = Array.from({ length: 9 }, () => ({
      x: 0.06 + Math.random() * 0.88,
      y: 0.06 + Math.random() * 0.88,
      phase: Math.random() * Math.PI * 2,
      drift: 0.025 + Math.random() * 0.035,
    }));
    const compressionPoints = Array.from({ length: 4 }, () => ({
      x: 0.12 + Math.random() * 0.76,
      y: 0.12 + Math.random() * 0.76,
      phase: Math.random() * Math.PI * 2,
      drift: 0.02 + Math.random() * 0.035,
    }));
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let lastDraw = 0;

    const resizeCanvas = () => {
      const bounds = aboutSection.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.floor(bounds.width));
      height = Math.max(1, Math.floor(bounds.height));
      voronoiCanvas.width = Math.floor(width * ratio);
      voronoiCanvas.height = Math.floor(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const drawVoronoi = (time) => {
      if (!width || !height) return;
      const seconds = time * 0.00078;
      const cell = Math.max(10, Math.round(Math.min(width, height) / 55));
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#050505';
      const columns = Math.ceil(width / cell);
      const rows = Math.ceil(height / cell);
      const occupied = new Set();

      for (let row = 0; row < rows; row++) {
        for (let column = 0; column < columns; column++) {
          const cellIndex = row * columns + column;
          if (occupied.has(cellIndex)) continue;

          const x = column * cell;
          const y = row * cell;
          const waveX = x + Math.sin(y * 0.023 + seconds * 6) * 34 + Math.sin(y * 0.052 - seconds * 3) * 15;
          const waveY = y + Math.sin(x * 0.02 - seconds * 5) * 18;
          let pullX = 0;
          let pullY = 0;
          let compressionStrength = 0;
          let compressionAxis = 'x';
          let compressionHole = false;

          compressionPoints.forEach((point) => {
            const pulse = (Math.sin(seconds * 5.4 + point.phase) + 1) * 0.5;
            const centerX = width * (point.x + Math.sin(seconds * point.drift * 58 + point.phase) * 0.12);
            const centerY = height * (point.y + Math.cos(seconds * point.drift * 52 + point.phase) * 0.12);
            const dx = centerX - x;
            const dy = centerY - y;
            const distance = Math.hypot(dx, dy);
            const radius = cell * (10 + pulse * 17);
            const strength = Math.pow(Math.max(0, 1 - (distance / radius)), 0.65) * (0.35 + pulse * 0.65);

            if (strength > compressionStrength) {
              compressionStrength = strength;
              compressionAxis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
            }

            if (strength > 0) {
              pullX += dx * strength * 0.68;
              pullY += dy * strength * 0.68;
            }

            if (distance < cell * (1.1 + pulse * 1.6)) compressionHole = true;
          });

          const distortedX = waveX + pullX;
          const distortedY = waveY + pullY;
          const liquidX = distortedX
            + Math.sin(distortedY * 0.019 + seconds * 5.8) * 48
            + Math.cos(distortedY * 0.041 - seconds * 3.6) * 22;
          const liquidY = distortedY
            + Math.cos(distortedX * 0.017 - seconds * 5.1) * 42
            + Math.sin(distortedX * 0.034 + seconds * 4.2) * 18;
          let nearest = Infinity;
          let secondNearest = Infinity;

          seeds.forEach((seed) => {
            const seedX = width * (seed.x + Math.sin(seconds * seed.drift * 18 + seed.phase) * 0.065);
            const seedY = height * (seed.y + Math.cos(seconds * seed.drift * 15 + seed.phase) * 0.075);
            const distance = Math.hypot(liquidX - seedX, liquidY - seedY);

            if (distance < nearest) {
              secondNearest = nearest;
              nearest = distance;
            } else if (distance < secondNearest) {
              secondNearest = distance;
            }
          });

          const liquidField =
            Math.sin(liquidX * 0.017 + seconds * 6.4)
            + Math.cos(liquidY * 0.021 - seconds * 5.3)
            + Math.sin((liquidX + liquidY) * 0.013 - seconds * 3.7) * 0.65
            + Math.cos(nearest * 0.04 - seconds * 4.5) * 0.45;
          const hole = Math.abs((x / width) - 0.5 + Math.sin((y / height) * 8 + seconds) * 0.09) < 0.075;
          // Inverte a máscara: as fronteiras Voronoi e as áreas claras viram lacunas.
          const filled = !hole && !compressionHole && liquidField <= 0.55;

          if (filled) {
            let widthCells = 1 + Math.floor((Math.sin(x * 0.071 + y * 0.039 + seconds * 7) + 1) * 1.25);
            let heightCells = 1 + Math.floor((Math.cos(x * 0.043 - y * 0.083 - seconds * 5) + 1) * 0.9);
            const stretch = Math.ceil(compressionStrength * 7);

            if (compressionAxis === 'x') widthCells += stretch;
            else heightCells += stretch;

            const endColumn = Math.min(columns, column + widthCells);
            const endRow = Math.min(rows, row + heightCells);

            for (let blockRow = row; blockRow < endRow; blockRow++) {
              for (let blockColumn = column; blockColumn < endColumn; blockColumn++) {
                occupied.add(blockRow * columns + blockColumn);
              }
            }

            context.fillRect(x + pullX, y + pullY, (cell * widthCells) - 1, (cell * heightCells) - 1);
          }
        }
      }
    };

    const animateVoronoi = (time) => {
      if (time - lastDraw > 32) {
        drawVoronoi(time);
        lastDraw = time;
      }
      if (!reduceMotion) requestAnimationFrame(animateVoronoi);
    };

    resizeCanvas();
    drawVoronoi(250);
    new ResizeObserver(() => {
      resizeCanvas();
      drawVoronoi(250);
    }).observe(aboutSection);
    if (!reduceMotion) requestAnimationFrame(animateVoronoi);
  }

  const modelsButton = document.getElementById('button');
  const modelsPanel = document.getElementById('model-panel');
  const modelsClose = document.getElementById('models-close');
  const modelsPrev = document.getElementById('models-prev');
  const modelsNext = document.getElementById('models-next');
  const backgroundVideo = document.getElementById('bgd-video');
  const modelTrack = document.querySelector('.model-content');
  const modelSlides = modelTrack?.querySelectorAll('.sketchfab-embed-wrapper');
  let modelIndex = 0;
  let modelVideoPauseTimeout;

  const updateModelCarousel = () => {
    if (!modelTrack || !modelSlides?.length) return;
    modelTrack.style.transform = `translateX(-${modelIndex * (100 / modelSlides.length)}%)`;
  };

  if (modelTrack && modelSlides?.length) {
    const slidePercent = 100 / modelSlides.length;
    modelTrack.style.width = `${modelSlides.length * 100}%`;
    modelSlides.forEach((slide) => {
      slide.style.flex = `0 0 ${slidePercent}%`;
      slide.style.width = `${slidePercent}%`;
    });
  }

  if (modelsButton && modelsPanel) {
    modelsButton.addEventListener('click', () => {
      modelIndex = 0;
      updateModelCarousel();
      modelsPanel.classList.add('active');
      modelsButton.classList.add('is-hidden');
      clearTimeout(modelVideoPauseTimeout);
      modelVideoPauseTimeout = setTimeout(() => {
        if (modelsPanel.classList.contains('active')) backgroundVideo?.pause();
      }, 1000);
    });
  }

  if (modelsClose && modelsPanel) {
    modelsClose.addEventListener('click', () => {
      clearTimeout(modelVideoPauseTimeout);
      modelsPanel.classList.remove('active');
      modelsButton?.classList.remove('is-hidden');
      backgroundVideo?.play().catch(() => {});
    });
  }

  if (modelsPrev && modelSlides?.length) {
    modelsPrev.addEventListener('click', () => {
      modelIndex = (modelIndex - 1 + modelSlides.length) % modelSlides.length;
      updateModelCarousel();
    });
  }

  if (modelsNext && modelSlides?.length) {
    modelsNext.addEventListener('click', () => {
      modelIndex = (modelIndex + 1) % modelSlides.length;
      updateModelCarousel();
    });
  }

  /* ===============================
     STL ZONE – Galeria (abre/fecha no mesmo container)
  ============================== */

  const stlZoneContainer = document.querySelector('.stl-zone-container');
  const stlZoneDefault = document.getElementById('stl-zone-default');
  const stlZoneGallery = document.getElementById('stl-zone-gallery');
  const stlZoneOpenBtn = document.getElementById('stl-zone-open-gallery');
  const stlZoneCloseBtn = document.getElementById('stl-zone-close-gallery');

  if (stlZoneContainer && stlZoneDefault && stlZoneGallery && stlZoneOpenBtn && stlZoneCloseBtn) {
    stlZoneOpenBtn.addEventListener('click', () => {
      stlZoneDefault.style.display = 'none';
      stlZoneGallery.classList.remove('stl-zone-gallery-hidden');
    });

    stlZoneCloseBtn.addEventListener('click', () => {
      stlZoneGallery.classList.add('stl-zone-gallery-hidden');
      stlZoneDefault.style.display = 'flex';
    });
  }

  /* Lightbox – clique na imagem expande; X fecha */
  const stlZoneLightbox = document.getElementById('stl-zone-lightbox');
  const stlZoneLightboxImg = document.getElementById('stl-zone-lightbox-img');
  const stlZoneLightboxClose = document.getElementById('stl-zone-lightbox-close');
  const stlZoneGridImgs = document.querySelectorAll('.stl-zone-grid-img');

  if (stlZoneLightbox && stlZoneLightboxImg && stlZoneLightboxClose) {
    stlZoneGridImgs.forEach((img) => {
      img.addEventListener('click', () => {
        stlZoneLightboxImg.src = img.src;
        stlZoneLightboxImg.alt = img.alt;
        stlZoneLightbox.classList.remove('stl-zone-lightbox-hidden');
        stlZoneLightbox.setAttribute('aria-hidden', 'false');
      });
    });

    stlZoneLightboxClose.addEventListener('click', () => {
      stlZoneLightbox.classList.add('stl-zone-lightbox-hidden');
      stlZoneLightbox.setAttribute('aria-hidden', 'true');
    });

    stlZoneLightbox.addEventListener('click', (e) => {
      if (e.target === stlZoneLightbox) {
        stlZoneLightbox.classList.add('stl-zone-lightbox-hidden');
        stlZoneLightbox.setAttribute('aria-hidden', 'true');
      }
    });
  }

  /* ===============================
     HACK TEXTO (AGORA CORRIGIDO)
  ============================== */

  const chars =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*";

  const elements = document.querySelectorAll(
    ".home-text-line, #button, .nav-list a:not(.nav-rpg)"
  );

  elements.forEach(el => {
    el.dataset.originalText = el.textContent;
  });

  function scrambleText(element) {
    const targetText = element.dataset.originalText;
    let iterations = 0;

    const interval = setInterval(() => {
      const displayed = targetText
        .split("")
        .map((char, i) => {
          if (i < iterations) return char;
          return chars[Math.floor(Math.random() * chars.length)];
        })
        .join("");

      element.textContent = displayed;

      iterations += 0.5;
      if (iterations >= targetText.length) {
        clearInterval(interval);
      }
    }, 20);
  }

  elements.forEach(element => {

    scrambleText(element);

    element.addEventListener("mouseenter", () => {
      scrambleText(element);
    });

    element.addEventListener("mouseleave", () => {
      element.textContent =
        element.dataset.originalText;
    });

  });

});


/* ===============================
   PARALLAX
============================== */

window.addEventListener("scroll", () => {

  const scrollY = window.scrollY;

  const midLayer =
    document.querySelector(".home-mid");

  if (midLayer) {
    const midOffset = scrollY * 0.7;

    midLayer.style.transform =
      `translate(-50%, calc(-50% + ${midOffset}px))`;

    const blurAmount =
      Math.min(scrollY / 50, 5);

    midLayer.style.filter =
      `blur(${blurAmount}px)`;
  }

});


/* ===============================
   CARROSSEL HOME AUTO
============================== */

window.addEventListener("load", () => {

  const track =
    document.querySelector(".carousel-track");

  if (track) {
    track.style.animationPlayState = "running";
  }

});
