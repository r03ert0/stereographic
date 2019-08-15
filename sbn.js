/*
    Depends on:
    linalg.js
*/

var verbose = false;

var sphereHash = [];
var sphereHashCellSize = Math.PI/Math.round(Math.PI/0.05); // the cell size will determine the size and resolution of the sphere hash

function setSphereHashCellSize(h) {
    sphereHashCellSize = h;
    sphereHash = [];
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
    if(verbose>1) {
        console.log('closest vertex:', imin);
    }
    return imin;
}

function findTriangleContainingVertexIndex(ip, t) {
    let i;
    const res = [];
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
//    a = Math.PI * Math.sqrt(1-p[2]*p[2]) + Math.atan2(p[1], p[0]); // meridian
    const a = Math.sqrt(1-p[2]*p[2]) * (Math.PI + Math.atan2(p[1], p[0])); // meridian
    const b = Math.asin(p[2]) + Math.PI/2; // parallel

    return [a, b];
}

function sinusoidal2sphere(c) {
    const [a, b] = c;
    const p2 = Math.sin(b - Math.PI/2); // p2 = sin(elevation angle)
    let ang;
    const cos =  Math.sqrt(1-p2*p2);
    if(cos < EPSILON) {
        ang = 0;
    } else {
        ang = a/cos - Math.PI;
    }
    const p1 = cos * Math.sin(ang);
    const p0 = cos * Math.cos(ang);

    return [p0, p1, p2];
}

/**
  * @function sphere2stereographic
  * @desc Convert a 3D coordinate over the unitary sphere into a 2D stereographic coordinate
  * @param x0 array 3D coordinates over the sphere
  * @returnValue array 2D stereographic coordinates
  */
function sphere2stereographic(x0) {
    const a = Math.atan2(x0[1], x0[0]);
    const b = Math.acos(x0[2]/Math.sqrt(x0[0]*x0[0] + x0[1]*x0[1] + x0[2]*x0[2]));
    const x1 = [b*Math.cos(a), b*Math.sin(a)];

    return x1;
}

/**
  * @function stereographic2sphere
  * @desc Convert a 2D stereographic coordinate into a 3D coordinate over the unitary sphere
  * @param x0 array 2D stereographic coordinates
  * @returnValue array 3D coordinates over the sphere
  */
function stereographic2sphere(x0) {
    if(verbose>1) console.log("[stereographic2sphere]");
    let z, f;
    const x1 = [];
    const b = Math.sqrt(x0[0]*x0[0] + x0[1]*x0[1]); if(verbose>1) console.log(`b: ${b}`);
    if(b === 0) {
        x1[0] = 0;
        x1[1] = 0;
        x1[2] = 1;
    } else {
        z = Math.cos(b);       if(verbose>1) console.log(`z: ${z}`);
        f = Math.sqrt(1-z*z);  if(verbose>1) console.log(`f: ${f}`);
        x1[0] = x0[0]*f/b;     if(verbose>1) console.log(`x: ${x1[0]}`);
        x1[1] = x0[1]*f/b;     if(verbose>1) console.log(`y: ${x1[1]}`);
        x1[2] = z;
    }

    return x1;
}


/**
 * @desc Check if to spheres intersect
 * @param sph1 array [cx, cy, cz, r]
 * @param sph2 array [cx, cy, cz, r]
 * @returnValue binary True if they intersect
 */
function testSphereIntersection(sph1, sph2) {
    const d = norm3D(sub3D(sph1, sph2));
    if(d>sph1[3]+sph2[3]) {
        return false;
    } else {
        return true;
    }
}
/**
 * @desc compute bounding box
 */
function computeAABB(a, b, c) {
    const bbox = {
        min: [
            Math.min(a[0], b[0], c[0]),
            Math.min(a[1], b[1], c[1]),
            Math.min(a[2], b[2], c[2])
        ],
        max: [
            Math.max(a[0], b[0], c[0]),
            Math.max(a[1], b[1], c[1]),
            Math.max(a[2], b[2], c[2])
        ]
    }

    return bbox;
}

