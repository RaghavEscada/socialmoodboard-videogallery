import * as THREE from "three";
import { vertexShader, fragmentShader } from "./shaders.js";
import { slides } from "./slides.js";

const container = document.querySelector(".container");
const projectTitle = document.getElementById("project-title");
const projectLink = document.getElementById("project-link");

let scrollIntensity = 0;
let targetScrollIntensity = 0;
const maxScrollIntensity = 1.0;
const scrollSmoothness = 0.5;

let scrollPosition = 0;
let targetScrollPosition = 0;
const scrollPositionSmoothness = 0.05;

let isMoving = false;
const movementThreshold = 0.001;
let isSnapping = false;

let stableCurrentIndex = 0;
let stableNextIndex = 1;
let isStable = false;

let titleHidden = false;
let titleAnimating = false;
let currentProjectIndex = 0;

// Video elements and textures arrays
const videos = [];
const videoTextures = [];

// Initialize with first project
projectTitle.textContent = slides[0].title;
projectLink.href = slides[0].url;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setClearColor(0xffffff, 0);
container.appendChild(renderer.domElement);

const calculatePlaneDimensions = () => {
  const fov = camera.fov * (Math.PI / 180);
  const viewportHeight = 2 * Math.tan(fov / 2) * camera.position.z;
  const viewportWidth = viewportHeight * camera.aspect;

  // Modified to create portrait dimensions (16:9 ratio but in portrait)
  const heightFactor = window.innerWidth < 900 ? 0.9 : 0.7;
  const planeHeight = viewportHeight * heightFactor;
  const planeWidth = planeHeight * (9 / 16); // Using 9/16 ratio for portrait

  return { width: planeWidth, height: planeHeight };
};

const dimensions = calculatePlaneDimensions();

// Function to load video textures
const loadVideoTextures = () => {
  // Create video elements and textures for each slide
  for (let i = 0; i < slides.length; i++) {
    // Create video element
    const video = document.createElement('video');
    video.src = `${i + 1}.mp4`; // Using numbered video files as requested
    video.crossOrigin = 'anonymous';
    video.loop = true;
    video.muted = true;
    video.playsInline = true; // Important for mobile
    video.style.display = 'none'; // Hide the video element
    
    // Add to document to ensure it loads
    document.body.appendChild(video);
    
    // Create texture from video
    const texture = new THREE.VideoTexture(video);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.format = THREE.RGBFormat;
    
    // Store references
    videos.push(video);
    videoTextures.push(texture);
  }

  // Start playing the first two videos
  videos[0].play();
  videos[1].play();
  
  return videoTextures;
};

// Load video textures instead of image textures
const textures = loadVideoTextures();

const geometry = new THREE.PlaneGeometry(
  dimensions.width,
  dimensions.height,
  32,
  32
);

const material = new THREE.ShaderMaterial({
  vertexShader,
  fragmentShader,
  side: THREE.DoubleSide,
  uniforms: {
    uScrollIntensity: { value: scrollIntensity },
    uScrollPosition: { value: scrollPosition },
    uCurrentTexture: { value: textures[0] },
    uNextTexture: { value: textures[1] },
  },
});

const plane = new THREE.Mesh(geometry, material);
scene.add(plane);

function determineTextureIndices(position) {
  const totalVideos = slides.length;

  const baseIndex = Math.floor(position % totalVideos);
  const positiveBaseIndex = 
    baseIndex >= 0 ? baseIndex : (totalVideos + baseIndex) % totalVideos;

  const nextIndex = (positiveBaseIndex + 1) % totalVideos;

  let normalizedPosition = position % 1;
  if (normalizedPosition < 0) normalizedPosition += 1;

  return {
    currentIndex: positiveBaseIndex,
    nextIndex: nextIndex,
    normalizedPosition: normalizedPosition,
  };
}

// Function to manage which videos should be playing
function updateActiveVideos(currentIndex, nextIndex) {
  // First pause all videos to save resources
  videos.forEach((video, index) => {
    // Only play the current and next videos
    if (index === currentIndex || index === nextIndex) {
      if (video.paused) {
        video.play().catch(e => console.warn("Video play error:", e));
      }
    } else {
      video.pause();
    }
  });
}

