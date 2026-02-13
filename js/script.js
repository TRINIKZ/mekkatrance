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
     CARROSSEL MODELS
  ============================== */

  const track = document.querySelector('.model-content');
  const btnPrev = document.getElementById('arrow-left');
  const btnNext = document.getElementById('goto-second');
  

  if (track && btnPrev && btnNext) {

    const slides =
      track.querySelectorAll('.sketchfab-embed-wrapper');

    let index = 0;
    const total = slides.length;

    function updateCarousel() {
      track.style.transform =
        `translateX(-${index * 50}%)`;
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

    // reset ao abrir
    button.addEventListener('click', () => {
      index = 0;
      updateCarousel();
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
