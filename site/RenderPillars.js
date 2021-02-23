function Pillars(canvasDOM) {
  this.gl = canvasDOM.getContext("webgl2");
  this.canvasDOM = canvasDOM;
  console.log("gl context in Pillars constructor is: ", this.gl);

  //expose the 4 key functions
  this.init = init.bind(this);
  this.render = render.bind(this);
  this.startRendering = startRendering.bind(this);
  this.cleanGL = cleanGL.bind(this);

  async function init() {
    console.log("this in init is: ", this);
    const gl = this.gl;
    this.progStartTime = new Date().getTime();
    // If we don't have a GL context, give up now
    if (!gl) {
      alert(
        "Unable to initialize WebGL. Your browser or machine may not support it."
      );
      return;
    }
    this.pillars3dShader = new Shader(gl, pillarsVShader, pillarsFShader);

    gl.clearColor(0.1, 0.2, 0.3, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);

    const vertexPoss = [
      -1.0,
      1.0,
      0.0,
      -1.0,
      1.0,

      -1.0,
      -1.0,
      0.0,
      -1.0,
      -1.0,

      1.0,
      -1.0,
      0.0,
      1.0,
      -1.0,

      -1.0,
      1.0,
      0.0,
      -1.0,
      1.0,

      1.0,
      -1.0,
      0.0,
      1.0,
      -1.0,

      1.0,
      1.0,
      0.0,
      1.0,
      1.0,
    ];
    this.vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(vertexPoss),
      gl.STATIC_DRAW,
      0
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
    gl.enableVertexAttribArray(1);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    gl.bindVertexArray(null);
  }

  function render(now) {
    const gl = this.gl;
    //console.log("this.gl in render function is: ", gl);
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
    
    gl.bindVertexArray(this.vao);
    this.pillars3dShader.use(gl);
    // gl.uniform2f(
    //   gl.getUniformLocation(pillars3dShader._ID, "resolution"),
    //   1280,
    //   720
    // );
    // console.log(
    //   "actual pixel size is: ",
    //   this.canvasDOM.clientWidth,
    //   this.canvasDOM.clientHeight
    // );
    gl.uniform2f(
      gl.getUniformLocation(this.pillars3dShader._ID, "canvasPixelSize"),
      this.canvasDOM.clientWidth,
      this.canvasDOM.clientHeight
    );
    const curTime = new Date().getTime();
    //console.log("current time is: ", curTime);
    gl.uniform1f(
      gl.getUniformLocation(this.pillars3dShader._ID, "iGlobalTime"),
      //new Date().getTime() / 10000000000.0
      (curTime - this.progStartTime) / 1000.0
    );

    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    //console.log((new Date()).getTime());
    if (this.activeRendering) {
      this.curRequestedFrame = requestAnimationFrame(this.render);
    }
  }

  function startRendering() {
    this.activeRendering = true;
    this.curRequestedFrame = requestAnimationFrame(this.render);
  };

  function cleanGL() {
    //stop requesting frames first
    if (this.curRequestedFrame != null) {
      cancelAnimationFrame(this.curRequestedFrame);
    }
    this.activeRendering = false;
    this.gl.clear(this.gl.COLOR_BUFFER_BIT, this.gl.DEPTH_BUFFER_BIT);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null);
    this.gl.deleteBuffer(this.vertexBuffer);
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vao);
    this.pillars3dShader.cleanUp();
  };
}
