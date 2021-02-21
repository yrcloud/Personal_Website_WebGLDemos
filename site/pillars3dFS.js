const pillarsFShader = `#version 300 es
precision highp float;

out vec4 resultColor;
in vec2 fScreenPos;
uniform float iGlobalTime;
uniform vec2 canvasPixelSize;

//#define VIDEO_RECORDING

// generate perlin noise in pixel shader, 
// from I�igo Qu�lez(iq)'s shader demo "Elevated" https://www.shadertoy.com/view/MdX3Rr"
/******************************Perlin noise generation begins************************************************/
float hash( float n )
{
    return fract(sin(n)*43758.5453123);
}

float noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);

    f = f*f*(3.0-2.0*f);

    float n = p.x + p.y*57.0 + 113.0*p.z;

    float res = mix(mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                        mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y),
                    mix(mix( hash(n+113.0), hash(n+114.0),f.x),
                        mix( hash(n+170.0), hash(n+171.0),f.x),f.y),f.z);
    return res;
}

float noise( in vec2 x )
{
    vec2 p = floor(x);
    vec2 f = fract(x);

    f = f*f*(3.0-2.0*f);

    float n = p.x + p.y*57.0;

    float res = mix(mix( hash(n+  0.0), hash(n+  1.0),f.x),
                    mix( hash(n+ 57.0), hash(n+ 58.0),f.x),f.y);

    return res;
}

const mat3 m = mat3( 0.00,  0.80,  0.60,
                    -0.80,  0.36, -0.48,
                    -0.60, -0.48,  0.64 );

float displacement( vec3 p )
{
	p += vec3(1.0,0.0,0.8);
	
    float f;
    f  = 0.5000*noise( p ); p = m*p*2.02;
    f += 0.2500*noise( p ); p = m*p*2.03;
    f += 0.1250*noise( p ); p = m*p*2.01;
    f += 0.0625*noise( p ); 
	
	float n = noise( p*3.5 );
    f += 0.03*n*n;
	
    return f;
}
/************************************Perlin noise ends*********************************/

/*********************************Pillars generation begins************************************/
//distance field for a box centered around the world origin, 
//from iq's tutorial at http://www.iquilezles.org/www/articles/distfunctions/distfunctions.htm
float sdBox (vec3 p, vec3 b)
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}	

//let's put them together into a pattern
//Here we actually begins creating the ancient pillars
float pillarsDistanceField( in vec3 position )
{
    // The distance between each pillar in our pattern of pillars, 
    // only x and z coordinates matters since it's a 2D pattern
	vec3 patternDist = vec3 (10.0, 25.0, 10.0);
	
    // Form the repetition of the pillars in x and z dimension
	vec3 pattern = mod(position,patternDist)-0.5*patternDist;

    // The shape doesnt repeat on the y dimension
	pattern.y = position.y;
		
	//The distance field of the ground
	float ground = position.y;
	
	//The distance field of the thickest part of the pillars (bottom)
	vec3 bottomPillars = vec3 (5.0, 8.0, 5.0);
    float distanceBottom = sdBox (pattern, bottomPillars);
	
	//The distance field of the middle part of the pillars
	pattern.y -= 8.0; //transform the distance field on the y direction
	vec3 middlePillars = vec3 (2.5, 6.0, 2.5);
	float distanceMiddle = sdBox (pattern, middlePillars);
	
	//The distance field of the thinest part of the pillars (top)
	pattern.y -= 10.0; //transform the distance field on the y direction
	vec3 topPillars = vec3 (1.5, 9.0, 1.5);
	float distanceTop = sdBox (pattern, topPillars);
	
    //the weight of the perlin noise changes according to time
    //creating the sense of "corrosion" and "growing"
	float distanceField = min ( min( distanceMiddle, distanceBottom), distanceTop);

#ifdef VIDEO_RECORDING
	distanceField = 0.65 * distanceField + (sin(iGlobalTime/3.0/2.0) + 2.0)/2.0* displacement (position); 
#else
	distanceField = 0.65 * distanceField + (sin(iGlobalTime) + 2.0)/2.0* displacement (position); 
#endif
	return distanceField;
}
/******************************Pillars generation ends*************************************************/

/******************************lighting calculation on distance field begins******************************************************************/
// calculating ambient occlusion on a distance field, 
// from I�igo Qu�lez(iq)'s shader demo "volcanic" https://www.shadertoy.com/view/XsX3RB,
// The original idea is from �Fast Approximation for Global Illumination on Dynamic Scenes�, SIGGRAPH 2006,  by Alex Evans
// modified as needed.
float calcAO( in vec3 pos, in vec3 nor )
{
    float ao = 1.0;
    float totao = 0.0;
    float sca = 5.0;
    for( int aoi=0; aoi<5; aoi++ )
    {
        //float hr = 0.01 + 0.015*float(aoi*aoi);
		float hr = 0.01 + 0.015*float(aoi*aoi);
        vec3 aopos =  nor * hr + pos;
        float dd = pillarsDistanceField ( aopos );
        totao += -(dd-hr)*sca;
        sca *= 0.5;
    }
    if (totao < 0.0) totao = 0.0;
    if (totao > 1.0) totao = 1.0;  
    //return 1.0 - clamp( totao, 0.0, 1.0 );
    return 1.0 - totao;
}

// calculating normal of procedural surface using traditional finite differential method, 
// from I�igo Qu�lez(iq)'s shader demo "Catacombs" https://www.shadertoy.com/view/lsf3zr
// modified as needed
vec3 calcNormal( in vec3 pos )
{
    vec3 eps = vec3(0.02,0.0,0.0);
	return normalize( vec3(
           pillarsDistanceField(pos+eps.xyy) - pillarsDistanceField(pos-eps.xyy),
           pillarsDistanceField(pos+eps.yxy) - pillarsDistanceField(pos-eps.yxy),
           pillarsDistanceField(pos+eps.yyx) - pillarsDistanceField(pos-eps.yyx) ) );

}

// fake soft shadow of the distance field, 
// from I�igo Qu�lez(iq)'s shader demo "volcanic" https://www.shadertoy.com/view/XsX3RB,
// modified as needed 
float softshadow( in vec3 ro, in vec3 rd, float mint, float k )
{
    float res = 1.0;
    float t = mint;
    for( int i=0; i<48; i++ )
    {
        float h = pillarsDistanceField(ro + rd*t);
		h = max( h, 0.0 );
        res = min( res, k*h/t );
        //t += clamp( h, 0.2, 5 );
        if (h<0.2) h = 0.2;
        if (h>5.0)   h = 5.0;
        t +=  h;
    }
    return clamp(res,0.0,1.0);
}
/******************************lighting calculation on distance field ends******************************************************************/

//adaptive ray marching
float rayMarching( in vec3 rayOrigin, in vec3 rayDir )
{
	/*****************!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!******/
	/******************************This part is very performance sensitive!!!!!!!!!!!!!!!!!!!!!!*************************************/

	//the following two parameters will determin the largest distance and shortest "sensitivity" of our ray marching
	//The maximuDistance is crucial to the performance!!!!!!!!
	//lower this value to 30 or enven 20 if you are using a moderate GPU!!!!! well...you will have less pillars...
	float maximumDistance = 25.0f;
	//The accuracy has an impact on performance too
	//Enlarge this value if you don't have a super GPU, but accuracy of the collision detection will compromise
    //usually happens near the silhouette 
    float accuracy = 0.0001f;
    float distance = 1.0f;
    float step = 0.1f;
    for( int i=0; i<100; i++ )
    {
        if( abs(distance)<accuracy||step>maximumDistance ) continue;//break;
	    distance = pillarsDistanceField( rayOrigin+rayDir*step );
        step += distance;
    }
    /*****************!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!******/

    if( step>maximumDistance ) step=-1.0;
    return step;
}

//parallel sun light
vec3 sunLightDir = normalize( vec3(0.3, 0.6,0.7 ));

void main()
{
    //for testing
    vec2 screen0to1 = (fScreenPos + vec2(1.0, 1.0))/2.0;
    resultColor = vec4(screen0to1.x, 0.0f, 0.0f, 1.0);

    //return;

	vec2 p = fScreenPos;
	p.x *= canvasPixelSize.x / canvasPixelSize.y;

//camera movement	
#ifdef VIDEO_RECORDING  //let the camera and lighting change slower
	// the change happens every fram
	// this applies to both skylight color and parallel light shading color
	vec3 change = vec3(sin (iGlobalTime/3.0/3.0+3.0)/6.0, sin (iGlobalTime/5.0/3.0)/7.0, sin (iGlobalTime/8.0/3.0)/5.0);

	//starting position
	vec3 rayOrigin = vec3 (10.0, 13.0, 0.0);
	//move the camera
	rayOrigin.y += 3.0* sin (iGlobalTime/3.0/3.0);
	rayOrigin.z += 0.5*sin (2.0*iGlobalTime/8.0/3.0);
	
	//the looking direction changes more dramatic
	vec3 lookAt = vec3 (0.0, 17.0, 0.0);
	lookAt.y += 5.0* sin (iGlobalTime/5.0/3.0);
	lookAt.x -= iGlobalTime/3.0;
	lookAt.z += 16.0*sin (2.0*iGlobalTime/36.0/3.0);
	rayOrigin.x -= iGlobalTime/3.0;
#else
	//same change applies here, with a faster speed
	vec3 change = vec3(sin (iGlobalTime/3.0/3.0+3.0)/6.0, sin (iGlobalTime/5.0/3.0)/7.0, sin (iGlobalTime/8.0/3.0)/5.0);
	vec3 rayOrigin = vec3 (10.0, 13.0, 0.0);
	rayOrigin.y += 3.0* sin (iGlobalTime/3.0);
	rayOrigin.z += 0.5*sin (2.0*iGlobalTime/4.0);
	
	vec3 lookAt = vec3 (0.0, 17.0, 0.0);
	lookAt.y += 5.0* sin (iGlobalTime/2.0);
	lookAt.x -= iGlobalTime;
	lookAt.z += 16.0*sin (2.0*iGlobalTime/18.0);
	rayOrigin.x -= iGlobalTime;
#endif
	
    // camera rolling, 
    // created by iq in his shader demo	"volcanic" https://www.shadertoy.com/view/XsX3RB, 
	float roll = 0.3*sin(1.0+0.07*iGlobalTime);
	vec3 cw = normalize(lookAt-rayOrigin);
	vec3 cp = vec3(sin(roll), cos(roll),0.0);
	vec3 cu = normalize(cross(cw,cp));
	vec3 cv = normalize(cross(cu,cw));
	vec3 rayDir = normalize( p.x*cu + p.y*cv + 2.0*cw );

    // color of the sky
	vec3 pixelColor = vec3(0.32  , 0.36 , 0.4 ) - rayDir.y*0.35;
	pixelColor += change/2.0;

  
    // collision detection	
	float t = rayMarching(rayOrigin, rayDir);
	
    if( t>0.0 )
	{
        //get the collision point and surface normal
		vec3 collisionPosition = rayOrigin + t*rayDir;
		vec3 collisionNormal = calcNormal( collisionPosition );

        //lighting
        //lambertian shading 
		float diffuse = clamp( dot( collisionNormal, sunLightDir ), 0.0, 1.0 );
	
		//get the soft shadow
		float shadow = 0.0; if( diffuse>0.01) shadow=softshadow(collisionPosition,sunLightDir,0.01,32.0);

		//get the AO
		float occlusion = calcAO( collisionPosition, collisionNormal );

		pixelColor = vec3(0.95);
		pixelColor += change*1.5;
   
		//core lighting, cos * softshadow * occlusion
		//from iq's shader demo "volcanic" https://www.shadertoy.com/view/XsX3RB, 
        //modified as needed
		//this is where the color of the sun matters to our pillars
		vec3 direct  = diffuse*vec3(1.64,1.27,0.99)*pow(vec3(shadow),vec3(1.0,1.2,1.5))*(0.8+0.2*occlusion);
        //ambient lighting, 
        //from iq's shader demo "Catacombs" https://www.shadertoy.com/view/lsf3zr
        //modified as needed
		float llig = dot(sunLightDir, sunLightDir);
		float at2 = exp2(-0.35*llig );
		float dif2 = clamp( dot(collisionNormal,normalize(vec3(-sunLightDir.x,0.0,-sunLightDir.z))), 0.0, 1.0 );
		direct += 1.0*occlusion*dif2*at2*vec3(0.05, 0.05, 0.05);
	
		pixelColor = direct * pixelColor;
	}

    // gamma correction, 
    // created by iq in his shader demo	"volcanic" https://www.shadertoy.com/view/XsX3RB
	pixelColor = pow( clamp( pixelColor, 0.0, 1.0 ), vec3(0.45) );
    /**************************************apply lighting ends******************************************************/

	resultColor = vec4( pixelColor, 1.0 );
}
`;
