import { MeshViewer } from "./RenderBunny.js";

export function NavBarBehaviors() {
  this.installHandler = function (id, f) {
    const obj = document.getElementById(id);
    obj.addEventListener("click", f);
  };

  this.cleanGL = function () {
    this.curRenderObj.cleanGL();
  };

  this.cleanMainCanvas = function () {
    const canvasDOM = document.getElementById("mainCanvas");
    if (canvasDOM) {
      this.cleanGL();
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
    if (event) this.adjustSelectedVis(event.target);
    const canvas = this.cleanMainCanvas();
    this.curRenderObj = new Pillars(canvas);
    this.renderTarget = "Pillars";
  };

  this.loadBunny = function (event) {
    if (event) this.adjustSelectedVis(event.target);
    const newCanvas = this.cleanMainCanvas();
    this.curRenderObj = new MeshViewer(newCanvas);
    this.renderTarget = "MeshViewer";
  };

  this.installInteractionOnCanvas = function () {
    const canvasDOM = document.getElementById("mainCanvas");
    if (!canvasDOM) return;
    const navBarObj = this;
    function mouseMoveHandler(event) {
      console.log("entered mouseMoveHandler, with event: ", event);
      const deltaX = (event.x - this.lastMouseX) / 10.0;
      if (navBarObj.curRenderObj instanceof MeshViewer) {
        console.log("current render target is MeshViewer");
        navBarObj.curRenderObj.rotatedYAngle += deltaX;
        console.log("rotatedYAngle is: ", navBarObj.curRenderObj.rotatedYAngle);
      }
      // console.log("event.target is: ", event.target);
      // console.log("navBarObj is: ", navBarObj);
      this.lastMouseX = event.x;
    }
    function mouseDownHandler(event) {
      console.log("installing mouseMoveHandler");
      this.lastMouseX = event.x;
      canvasDOM.addEventListener("mousemove", mouseMoveHandler);
    }
    function mouseUpHandler(event) {
      console.log("removing mouseMoveHandler");
      canvasDOM.removeEventListener("mousemove", mouseMoveHandler);
      this.lastMouseX = null;
    }
    canvasDOM.addEventListener("mousedown", mouseDownHandler);
    canvasDOM.addEventListener("mouseup", mouseUpHandler);
  };
}