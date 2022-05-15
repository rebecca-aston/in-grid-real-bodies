let container;
let camera, scene, renderer;
let uniforms;
let alpha = 1;
let clock;
let start = false;

let DEFAULT_MFCC_VALUE = [0,0,0,0,0,0,0,0,0,0,0,0,0];
let FEATURE_NAME_MFCC = 'mfcc';
let FEATURE_NAME_RMS = 'rms';

let THRESHOLD_RMS = 0.005; // threshold on rms value
let MFCC_HISTORY_MAX_LENGTH = 40;

let BOX_WIDTH = 25;
let BOX_HEIGHT = 20;

let silence = true;

let cur_mfcc = DEFAULT_MFCC_VALUE;
let cur_rms = 0;
let mfcc_history = [];
let smooth_rms = [];
let smooth_rms_val = 0;


function createAudioCtx(){
    let AudioContext = window.AudioContext || window.webkitAudioContext;    
    return new AudioContext();
}


function createMicSrcFrom(audioCtx){
    /* get microphone access */
    return new Promise((resolve, reject)=>{
        /* only audio */
        let constraints = {audio:true, video:false}

        navigator.mediaDevices.getUserMedia(constraints)
        .then((stream)=>{
            /* create source from
            microphone input stream */
            let src = audioCtx.createMediaStreamSource(stream)
            resolve(src)
        }).catch((err)=>{reject(err)})
    })
}



function onMicDataCall(features, callback){
    return new Promise((resolve, reject)=>{
        let audioCtx = createAudioCtx()

        createMicSrcFrom(audioCtx)
        .then((src) => {
            let analyzer = Meyda.createMeydaAnalyzer({
                'audioContext': audioCtx,
                'source':src,
                'bufferSize':512,
                'featureExtractors':features,
                'callback':callback
            })
            resolve(analyzer)
        }).catch((err)=>{
            reject(err)
        })
    })
    
}


function show(features){
    // update spectral data size
    cur_mfcc = features[FEATURE_NAME_MFCC]
    cur_rms = features[FEATURE_NAME_RMS]

}



function init() {
  container = document.getElementById( 'container' );
  
  clock = new THREE.Clock(true);

  camera = new THREE.Camera();
  camera.position.z = 1;

  scene = new THREE.Scene();

  let geometry = new THREE.PlaneBufferGeometry( 2, 2 );


  uniforms = {
    u_time: { type: "f", value: 2001.0 },
    u_resolution: { type: "v2", value: new THREE.Vector2() },
    u_mouse: { type: "v2", value: new THREE.Vector2() },
    col1: { type: "v3", value: new THREE.Vector3() },
    col2: { type: "v3", value: new THREE.Vector3() },
    col3: { type: "v3", value: new THREE.Vector3() },
    col4: { type: "v3", value: new THREE.Vector3() },
    coef1: { type: "f", value: 1.0 },
    coef2: { type: "f", value: 1.0 },
    coef3: { type: "f", value: 1.0 },
    coef4: { type: "f", value: 1.0 },
    coef5: { type: "f", value: 1.0 },
    coef6: { type: "f", value: 1.0 },
    coef9: { type: "f", value: 1.0 },
    rms: { type: "f", value: 0.0 },
    alpha: { type: "f", value: 1.0 }

  };

  let material = new THREE.ShaderMaterial( {
    uniforms: uniforms,
    vertexShader: document.getElementById( 'vertexShader' ).textContent,
    fragmentShader: document.getElementById( 'fragmentShader' ).textContent
  } );

  let mesh = new THREE.Mesh( geometry, material );
  scene.add( mesh );

  renderer = new THREE.WebGLRenderer();
  renderer.setPixelRatio( window.devicePixelRatio );

  container.appendChild( renderer.domElement );

  onWindowResize();
  window.addEventListener( 'resize', onWindowResize, false );

  uniforms.col2.value.x = 1.0;
  uniforms.col2.value.y = 1.0;
  uniforms.col2.value.z = 0;

  uniforms.col1.value.x = 1.0;
  uniforms.col1.value.y = 1.0;
  uniforms.col1.value.z = 1.0;


  document.getElementById("start-audio").addEventListener("click",function(){
    if(!start){
//        console.log("start");
        let bttn = document.getElementById('start-audio');
//        bttn.innerHTML = "LIVE";
        document.body.classList.add("live");
        start = true;
        onMicDataCall([FEATURE_NAME_MFCC, FEATURE_NAME_RMS], show)
        .then((meydaAnalyzer) => {
            meydaAnalyzer.start()
        }).catch((err)=>{
            alert(err)
        })
    }

  });

}

