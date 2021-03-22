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
import {backBoardsVertices} from "./backBoardsGeo.js";

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
  const SHADOW_MAP_WIDTH = 2048;
  const SHADOW_MAP_HEIGHT = 2048;
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

  async function createBackBoardsTextures(gl) {
    async function loadOneImg (srcPath) {
      const loadOneImgPromise = new Promise ((resolve)=>{
        const imgDOM = document.createElement("img");
        imgDOM.src = srcPath;
        imgDOM.onload = ()=>{
          resolve(imgDOM);
        };
      });
      const newImgDOM = await loadOneImgPromise;
      console.log(
        "image loaded. Result is ",
        newImgDOM,
        ", with width and heigh of ",
        newImgDOM.width,
        newImgDOM.height
      );
      return newImgDOM;
    }
    const wallImgDOM = await loadOneImg("./images/walls_floor/brickwall.jpg");
    const floorImgDOM = await loadOneImg("./images/walls_floor/wood.png");
    const imgDOMs = [wallImgDOM, floorImgDOM];
    const textures = [];

    for (let i=0; i<2; i++){
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        imgDOMs[i].width,
        imgDOMs[i].height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        imgDOMs[i]
      );
      textures.push(texture);
      gl.bindTexture(gl.TEXTURE_2D, null);
    }
    return textures;
  }

  function setupCommonData(gl) {
    this.cameraFocusPosWld = vec3.fromValues(0, 0.1, 0);
    this.cameraPosWld = vec3.fromValues(0.0, 0.15, 0.165);
    this.cameraUp = vec3.fromValues(0.0, 1.0, 0.0);
    this.rotatedYAngle = 0.0;
  }

  function setupMainMesh(gl) {
    ////////////////////////////////////
    ///////// the main shader //////////
    ////////////////////////////////////
    const mainMeshVertexShader = `#version 300 es
    layout (location=0) in vec3 vPos;
    layout (location=1) in vec3 vNormal;
    uniform mat4 modelMat;
    uniform mat4 viewMat;
    uniform mat4 projMat;
    uniform mat4 dirLightViewMat;
    uniform mat4 dirLightProjMat;
    uniform sampler2D shadowMapTexture;
    uniform samplerCube skybox;
  
    out vec3 normal;
    out vec4 fragPosWld;
    out vec4 NDCCoordDirLight;
  
    void main() {
      gl_Position = projMat * viewMat * modelMat * vec4(vPos, 1.0f);
      normal = mat3(modelMat) * vNormal;
      fragPosWld = modelMat * vec4(vPos, 1.0f);
      NDCCoordDirLight = dirLightProjMat * dirLightViewMat * modelMat * vec4(vPos, 1.0f);
    }
    `;
  
    const mainMeshFragShader = `#version 300 es
    precision highp float;
    in vec3 normal;
    in vec4 fragPosWld;
    in vec4 NDCCoordDirLight;

    uniform vec3 cameraPosWld;
    uniform sampler2D shadowMapTexture;
    uniform samplerCube skybox;
    uniform bool skyboxRenderToggle;
    uniform bool shadowEffectOn;
    uniform vec2 shadowMapTexResol;

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

      vec3 ambientResult = light._ambient;

      return diffuseResult + specularResult + ambientResult;
    }

    vec4 skyBoxReflection()
    {
      vec3 viewDir = normalize(vec3(fragPosWld) - cameraPosWld);
      vec3 toSkyBoxDir = reflect(viewDir, normal);
      return vec4(texture(skybox, toSkyBoxDir).rgb, 1.0);
    }

    vec4 skyBoxRefraction()
    {
      vec3 viewDir = normalize(vec3(fragPosWld) - cameraPosWld);
      vec3 toSkyBoxDir = refract(viewDir, normal, 1.00 / 1.52);
      return vec4(texture(skybox, toSkyBoxDir).rgb, 1.0);
    }

    float shadowStrength(vec4 NDCCoordvec4) {
      vec3 NDCCoord = NDCCoordvec4.xyz/NDCCoordvec4.w;
      NDCCoord = NDCCoord * 0.5 + vec3(0.5);
      float bias = 0.005;
      float strength = 0.0;
      for (float x = -1.0; x < 1.01; x += 1.0)
      {
        for (float y = -1.0; y < 1.01; y += 1.0)
        {
          vec2 shadowCoord = NDCCoord.xy + vec2(x,y)/shadowMapTexResol;
          if (NDCCoord.z >= texture(shadowMapTexture, shadowCoord).r + bias)
          {
            strength += 1.0;
          }
        }
      }
      strength /= 9.0;
      return strength;
      // float shadowMapDepth = texture(shadowMapTexture, NDCCoord.xy).r;
      // float bias = 0.005;
      // return NDCCoord.z >= shadowMapDepth + bias;
    }

    void main()
    {
      vec4 dirLightResult = vec4(GetDirLighting(g_dirLight, normal, normalize(cameraPosWld-fragPosWld.xyz)), 1.0);
      if (skyboxRenderToggle)
      {
        finalColor = 0.1 * dirLightResult + 0.9 * skyBoxReflection();
      }
      else
      {
        finalColor = dirLightResult;
      }

      if (shadowEffectOn)
      {
        float shadowStr = shadowStrength(NDCCoordDirLight) * 0.6;
        finalColor = vec4(finalColor.xyz * (1.0 - shadowStr), 1.0);
      }
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
    ///////////// Set up main mesh render //////////////////////
    ////////////////////////////////////////////////////////////
    this.mainMeshShader = new Shader(gl, mainMeshVertexShader, mainMeshFragShader);
    this.meshData = parseObj(bunnyMeshDataObj);
    //per vertex normal, as an avg of adjacent faces
    this.vertexNormals = getVertexNormals(this.meshData); 
    //vertex + normal that's the same as face normal
    this.processedMesh = processMesh(this.meshData); 

    //set up shadow map and its testing board
    // if (this.shadowToggle) {
    //   setupShadowMap.call(this, gl);
    //   setupShadowMapTestBoard.call(this, gl);
    // }
    
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
  }

  ////////////////////////////////////////////////////////////
  ///////////// Set up shadow map render /////////////////////
  ////////////////////////////////////////////////////////////
  function setupShadowMap(gl) {
    //below is only available in WebGL1
    //WebGL2 naturally supports depth component for framebuffer
    //syntax is slightly different though
    // const ext = gl.getExtension("WEBGL_depth_texture");
    // if (!ext) {
    //   alert("Need WEBGL_depth_texture");
    //   return;
    // }
    //create the frame buffer object
    this.shadowMapFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFBO);

    //create and set up the texture
    this.shadowMapTextureDirLight = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTextureDirLight);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.DEPTH_COMPONENT32F,
      SHADOW_MAP_WIDTH,
      SHADOW_MAP_HEIGHT,
      0,
      gl.DEPTH_COMPONENT,
      gl.FLOAT,
      null
    );
    //attach texture as depth component
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.DEPTH_ATTACHMENT,
      gl.TEXTURE_2D,
      this.shadowMapTextureDirLight,
      0
    );
    //tell WebGL we don't need color attachment
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);

    console.log(
      "shadowmap framebuffer status is COMPLETE? ",
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
    `;
    this.shadowMapShader = new Shader(
      gl,
      shadowMapVertexShader,
      shadowMapFragShader
    );
  }

  function setupShadowMapTestBoard(gl) {
    const squareVertices = [
      0.1, 0.0, 0.0, 0.0, 0.0,
      0.3, 0.0, 0.0, 1.0, 0.0,
      0.1, 0.2, 0.0, 0.0, 1.0,
      0.3, 0.2, 0.0, 1.0, 1.0,
    ];
    const drawIndices = [
      0, 1, 2, 1, 3, 2,
    ];
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

    this.eaboShadowMapTestBoard = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboShadowMapTestBoard);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(drawIndices), gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    const shadowMapTestBoardVertexShader = `#version 300 es
    layout (location=0) in vec3 vertexPos;
    layout (location=1) in vec2 texCoord;

    uniform mat4 modelMat;
    uniform mat4 viewMat;
    uniform mat4 projMat;

    out vec2 f_texCoord;

    void main()
    {
      gl_Position = projMat * viewMat * modelMat * vec4(vertexPos, 1.0);
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
      finalFragColor = vec4(texture(shadowMapTexture, f_texCoord).rrr, 1.0);
    }
    `

    this.shadowMapTestBoardShader = new Shader(
      gl,
      shadowMapTestBoardVertexShader,
      shadowMapTestBoardFragShader
    );
  }

  function setupSkybox(gl) {
    console.log("Entered setupSkybox");
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

    console.log("Finishing setupSkybox");
  }

  function setupBackBoards(gl) {
    //shaders
    const backBoardsVertexShader = `#version 300 es
    layout (location=0) in vec3 vPos;
    layout (location=1) in vec3 vNormal;
    layout (location=2) in vec2 vTexCoord;
    layout (location=3) in vec3 T;
    layout (location=4) in vec3 B;

    uniform mat4 modelMat;
    uniform mat4 viewMat;
    uniform mat4 projMat;
    uniform mat4 dirLightViewMat;
    uniform mat4 dirLightProjMat;

    out vec3 fNormal;
    out vec3 fPos;
    out vec4 NDCPosShadowMap;
    out vec2 fTexCoord;
    out vec3 fT;
    out vec3 fB;

    void main()
    {
      gl_Position = projMat * viewMat * modelMat * vec4(vPos, 1.0);
      fNormal = mat3(modelMat) * vNormal;
      fPos = (modelMat * vec4(vPos, 1.0)).xyz;
      NDCPosShadowMap = dirLightProjMat * dirLightViewMat * modelMat * vec4(vPos, 1.0);
      fTexCoord = vTexCoord;
    }
    `;

    const backBoardsFragShader = `#version 300 es
    precision highp float;
    in vec3 fNormal;
    in vec3 fPos;
    in vec4 NDCPosShadowMap;
    in vec2 fTexCoord;
    in vec3 fT;
    in vec3 fB;

    out vec4 finalFragColor;

    uniform sampler2D shadowMapTexture;
    uniform samplerCube skyboxTexture;
    uniform sampler2D boardTexture;
    uniform sampler2D normalMapTexture;
    uniform bool normalMapEffectOn;
    uniform bool skyboxEffectOn;
    uniform bool shadowEffectOn;
    uniform vec3 g_cameraPos;
    struct DirLight 
    {
      vec3 _dir;
      vec3 _ambient;
      vec3 _diffuse;
      vec3 _specular;
    };
    uniform DirLight g_dirLight;
  
    vec3 g_boardColor = vec3(1.0, 1.0, 1.0);

    vec3 skyboxReflectCalc(vec3 normalVector)
    {
      vec3 viewDir = normalize(fPos-g_cameraPos);
      vec3 toSkyboxDir = reflect(viewDir, normalVector);
      return texture(skyboxTexture, toSkyboxDir).rgb;
    }

    vec3 skyboxRefractCalc(vec3 normalVector)
    {
      vec3 viewDir = normalize(fPos-g_cameraPos);
      vec3 toSkyboxDir = refract(viewDir, normalVector, 1.00/1.52);
      return texture(skyboxTexture, toSkyboxDir).rgb;
    }

    vec3 dirLightCalc(vec3 normalVector)
    {
      vec3 dirLightDir = normalize(g_dirLight._dir);
      vec3 diffuse = dot(normalVector, -dirLightDir) * g_dirLight._diffuse;
      diffuse *= texture(boardTexture, fTexCoord).rgb;

      vec3 dirLightReflect = reflect(dirLightDir, normalVector);
      vec3 dirPosToCamera = normalize(g_cameraPos - fPos);
      float specularStrength = clamp(dot(dirLightReflect, dirPosToCamera), 0.0f, 1.0f);
      specularStrength = pow(specularStrength, 16.0);
      vec3 specular = specularStrength * g_dirLight._specular;

      vec3 ambient = g_dirLight._ambient;
      return (diffuse + specular + ambient) * g_boardColor;
    }

    bool inShadow()
    {
      vec3 NDCCoord = NDCPosShadowMap.xyz/NDCPosShadowMap.w;
      vec3 shadowMapCoord = NDCCoord * 0.5 + vec3(0.5);
      float depthInShadowMap = texture(shadowMapTexture, shadowMapCoord.xy).r;
      float bias = 0.005;
      return (depthInShadowMap + bias <= shadowMapCoord.z );
    }

    vec3 calcNormal()
    {
      vec3 fN = cross(fT, fB);
      mat3 wldToTangent = mat3(fT, fB, fN);
      
    }
    
    void main()
    {
      finalFragColor = skyboxEffectOn ? 
          vec4(0.5 * skyboxReflectCalc(fNormal) + 0.4 * skyboxRefractCalc(fNormal) + 0.1 * dirLightCalc(fNormal), 1.0) : 
          vec4(dirLightCalc(fNormal), 1.0);
      if (shadowEffectOn && inShadow())
        finalFragColor = vec4(finalFragColor.xyz * 0.4, 1.0);
    }
    `;
    this.backBoardsShader = new Shader(
      gl,
      backBoardsVertexShader,
      backBoardsFragShader
    );

    //vertex array buffer
    this.vboBackBoards = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboBackBoards);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(backBoardsVertices),
      gl.STATIC_DRAW
    );
    //vertex array object
    this.vaoBackBoards = gl.createVertexArray();
    gl.bindVertexArray(this.vaoBackBoards);
    gl.enableVertexAttribArray(0); //vertex pos
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 14 * FLOAT_BYTE_SIZE, 0);
    gl.enableVertexAttribArray(1); //vertex normal
    gl.vertexAttribPointer(
      1,
      3,
      gl.FLOAT,
      false,
      14 * FLOAT_BYTE_SIZE,
      3 * FLOAT_BYTE_SIZE
    );
    gl.enableVertexAttribArray(2); //uv coord
    gl.vertexAttribPointer(
      2,
      2,
      gl.FLOAT,
      false,
      14 * FLOAT_BYTE_SIZE,
      6 * FLOAT_BYTE_SIZE
    );
    gl.enableVertexAttribArray(3); //uv coord
    gl.vertexAttribPointer(
      3,
      3,
      gl.FLOAT,
      false,
      14 * FLOAT_BYTE_SIZE,
      8 * FLOAT_BYTE_SIZE
    );
    gl.enableVertexAttribArray(4); //uv coord
    gl.vertexAttribPointer(
      4,
      3,
      gl.FLOAT,
      false,
      14 * FLOAT_BYTE_SIZE,
      11 * FLOAT_BYTE_SIZE
    );
    gl.bindVertexArray(null);
    //element array buffer (drawing index);
    this.drawIndexWalls = [
      4, 5, 6, 
      6, 7, 4,
      8, 9, 10,
      10, 11, 8,
    ];
    this.drawIndexFloor = [
      0, 1, 2,  
      2, 3, 0, 
    ]
    this.eaboWalls = gl.createBuffer();
    this.eaboFloor = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboWalls);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Int16Array(this.drawIndexWalls),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboFloor);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Int16Array(this.drawIndexFloor),
      gl.STATIC_DRAW
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  function setupControls() {
    this.skyboxRenderToggle = false;
    this.shadowToggle = false;
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
    this.backBoardsTextures = await createBackBoardsTextures(gl);
    //console.log("right after function call of createSkyBoxTexture");
    setupCommonData.call(this, gl);
    setupShadowMap.call(this, gl);
    setupShadowMapTestBoard.call(this, gl);
    setupSkybox.call(this, gl);
    setupMainMesh.call(this, gl);
    setupBackBoards.call(this, gl);

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
    const modelMatBunny = mat4.create();
    mat4.fromRotation(
      modelMatBunny,
      this.rotatedYAngle,
      vec3.fromValues(0.0, 1.0, 0.0)
    );
    const dirLight = {
      dir: vec3.fromValues(1.0, -0.5, -0.5),
      ambient: vec3.fromValues(0.1, 0.1, 0.1),
      diffuse: vec3.fromValues(1.0, 1.0, 1.0),
      specular: vec3.fromValues(1.0, 1.0, 1.0),
    };

    //view matrix from light's point of view
    const dirLightViewMat = mat4.create();
    let dirLightPos = vec3.create();
    vec3.negate(dirLightPos, dirLight.dir);
    mat4.lookAt(
      dirLightViewMat,
      dirLightPos, //camera position
      vec3.fromValues(0.0, 0.0, 0.0), //camera focus position, world origin
      vec3.fromValues(0.0, 1.0, 0.0)
    );
    //projection matrix from light's point of view
    const dirLightProjMat = mat4.create();
    mat4.ortho(dirLightProjMat, -0.5, 0.5, -0.5, 0.5, 0.01, 2.0);

    function renderShadowMap(gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowMapFBO);
      gl.enable(gl.DEPTH_TEST);
      gl.viewport(0, 0, SHADOW_MAP_WIDTH, SHADOW_MAP_HEIGHT);
      gl.clear(gl.DEPTH_BUFFER_BIT);
      this.gl.useProgram(this.shadowMapShader.shaderProgram);
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.shadowMapShader.shaderProgram,
          "viewFromLightMat"
        ),
        false,
        dirLightViewMat
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.shadowMapShader.shaderProgram, "projMat"),
        false,
        dirLightProjMat
      );
      //object matrix, this is rendering the bunny so use bunny's model matrix
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.shadowMapShader.shaderProgram, "modelMat"),
        false,
        modelMatBunny
      );
      gl.bindVertexArray(this.vaoBunny);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture); //bind the cubeTexture
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
      gl.drawElements(
        gl.TRIANGLES,
        this.meshData.faces.length,
        gl.UNSIGNED_SHORT,
        0
      );
      gl.bindVertexArray(null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    function renderShadowMapTestBoard(gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvasDOM.width, this.canvasDOM.height);
      gl.useProgram(this.shadowMapTestBoardShader.shaderProgram);
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.shadowMapTestBoardShader.shaderProgram,
          "viewMat"
        ),
        false,
        viewMat
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.shadowMapTestBoardShader.shaderProgram,
          "projMat"
        ),
        false,
        projMat
      );
      const modelMat = mat4.create();
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.shadowMapTestBoardShader.shaderProgram,
          "modelMat"
        ),
        false,
        modelMat
      );
      gl.bindVertexArray(this.vaoShadowMapTestBoard);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboShadowMapTestBoard);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTextureDirLight);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      gl.bindVertexArray(null);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    }

    function renderBackBoards(gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.bindVertexArray(this.vaoBackBoards);
      gl.useProgram(this.backBoardsShader.shaderProgram);
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.backBoardsShader.shaderProgram, "modelMat"),
        false,
        mat4.create()
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.backBoardsShader.shaderProgram, "viewMat"),
        false,
        viewMat
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.backBoardsShader.shaderProgram, "projMat"),
        false,
        projMat
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "g_cameraPos"
        ),
        this.cameraPosWld[0],
        this.cameraPosWld[1],
        this.cameraPosWld[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "g_dirLight._dir"
        ),
        dirLight.dir[0],
        dirLight.dir[1],
        dirLight.dir[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "g_dirLight._ambient"
        ),
        dirLight.ambient[0],
        dirLight.ambient[1],
        dirLight.ambient[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "g_dirLight._diffuse"
        ),
        dirLight.diffuse[0],
        dirLight.diffuse[1],
        dirLight.diffuse[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "g_dirLight._specular"
        ),
        dirLight.specular[0],
        dirLight.specular[1],
        dirLight.specular[2]
      );
      //shadow map related
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "dirLightViewMat"
        ),
        false,
        dirLightViewMat
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "dirLightProjMat"
        ),
        false,
        dirLightProjMat
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "skyboxEffectOn"
        ),
        this.skyboxRenderToggle
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "shadowEffectOn"
        ),
        this.shadowToggle
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "shadowMapTexture"
        ),
        0
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "skyboxTexture"
        ),
        1
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.backBoardsShader.shaderProgram,
          "boardTexture"
        ),
        2
      );
      // gl.uniform1i(
      //   gl.getUniformLocation(
      //     this.backBoardsShader.shaderProgram,
      //     "floorTexture"
      //   ),
      //   3
      // );
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTextureDirLight);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.backBoardsTextures[0]); //wall
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboWalls);
      gl.drawElements(
        gl.TRIANGLES,
        this.drawIndexWalls.length,
        gl.UNSIGNED_SHORT,
        0
      );

      gl.bindTexture(gl.TEXTURE_2D, this.backBoardsTextures[1]); //floor
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboFloor);
      gl.drawElements(
        gl.TRIANGLES,
        this.drawIndexFloor.length,
        gl.UNSIGNED_SHORT,
        0
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      gl.activeTexture(gl.TEXTURE0);
    }

    function renderSkybox(gl) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
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
    }

    function renderBunny(gl) {
      gl.useProgram(this.mainMeshShader.shaderProgram);
      gl.uniform3f(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "g_dirLight._dir"),
        dirLight.dir[0],
        dirLight.dir[1],
        dirLight.dir[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "g_dirLight._ambient"
        ),
        dirLight.ambient[0],
        dirLight.ambient[1],
        dirLight.ambient[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "g_dirLight._diffuse"
        ),
        dirLight.diffuse[0],
        dirLight.diffuse[1],
        dirLight.diffuse[2]
      );
      gl.uniform3f(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "g_dirLight._specular"
        ),
        dirLight.specular[0],
        dirLight.specular[1],
        dirLight.specular[2]
      );
  
      //Pass shared view matrix to shader
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "viewMat"),
        false,
        viewMat
      );
      //Pass shared projection matrix to shader
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "projMat"),
        false,
        projMat
      );
  
      //pass camera world position to frag shader
      gl.uniform3f(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "cameraPosWld"),
        this.cameraPosWld[0],
        this.cameraPosWld[1],
        this.cameraPosWld[2]
      );
  
      //compose the rotation based on mouse input
      //console.log("this.rotatedYAngle is: ", this.rotatedYAngle);
  
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "modelMat"),
        false,
        modelMatBunny
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "skyboxRenderToggle"
        ),
        this.skyboxRenderToggle
      );
      gl.uniform1i(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "shadowEffectOn"
        ),
        this.shadowToggle
      );
      gl.uniform2f(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "shadowMapTexResol"
        ),
        SHADOW_MAP_WIDTH,
        SHADOW_MAP_HEIGHT
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "dirLightViewMat"),
        false,
        dirLightViewMat,
      );
      gl.uniformMatrix4fv(
        gl.getUniformLocation(this.mainMeshShader.shaderProgram, "dirLightProjMat"),
        false,
        dirLightProjMat,
      );
  
      gl.bindVertexArray(this.vaoBunny);
      //bind the cubeTexture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.shadowMapTextureDirLight); //bind the shadowmap
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, this.cubeMapTexture);
  
      gl.uniform1i(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "shadowMapTexture"
        ),
        0
      );
  
      gl.uniform1i(
        gl.getUniformLocation(
          this.mainMeshShader.shaderProgram,
          "skybox"
        ),
        1
      );
  
      //gl.drawArrays(gl.TRIANGLES, 0, this.processedMesh.length / 6);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.eaboBunny);
      gl.drawElements(
        gl.TRIANGLES,
        this.meshData.faces.length,
        gl.UNSIGNED_SHORT,
        0
      );
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
      gl.bindVertexArray(null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_CUBE_MAP, null);
      gl.activeTexture(gl.TEXTURE0);
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
      //renderShadowMapTestBoard.call(this, gl);
    }
    gl.viewport(0, 0, this.canvasDOM.width, this.canvasDOM.height);

    //////////////////////////////////////////////
    //////// draw the back boards /////////////////
    //////////////////////////////////////////////
    renderBackBoards.call(this, gl);

    ///////////////////////////////////////////////
    //////// draw the skybox ////////////////
    ///////////////////////////////////////////////
    renderSkybox.call(this, gl);

    ///////////////////////////////////////////////
    //////// draw the bunny ////////////////
    ///////////////////////////////////////////////
    renderBunny.call(this, gl);

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
    //vertex buffers
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.deleteBuffer(this.vboBunny);
    this.gl.deleteBuffer(this.vboSkybox);
    this.gl.deleteBuffer(this.vboBackBoards);
    this.gl.deleteBuffer(this.vboShadowMapTestBoard)

    //VAOs
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vaoBunny);
    this.gl.deleteVertexArray(this.vaoSkybox);
    this.gl.deleteVertexArray(this.vaoBackBoards);
    this.gl.deleteVertexArray(this.vaoShadowMapTestBoard);

    //element array buffers
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, null);
    this.gl.deleteBuffer(this.eaboBunny);
    this.gl.deleteBuffer(this.eaboWalls);
    this.gl.deleteBuffer(this.eaboFloor);
    if (this.eaboShadowMapTestBoard != null)
      this.gl.deleteBuffer(this.eaboShadowMapTestBoard);

    //framebuffer objects
    if (this.shadowMapFBO != null) {
      console.log("this.shadowMapFBO is: ", this.shadowMapFBO);
      this.gl.deleteFramebuffer(this.shadowMapFBO);
    }

    //textures
    if (this.shadowMapTextureDirLight != null) {
      this.gl.deleteTexture(this.shadowMapTextureDirLight);
    }
    if (this.cubeMapTexture != null) {
      this.gl.deleteTexture(this.cubeMapTexture);
    }

    //shaders
    this.mainMeshShader.cleanUp();
    this.skyboxShader.cleanUp();
    this.backBoardsShader.cleanUp();
    if (this.shadowMapShader != null) {
      this.shadowMapShader.cleanUp();
    }
    if (this.shadowMapTestBoardShader != null) {
      this.shadowMapTestBoardShader.cleanUp();
    }
  }
}
