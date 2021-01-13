function Shader(gl, vsSource, fsSource) {
  function loadShader(gl, type, source) {
    const shader = gl.createShader(type);

    //console.log("shaderContent is: ", shaderContent);
    gl.shaderSource(shader, source);

    // Compile the shader program
    gl.compileShader(shader);

    // See if it compiled successfully
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      alert(
        "An error occurred compiling the shaders: " +
          gl.getShaderInfoLog(shader)
      );
      gl.deleteShader(shader);
      return null;
    }
    console.log("Singlular Shader successfully created: ", shader);
    return shader;
  }

  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);
  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(shaderProgram)
    );
    this._ID = null;
    return;
  }
  console.log("Shader program successfully created: ", shaderProgram);
  this._ID = shaderProgram;
}

Shader.prototype.use = function (gl) {
  gl.useProgram(this._ID);
};