function updateTextureIndices() {
  if (isStable) {
    material.uniforms.uCurrentTexture.value = textures[stableCurrentIndex];
    material.uniforms.uNextTexture.value = textures[stableNextIndex];
    updateActiveVideos(stableCurrentIndex, stableNextIndex);
    return;
  }

  const indices = determineTextureIndices(scrollPosition);

  material.uniforms.uCurrentTexture.value = textures[indices.currentIndex];
  material.uniforms.uNextTexture.value = textures[indices.nextIndex];
  updateActiveVideos(indices.currentIndex, indices.nextIndex);
}

function snapToNearestImage() {
  if (!isSnapping) {
    isSnapping = true;
    const roundedPosition = Math.round(scrollPosition);
    targetScrollPosition = roundedPosition;

    const indices = determineTextureIndices(roundedPosition);
    stableCurrentIndex = indices.currentIndex;
    stableNextIndex = indices.nextIndex;

    currentProjectIndex = indices.currentIndex;

    showTitle();
  }
}

function hideTitle() {
  if (!titleHidden && !titleAnimating) {
    titleAnimating = true;
    projectTitle.style.transform = "translateY(20px)";

    setTimeout(() => {
      titleAnimating = false;
      titleHidden = true;
    }, 500);
  }
}

function showTitle() {
  if (titleHidden && !titleAnimating) {
    projectTitle.textContent = slides[currentProjectIndex].title;
    projectLink.href = slides[currentProjectIndex].url;

    titleAnimating = true;
    projectTitle.style.transform = "translateY(0px)";

    setTimeout(() => {
      titleAnimating = false;
      titleHidden = false;
    }, 500);
  }
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const newDimensions = calculatePlaneDimensions();
  plane.geometry.dispose();
  plane.geometry = new THREE.PlaneGeometry(
    newDimensions.width,
    newDimensions.height,
    32,
    32
  );
});

window.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();

    isSnapping = false;
    isStable = false;

    hideTitle();

    targetScrollIntensity += event.deltaY * 0.001;
    targetScrollIntensity = Math.max(
      -maxScrollIntensity,
      Math.min(maxScrollIntensity, targetScrollIntensity)
    );

    targetScrollPosition += event.deltaY * 0.001;

    isMoving = true;
  },
  { passive: false }
);

function animate() {
  requestAnimationFrame(animate);

  scrollIntensity +=
    (targetScrollIntensity - scrollIntensity) * scrollSmoothness;
  material.uniforms.uScrollIntensity.value = scrollIntensity;

  scrollPosition +=
    (targetScrollPosition - scrollPosition) * scrollPositionSmoothness;

  let normalizedPosition = scrollPosition % 1;
  if (normalizedPosition < 0) normalizedPosition += 1;

  if (isStable) {
    material.uniforms.uScrollPosition.value = 0;
  } else {
    material.uniforms.uScrollPosition.value = normalizedPosition;
  }

  updateTextureIndices();

  const baseScale = 1.0;
  const scaleIntensity = 0.1;

  if (scrollIntensity > 0) {
    const scale = baseScale + scrollIntensity * scaleIntensity;
    plane.scale.set(scale, scale, 1);
  } else {
    const scale = baseScale - Math.abs(scrollIntensity) * scaleIntensity;
    plane.scale.set(scale, scale, 1);
  }

  targetScrollIntensity *= 0.98;

  const scrollDelta = Math.abs(targetScrollPosition - scrollPosition);

  if (scrollDelta < movementThreshold) {
    if (isMoving && !isSnapping) {
      snapToNearestImage();
    }

    if (scrollDelta < 0.0001) {
      if (!isStable) {
        isStable = true;
        scrollPosition = Math.round(scrollPosition);
        targetScrollPosition = scrollPosition;
      }

      isMoving = false;
      isSnapping = false;
    }
  }

  // Need to update textures each frame for videos
  videoTextures.forEach(texture => {
    texture.needsUpdate = true;
  });

  renderer.render(scene, camera);
}

// Handle page visibility changes to pause/resume videos
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Pause all videos when page is not visible
    videos.forEach(video => video.pause());
  } else {
    // Resume only the active videos
    updateTextureIndices();
  }
});

animate();