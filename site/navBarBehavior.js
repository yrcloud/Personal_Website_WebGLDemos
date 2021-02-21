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
      document.getElementById("leftControlPanel").after(newCanvas);
      console.log("newly created canvas is: ", newCanvas);
      return newCanvas;
    }
  };

  this.adjustSelectedVis = function (target) {
    for (const element of target.parentElement.children) {
      element.className = element === target ? "selected" : "unselected";
    }
  };

  this.loadPillars = async function (event) {
    if (event) this.adjustSelectedVis(event.target);
    const canvas = this.cleanMainCanvas();
    this.curRenderObj = new Pillars(canvas);
    await this.curRenderObj.init();
    this.curRenderObj.startRendering();
    this.renderTarget = "Pillars";
    this.adjustControlLayout("Pillars");
  };

  this.loadBunny = async function (event) {
    if (event) this.adjustSelectedVis(event.target);
    const newCanvas = this.cleanMainCanvas();
    this.curRenderObj = new MeshViewer(newCanvas);
    await this.curRenderObj.init();
    this.curRenderObj.startRendering();
    this.renderTarget = "MeshViewer";
    this.adjustControlLayout("MeshViewer");
  };

  this.adjustControlLayout = function (app) {
    switch (app) {
      case "MeshViewer":
        const HTMLToInsert = `<div id="leftControlPanel">
        <div id="skyBoxToggleDiv">
            <input type="checkbox" id="skyBoxToggleCheckbox">
            <label for="skyBoxToggleCheckbox">SkyBox Reflection</label>
        </div>
        <div id="dummyToggleDiv0">
            <input type="checkbox" id="dummyToggleCheckbox0">
            <label for="dummyToggleCheckbox0">Dummy control 0</label>
        </div>
        <div id="dummyToggleDiv1">
            <input type="checkbox" id="dummyToggleCheckbox1">
            <label for="dummyToggleCheckbox1">Dummy control 1</label>
        </div>
    </div>`;
        document.getElementById("leftControlPanel")?.remove();
        document.querySelector("#mainDisplayDiv").insertAdjacentHTML(
          "afterbegin",
          HTMLToInsert
        )
        break;
      case "Pillars":
        document.getElementById("leftControlPanel").remove();
        break;
      default:
        break;
    }

  }

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