/**
 * @desc From http://realtimecollisiondetection.net/blog/?p=20
 * @param a array coordinates of the 1st vertex of the triangle
 * @param b array coordinates of the 2nd vertex of the triangle
 * @param c array coordinates of the 3rd vertex of the triangle
 */
function minimumBoundingCircle(a, b, c) {
    const dotABAB = dot3D(sub3D(b, a), sub3D(b, a));
    const dotABAC = dot3D(sub3D(b, a), sub3D(c, a));
    const dotACAC = dot3D(sub3D(c, a), sub3D(c, a));
    const d = 2.0*(dotABAB*dotACAC - dotABAC*dotABAC);
    let referencePt = a;
    const circle = {};
    if (Math.abs(d) <= EPSILON) {
        // a, b, and c lie on a line. Circle center is center of AABB of the
        // points, and radius is distance from circle center to AABB corner
        const bbox = computeAABB(a, b, c);
        circle.c = sca3D(add3D(bbox.min, bbox.max), 0.5);
        referencePt = bbox.min;
    } else {
        const s = (dotABAB*dotACAC - dotACAC*dotABAC) / d;
        const t = (dotACAC*dotABAB - dotABAB*dotABAC) / d;
        // s controls height over AC, t over AB, (1-s-t) over BC
        if (s <= 0.0) {
            circle.c = sca3D(add3D(a, c), 0.5);
        } else if (t <= 0.0) {
            circle.c = sca3D(add3D(a, b), 0.5);
        } else if (s + t >= 1.0) {
            circle.c = sca3D(add3D(b, c), 0.5);
            referencePt = b;
        } else {
            circle.c = add3D(add3D(a, sca3D(sub3D(b, a), s)), sca3D(sub3D(c, a), t));
        }
    }
    circle.r = Math.sqrt(dot3D(sub3D(circle.c, referencePt), sub3D(circle.c, referencePt)));

    return [...circle.c, circle.r];
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
    let n;
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

    // compute all the spheres
    const spheres = [];
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

/*
    // add two large spheres at the poles
    spheres[0][0] = [0,0,1,4*ah];
    spheres[Math.round(Math.PI/ah)-1][0] = [0,0,-1,4*ah];
*/

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
    console.log('Sphere hash computed.');
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
    let stat = 'h';

    // 1. Using the spherical Hash
    // if there's no sphere hash computed, compute one
    if(sphereHash.length === 0) {
        console.log('Sphere hash is not computed. Computing it now');
        computeSphereHash(sph);
    }
    const [a, b] = sphere2sinusoidal(p);
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
        if(verbose>1) {
            console.log(`ERROR: empty hash. Point ${p}. Hash a,b coordinates: ${ia}, ${ib}. Going bruteforce [1]`);
        }
        const pind = findClosestVertex(p, sph.p);
        tlist = findTriangleContainingVertexIndex(pind, sph.t);
        stat = 'v';
    }

    for(t of tlist) {
        const c = intersectVectorTriangle(p, sph.t[t].map((o)=>sph.p[o]));
        if(c.case === 1) {
            result = [t, c.u, c.v, stat];
            break;
        }
    }

    // 3. Looking at all triangles
    if(typeof result === 'undefined') {
        if(verbose>1) {
            console.log(`ERROR: no triangle for point ${p} in the hash. Going bruteforce [2]`);
        }
        for(t=0;t<sph.t.length;t++) {
            if(dot3D(p, sph.p[sph.t[t][0]])>0.9) {
                const c = intersectVectorTriangle(p, sph.t[t].map((o)=>sph.p[o]));
                if(c.case === 1) {
//                    console.log(p);
                    stat = 't';
                    result = [t, c.u, c.v, stat];
                    break;
                }
            }
        }
    }

    return result;
}


/**
 * @desc native geometry 2, on topology 1
 */
