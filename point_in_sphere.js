/*
    Depends on:
    minimum_bounding_circle.js
    intersect_vector_triangle.js
    linalg.js
*/

var sphereHash = [];
var sphereHashCellSize = Math.PI/Math.round(Math.PI/0.05); // the cell size will determine the size and resolution of the sphere hash

function setSphereHashCellSize(h) {
    sphereHashCellSize = h;
    sphereHash = [];
}
/**
 * @function sameSide
 * @desc Check that all points of the triangle t1 are on the same side of the triangle t0
 *   after mapping to barycentric coordinates. From https://stackoverflow.com/questions/2778240/detection-of-triangle-collision-in-2d-space
 * @param t0 array 3x2 matrix where each row represents the x, y coordinates of the 1st
 *   triangle
 * @param t1 array 3x2 matrix where each row represents the x, y coordinates of the 2nd
 *   triangle
 * @returnValue boolean True if all points are outside on the same side
 */
function sameSide(t0, t1) {
  var pa = t0.a;
  var pb = t0.b;
  var pc = t0.c;
  var p0 = t1.a;
  var p1 = t1.b;
  var p2 = t1.c;
  var dXa = pa.x - p2.x;
  var dYa = pa.y - p2.y;
  var dXb = pb.x - p2.x;
  var dYb = pb.y - p2.y;
  var dXc = pc.x - p2.x;
  var dYc = pc.y - p2.y;
  var dX21 = p2.x - p1.x;
  var dY12 = p1.y - p2.y;
  var D = dY12 * (p0.x - p2.x) + dX21 * (p0.y - p2.y);
  var sa = dY12 * dXa + dX21 * dYa;
  var sb = dY12 * dXb + dX21 * dYb;
  var sc = dY12 * dXc + dX21 * dYc;
  var ta = (p2.y - p0.y) * dXa + (p0.x - p2.x) * dYa;
  var tb = (p2.y - p0.y) * dXb + (p0.x - p2.x) * dYb;
  var tc = (p2.y - p0.y) * dXc + (p0.x - p2.x) * dYc;
  if (D < 0) return ((sa >= 0 && sb >= 0 && sc >= 0) ||
                     (ta >= 0 && tb >= 0 && tc >= 0) ||
                     (sa+ta <= D && sb+tb <= D && sc+tc <= D));
  return ((sa <= 0 && sb <= 0 && sc <= 0) ||
          (ta <= 0 && tb <= 0 && tc <= 0) ||
          (sa+ta >= D && sb+tb >= D && sc+tc >= D));
}
function trianglesIntersect(t0, t1) {
  return !(sameSide(t0, t1) || sameSide(t1, t0));
}

/**
 * @desc Barycentric coordinates u, v, w, such that p = ua + vb + wc
 */
function barycentric(p, a, b, c) {
    var v0=sub3D(b,a),v1=sub3D(c,a),v2=sub3D(p,a);
    var d00 = dot3D(v0, v0);
    var d01 = dot3D(v0, v1);
    var d11 = dot3D(v1, v1);
    var d20 = dot3D(v2, v0);
    var d21 = dot3D(v2, v1);
    var denom = d00 * d11 - d01 * d01;
    var v = (d11 * d20 - d01 * d21) / denom;
    var w = (d00 * d21 - d01 * d20) / denom;
    var u = 1 - v - w;

    return [u, v, w];
}

function pointInTriangle(p, a, b, c) {
    const [u, v, w] = barycentric(p, a, b, c);
    if(u<0 || v<0 || w<0 || (u + v + w) > 1) {
        return false;
    }

    return true;
}

function boundingBox(coords) {
    let min = [], max = [];

    min[0] = Math.min(...coords.map((o) => o[0]));
    min[1] = Math.min(...coords.map((o) => o[1]));
    min[2] = Math.min(...coords.map((o) => o[2]));
    max[0] = Math.max(...coords.map((o) => o[0]));
    max[1] = Math.max(...coords.map((o) => o[1]));
    max[2] = Math.max(...coords.map((o) => o[2]));

    return [...min, ...max];
}

