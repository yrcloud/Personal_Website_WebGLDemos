function init(gl) {
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
    0,
    -1,
    -1,
    0,
    1,
    -1,
    0,
    -1,
    1,
    0,
    1,
    -1,
    0,
    1,
    1,
    0,
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
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindVertexArray(null);

  function render(now) {
    gl.bindVertexArray(vao);
    pillars3dShader.use(gl);
    gl.uniform2f(
      gl.getUniformLocation(pillars3dShader._ID, "resolution"),
      800,
      800
    );
    gl.uniform1f(
      gl.getUniformLocation(pillars3dShader._ID, "time"),
      new Date().getTime() / 1000000.0
    );
    gl.clear(gl.COLOR_BUFFER_BIT, gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.bindVertexArray(null);
    //console.log((new Date()).getTime());
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
}
