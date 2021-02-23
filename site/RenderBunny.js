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

  const FLOAT_BYTE_SIZE = 4; 
  const NEAR_CLIP_PLANE_DIST = 0.01;
  const FAR_CLIP_PLANE_DIST = 50.0;
  const FIELD_OF_VIEW_DEGREES = 90.0;
  const SHADOW_MAP_WIDTH = 1024;
  const SHADOW_MAP_HEIGHT = 1024;
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
      "./images/skybox/front.jpg",
      "./images/skybox/back.jpg",
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
    uniform mat4 projMat;
  
    out vec3 normal;
    out vec4 fragPosWld;
  
    void main() {
      gl_Position = projMat * viewMat * objMat * vec4(vPos, 1.0f);
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
    uniform bool skyboxRenderToggle;
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
      if (skyboxRenderToggle)
        finalColor = 0.1 * dirLightResult + 0.9 * skyBoxReflection() + 0.0 * skyBoxRefraction();
      else
        finalColor = dirLightResult;
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
            faces.push(...line.slice(1).map((item) => Number(item-1)));
            break;
          default:
            return;
        }
      });
      console.log("vertices are", vertices);
      console.log("faces are: ", faces);
  
      const faceNormals = [];
      for (let i = 0; i < faces.length / 3; i++) {
        const v0i = faces[3 * i];
        const v1i = faces[3 * i + 1];
        const v2i = faces[3 * i + 2];
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
          meshData.faces[3 * i],
          meshData.faces[3 * i + 1],
          meshData.faces[3 * i + 2],
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
        const vertexIndex = vIndex;
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
    ////////////////////////////////////////////////////////////
    ///////////// Set up shadow map render /////////////////////
    ////////////////////////////////////////////////////////////
    function setupShadowMap(gl) {
      //below is only available in WebGL1
      //WebGL2 naturally supports depth component for framebuffer
      //syntax is slightly different thought
      // const ext = gl.getExtension("WEBGL_depth_texture");
      // if (!ext) {
      //   alert("Need WEBGL_depth_texture");
      //   return;
      // }
      //create the frame buffer object
      this.shadowMapFBO = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFBO);

      //create and set up the texture
      this.shadowMapTextureSunLight = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTextureSunLight);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.DEPTH_COMPONENT24,
        SHADOW_MAP_WIDTH,
        SHADOW_MAP_HEIGHT,
        0,
        gl.DEPTH_COMPONENT,
        gl.UNSIGNED_INT,
        null
      );
      //attach texture as depth component
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.DEPTH_ATTACHMENT,
        gl.TEXTURE_2D,
        this.shadowMapTextureSunLight,
        0
      );
      //tell WebGL we don't need color attachment
      gl.drawBuffers([gl.NONE]);
      gl.readBuffer(gl.NONE);

      console.log(
        "shadowmap framebuffer status is COMPLETE: ",
        gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
      );

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindTexture(gl.TEXTURE_2D, null);

      //create the shader used in the shadow map render pass
      const shadowMapVertexShader = `#version 300 es
      layout (location=0) in vec3 vertexPos;
      uniform mat4 projMat;
      uniform mat4 viewFromLightMat;
      uniform mat4 modelMat;

      void main() 
      {
        gl_Position = projMat * viewFromLightMat * modelMat * vec4(vertexPos, 1.0);
      }
      `;

      const shadowMapFragShader = `#version 300 es
      precision highp float;

      void main()
      {
      }
      `

      this.shadowMapShader = new Shader(gl, shadowMapVertexShader, shadowMapFragShader);
    }

    function setupShadowMapTestBoard(gl) {
      const squareVertices = [
        0.1, 0.1, 0.0, 0.0, 0.0,
        0.3, 0.1, 0.0, 1.0, 0.0,
        0.1, 0.3, 0.0, 0.0, 1.0,
        0.3, 0.3, 0.0, 1.0, 1.0,
      ]
      const drawIndices = [
        0, 2, 1, 1, 2, 3,
      ]
      this.vboShadowMapTestBoard = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.vboShadowMapTestBoard);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(squareVertices), gl.STATIC_DRAW);
      this.vaoShadowMapTestBoard = gl.createVertexArray();
      gl.bindVertexArray(this.vaoShadowMapTestBoard);
      gl.enableVertexAttribArray(0);
      gl.vertexAttribPointer(0, 3, gl.FLOAT, false, FLOAT_BYTE_SIZE * 5, 0);
      gl.enableVertexAttribArray(1);
      gl.vertexAttribPointer(
        1,
        2,
        gl.FLOAT,
        false,
        FLOAT_BYTE_SIZE * 5,
        FLOAT_BYTE_SIZE * 3
      );
      gl.bindVertexArray(null);

      this.drawIndexShadowMapTestBoard = gl.createBuffer();
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.drawIndexShadowMapTestBoard);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(drawIndices), gl.STATIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

      const shadowMapTestBoardVertexShader = `#version 300 es
      layout (location=0) in vec3 vertexPos;
      layout (location=1) in vec2 texCoord;

      uniform mat4 objMat;
      uniform mat4 viewMat;
      uniform mat4 projMat;

      out vec2 f_texCoord;

      void main()
      {
        gl_Position = projMat * viewMat * objMat * vec4(vertexPos, 1.0);
        f_texCoord = texCoord;
      }
      `

      const shadowMapTestBoardFragShader = `#version 300 es
      precision highp float;
      in vec2 f_texCoord;
      uniform sampler2D shadowMapTexture;
      out vec4 finalFragColor;

      void main()
      {
        finalFragColor = vec4(texture(shadowMapTexture, f_texCoord).rgb, 1.0);
      }
      `

      this.shadowMapTestBoardShader = new Shader(
        gl,
        shadowMapTestBoardVertexShader,
        shadowMapTestBoardFragShader
      );
    }

    ////////////////////////////////////////////////////////////
    ///////////// Set up main mesh render //////////////////////
    ////////////////////////////////////////////////////////////
    this.plainShader = new Shader(gl, vs, fs);
    this.meshData = parseObj(bunnyMeshDataObj);
    //per vertex normal, as an avg of adjacent faces
    this.vertexNormals = getVertexNormals(this.meshData); 
    //vertex + normal that's the same as face normal
    this.processedMesh = processMesh(this.meshData); 

    if (this.shadowToggle) {
      setupShadowMap.call(this, gl);
      setupShadowMapTestBoard.call(this, gl);
    }
    
    this.vboBunny = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboBunny);
    //allocate memory 
    gl.bufferData(
      gl.ARRAY_BUFFER,
      (this.meshData.vertices.length + this.vertexNormals.length) * FLOAT_BYTE_SIZE,
      gl.STATIC_DRAW
    );
    //copy data
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      0,
      new Float32Array(this.meshData.vertices),
      0
    );
    gl.bufferSubData(
      gl.ARRAY_BUFFER,
      this.meshData.vertices.length * FLOAT_BYTE_SIZE,
      new Float32Array(this.vertexNormals),
      0
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    //element array buffer
    this.eaboBunny = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(this.meshData.faces),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.vaoBunny = gl.createVertexArray();
    gl.bindVertexArray(this.vaoBunny);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboBunny);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
    //attribute 0 is for vertex positions
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 3 * FLOAT_BYTE_SIZE, 0);
    gl.enableVertexAttribArray(0);
    //attribute 1 is for normals
    gl.vertexAttribPointer(
      1,
      3,
      gl.FLOAT, 
      false,
      3 * FLOAT_BYTE_SIZE,
      this.meshData.vertices.length * FLOAT_BYTE_SIZE
    );
    gl.enableVertexAttribArray(1);
    //unbind vao and vbo
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

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

    const projMat = mat4.create();
    mat4.perspective(
      projMat,
      degreeToRadian(FIELD_OF_VIEW_DEGREES), 
      this.canvasDOM.clientWidth / this.canvasDOM.clientHeight,
      NEAR_CLIP_PLANE_DIST,
      FAR_CLIP_PLANE_DIST
    );

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
      gl.getUniformLocation(this.plainShader.shaderProgram, "projMat"),
      false,
      projMat
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
      gl_Position = projMat * viewMat * vec4(vPos, 1.0);
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
    const projMat = mat4.create();
    mat4.perspective(
      projMat,
      degreeToRadian(FIELD_OF_VIEW_DEGREES),
      this.canvasDOM.clientWidth / this.canvasDOM.clientHeight,
      NEAR_CLIP_PLANE_DIST,
      FAR_CLIP_PLANE_DIST
    );
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.skyboxShader.shaderProgram, "projMat"),
      false,
      projMat
    );
    gl.useProgram(null);

    console.log("Finishing setupSkyboxRender");
  }

  function setupControls() {
    this.skyboxRenderToggle = false;
    this.shadowToggle = true;
  }

  ////////////////////////////////////////////////////////////
  ///////////// exposed key functions ////////////////////////
  ////////////////////////////////////////////////////////////
  async function init() {
    const gl = this.gl;
    setupControls.call(this);
    // this.canvasDOM.width = this.canvasDOM.clientWidth;
    // this.canvasDOM.height = this.canvasDOM.clientHeight;
    this.cubeMapTexture = await createSkyBoxTexture(gl);
    //console.log("right after function call of createSkyBoxTexture");
    setupSkyboxRender.call(this, gl);
    setupMainMeshRender.call(this, gl);

    // gl.enable(gl.CULL_FACE);
    gl.enable(gl.DEPTH_TEST);
    // gl.cullFace(gl.BACK);
    //gl.viewport(0, 0, this.canvasDOM.clientWidth, this.canvasDOM.clientHeight);
  }

  function render(now) {
    ///////////////////////////////////////////////
    //////// Common data ////////////////
    ///////////////////////////////////////////////
    const viewMat = mat4.create();
    mat4.lookAt(
      viewMat,
      this.cameraPosWld,
      this.cameraFocusPosWld,
      this.cameraUp
    );
    const projMat = mat4.create();
    mat4.perspective(
      projMat,
      degreeToRadian(FIELD_OF_VIEW_DEGREES), 
      this.canvasDOM.clientWidth / this.canvasDOM.clientHeight,
      NEAR_CLIP_PLANE_DIST,
      FAR_CLIP_PLANE_DIST
    );
    const dirLight = {
      dir: vec3.fromValues(0.0, -1.0, -1.0),
      ambient: vec3.fromValues(0.1, 0.1, 0.1),
      diffuse: vec3.fromValues(0.8, 0.9, 0.5),
      specular: vec3.fromValues(1.0, 1.0, 1.0),
    };

    function renderShadowMap(gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFBO);
      gl.enable(gl.DEPTH_TEST);
      gl.viewport(0, 0, SHADOW_MAP_WIDTH, SHADOW_MAP_HEIGHT);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.gl.useProgram(this.shadowMapShader.shaderProgram);
      gl.bindVertexArray(this.vaoBunny);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
      gl.drawElements(gl.TRIANGLES, this.meshData.faces.length, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }
    const gl = this.gl;
    // console.log(
    //   "canvasDOM client width and client height: ",
    //   this.canvasDOM.clientWidth,
    //   this.canvasDOM.clientHeight
    // );
    // console.log(
    //   "canvasDOM width and height: ",
    //   this.canvasDOM.width,
    //   this.canvasDOM.height
    // )
    this.canvasDOM.width = this.canvasDOM.clientWidth;
    this.canvasDOM.height = this.canvasDOM.clientHeight;
    gl.viewport(0, 0, this.canvasDOM.width, this.canvasDOM.height);
    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);

    //////////////////////////////////////////////
    //////// draw the shadow map /////////////////
    //////////////////////////////////////////////
    if (this.shadowToggle) {
      renderShadowMap.call(this, gl);
    }
    gl.viewport(0, 0, this.canvasDOM.width, this.canvasDOM.height);

    ///////////////////////////////////////////////
    //////// draw the skybox ////////////////
    ///////////////////////////////////////////////
    if (this.skyboxRenderToggle) {
      gl.useProgram(this.skyboxShader.shaderProgram);
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.skyboxShader.shaderProgram, "viewMat"),
        false,
        viewMat
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.skyboxShader.shaderProgram, "projMat"),
        false,
        projMat
      );
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture);
      //gl.bindBuffer(gl.ARRAY_BUFFER, this.vboSkybox);
      gl.bindVertexArray(this.vaoSkybox);
      gl.drawArrays(gl.TRIANGLES, 0, skyboxVertices.length / 3);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      gl.bindVertexArray(null);
    }

    ///////////////////////////////////////////////
    //////// draw the bunny ////////////////
    ///////////////////////////////////////////////
    gl.useProgram(this.plainShader.shaderProgram);

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

    //Pass shared view matrix to shader
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "viewMat"),
      false,
      viewMat
    );
    //Pass shared projection matrix to shader
    gl.uniformMatrix4fv(
      gl.getUniformLocation(this.plainShader.shaderProgram, "projMat"),
      false,
      projMat
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

    gl.uniform1i(
      gl.getUniformLocation(this.plainShader.shaderProgram, "skyboxRenderToggle"),
      this.skyboxRenderToggle
    )

    gl.bindVertexArray(this.vaoBunny);
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture); //bind the cubeTexture

    //gl.drawArrays(gl.TRIANGLES, 0, this.processedMesh.length / 6);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
    gl.drawElements(gl.TRIANGLES, this.meshData.faces.length, gl.UNSIGNED_SHORT, 0);
    gl.bindVertexArray(null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

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

    if (this.shadowMapFBO != null) {
      console.log("this.shadowMapFBO is: ", this.shadowMapFBO);
      this.gl.deleteFramebuffer(this.shadowMapFBO);
    }
    if (this.shadowMapTextureSunLight != null) {
      this.gl.deleteTexture(this.shadowMapTextureSunLight);
    }
    this.plainShader.cleanUp();
    this.skyboxShader.cleanUp();
    if (this.shadowMapShader != null) {
      this.shadowMapShader.cleanUp();
    }
    if (this.shadowMapTestBoardShader != null) {
      this.shadowMapTestBoardShader.cleanUp();
    }
  }
}
