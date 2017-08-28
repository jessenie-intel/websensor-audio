/*
*       360 degree beach panorama demo using generic sensors
*/

'use strict';

//This is an inclination sensor that uses RelativeOrientationSensor and converts the quaternion to Euler angles
class RelativeInclinationSensor extends RelativeOrientationSensor{
        constructor() {
        super();
        this.sensor_ = new RelativeOrientationSensor({ frequency: 60 });
        this.longitude_ = 0;
        this.latitude_ = 0;
        this.longitudeInitial_ = 0;
        this.initialOriObtained_ = false;
        this.onreading = () => {
                let quat = this.sensor_.quaternion;
                //Conversion to Euler angles done in THREE.js so we have to create a THREE.js object for holding the quaternion to convert from
                let quaternion = new THREE.Quaternion();
                let euler = new THREE.Euler( 0, 0, 0);  //Will hold the Euler angles corresponding to the quaternion
                quaternion.set(quat[0], quat[1], quat[2], quat[3]);     //Order x,y,z,w
                //Order of rotations must be adapted depending on orientation - for portrait ZYX, for landscape ZXY
                let angleOrder = null;
                screen.orientation.angle === 0 ? angleOrder = 'ZYX' : angleOrder = 'ZXY';
                euler.setFromQuaternion(quaternion, angleOrder);     //ZYX works in portrait, ZXY in landscape
                if(!this.initialOriObtained_) //Obtain initial longitude to make the initial camera orientation the same every time
                {
                        this.longitudeInitial_ = -euler.z;
                        if(screen.orientation.angle === 90)
                        {
                                this.longitudeInitial_ = this.longitudeInitial_ + Math.PI/2;     //Offset fix
                        }
                        this.initialOriObtained_ = true;
                }
                //When the device orientation changes, that needs to be taken into account when reading the sensor values by adding offsets, also the axis of rotation might change
                switch(screen.orientation.angle) {
                        default:
                        case 0:
                                this.longitude_ = -euler.z - this.longitudeInitial_;
                                this.latitude_ = euler.x - Math.PI/2;
                                break; 
                        case 90:
                                this.longitude_ = -euler.z - this.longitudeInitial_ + Math.PI/2;
                                this.latitude_ = -euler.y - Math.PI/2;                 
                                break;     
                        case 270:
                                this.longitude_ = -euler.z - this.longitudeInitial_ - Math.PI/2;
                                this.latitude_ = euler.y - Math.PI/2;
                                break;
                }
                if (this.onreading_) this.onreading_();
        };
        }
        start() { this.start(); this.sensor_.start(); }
        stop() { this.stop(); this.sensor_.stop(); }
        get longitude() {
                return this.longitude_;
        }
        get latitude() {
                return this.latitude_;
        }
        /*set onactivate(func) {
                this.sensor_.onactivate_ = func;
        }
        set onerror(err) {
                this.sensor_.onerror_ = err;
        }
        set onreading (func) {
                this.sensor_.onreading_ = func;  
        }*/
}

const container = document.querySelector('#app-view');
var oriSensor = new RelativeInclinationSensor();
var image = "resources/beach_dinner.jpg";

//Required for a THREE.js scene
var renderer = new THREE.WebGLRenderer();
var scene = new THREE.Scene();

//Camera setup
var farPlane = 200;
var fov = 75;
var camera = new THREE.PerspectiveCamera(fov, window.innerWidth / window.innerHeight, 1, farPlane);
camera.target = new THREE.Vector3(0, 0, 0);

//Longitude and latitude, used for rendering
var longitude = 0;
var latitude = 0;

//Service worker registration
if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
                navigator.serviceWorker.register('sw.js').then(function(registration) {
                        //Registration was successful
                }, function(err) {
                        //Registration failed
                console.log('ServiceWorker registration failed: ', err);
                });
        });
}

//This function sets up the THREE.js scene, initializes the orientation sensor and adds the canvas to the DOM
(function init() {

        //ThreeJS scene setup below
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setPixelRatio( window.devicePixelRatio );

        //TextureLoader for loading the image file
        let textureLoader = new THREE.TextureLoader();
        //AudioLoader for loading the audio file
        let audioLoader = new THREE.AudioLoader();
        //Creating the sphere where the image will be projected and adding it to the scene
        let sphere = new THREE.SphereGeometry(100, 100, 40);
        sphere.applyMatrix(new THREE.Matrix4().makeScale(-1, 1, 1));    //The sphere needs to be transformed for the image to render inside it
        let sphereMaterial = new THREE.MeshBasicMaterial();
        sphereMaterial.map = textureLoader.load(image); //Use the image as the material for the sphere
        // Combining geometry and material produces the mesh with the image as its material
        let sphereMesh = new THREE.Mesh(sphere, sphereMaterial);
        scene.add(sphereMesh);

        //The sound needs to be attached to a mesh, here an invisible one, in order to be able to be positioned in the scene. Here the mesh is created and added to the scene
        let soundmesh = new THREE.Mesh( new THREE.SphereGeometry(), new THREE.MeshBasicMaterial() );    //The mesh is invisible by default
        soundmesh.position.set( -40, 0, 0 ); //The position where the sound will come from, important for directional sound
        scene.add( soundmesh );

        //Add an audio listener to the camera so we can hear the sound
        let listener = new THREE.AudioListener();
        camera.add( listener );

        //Here the sound is loaded and attached to the mesh
        let sound = new THREE.PositionalAudio( listener );
        audioLoader.load( 'resources/ocean.mp3', function( buffer ) {
                sound.setBuffer( buffer );
                sound.setLoop(true);
                sound.setRefDistance( 40 );
                sound.setRolloffFactor(1);
                sound.play();
        });
        soundmesh.add( sound );
        container.appendChild( renderer.domElement );

        //Sensor initialization
       /* //Event listener to render again when sensor gets a new reading
        oriSensor.addEventListener('reading', () => {
                render();
            }
        });*/
        oriSensor.start();

        //On window resize, also resize canvas so it fills the screen
        window.addEventListener('resize', () => {
                camera.aspect = window.innerWidth / window.innerHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(window.innerWidth, window.innerHeight);
        }, false);

        render();
})();

//Renders the scene according to the longitude and latitude
function render() {


        camera.target.x = (farPlane/2) * Math.sin(Math.PI/2 - oriSensor.latitude) * Math.cos(oriSensor.longitude);
        camera.target.y = (farPlane/2) * Math.cos(Math.PI/2 - oriSensor.latitude);
        camera.target.z = (farPlane/2) * Math.sin(Math.PI/2 - oriSensor.latitude) * Math.sin(oriSensor.longitude);
        camera.lookAt(camera.target);

        renderer.render(scene, camera);
        requestAnimationFrame(() => render());
}