function resampleMesh(tr2, sphcoords2, native2, sphcoords1as2) {
    const native2as1 = [];
    let t, u, v;
    let n = 0;
    let nhash = 0, nverts = 0, ntris = 0;

    // if there's no sphere hash computed, compute one
    if(sphereHash.length === 0) {
        console.log('Sphere hash is not computed. Computing it now');
        console.time('sphere hash');
        computeSphereHash({p: sphcoords2, t: tr2});
        console.timeEnd('sphere hash');
    }

    // resample vertices
    console.log('resampling vertices');
    console.time('resampling');
    for(i=0; i<sphcoords1as2.length; i++) {
        const res = pointInSphere(
            sphcoords1as2[i],
            {p: sphcoords2, t: tr2}
        );
        if(typeof res !== 'undefined') {
            [t, u, v, stat] = res;
        } else {
            console.log(`ERROR: no triangle found for vertex ${i}`);
            n ++;
            continue;
        }
        const p = add3D(
            add3D(
                sca3D(native2[tr2[t][0]],1-u-v),
                sca3D(native2[tr2[t][1]],u)
            ),  sca3D(native2[tr2[t][2]],v));
        native2as1.push(p);
        switch(stat) {
            case 'h':
                nhash++;
                break;
            case 'v':
                nverts++;
                break;
            case 't':
                ntris++;
                break;
        }
    }
    console.timeEnd('resampling');
    console.log(`nhash: ${nhash}, nverts: ${nverts}, ntris: ${ntris}`);
    if(n) {
        console.log(`${n} vertices could not be resampled, ${(100*(n+1)/i)|0}% of the total`);
    }

    return native2as1;
}

/**
  * @function transform
  * @desc Given a lineset and a set of weights, compute new positions for the vertex x
  * @param l array Line set
  * @param w object weights
  * @param maxnl number Number of lines from line set l to use in the transformation
  * @returnValue array Transformed vertex x
  */
function transform(l, w, maxnl) {
    if(verbose>1) console.log("[transform]");
    let i, j, k;
    let p, q, r, q1;
    let tmp, x0;
    let sumw;
    let a, b, length;
    let xy;

    tmp = [0, 0, 0];
    sumw = 0;
    k = 0;
    for(i = 0; i<maxnl/*l->nlines*/; i++) {
        for(j = 0; j<l[i].p.length-1; j++) {
            p = stereographic2sphere(l[i].p[j]);                                   if(verbose>1) console.log(`p: ${p[0]}, ${p[1]}, ${p[2]}`);
            q = stereographic2sphere(l[i].p[j + 1]);                               if(verbose>1) console.log(`q: ${q[0]}, ${q[1]}, ${q[2]}`);
            r = cross3D(p, q);
            r = sca3D(r, 1/norm3D(r));                                             if(verbose>1) console.log(`r: ${r[0]}, ${r[1]}, ${r[2]}`);
            q1 = cross3D(r, p);                                                    if(verbose>1) console.log(`q1: ${q1[0]}, ${q1[1]}, ${q1[2]}`);
            length = Math.acos(dot3D(p, q));                                       if(verbose>1) console.log(`length: ${length}`);

            a = w.c[2*k + 0];
            b = length*w.c[2*k + 1];                                               if(verbose>1) console.log(`a, b: ${a}, ${b}`);
            xy = [b*Math.cos(a), b*Math.sin(a)];                                   if(verbose>1) console.log(`xy: ${xy[0]}, ${xy[1]}`);
            x0 = stereographic2sphere(xy);                                         if(verbose>1) console.log(`x0: ${tmp[0]}, ${tmp[1]}, ${tmp[2]}`);
            x0 = add3D(add3D(sca3D(q1, x0[0]), sca3D(r, x0[1])), sca3D(p, x0[2])); if(verbose>1) console.log(`x0: ${x0[0]}, ${x0[1]}, ${x0[2]}`);
            tmp = add3D(tmp, sca3D(x0, w.w[k]));
            sumw += w.w[k];
            k++;
        }
    }
    const x = direction(sca3D(tmp, 1/sumw));

    if(verbose>1) console.log(`Total number of weights applied: ${k}`);

    return x;
}

/**
  * @function prepareWeights
  * @desc Precompute intermediate variables necessary for computing weights
  * @param l array Line set
  * @param maxnl number Number of lines from the line set l to use to compute the weights w
  */
