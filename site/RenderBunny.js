import {
  glMatrix,
  mat2,
  mat2d,
  mat3,
  mat4,
  quat,
  quat2,
  vec2,
  vec3,
  vec4,
} from "./toji-gl-matrix-v3.3.0-35-g21b745f/toji-gl-matrix-21b745f/src/index.js";

export function MeshViewer(canvasDOM) {
  const BYTE_SIZE = 4;
  this.gl = canvasDOM.getContext("webgl2");
  this.canvasDOM = canvasDOM;
  console.log("gl context in MeshViewer constructor is: ", this.gl);

  const vs = `#version 300 es
  layout (location=0) in vec3 vPos;
  layout (location=1) in vec3 vNormal;
  uniform mat4 viewMat;
  uniform mat4 perspectiveMat;

  void main() {
      gl_Position = perspectiveMat * viewMat * vec4(vPos, 1.0f);
  }
  `;

  const fs = `#version 300 es
  precision highp float;
  out vec4 finalColor;

  void main(){
    finalColor = vec4(1.0, 0.0, 0.0, 1.0);
  }
  `;

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

    const normals = [];
    for (let i = 0; i < faces.length / 3; i++) {
      const v0i = faces[3 * i] - 1;
      const v1i = faces[3 * i + 1] - 1;
      const v2i = faces[3 * i + 2] - 1;
      const v0 = vec3.fromValues(
        vertices[v0i * 3],
        vertices[v0i * 3 + 1],
        vertices[v0i * 3 + 2]
      );
      //console.log("v0 is: ", v0);
      const v1 = vec3.fromValues(
        vertices[v1i * 3],
        vertices[v1i * 3 + 1],
        vertices[v1i * 3 + 2]
      );
      //console.log("v1 is: ", v1);
      const v2 = vec3.fromValues(
        vertices[v2i * 3],
        vertices[v2i * 3 + 1],
        vertices[v2i * 3 + 2]
      );
      //console.log("v2 is: ", v2);
      const normal = vec3.create();
      const e0 = vec3.create();
      const e1 = vec3.create();
      vec3.subtract(e0, v1, v0);
      vec3.subtract(e1, v2, v1);
      vec3.cross(normal, e0, e1);
      //console.log("normal is: ", normal);
      vec3.normalize(normal, normal);
      normals.push(...normal);
    }
    console.log("normals are: ", normals);

    return {
      vertices: vertices,
      faces: faces,
      normals: normals,
    };
  }

  function processMesh(meshData) {
    const result = [];
    meshData.faces.forEach((vIndex, index) => {
      const vertexIndex = vIndex - 1;
      const vertexPlusNormal = [
        meshData.vertices[3 * vertexIndex],
        meshData.vertices[3 * vertexIndex + 1],
        meshData.vertices[3 * vertexIndex + 2],
      ];
      const normalIndex = Math.floor(index / 3);
      vertexPlusNormal.push(meshData.normals[3 * normalIndex]);
      vertexPlusNormal.push(meshData.normals[3 * normalIndex + 1]);
      vertexPlusNormal.push(meshData.normals[3 * normalIndex + 2]);
      result.push(...vertexPlusNormal);
    });
    console.log("processed mesh is: ", result);
    return result;
  }

  function degreeToRadian(degree) {
    return (Math.PI / 180) * degree;
  }

  function init() {
    const gl = this.gl;
    this.plainShader = new Shader(gl, vs, fs);
    this.meshData = parseObj(bunnyMeshDataObj);
    this.processedMesh = processMesh(this.meshData);
    this.vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.processedMesh),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 24, 12);
    gl.enableVertexAttribArray(1);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const viewMat = mat4.create();
    mat4.lookAt(
      viewMat,
      vec3.fromValues(0, 5, 5),
      vec3.fromValues(0, 0, 0),
      vec3.fromValues(0, 1, 0)
    );
    //console.log("viewMat is: ", viewMat);
    const perspectiveMat = mat4.create();
    mat4.perspective(perspectiveMat, degreeToRadian(90), 1, 0.1, 500);

    gl.useProgram(this.plainShader.shaderProgram);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "viewMat"),
      false,
      viewMat
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "perspectiveMat"),
      false,
      perspectiveMat
    );
  }
}
