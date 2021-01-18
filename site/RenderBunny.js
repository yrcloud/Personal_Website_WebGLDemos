import { vec3 } from "./toji-gl-matrix-v3.3.0-35-g21b745f/toji-gl-matrix-21b745f/src/index.js";

export function MeshViewer(canvasDOM) {
  const BYTE_SIZE = 4;
  this.gl = canvasDOM.getContext("webgl2");
  this.canvasDOM = canvasDOM;
  console.log("gl context in MeshViewer constructor is: ", this.gl);
  init.call(this);

  function parseObj(objStr) {
    const lines = objStr.split("\n");
    lines.forEach((element) => {});
    const vertices = [];
    const faces = [];
    lines.forEach((item) => {
      const line = item.split(" ");
      switch (line[0]) {
        case "#":
          return;
          break;
        case "v":
          vertices.push(...line.slice(1).map((item) => Number(item)));
          break;
        case "f":
          faces.push(...line.slice(1).map((item) => Number(item)));
          break;
        default:
          return;
      }
    });
    console.log("vertices are", vertices);
    console.log("faces are: ", faces);
    return {
      vertices: vertices,
      faces: faces,
    };
  }

  const vs = `#version 300 es
  layout (location=0) in vec3 vPos;

  void main() {
      gl_Position  = 
  }
  `;

  const fs = `
  `;

  function init() {
    const gl = this.gl;
    //this.shader = new Shader(gl, vs, fs);
    this.meshData = parseObj(bunnyMeshDataObj);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.meshData.vertices),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const testVec = vec3.fromValues(0.0, -1.0, -0.5);
    console.log("testVec is in RenderBunny: ", testVec);
  }
}
