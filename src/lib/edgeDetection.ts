export interface Point {
  x: number;
  y: number;
}

export interface PathComponent {
  id: string;
  paths: Point[][];
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: { x: number; y: number };
}

export interface EdgeDetectionResult {
  rawPaths: Point[][];
  components: PathComponent[];
}

export function detectEdgesAndExtractPaths(
  imageData: ImageData,
  pathDensity: number = 20,
  blurRadius: number = 2,
  mode: 'edge' | 'skeleton' = 'edge',
  sensitivity: number = 50
): EdgeDetectionResult {
  const width = imageData.width;
  const height = imageData.height;
  const data = imageData.data;

  const binary = new Uint8Array(width * height);
  const edges = new Float32Array(width * height);
  let threshold = 0;

  if (mode === 'skeleton') {
    let hasAlpha = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] < 255) { hasAlpha = true; break; }
    }
    
    let isDarkBackground = false;
    if (!hasAlpha) {
      let lumSum = 0;
      const samples = [0, width - 1, (height - 1) * width, (height - 1) * width + width - 1];
      samples.forEach(idx => {
        const i = idx * 4;
        lumSum += 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      });
      isDarkBackground = (lumSum / 4) < 128;
    }
    
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const i = idx * 4;
        if (hasAlpha) {
          binary[idx] = data[i + 3] > (100 - sensitivity) * 2.55 ? 1 : 0;
        } else {
          const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const lumaThreshLightBg = sensitivity * 2.55;
          const lumaThreshDarkBg = 255 - (sensitivity * 2.55);
          binary[idx] = (isDarkBackground ? lum > lumaThreshDarkBg : lum < lumaThreshLightBg) ? 1 : 0;
        }
      }
    }
    
    // Zhang-Suen Thinning
    let changed = true;
    const marker = new Uint8Array(width * height);
    const getP = (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return binary[y * width + x];
    };
    
    while (changed) {
      changed = false;
      // Step 1
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (binary[y * width + x] === 1) {
            let p2 = getP(x, y - 1);
            let p3 = getP(x + 1, y - 1);
            let p4 = getP(x + 1, y);
            let p5 = getP(x + 1, y + 1);
            let p6 = getP(x, y + 1);
            let p7 = getP(x - 1, y + 1);
            let p8 = getP(x - 1, y);
            let p9 = getP(x - 1, y - 1);
            
            let A = (p2 == 0 && p3 == 1 ? 1 : 0) + (p3 == 0 && p4 == 1 ? 1 : 0) + 
                    (p4 == 0 && p5 == 1 ? 1 : 0) + (p5 == 0 && p6 == 1 ? 1 : 0) + 
                    (p6 == 0 && p7 == 1 ? 1 : 0) + (p7 == 0 && p8 == 1 ? 1 : 0) + 
                    (p8 == 0 && p9 == 1 ? 1 : 0) + (p9 == 0 && p2 == 1 ? 1 : 0);
            let B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            let m1 = p2 * p4 * p6;
            let m2 = p4 * p6 * p8;
            
            if (A === 1 && (B >= 2 && B <= 6) && m1 === 0 && m2 === 0) {
              marker[y * width + x] = 1;
              changed = true;
            }
          }
        }
      }
      for (let i = 0; i < binary.length; i++) {
        if (marker[i] === 1) {
          binary[i] = 0;
          marker[i] = 0;
        }
      }
      // Step 2
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          if (binary[y * width + x] === 1) {
            let p2 = getP(x, y - 1);
            let p3 = getP(x + 1, y - 1);
            let p4 = getP(x + 1, y);
            let p5 = getP(x + 1, y + 1);
            let p6 = getP(x, y + 1);
            let p7 = getP(x - 1, y + 1);
            let p8 = getP(x - 1, y);
            let p9 = getP(x - 1, y - 1);
            
            let A = (p2 == 0 && p3 == 1 ? 1 : 0) + (p3 == 0 && p4 == 1 ? 1 : 0) + 
                    (p4 == 0 && p5 == 1 ? 1 : 0) + (p5 == 0 && p6 == 1 ? 1 : 0) + 
                    (p6 == 0 && p7 == 1 ? 1 : 0) + (p7 == 0 && p8 == 1 ? 1 : 0) + 
                    (p8 == 0 && p9 == 1 ? 1 : 0) + (p9 == 0 && p2 == 1 ? 1 : 0);
            let B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9;
            let m1 = p2 * p4 * p8;
            let m2 = p2 * p6 * p8;
            
            if (A === 1 && (B >= 2 && B <= 6) && m1 === 0 && m2 === 0) {
              marker[y * width + x] = 1;
              changed = true;
            }
          }
        }
      }
      for (let i = 0; i < binary.length; i++) {
        if (marker[i] === 1) {
          binary[i] = 0;
          marker[i] = 0;
        }
      }
    }
    
    // In skeleton mode, edges is just the binary array, threshold is 0
    for(let i=0; i<binary.length; i++) edges[i] = binary[i];
    threshold = 0;

  } else {
    // 1. Grayscale & simple blur
    const gray = new Float32Array(width * height);
    for (let i = 0; i < data.length; i += 4) {
      gray[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    }

    const blurred = new Float32Array(width * height);
    for (let y = blurRadius; y < height - blurRadius; y++) {
      for (let x = blurRadius; x < width - blurRadius; x++) {
        let sum = 0;
        let count = 0;
        for (let dy = -blurRadius; dy <= blurRadius; dy++) {
          for (let dx = -blurRadius; dx <= blurRadius; dx++) {
            sum += gray[(y + dy) * width + (x + dx)];
            count++;
          }
        }
        blurred[y * width + x] = sum / count;
      }
    }

    // 2. Sobel Edge Detection
    let maxGradient = 0;
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const p00 = blurred[(y - 1) * width + (x - 1)];
        const p01 = blurred[(y - 1) * width + x];
        const p02 = blurred[(y - 1) * width + (x + 1)];
        const p10 = blurred[y * width + (x - 1)];
        const p12 = blurred[y * width + (x + 1)];
        const p20 = blurred[(y + 1) * width + (x - 1)];
        const p21 = blurred[(y + 1) * width + x];
        const p22 = blurred[(y + 1) * width + (x + 1)];

        const gx = -1 * p00 + 1 * p02 - 2 * p10 + 2 * p12 - 1 * p20 + 1 * p22;
        const gy = -1 * p00 - 2 * p01 - 1 * p02 + 1 * p20 + 2 * p21 + 1 * p22;
        
        const magnitude = Math.sqrt(gx * gx + gy * gy);
        edges[y * width + x] = magnitude;
        if (magnitude > maxGradient) maxGradient = magnitude;
      }
    }
    threshold = maxGradient * (1 - (sensitivity / 100)) * 0.3;
  }

  // 3. Extract paths
  const visited = new Uint8Array(width * height);
  const rawPaths: Point[][] = [];

  const tracePath = (startX: number, startY: number): Point[] => {
    const path: Point[] = [];
    let cx = startX;
    let cy = startY;

    while (true) {
      path.push({ x: cx, y: cy });
      visited[cy * width + cx] = 1;

      let bestX = -1;
      let bestY = -1;
      let maxG = 0;

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
          
          const idx = ny * width + nx;
          if (!visited[idx] && edges[idx] > threshold) {
            // In skeleton mode we don't care about gradient strength as much
            // But we can prefer the strongest edge if available
            if (mode === 'skeleton' || edges[idx] > maxG) {
              maxG = mode === 'skeleton' ? 1 : edges[idx];
              bestX = nx;
              bestY = ny;
            }
          }
        }
      }

      if (bestX !== -1) {
        cx = bestX;
        cy = bestY;
      } else {
        break;
      }
    }
    return path;
  };

  const step = mode === 'skeleton' ? 1 : pathDensity;
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const idx = y * width + x;
      if (!visited[idx] && edges[idx] > threshold) {
        // Find end of a stroke if doing skeleton to avoid splitting strokes
        let startX = x, startY = y;
        if (mode === 'skeleton') {
           // simple check for endpoints (only 1 neighbor)
           const getNeighbors = (cx: number, cy: number) => {
              let c = 0;
              for(let dy=-1; dy<=1; dy++) {
                 for(let dx=-1; dx<=1; dx++) {
                    if(dx===0 && dy===0) continue;
                    let nx = cx+dx, ny = cy+dy;
                    if(nx>=0 && nx<width && ny>=0 && ny<height) {
                       if(edges[ny*width+nx] > threshold && !visited[ny*width+nx]) c++;
                    }
                 }
              }
              return c;
           };
           if (getNeighbors(x, y) > 1) {
               // Try to find a better endpoint nearby just superficially
               for (let r = 1; r < 5; r++) {
                   let found = false;
                   for(let dy=-r; dy<=r; dy++) {
                       for(let dx=-r; dx<=r; dx++) {
                           let nx = x+dx, ny = y+dy;
                           if(nx>=0 && nx<width && ny>=0 && ny<height) {
                               if (edges[ny*width+nx] > threshold && !visited[ny*width+nx]) {
                                   if (getNeighbors(nx, ny) === 1) {
                                       startX = nx; startY = ny; found = true; break;
                                   }
                               }
                           }
                       }
                       if (found) break;
                   }
                   if (found) break;
               }
           }
        }
        
        const path = tracePath(startX, startY);
        if (path.length > (mode === 'skeleton' ? 2 : 5)) {
          rawPaths.push(path);
        }
      }
    }
  }

  // 4. Cluster paths into "Elements" based on bounding box overlaps / proximity
  // For simplicity, we can use a basic grid-based clustering or bounding box inflation
  const components: PathComponent[] = [];
  
  // Create initial components (each path is a component)
  const initialComponents = rawPaths.map(path => {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    let sumX = 0, sumY = 0;
    path.forEach(p => {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
      sumX += p.x;
      sumY += p.y;
    });
    return {
      paths: [path],
      bounds: { minX, minY, maxX, maxY },
      centroid: { x: sumX / path.length, y: sumY / path.length }
    };
  });

  // Merge components that are close to each other
  const MERGE_THRESHOLD = Math.max(50, width * 0.05); // Adjust threshold as needed
  
  const merged = Array.from(initialComponents);
  let changedParams = true;
  while (changedParams) {
    changedParams = false;
    for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const c1 = merged[i];
        const c2 = merged[j];
        
        // Check if bounds expanded by threshold overlap
        const overlap = !(
          c1.bounds.maxX + MERGE_THRESHOLD < c2.bounds.minX - MERGE_THRESHOLD ||
          c1.bounds.minX - MERGE_THRESHOLD > c2.bounds.maxX + MERGE_THRESHOLD ||
          c1.bounds.maxY + MERGE_THRESHOLD < c2.bounds.minY - MERGE_THRESHOLD ||
          c1.bounds.minY - MERGE_THRESHOLD > c2.bounds.maxY + MERGE_THRESHOLD
        );

        if (overlap) {
          // Merge c2 into c1
          c1.paths.push(...c2.paths);
          c1.bounds.minX = Math.min(c1.bounds.minX, c2.bounds.minX);
          c1.bounds.minY = Math.min(c1.bounds.minY, c2.bounds.minY);
          c1.bounds.maxX = Math.max(c1.bounds.maxX, c2.bounds.maxX);
          c1.bounds.maxY = Math.max(c1.bounds.maxY, c2.bounds.maxY);
          
          let sumX = 0, sumY = 0, count = 0;
          c1.paths.forEach(path => path.forEach(p => { sumX += p.x; sumY += p.y; count++; }));
          c1.centroid = { x: sumX / count, y: sumY / count };

          merged.splice(j, 1);
          changedParams = true;
          break; // restart inner loop
        }
      }
      if (changedParams) break; // restart outer loop
    }
  }

  // Sort components loosely from top-left to bottom-right
  merged.sort((a, b) => {
    return (a.centroid.y + a.centroid.x) - (b.centroid.y + b.centroid.x);
  });

  return {
    rawPaths,
    components: merged.map((c, i) => ({
      id: `element-${i + 1}`,
      ...c
    }))
  };
}
