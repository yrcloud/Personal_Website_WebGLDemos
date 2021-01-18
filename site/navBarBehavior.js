import { MeshViewer } from "./RenderBunny.js";

export function NavBarBehaviors() {
  this.installHandler = function (id, f) {
    const obj = document.getElementById(id);
    obj.addEventListener("click", f);
  };

  this.cleanGL = function (activeDrawName) {
    if (activeDrawName === "pillars") {
      this.pillars.cleanGL();
    }
  };

  this.cleanMainCanvas = function () {
    const canvasDOM = document.getElementById("mainCanvas");
    if (canvasDOM) {
      this.cleanGL(this.activeDrawName);
      return canvasDOM;
    } else {
      const newCanvas = document.createElement("canvas");
      newCanvas.id = "mainCanvas";
      document.getElementById("mainDisplayDiv").append(newCanvas);
      console.log("newly created canvas is: ", newCanvas);
      return newCanvas;
    }
  };

  this.loadPillars = function () {
    const newCanvas = this.cleanMainCanvas();
    this.pillars = new Pillars(newCanvas);
    this.activeDrawName = "pillars";
  };

  this.loadBunny = function () {
    const newCanvas = this.cleanMainCanvas();
    this.meshViewer = new MeshViewer(newCanvas);
  };
}
