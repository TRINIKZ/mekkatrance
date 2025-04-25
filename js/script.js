function redpage() {
    window.location.href = "html/myFiles.html";
}
document.getElementById("button").addEventListener("click", () => {
  const panel = document.getElementById("model-panel");
  panel.classList.remove("hidden");
  panel.classList.add("active");
});

document.getElementById("button").addEventListener("click", () => {
const video = document.getElementById("bgd-video");

  video.paused
    ? video.play()
    : setTimeout(() => video.pause(), 600);
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
      const blurAmount = Math.min(scrollY / 50, 5); // máx 10px
      baseLayer.style.filter = `blur(${blurAmount}px)`;
    }
  });
  
//carrossel
window.addEventListener("load", () => {
    const track = document.querySelector(".carousel-track");
    track.style.animationPlayState = "running";
  });

//hack
const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890!@#$%^&*";
const elements = document.querySelectorAll(".home-text-line, #container-mid-p, #button");

function scrambleText(element) {
  const targetText = element.textContent;
  let iterations = 0;

  const interval = setInterval(() => {
    const displayed = targetText
      .split("")
      .map((char, i) => {
        if (i < iterations) {
          return char;
        }
        return chars[Math.floor(Math.random() * chars.length)];
      })
      .join("");

    element.textContent = displayed;

    if (iterations >= targetText.length) {
      clearInterval(interval);
    }

    iterations += 1 / 2;
  }, 20);
}

elements.forEach(element => {
  // Efeito quando a página carrega (no load)
  scrambleText(element);

  // Efeito quando passar o mouse
  element.addEventListener("mouseenter", () => {
    scrambleText(element);
  });

  // Reseta o texto quando o mouse sai
  element.addEventListener("mouseleave", () => {
    element.textContent = element.textContent;
  });
});
