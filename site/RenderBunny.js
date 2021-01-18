function MeshViewer(canvasDOM) {
  this.gl = canvasDOM.getContext("webgl2");
  this.canvasDOM = canvasDOM;
  console.log("gl context in MeshViewer constructor is: ", this.gl);
  init.call(this);

  function parseObj(objStr) {
    const lines = objStr.split("\n");
    lines.forEach((element) => {});

    // const testArr = [1, 2, 3, 4];
    // console.log(
    //   "mapped testArr is: ",
    //   testArr.map((item) => {
    //     if (item >= 3) return;
    //     else return item;
    //   })
    // );
    const vertices = [];
    const faces = [];
    lines.forEach((item) => {
      const line = item.split(" ");
      switch (line[0]) {
        case "#":
          return;
          break;
        case "v":
          vertices.push(line.slice(1).map((item) => Number(item)));
          break;
        case "f":
          faces.push(line.slice(1).map((item) => Number(item)));
          break;
        default:
          return;
      }
    });
    console.log("vertices are", vertices);
    console.log("faces are: ", faces);
  }

  function init() {
    parseObj(bunnyMeshDataObj);
  }
}
