/**
 * Face Recognition using face-api.js
 * Real face embedding comparison for accurate recognition
 */

// We'll load face-api dynamically on client side
let faceapi: typeof import('face-api.js') | null = null;
let modelsLoaded = false;

/**
 * Load face-api.js models
 */
export async function loadModels(): Promise<boolean> {
  if (modelsLoaded) return true;

  if (typeof window === 'undefined') {
    console.log('Cannot load face-api on server');
    return false;
  }

  try {
    // Dynamic import for client-side only
    faceapi = await import('face-api.js');

    const MODEL_URL = '/models';

    console.log('Loading face detection models...');

    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
    ]);

    modelsLoaded = true;
    console.log('✅ Face recognition models loaded');
    return true;
  } catch (error) {
    console.error('❌ Failed to load face models:', error);
    return false;
  }
}

/**
 * Detect face and get embedding (128-dimensional vector)
 */
export async function getFaceEmbedding(
  imageElement: HTMLImageElement | HTMLVideoElement | HTMLCanvasElement
): Promise<Float32Array | null> {
  if (!faceapi || !modelsLoaded) {
    await loadModels();
    if (!faceapi) return null;
  }

  try {
    const detection = await faceapi
      .detectSingleFace(imageElement, new faceapi.TinyFaceDetectorOptions())
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      console.log('No face detected');
      return null;
    }

    return detection.descriptor;
  } catch (error) {
    console.error('Face detection error:', error);
    return null;
  }
}

/**
 * Get face embedding from base64 image
 */
export async function getFaceEmbeddingFromBase64(base64Image: string): Promise<Float32Array | null> {
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = async () => {
      const embedding = await getFaceEmbedding(img);
      resolve(embedding);
    };
    img.onerror = () => {
      console.error('Failed to load image');
      resolve(null);
    };
    img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
  });
}

/**
 * Compare two face embeddings
 * Returns similarity score (0-1, higher is more similar)
 */
export function compareFaces(embedding1: Float32Array, embedding2: Float32Array): number {
  if (!faceapi) return 0;

  // Euclidean distance - lower is more similar
  const distance = faceapi.euclideanDistance(embedding1, embedding2);

  // Convert to similarity (0-1 scale)
  // Distance < 0.6 is typically considered a match
  const similarity = Math.max(0, 1 - distance);

  return similarity;
}

/**
 * Check if embedding matches any enrolled face
 * Returns the best match if found
 */
export function findBestMatch(
  queryEmbedding: Float32Array,
  enrolledFaces: Array<{ employee_id: number; employee_name: string; embedding: number[] }>,
  threshold: number = 0.5
): { employee_id: number; employee_name: string; similarity: number } | null {
  if (!faceapi || enrolledFaces.length === 0) return null;

  let bestMatch: { employee_id: number; employee_name: string; similarity: number } | null = null;

  for (const face of enrolledFaces) {
    const storedEmbedding = new Float32Array(face.embedding);
    const similarity = compareFaces(queryEmbedding, storedEmbedding);

    if (similarity >= threshold) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = {
          employee_id: face.employee_id,
          employee_name: face.employee_name,
          similarity,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Serialize embedding for storage
 */
export function serializeEmbedding(embedding: Float32Array): number[] {
  return Array.from(embedding);
}

/**
 * Deserialize embedding from storage
 */
export function deserializeEmbedding(data: number[]): Float32Array {
  return new Float32Array(data);
}

/**
 * Draw face detection box on canvas
 */
export async function drawFaceDetection(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement
): Promise<boolean> {
  if (!faceapi || !modelsLoaded) {
    await loadModels();
    if (!faceapi) return false;
  }

  const detection = await faceapi
    .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks();

  const ctx = canvas.getContext('2d');
  if (!ctx || !detection) return false;

  // Clear previous drawings
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw detection box
  const dims = faceapi.matchDimensions(canvas, video, true);
  const resizedDetection = faceapi.resizeResults(detection, dims);

  // Draw face box
  const box = resizedDetection.detection.box;
  ctx.strokeStyle = '#00ff00';
  ctx.lineWidth = 3;
  ctx.strokeRect(box.x, box.y, box.width, box.height);

  return true;
}

export { faceapi };
