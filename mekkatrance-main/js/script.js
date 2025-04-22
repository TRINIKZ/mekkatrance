function redpage() {
    window.location.href = "html/myFiles.html";
}
document.getElementById("button").addEventListener("click", redpage);

window.addEventListener("load", () => {
    const track = document.querySelector(".carousel-track");
    track.style.animationPlayState = "running";
  });