function findClosestVertex(p, coords) {
    let d, i, imin, min;
    imin = 0;
    min = norm3D(sub3D(p, coords[0]));
    for(i=0;i<coords.length;i++) {
        d = norm3D(sub3D(p, coords[i]));
        if(d<min) {
            min = d;
            imin = i;
        }
    }
    if(verbose) {
        console.log('closest vertex:', imin);
    }
    return imin;
}
function findTriangleContainingVertexIndex(ip, t) {
    let i, res = [];
    for(i=0;i<t.length;i++) {
        if(t[i][0]===ip||t[i][1]===ip||t[i][2]===ip) {
            res.push(i);
        }
    }
    return res;
}
function convertVertexIndicesToVertexArray(t, coords) {
    return t.map((o) => coords[o]);
}
function centre(coords) {
    let bbx = boundingBox(coords);
    let i;
    for(i=0;i<coords.length;i++) {
        coords[i][0] -= (bbx[0]+bbx[3])/2;
        coords[i][1] -= (bbx[1]+bbx[4])/2;
        coords[i][2] -= (bbx[2]+bbx[5])/2;
    }
}

/**
 * @function sphere2sinusoidal
 * @desc Gets sinusoidal coordinates from the Euclidean coordinates of a point over
 *   the unitary sphere. This is not exactly equivalent to the standard sinusoidal
 *   projection, because the left side of the map is made to be straight.
 * @param p array Vector with the x, y, z Euclidean coordinates of a point over the
 *   unitary sphere
 * @returnValue array Vector with the meridian and parallel coordinates on the sinusoidal
 *   projection.
 */
function sphere2sinusoidal(p) {
    let a, b;
//    a = Math.PI * Math.sqrt(1-p[2]*p[2]) + Math.atan2(p[1], p[0]); // meridian
    a = Math.sqrt(1-p[2]*p[2]) * (Math.PI + Math.atan2(p[1], p[0])); // meridian
    b = Math.asin(p[2]) + Math.PI/2; // parallel

    return [a, b];
}

function sinusoidal2sphere(c) {
    let [a, b] = c;
    let p2 = Math.sin(b - Math.PI/2); // p2 = sin(elevation angle)
    let ang;
    let cos =  Math.sqrt(1-p2*p2);
    if(cos < EPSILON) {
        ang = 0;
    } else {
        ang = a/cos - Math.PI;
    }
    let p1 = cos * Math.sin(ang);
    let p0 = cos * Math.cos(ang);

    return [p0, p1, p2];
}

/**
 * @function computeSphereHash(sph)
 * @desc Given a sphere compute a hash table to quickly find the triangles that tile
 *   a particular region in space. The has is a sinusoidal unfolding of the sphere,
 *   where the parallel direction is uniformely sampled, and the meridian direction is
 *   sampled proportionally to the perimeter of the disc resulting from the intersection
 *   of the sphere and a specific parallel plane.
 * @param sph object An triangulated sphere containing an array of vertices and an array
 *   of triangles.
 * @returnValue none The function result is stored in the global variable sphereHash
 */
