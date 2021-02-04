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
  uniform mat4 objMat;
  uniform mat4 viewMat;
  uniform mat4 perspectiveMat;

  out vec3 normal;
  out vec4 fragPosWld;
  out vec3 fCameraPosWld;

  void main() {
      gl_Position = perspectiveMat * viewMat * objMat * vec4(vPos, 1.0f);
      normal = mat3(objMat) * vNormal;
      fragPosWld = objMat * vec4(vPos, 1.0f);
  }
  `;

  const fs = `#version 300 es
  precision highp float;
  in vec3 normal;
  in vec4 fragPosWld;
  uniform vec3 cameraPosWld;
  out vec4 finalColor;

  struct DirLight
  {
    vec3 _dir;
    vec3 _ambient;
    vec3 _diffuse;
    vec3 _specular;
  };
  uniform DirLight g_dirLight;

  vec3 GetDirLighting (DirLight light, vec3 normal, vec3 viewDir) 
  {
    //diffuse first
    vec3 lightDir = normalize(-light._dir);
    float diffuse = clamp (dot(lightDir, normal), 0.0f, 1.0f);
    vec3 diffuseResult = diffuse * light._diffuse;

    //specular next
    vec3 reflectDir = normalize(reflect (-lightDir, normal));
    float specular = clamp (dot(reflectDir, viewDir), 0.0f, 1.0f);
    specular = pow (specular, 16.0); //32 is shininess
    vec3 specularResult = specular * light._specular;

    /*
    //ambient last
    vec3 ambientResult = light._ambient * simTextColor; 
        //vec3(texture (mat._diffuseSampler2D, textureCoord));

    //return (diffuseResult + specularResult + ambientResult);
    return diffuseResult + ambientResult;
    */
    return diffuseResult + specularResult;
  }


  void main(){
    finalColor = vec4(GetDirLighting(g_dirLight, normal, normalize(cameraPosWld-vec3(fragPosWld))), 1.0);
    //finalColor = vec4(normal, 1.0);
  }
  `;

  this.render = render.bind(this);
  this.startRendering = startRendering.bind(this);
  this.cleanGL = cleanGL.bind(this);

  //initialize and start rendering
  init.call(this);
  this.startRendering();

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

  function createSkyBoxTexture(gl) {
    const textureFaceTargets = [
      gl.TEXTURE_CUBE_MAP_POSITIVE_X,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_X,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Y,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Y,
      gl.TEXTURE_CUBE_MAP_POSITIVE_Z,
      gl.TEXTURE_CUBE_MAP_NEGATIVE_Z,
    ];

    const imageFileNames = [
      "./images/skybox/right.jpg",
      "./images/skybox/left.jpg",
      "./images/skybox/top.jpg",
      "./images/skybox/bottom.jpg",
      "./images/skybox/back.jpg",
      "./images/skybox/front.jpg",
    ];
    const textureID = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureID);

    async function loadOneFaceImg(index) {
      const loadNewImagePromise = new Promise(function (resolve, reject) {
        const imgDOM = document.createElement("img");
        imgDOM.src = imageFileNames[index];
        imgDOM.onload = () => {
          resolve(imgDOM);
        };
      });
      const result = await loadNewImagePromise;
      console.log(
        "image No. " + index + " loaded. Result is ",
        result,
        ", with width and heigh of ",
        result.width,
        result.height
      );
    }

    for (let i = 0; i < imageFileNames.length; i++) {
      loadOneFaceImg(i);
    }
  }

  function init() {
    const gl = this.gl;
    createSkyBoxTexture(gl);
    gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    gl.cullFace(gl.BACK);
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
    //unbind vao and vbo
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    const objMat = mat4.create();
    mat4.fromRotation(objMat, 0, vec3.fromValues(0.0, 1.0, 1.0));
    this.rotatedYAngle = 0.0;

    const viewMat = mat4.create();
    this.cameraFocusPosWld = vec3.fromValues(0, 0.1, 0);
    this.cameraPosWld = vec3.fromValues(0.0, 0.15, 0.15);
    this.cameraUp = vec3.fromValues(0.0, 1.0, 0.0);
    mat4.lookAt(
      viewMat,
      this.cameraPosWld,
      this.cameraFocusPosWld,
      this.cameraUp
    );
    //console.log("viewMat is: ", viewMat);
    const perspectiveMat = mat4.create();
    mat4.perspective(perspectiveMat, degreeToRadian(90), 1, 0.01, 50);

    gl.useProgram(this.plainShader.shaderProgram);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "objMat"),
      false,
      objMat
    );
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

  function render(now) {
    const gl = this.gl;
    //console.log("render");
    gl.useProgram(this.plainShader.shaderProgram);
    const dirLight = {
      dir: vec3.fromValues(0.0, -1.0, -1.0),
      ambient: vec3.fromValues(0.1, 0.1, 0.1),
      diffuse: vec3.fromValues(0.8, 0.9, 0.5),
      specular: vec3.fromValues(1.0, 1.0, 1.0),
    };
    gl.uniform3f(
      gl.getUniformLocation(this.plainShader.shaderProgram, "g_dirLight._dir"),
      dirLight.dir[0],
      dirLight.dir[1],
      dirLight.dir[2]
    );
    gl.uniform3f(
      gl.getUniformLocation(
        this.plainShader.shaderProgram,
        "g_dirLight._ambient"
      ),
      dirLight.ambient[0],
      dirLight.ambient[1],
      dirLight.ambient[2]
    );
    gl.uniform3f(
      gl.getUniformLocation(
        this.plainShader.shaderProgram,
        "g_dirLight._diffuse"
      ),
      dirLight.diffuse[0],
      dirLight.diffuse[1],
      dirLight.diffuse[2]
    );
    gl.uniform3f(
      gl.getUniformLocation(
        this.plainShader.shaderProgram,
        "g_dirLight._specular"
      ),
      dirLight.specular[0],
      dirLight.specular[1],
      dirLight.specular[2]
    );

    //view matrix and pass it to shader
    const viewMat = mat4.create();
    mat4.lookAt(
      viewMat,
      this.cameraPosWld,
      this.cameraFocusPosWld,
      this.cameraUp
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "viewMat"),
      false,
      viewMat
    );

    //pass camera world position to frag shader
    gl.uniform3f(
      gl.getUniformLocation(this.plainShader.shaderProgram, "cameraPosWld"),
      this.cameraPosWld[0],
      this.cameraPosWld[1],
      this.cameraPosWld[2]
    );

    //compose the rotation based on mouse input
    //console.log("this.rotatedYAngle is: ", this.rotatedYAngle);
    const objMat = mat4.create();
    mat4.fromRotation(
      objMat,
      this.rotatedYAngle,
      vec3.fromValues(0.0, 1.0, 0.0)
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "objMat"),
      false,
      objMat
    );

    gl.bindVertexArray(this.vao);

    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, this.processedMesh.length / 6);
    gl.bindVertexArray(null);

    this.curRequestedFrame = requestAnimationFrame(this.render);
  }

  function startRendering() {
    console.log("start rendering in meshViewer");
    this.activeRendering = true;
    this.curRequestedFrame = requestAnimationFrame(this.render);
  }

  function cleanGL() {
    if (this.curRequestedFrame != null) {
      cancelAnimationFrame(this.curRequestedFrame);
    }
    this.activeRendering = false;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT, this.gl.DEPTH_BUFFER_BIT);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.deleteBuffer(this.vbo);
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vao);
    this.plainShader.cleanUp();
  }
}
