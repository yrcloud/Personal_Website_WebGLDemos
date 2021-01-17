function init(gl, mainCanvasDOM) {
  const progStartTime = new Date().getTime();
  // If we don't have a GL context, give up now
  if (!gl) {
    alert(
      "Unable to initialize WebGL. Your browser or machine may not support it."
    );
    return;
  }
  const pillars3dShader = new Shader(gl, vertexShader, fragShader);

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
  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array(vertexPoss),
    gl.STATIC_DRAW,
    0
  );
  gl.bindBuffer(gl.ARRAY_BUFFER, null);

  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 20, 12);
  gl.enableVertexAttribArray(1);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindVertexArray(null);

  function render(now) {
    gl.bindVertexArray(vao);
    pillars3dShader.use(gl);
    // gl.uniform2f(
    //   gl.getUniformLocation(pillars3dShader._ID, "resolution"),
    //   1280,
    //   720
    // );
    console.log(
      "actual pixel size is: ",
      mainCanvasDOM.clientWidth,
      mainCanvasDOM.clientHeight
    );
    gl.uniform2f(
      gl.getUniformLocation(pillars3dShader._ID, "canvasPixelSize"),
      1280,
      720
    );
    const curTime = new Date().getTime();
    //console.log("current time is: ", curTime);
    gl.uniform1f(
      gl.getUniformLocation(pillars3dShader._ID, "iGlobalTime"),
      //new Date().getTime() / 10000000000.0
      (curTime - progStartTime) / 1000.0
    );

    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    //console.log((new Date()).getTime());
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
