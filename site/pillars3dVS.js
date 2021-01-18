const pillarsVShader = `#version 300 es
//precision highp float;
out vec2 fScreenPos;
layout (location=0) in vec3 vPos;
layout (location=1) in vec2 vScreenPos;

void main() 
{
    gl_Position = vec4(vPos, 1.0f);
    fScreenPos = vScreenPos;
}
`;
