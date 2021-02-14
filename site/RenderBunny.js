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

import {skyboxVertices} from "./SkyboxGeo.js";

export function MeshViewer(canvasDOM) {
  //exposed 4 functions, note that init is async, need to call with await
  this.render = render.bind(this);
  this.startRendering = startRendering.bind(this);
  this.cleanGL = cleanGL.bind(this);
  this.init = init.bind(this);  //async

  const BYTE_SIZE = 4;
  this.gl = canvasDOM.getContext("webgl2");
  this.canvasDOM = canvasDOM;
  console.log("gl context in MeshViewer constructor is: ", this.gl);

  ////////////////////////////////////////////////////////////
  ///////////// lower level functions ///////////////////////////
  ////////////////////////////////////////////////////////////

  function degreeToRadian(degree) {
    return (Math.PI / 180) * degree;
  }

  async function createSkyBoxTexture(gl) {
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

    //create the texture, bind it to cube map and set up parameters
    const textureID = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, textureID);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_CUBE_MAP, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    //connect the images to the faces of the cubemap texture
    async function loadOneFaceImg(index, resultContainer) {
      const loadNewImagePromise = new Promise(function (resolve, reject) {
        const imgDOM = document.createElement("img");
        imgDOM.src = imageFileNames[index];
        imgDOM.onload = () => {
          resolve(imgDOM);
        };
        //setTimeout(() => resolve(imgDOM), 1000); //testing await
      });
      const resultImgDOM = await loadNewImagePromise;
      console.log(
        "image No. " + index + " loaded. Result is ",
        resultImgDOM,
        ", with width and heigh of ",
        resultImgDOM.width,
        resultImgDOM.height
      );
      resultContainer.push(resultImgDOM);
      return resultImgDOM; 
      //it seems that if it's resolved, it's returning the datra
      //if it's pending, it's returning a Promise 
    }

    const imgDOMs = [];
    for (let i = 0; i < imageFileNames.length; i++) {
      const asynResult = await loadOneFaceImg(i, imgDOMs);
      //console.log("asyncResult is: ", asynResult);
    }
    console.log("imgDOMs are: ", imgDOMs);

    imgDOMs.forEach((item, index) => {
      gl.texImage2D(
        textureFaceTargets[index],
        0,
        gl.RGBA,
        imgDOMs[index].width,
        imgDOMs[index].height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imgDOMs[index]
      );
    });
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
    return textureID;
  }

  function setupMainMeshRender(gl) {
    ////////////////////////////////////
    ///////// the main shader //////////
    ////////////////////////////////////
    const vs = `#version 300 es
    layout (location=0) in vec3 vPos;
    layout (location=1) in vec3 vNormal;
    uniform mat4 objMat;
    uniform mat4 viewMat;
    uniform mat4 perspectiveMat;
  
    out vec3 normal;
    out vec4 fragPosWld;
  
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
    uniform samplerCube skybox;
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

    vec4 skyBoxReflection ()
    {
      vec3 viewDir = normalize(vec3(fragPosWld) - cameraPosWld);
      vec3 toSkyBoxDir = reflect(viewDir, normal);
      return vec4(texture(skybox, toSkyBoxDir).rgb, 1.0);
    }

    vec4 skyBoxRefraction ()
    {
      vec3 viewDir = normalize(vec3(fragPosWld) - cameraPosWld);
      vec3 toSkyBoxDir = refract(viewDir, normal, 1.00 / 1.52);
      return vec4(texture(skybox, toSkyBoxDir).rgb, 1.0);
    }

    void main()
    {
      vec4 dirLightResult = vec4(GetDirLighting(g_dirLight, normal, normalize(cameraPosWld-vec3(fragPosWld))), 1.0);
      //finalColor = vec4(texture(skybox, normal).rgb, 1.0);
      finalColor = 0.0 * dirLightResult + 1.0 * skyBoxReflection() + 0.0 * skyBoxRefraction();
    }
    `;

    ////////////////////////////////////////////////////////////
    ///////////// Process the input obj mesh ///////////////////
    ////////////////////////////////////////////////////////////
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
  
      const faceNormals = [];
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
        faceNormals.push(...normal);
      }
      console.log("faceNormals are: ", faceNormals);
  
      return {
        vertices: vertices,
        faces: faces, //starts from 1 instead of 0
        faceNormals: faceNormals,
      };
    }

    function getVertexNormals(meshData) {
      //somehow the line below does not work
      //const vertexNormals = (new Array(meshData.vertices.length / 3)).fill([]);
      const vertexNormals = (new Array(meshData.vertices.length / 3)).fill(null).map(()=>[]);
      console.log("Empty vertex normals are: ", vertexNormals);
      //first record all normals of adjacent faces for each vertex 
      for (let i = 0; i < meshData.faceNormals.length / 3; i++) {//for each face normal
        //this is the normal of the face
        const normal = [
          meshData.faceNormals[3 * i],
          meshData.faceNormals[3 * i + 1],
          meshData.faceNormals[3 * i + 2],
        ];
        //these are the face's 3 vertices' indices
        const vIndices = [
          meshData.faces[3 * i] - 1,
          meshData.faces[3 * i + 1] - 1,
          meshData.faces[3 * i + 2] - 1,
        ];
        //record this normal for each vertex of that face
        vIndices.forEach((vIndex) => {
          vertexNormals[vIndex].push(normal);
        });
      }
      console.log("Raw vertexNormals are: ", vertexNormals);
      const avgNormals = [];
      //then calculate the average
      vertexNormals.forEach((normals)=>{
        const avgNormal = vec3.fromValues(0.0, 0.0, 0.0);
        normals.forEach((normal)=>{
          vec3.add(avgNormal, avgNormal, normal);
        });
        vec3.normalize(avgNormal, avgNormal);
        avgNormals.push(...avgNormal);
      });
      console.log("processed avgNormals are:", avgNormals);
      return avgNormals;
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
        vertexPlusNormal.push(meshData.faceNormals[3 * normalIndex]);
        vertexPlusNormal.push(meshData.faceNormals[3 * normalIndex + 1]);
        vertexPlusNormal.push(meshData.faceNormals[3 * normalIndex + 2]);
        result.push(...vertexPlusNormal);
      });
      console.log("processed mesh is: ", result);
      return result;
    }  

    this.plainShader = new Shader(gl, vs, fs);
    this.meshData = parseObj(bunnyMeshDataObj);
    this.vertexNormals = getVertexNormals(this.meshData);
    this.processedMesh = processMesh(this.meshData);
    this.vboBunny = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboBunny);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.processedMesh),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.vaoBunny = gl.createVertexArray();
    gl.bindVertexArray(this.vaoBunny);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboBunny);
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

  function setupSkyboxRender(gl) {
    console.log("Entered setupSkyboxRender");
    //create shader to render skybox
    const skyboxVertexShader = `#version 300 es
    layout (location=0) in vec3 vPos;
    uniform mat4 viewMat;
    uniform mat4 projMat;
    out vec3 v2fPos;
    void main()
    {
      mat4 rotOnlyViewMat = mat4(mat3(viewMat));
      gl_Position = projMat * vec4(vPos, 1.0);
      v2fPos = vPos;
    }
    `;
    const skyboxFragmentShader = `#version 300 es
    precision highp float;
    in vec3 v2fPos;
    uniform samplerCube skybox;
    out vec4 finalColor;
    void main()
    {
      finalColor = vec4(texture(skybox, v2fPos).rgb, 1.0);
      //finalColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
    `;
    this.skyboxShader = new Shader(gl, skyboxVertexShader, skyboxFragmentShader);
    //pass sky box vertices to GPU buffer
    this.vboSkybox = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSkybox);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(skyboxVertices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    //create vao for skybox
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSkybox);
    this.vaoSkybox = gl.createVertexArray();
    gl.bindVertexArray(this.vaoSkybox);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 12, 0);
    gl.bindVertexArray(null);

    //pass projection matrix to shader
    gl.useProgram(this.skyboxShader.shaderProgram);
    const perspectiveMat = mat4.create();
    mat4.perspective(perspectiveMat, degreeToRadian(90), 1, 0.01, 50);
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.skyboxShader.shaderProgram, "projMat"),
      false,
      perspectiveMat
    );
    gl.useProgram(null);

    console.log("Finishing setupSkyboxRender");
  }

  ////////////////////////////////////////////////////////////
  ///////////// exposed key functions ////////////////////////
  ////////////////////////////////////////////////////////////
  async function init() {
    const gl = this.gl;
    this.cubeMapTexture = await createSkyBoxTexture(gl);
    console.log("right after function call of createSkyBoxTexture");
    setupSkyboxRender.call(this, gl);
    setupMainMeshRender.call(this, gl);
    // gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    // gl.cullFace(gl.BACK);
  }

  function render(now) {
    const gl = this.gl;
    //console.log("render");

    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
    ///////////////////////////////////////////////
    //////// first draw the skybox ////////////////
    ///////////////////////////////////////////////
    gl.useProgram(this.skyboxShader.shaderProgram);
    const viewMat = mat4.create();
    mat4.lookAt(
      viewMat,
      this.cameraPosWld,
      this.cameraFocusPosWld,
      this.cameraUp
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.skyboxShader.shaderProgram, "viewMat"),
      false,
      viewMat
    );
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture);
    //gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSkybox);
    gl.bindVertexArray(this.vaoSkybox);
    gl.drawArrays(gl.TRIANGLES, 0, skyboxVertices.length / 3);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);

    ///////////////////////////////////////////////
    //////// draw the bunny ////////////////
    ///////////////////////////////////////////////
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

    gl.bindVertexArray(this.vaoBunny);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture); //bind the cubeTexture

    //gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
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
    this.gl.deleteBuffer(this.vboBunny);
    this.gl.deleteBuffer(this.vboSkybox);
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vaoBunny);
    this.gl.deleteVertexArray(this.vaoSkybox);
    this.plainShader.cleanUp();
    this.skyboxShader.cleanUp();
  }
}