function prepareWeights(l, maxnl) {
    let i, j, k;
    let length;
    let fa, fb, t;
    let p, q, r, q1;
    let tmp;
    const w = {};

    const a = 0.5;  // if a = 0, there's no influence of line length on the weights
    const b = 0.01; // a small number to ensure that the weights are defined even over the line
    const c = 2;    // a value that determines how quickly the influence of a line decreases with distance

    // count total number of segments that will be used for morphing
    k = 0;
    for(i = 0; i<l.length; i++) {
        k += l[i].p.length-1;
    }
    if(verbose>1) console.log(`Total number of segments used for morphing: ${k}`);

    for(i = 0; i<maxnl; i++) {
        l[i].precomputed = [];
        for(j = 0; j<l[i].p.length-1; j++) {
            p = stereographic2sphere(l[i].p[j]);                          if(verbose>1) console.log(`p: ${p[0]}, ${p[1]}, ${p[2]}`);
            q = stereographic2sphere(l[i].p[j + 1]);                      if(verbose>1) console.log(`q: ${q[0]}, ${q[1]}, ${q[2]}`);
            r = cross3D(p, q);
            r = sca3D(r, 1/norm3D(r));                                    if(verbose>1) console.log(`r: ${r[0]}, ${r[1]}, ${r[2]}`);
            q1 = cross3D(r, p);                                           if(verbose>1) console.log(`q1: ${q1[0]}, ${q1[1]}, ${q1[2]}`);
            length = Math.acos(dot3D(p, q));                              if(verbose>1) console.log(`length: ${length}`);
            fa = Math.pow(length, a);
            l[i].precomputed[j] = {p, q, r, q1, length, fa};
        }
    }
}

/**
  * @function weights
  * @desc Given a line set and a vertex, compute weights using maxnl number of lines
  * @param l array Line set
  * @param x array vertex
  * @param maxnl number Number of lines from the line set l to use to compute the weights w
  * @returnValue object Weights
  */
function weights(l, x, maxnl) {
    if(verbose>1) console.log("[weights]");
    let i, j, k;
    let length;
    let fa, fb, t;
    let p, q, r, q1;
    let tmp, acosdotpx,acosdotqx;
    const w = {};

    const a = 0.5;  // if a = 0, there's no influence of line length on the weights
    const b = 0.01; // a small number to ensure that the weights are defined even over the line
    const c = 2;    // a value that determines how quickly the influence of a line decreases with distance

    // count total number of segments that will be used for morphing
    k = 0;
    for(i = 0; i<l.length; i++) {
        k += l[i].p.length-1;
    }
    if(verbose>1) console.log(`Total number of segments used for morphing: ${k}`);
    w.w = new Float32Array(k);
    w.c = new Float32Array(2*k);

    k = 0;
    for(i = 0; i<maxnl; i++) {
        for(j = 0; j<l[i].p.length-1; j++) {
           const {p, q, r, q1, length, fa} = l[i].precomputed[j];
           acosdotpx = Math.acos(Math.min(1,dot3D(p, x)));
           acosdotqx = Math.acos(Math.min(1,dot3D(q, x)));

            // coordinates
            w.c[2*k + 0] = Math.atan2(dot3D(x, r), dot3D(x, q1));
            w.c[2*k + 1] = acosdotpx/length;

            // weight
            // transformed coordinate
            t = acosdotpx/(acosdotpx + acosdotqx);
            tmp = add3D(sca3D(p, 1-t), sca3D(q, t));
            fb = b + 10*Math.min(Math.min(acosdotpx, acosdotqx), Math.acos(Math.min(1,dot3D(tmp, x))));
            w.w[k] = Math.pow(fa/fb, c);
            if(!w.w[k]) {
                console.log("Null weight for fa:", fa, "fb:", fb, "c:", c);
                console.log("b:",b,"acosdotpx:",acosdotpx,"q:",x,"x:",x,"tmp:",tmp);
                console.log("p:",p,"x:",x,"dot3D(p, x):",dot3D(p, x),"Math.acos(dot3D(p, x)):",Math.acos(dot3D(p, x)));
            }
            k++;
        }
    }
    if(verbose>1) console.log(`Total number of weights computed: ${k}`);

    return w;
}