function onWindowResize( event ) {
  renderer.setSize( window.innerWidth, window.innerHeight );
  uniforms.u_resolution.value.x = renderer.domElement.width;
  uniforms.u_resolution.value.y = renderer.domElement.height;
}


function animate() {
  requestAnimationFrame( animate );
  render();
}

function render() {

  let delta = Math.min(clock.getDelta(),0.5);
  uniforms.u_time.value += (0.1 * delta) + ((smooth_rms_val*0.08)*(1-alpha));

    /* append new mfcc values */
  if ( cur_rms > THRESHOLD_RMS ) {
      mfcc_history.push( cur_mfcc )
      smooth_rms.push( cur_rms )
      silence = false
  } else {
      // push an empty mfcc value 
      // to signify end of utterance
      if ( silence == false ) {
          mfcc_history.push(DEFAULT_MFCC_VALUE)
          smooth_rms.push( cur_rms )
          silence = true;
      }
  }

      // only store the last n 
  if(mfcc_history.length > MFCC_HISTORY_MAX_LENGTH){
    mfcc_history.splice(0,1)
    smooth_rms.splice(0,1)
  }
     


  if(mfcc_history.length > 0 && !silence){
      // console.log("--------------");
      let smoothed = [];
      
      if(alpha > 0){
        alpha -= 0.2 * delta;
        uniforms.alpha.value = Math.max(0,alpha);
      }

      for(let i = 0; i < smooth_rms.length; i++ ) {
          smooth_rms_val += smooth_rms[i]
      }
      smooth_rms_val /= smooth_rms.length;
      
      for(let j = 0; j < mfcc_history[0].length; j++ ) {
          smoothed.push(mfcc_history[0][j]);
          for(let i = 1; i < mfcc_history.length; i++ ) {
              smoothed[j] += mfcc_history[i][j];        
          }
          smoothed[j] /= mfcc_history.length;
      }


      uniforms.coef1.value = (smoothed[0]>=0) ? smoothed[0]/100: -smoothed[0]/100;
      uniforms.coef2.value = (smoothed[1]>=0) ? smoothed[1]/20: -smoothed[1]/20;
      uniforms.coef3.value = (smoothed[2]>=0) ? smoothed[2]/20: -smoothed[2]/20;
      uniforms.coef4.value = Math.max(0,((smoothed[3]/20) + 1)/2);
      uniforms.coef5.value = (smoothed[4]>=0) ? smoothed[4]/20: -smoothed[4]/20;
      uniforms.coef6.value = 0.7;//Math.min(0.9,Math.max(0.7,1-smoothed[5]/20));

      uniforms.coef9.value = smoothed[8]/20;

      uniforms.rms.value = smooth_rms_val;

      if ( smoothed[8] >= 0 ){
        uniforms.col1.value.x = 1.0;
        uniforms.col1.value.y = smoothed[8]/20;
        uniforms.col1.value.z = 0;
      }else{
        uniforms.col1.value.x = 1.0;
        uniforms.col1.value.y = -smoothed[8]/20;
        uniforms.col1.value.z = 0;
      }


      if ( smoothed[10] >= 0 ){
          uniforms.col3.value.x = 0.0;
          uniforms.col3.value.y = (smoothed[10]/20);
          uniforms.col3.value.z = 1.0;

      }else{
          uniforms.col3.value.x = 0.0;
          uniforms.col3.value.y = -(smoothed[10]/20);
          uniforms.col3.value.z = 1.0;
      }


  }else if(silence){

      if(alpha < 1){
        alpha += 0.08 * delta;
        uniforms.alpha.value = alpha;
      }
  }


  renderer.render( scene, camera );


}



init();
animate();