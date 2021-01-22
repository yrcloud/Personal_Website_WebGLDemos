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

  this.adjustSelectedVis = function (target) {
    for (const element of target.parentElement.children) {
      element.className = element === target ? "selected" : "unselected";
    }
  };

  this.loadPillars = function (event) {
    console.log("event is: ", event);
    if (event) this.adjustSelectedVis(event.target);
    const canvas = this.cleanMainCanvas();
    this.pillars = new Pillars(canvas);
    this.activeDrawName = "pillars";
  };

  this.loadBunny = function (event) {
    if (event) this.adjustSelectedVis(event.target);
    const newCanvas = this.cleanMainCanvas();
    this.meshViewer = new MeshViewer(newCanvas);
    this.activeDrawName = "bunny";
  };
}
