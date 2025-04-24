function redpage() {
  window.location.href = "html/myFiles.html";
}

document.getElementById("button").addEventListener("click", () => {
  const panel = document.getElementById("model-panel");
  panel.classList.remove("hidden");
  panel.classList.add("active");
});

window.addEventListener("scroll", () => {
  const scrollY = window.scrollY;

  // Parallax na camada do meio
  const midLayer = document.querySelector(".home-mid");
  const midOffset = scrollY * 0.7;
  midLayer.style.transform = `translate(-50%, calc(-50% + ${midOffset}px))`;

  // Blur dinâmico na camada base
  const baseLayer = document.querySelector(".home-mid");
  if (baseLayer) {
    const blurAmount = Math.min(scrollY / 50, 10); // máx 10px
    baseLayer.style.filter = `blur(${blurAmount}px)`;
  }
});

// Carrossel
window.addEventListener("load", () => {
  const track = document.querySelector(".carousel-track");
  track.style.animationPlayState = "running";
});
