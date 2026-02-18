function redpage() {
  window.location.href = "html/myFiles.html";
}

document.addEventListener('DOMContentLoaded', () => {

  /* ===============================
     BOTÃO ++MODELS++
  ============================== */

  const button = document.getElementById('button');
  const panel = document.getElementById('model-panel');

  if (button && panel) {
    button.addEventListener('click', () => {
      panel.classList.toggle('active');
    });
  }


  /* ===============================
     CARROSSEL MODELS (suporta N itens)
  ============================== */

  const track = document.querySelector('.model-content');
  const btnPrev = document.getElementById('arrow-left');
  const btnNext = document.getElementById('arrow-right');

  if (track && btnPrev && btnNext) {

    const slides = track.querySelectorAll('.sketchfab-embed-wrapper');
    const total = slides.length;

    if (total > 0) {
      const slidePercent = 100 / total;
      track.style.width = `${total * 100}%`;
      slides.forEach((slide) => {
        slide.style.flex = `0 0 ${slidePercent}%`;
        slide.style.width = `${slidePercent}%`;
        slide.style.minWidth = `${slidePercent}%`;
      });
    }

    let index = 0;

    function updateCarousel() {
      const percent = total > 0 ? (index * (100 / total)) : 0;
      track.style.transform = `translateX(-${percent}%)`;
    }

    btnNext.addEventListener('click', () => {
      if (index < total - 1) {
        index++;
        updateCarousel();
      }
    });

    btnPrev.addEventListener('click', () => {
      if (index > 0) {
        index--;
        updateCarousel();
      } else {
        panel.classList.remove('active');
      }
    });

    button.addEventListener('click', () => {
      index = 0;
      updateCarousel();
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
    ".home-text-line, #button, .nav-list a"
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
