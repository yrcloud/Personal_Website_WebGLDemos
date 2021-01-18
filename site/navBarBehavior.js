function installHandler(id, f) {
  const obj = document.getElementById(id);
  obj.addEventListener("click", f);
}

function cleanMainCanvas() {
  const canvasDOM = document.getElementById("mainCanvas");
  if (canvasDOM) return canvasDOM;
  else {
    const newCanvas = document.createElement("canvas");
    newCanvas.id = "mainCanvas";
    document.getElementById("mainDisplayDiv").append(newCanvas);
    console.log("newly created canvas is: ", newCanvas);
    return newCanvas;
  }
}

function loadPillars() {
  const newCanvas = cleanMainCanvas();
  const pillars = new Pillars(newCanvas);
}

function loadBunny() {
  const newCanvas = cleanMainCanvas();
  renderBunny(newCanvas);
  console.log("place holder for bunny rendering");
}