function findLineWithName(l, name) {
    if(verbose>1) console.log("[findLineWithName]");
    let j;
    let found = 0;
    let result;

    for(j = 0; j<l.length; j++) {
        if(name === l[j].name) {
            found = 1;
            result = j;
            break;
        }
    }
    if(!found) {
        result = -1;
    }

    return result;
}

function resampleLine(l, nseg) {
    if(verbose>1) console.log("[resampleLine]");
    /*
        Resample the line into nseg equal-length segments
    */
    let tlength; // total length
    let s, t, d, g;
    let i, j;
    let p1, p2, px;
    const spx = [];

    //console.log("nsegments: %i, npoints: %i\n", nseg, l->npoints);

    // compute the total length of the line and the length of each segment
    // in the resampled line ( = total/nseg)
    tlength = 0;
    for(i = 0; i<l.p.length-1; i++) {
        p1 = stereographic2sphere(l.p[i]);
        p2 = stereographic2sphere(l.p[i + 1]);
        tlength += norm3D(sub3D(p1, p2));
    }
     // segment length
    const slength = tlength/nseg;
    //console.log("total length: %g\nsegment length: %g\n", tlength, slength);

    // resample the line
    for(i = 0; i<nseg + 1; i++) {
        s = slength*i;
        t = 0;
        for(j = 0; j<l.p.length-1; j++)
        {
            p1 = stereographic2sphere(l.p[j]);
            p2 = stereographic2sphere(l.p[j + 1]);
            d = norm3D(sub3D(p1, p2));
            //console.log("t:%g, s:%g, t + d:%g\n", t, s, t + d);
            if(t <= s && t + d >= s-1e-6) { // point is bracketed
                g = (s-t)/d;
                px = add3D(sca3D(p1, 1-g), sca3D(p2, g));
                px = sca3D(px, 1/norm3D(px));
                spx[i] = sphere2stereographic(px);

                //console.log("%g, %g, %g:%g, %g  ", px[0], px[1], px[2], spx[i][0], spx[i][1]);

                break;
            }
            t += d;
        }
    }

    // replace the points in the original line with the resampled ones
    if(l.p.length<nseg + 1) {
        console.log(`ERROR: ${l.p.length}, ${nseg + 1}`);
    }
    l.p.length = nseg + 1;
    for(i = 0; i<nseg + 1; i++) {
        l.p[i][0] = spx[i][0];
        l.p[i][1] = spx[i][1];
        //console.log("%g, %g ", spx[i][0], spx[i][1]);
    }

    return 0;
}

/**
  * @function resample
  * @desc Resample the linesets to have the same number of points
  *       1. for each pair of lines the number of segments has to be equal, so use the
  *          smaller number of segments
  *       2. adjust d to resample the lines into segments all of the same length
  * @param l1 array Line set 1
  * @param l2 array Line set 2
  * @param d number Maximum segment length for resampling
  * @returnValue none The line sets are resampled to have the same number of points
  */
function resample(l1, l2, d) {
    if(verbose) console.log("[resample]");
    let length1, length2;
    let p1, p2;
    let i, j, k, nseg, totseg = 0;

    for(i = 0; i<l1.length; i++) {
        length1 = 0;
        for(j = 0; j<l1[i].p.length-1; j++) {
            p1 = stereographic2sphere(l1[i].p[j]);
            p2 = stereographic2sphere(l1[i].p[j + 1]);
            length1 += norm3D(sub3D(p1, p2));
        }
        k = findLineWithName(l2, l1[i].name);
        length2 = 0;
        for(j = 0; j<l2[k].p.length-1; j++)
        {
            p1 = stereographic2sphere(l2[k].p[j]);
            p2 = stereographic2sphere(l2[k].p[j + 1]);
            length2 += norm3D(sub3D(p1, p2));
        }
        nseg = Math.max(1, Math.min(Math.round(length1/d), Math.round(length2/d)));
        nseg = Math.min(nseg, Math.min(l1[i].p.length-1, l2[k].p.length-1));
        if(verbose) console.log(`line ${l1[i].name}, ${nseg} segments`);

        resampleLine(l1[i], nseg);
        resampleLine(l2[k], nseg);
        totseg += nseg;
    }
    console.log(`Line sets resampled to ${totseg} points`);

    return 0;
}

