function Shader(gl, vsSource, fsSource) {
  this.gl = gl;
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

  this.vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  this.fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
  this.shaderProgram = gl.createProgram();
  gl.attachShader(this.shaderProgram, this.vertexShader);
  gl.attachShader(this.shaderProgram, this.fragmentShader);
  gl.linkProgram(this.shaderProgram);
  if (!gl.getProgramParameter(this.shaderProgram, gl.LINK_STATUS)) {
    alert(
      "Unable to initialize the shader program: " +
        gl.getProgramInfoLog(this.shaderProgram)
    );
    this._ID = null;
    return;
  }
  console.log("Shader program successfully created: ", this.shaderProgram);
  this._ID = this.shaderProgram;

  this.cleanUp = function () {
    this.gl.deleteProgram(this.shaderProgram);
    this.gl.deleteShader(this.vertexShader);
    this.gl.deleteShader(this.fragmentShader);
    console.log("cleaned up shader");
  };
}

Shader.prototype.use = function () {
  this.gl.useProgram(this._ID);
};