function computeSphereHash(sph) {
    let a, b, i;
    let n, p;
    let h, h0, h1, max, max0, max1, ncells;
    const sqrt2 = 1.5;// Math.sqrt(2);
    const ah = sphereHashCellSize;
    const pi2 = 2*Math.PI;
    let s1, s2;

    n = 0;
    sphereHash = [];
    for(b=0;b<Math.round(Math.PI/ah); b++) {
        max0 = pi2*Math.sin(b*ah);
        max = pi2*Math.sin((b+0.5)*ah);
        max1 = pi2*Math.sin((b+1)*ah);
        // number of cells for the parallel band
        ncells = Math.round(max/ah);
        // lower and upper hash cell size
        h0 = max0/ncells;
        h1 = max1/ncells;
        // add meridian cells
        sphereHash[b]=[];
        for(a = 0; a < ncells; a++) {
            sphereHash[b][a] = new Set();
//            sphereHash[b][a] = '.';
            n++;
        }
    }
    console.log(`The sphere hash has ${n} cells`);

    let spheres = [];
    for(b=0;b<Math.round(Math.PI/ah); b++) {
        spheres[b] = [];
        max0 = pi2*Math.sin(b*ah);
        max = pi2*Math.sin((b+0.5)*ah);
        max1 = pi2*Math.sin((b+1)*ah);
        ncells = Math.round(max/ah);
        h0 = max0/ncells;
        h1 = max1/ncells;
        h = Math.max(h0, h1);
        for(a = 0; a < ncells; a++) {
            spheres[b][a] = [...sinusoidal2sphere([(a+0.5)*max/ncells,(b+0.5)*ah]), sqrt2*h];
        }
    }

    for(i=0;i<sph.t.length;i++) {
        s1 = minimumBoundingCircle(...(sph.t[i].map((o)=>sph.p[o])));
        for(b=0;b<Math.round(Math.PI/ah); b++) {
            max = pi2*Math.sin((b+0.5)*ah);
            ncells = Math.round(max/ah);
            for(a = 0; a < ncells; a++) {
                s2 = spheres[b][a];
                if(norm3D(sub3D(s1, s2)) < s1[3] + s2[3]) {
                    sphereHash[b][a].add(i);
                }
            }
        }
//        console.log(sphereHash.map((o)=>o.join('')).join('\n'));
    }
}

/**
 * @function pointInSphere
 * @desc Gives barycentric coordinates of point p relative to the triangle in
 *   the sphere sph that it intersects
 * @param p array A point over the sphere
 * @param sph object A triangulated sphere. The sph object contains an array of
 *   vertices and an array of triangles
 * @returnValue object An object containing the index of the triangle in sph that
 *   contains the point p, and its barycentric coordinates.
 */
function pointInSphere(p, sph) {
    const ah = sphereHashCellSize;
    let result;

    // 1. Using the spherical Hash
    // if there's no sphere hash computed, compute one
    if(sphereHash.length === 0) {
        console.log('Sphere hash is not computed. Computing it now');
        computeSphereHash(sph);
    }
    let [a, b] = sphere2sinusoidal(p);
    //parallel band index
    const ib = (b/ah)|0;
    // number of meridian cells
    const ncells = Math.round(2*Math.PI*Math.cos(b+ah/2-Math.PI/2)/ah);
    // average meridian cell size
    const h = 2*Math.PI*Math.cos(b+ah/2-Math.PI/2)/ncells;
    // meridian index
    const ia = (a/h)|0;
    let tlist = sphereHash[ib][ia];

    // 2. Looking at the closest destination vertex
    if( typeof tlist === 'undefined' ) {
        if(verbose) {
            console.log(`ERROR: empty hash. Point ${p}. Hash a,b coordinates: ${ia}, ${ib}. Going bruteforce [1]`);
        }
        let pind = findClosestVertex(p, sph.p);
        tlist = findTriangleContainingVertexIndex(pind, sph.t);
    }

    for(t of tlist) {
        const c = intersectVectorTriangle(p, sph.t[t].map((o)=>sph.p[o]));
        if(c.case === 1) {
            result = [t, c.u, c.v];
            break;
        }
    }

    // 3. Looking at all triangles
    if(typeof result === 'undefined') {
        if(verbose) {
            console.log(`ERROR: no triangle for point ${p} in the hash. Going bruteforce [2]`);
        }
        for(t=0;t<sph.t.length;t++) {
            if(dot3D(p, sph.p[sph.t[t][0]])>0.9) {
                const c = intersectVectorTriangle(p, sph.t[t].map((o)=>sph.p[o]));
                if(c.case === 1) {
                    result = [t, c.u, c.v];
                    break;
                }
            }
        }
    }

    return result;
}