/**
  * @function findLineWithName
  * @desc Find in lineset l the line with a given name
  * @param l1 array A Lineset
  * @param name string Name of the line to find
  * @returnValue number The index of the line found, undefined if not found
  */
function findLineWithName(l, name) {
    if(verbose>1) console.log("[findLineWithName]");
    let j;

    for(j = 0; j<l.length; j++) {
        if(name === l[j].name) {
            return j;
        }
    }

    return;
}

/**
 * @function pairLines
 * @desc Find same line names in two line sets
 * @param l1 object Line set 1
 * @param l2 object Line set 2
 * @returnValues number Number of line sets common to l1 and l2
 */
function pairLines(linesets) {
    if(verbose) console.log("[pairLines]");
    const {l1, l2} = linesets;
    const ltmp = [];
    let i, j;

    for(i = l1.length - 1; i>=0; i--) {
        if(verbose) {
            console.log(`Looking for ${l1[i].name} in line set 2`);
        }
        j = findLineWithName(l2, l1[i].name);
        if(typeof j === 'undefined') {
            //console.log(`Dropping line ${i}, '${l1[i].name}', which is in line set 1 but not in line set 2`);
            l1.splice(i, 1);
        } else {
            ltmp.unshift(l2[j]);
/*
            console.log(`Swapping line ${i} and line ${j} in line set 2 for '${l1[i].name}'`);
            swap = l2[i];
            l2[i] = l2[j];
            l2[j] = swap;
*/
        }
        //console.log("-------->l1", i);
        //console.log(JSON.stringify(l1.map((o,ind)=>ind+' '+o.name),' ',4));
        //console.log("-------->ltmp", i);
        //console.log(JSON.stringify(ltmp.map((o,ind)=>ind+' '+o.name),' ',4));
    }
    for(i=0;i<ltmp.length;i++) {
        l2[i] = ltmp[i];
    }
    l2.length = ltmp.length;

    return l1.length;
}

/**
 * @function sbn
 * @desc Morph one sphere into another based on landmarks using a spherical version of the Beier and Neely algorithm
 * @param l1 object Line set with landmarks in sphere 1
 * @param l2 object Line set with landmarks in sphere 2
 * @param sph array Vertices on sphere 1. The mesh has to have radius 1 and center at the origin
 * @param maxnl number [optional] Number of landmark pairs to use for the morphing
 * @returnValues object The vertices sph morphed into the space of sphere2
 */
function sbn(l1, l2, sph, maxnl) {
    const d = 0.1;
    let w ={};
    let x1;
    let x2;
    let j;
    const sph2 = [];

    // check line pairing
    const nl = pairLines({l1, l2});

    if(nl === 0) {
        console.log("ERROR: There are no lines in common between both sets");
    }

    if(maxnl > nl) {
        console.log(`There are ${nl} lines common to both line sets`);
        maxnl = nl;
    }

    if(typeof maxnl === 'undefined') {
        maxnl = nl;
    }
    console.log(`Deformation based on ${maxnl}/${nl} line pairs`);

    // resample the lines to have a homogeneous number of segments
    resample(l1, l2, d);

    console.log("[prepareWeights]");
    prepareWeights(l1, maxnl);

    console.log(`Morphing ${sph.length} vertices`);
    for(j = 0; j<sph.length; j++) {
        if(verbose) {
            if(j%1000 === 0 ) {
                console.time('1000 vertices');
            }
            if((j+1)%1000 === 0 ) {
                console.timeEnd('1000 vertices');
            }
        }

        x1 = sph[j];

        // 4. compute weights for x1 relative to set 1
        //console.log("%i. ", j);
        w = weights(l1, x1, maxnl);

        // 5. compute x2 = f(x1), applying the previous weights to line set 2
        x2 = transform(l2, w, maxnl);
        sph2[j] = x2;
    }

    return sph2;
}
