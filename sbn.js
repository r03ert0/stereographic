/*
    Depends on:
    linalg.js
*/

var verbose = false;

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
    let x, xy;

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
            a = w.c[2*k + 0];
            length = Math.acos(dot3D(p, q));                                       if(verbose>1) console.log(`length: ${length}`);
            b = length*w.c[2*k + 1];                                               if(verbose>1) console.log(`a, b: ${a}, ${b}`);
            xy = [b*Math.cos(a), b*Math.sin(a)];                                   if(verbose>1) console.log(`xy: ${xy[0]}, ${xy[1]}`);
            x0 = stereographic2sphere(xy);                                         if(verbose>1) console.log(`x0: ${tmp[0]}, ${tmp[1]}, ${tmp[2]}`);
            x0 = add3D(add3D(sca3D(q1, x0[0]), sca3D(r, x0[1])), sca3D(p, x0[2])); if(verbose>1) console.log(`x0: ${x0[0]}, ${x0[1]}, ${x0[2]}`);
            tmp = add3D(tmp, sca3D(x0, w.w[k]));
            sumw += w.w[k];
            k++;
        }
    }
    x = direction(sca3D(tmp, 1/sumw));

    if(verbose>1) console.log(`Total number of weights applied: ${k}`);

    return x;
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
    let a, b, c;
    let fa, fb, t;
    let p, q, r, q1;
    let tmp;
    let w = {};

    a = 0.5;  // if a = 0, there's no influence of line length on the weights
    b = 0.01; // a small number to ensure that the weights are defined even over the line
    c = 2;    // a value that determines how quickly the influence of a line decreases with distance

    // count total number of segments that will be used for morphing
    k = 0;
    for(i = 0; i<l.length; i++) {
        k += l[i].p.length-1;
    }
    if(verbose>1) console.log(`Total number of segments used for morphing: ${k}`);
    w.w = new Float32Array(k);
    w.c = new Float32Array(2*k);

    k = 0;
    for(i = 0; i<maxnl/*l->nlines*/; i++) {
        for(j = 0; j<l[i].p.length-1; j++) {
            p = stereographic2sphere(l[i].p[j]);                          if(verbose>1) console.log(`p: ${p[0]}, ${p[1]}, ${p[2]}`);
            q = stereographic2sphere(l[i].p[j + 1]);                      if(verbose>1) console.log(`q: ${q[0]}, ${q[1]}, ${q[2]}`);
            r = cross3D(p, q);
            r = sca3D(r, 1/norm3D(r));                                    if(verbose>1) console.log(`r: ${r[0]}, ${r[1]}, ${r[2]}`);
            q1 = cross3D(r, p);                                           if(verbose>1) console.log(`q1: ${q1[0]}, ${q1[1]}, ${q1[2]}`);
            // coordinates
            w.c[2*k + 0] = Math.atan2(dot3D(x, r), dot3D(x, q1));
            w.c[2*k + 1] = Math.acos(dot3D(x, p))/Math.acos(dot3D(p, q)); if(verbose>1) console.log(`c: ${w.c[2*i + 0]}, ${w.c[2*i + 1]}`);
            // weight
            length = Math.acos(dot3D(p, q));                              if(verbose>1) console.log(`length: ${length}`);
            fa = Math.pow(length, a);
            // transformed coordinate
            t = Math.acos(dot3D(p, x))/(Math.acos(dot3D(p, x)) + Math.acos(dot3D(q, x)));
            tmp = add3D(sca3D(p, 1-t), sca3D(q, t));
            fb = b + 10*Math.min(Math.min(Math.acos(dot3D(p, x)), Math.acos(dot3D(q, x))), Math.acos(dot3D(tmp, x)));
            w.w[k] = Math.pow(fa/fb, c);                                  if(verbose>1) console.log(`w: ${w.w[i]}`);
    //        console.log("sx:%g sy:%g tx:%g ty:%g px:%g py:%g pz:%g qx:%g qy:%g qz:%g x:%g y:%g fa:%g t:%g fb:%g w:%g; ", l[i][j][0], l[i][j][1], l[i][j + 1][0], l[i][j + 1][1], p[0], p[1], p[2], q[0], q[1], q[2], w->c[k][0], w->c[k][1], fa, t, fb, w->w[k]);
            k++;
        }
    }
//    console.log("\n");
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
    let slength; // segment length
    let s, t, d, g;
    let i, j;
    let p1, p2, px;
    let spx = [];

    //console.log("nsegments: %i, npoints: %i\n", nseg, l->npoints);

    // compute the total length of the line and the length of each segment
    // in the resampled line ( = total/nseg)
    tlength = 0;
    for(i = 0; i<l.p.length-1; i++) {
        p1 = stereographic2sphere(l.p[i]);
        p2 = stereographic2sphere(l.p[i + 1]);
        tlength += norm3D(sub3D(p1, p2));
    }
    slength = tlength/nseg;
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
        console.log(`EEEEERRRRROOOOORRRRR!!!! ${l.p.length}, ${nseg + 1}`);
    }
    //console.log("\n-----------------------------------------\n");
    l.p.length = nseg + 1;
    for(i = 0; i<nseg + 1; i++) {
        l.p[i][0] = spx[i][0];
        l.p[i][1] = spx[i][1];
        //console.log("%g, %g ", spx[i][0], spx[i][1]);
    }

    return 0;
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
    let x1 = [b*Math.cos(a), b*Math.sin(a)];

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
    let b, z, f;
    let x1 = [];
    b = Math.sqrt(x0[0]*x0[0] + x0[1]*x0[1]); if(verbose>1) console.log(`b: ${b}`);
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
    let found = 0;

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
    let {l1, l2} = linesets;
    let ltmp = [];
    let i, j;
    let found;
    var keep = [];
    let swap;

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
    let d = 0.1;
    let w ={};
    let x1;
    let x2;
    let mi = [], ma = [];
    let i, j, k, nl;
    let m;
    let sph2 = [];

    // check line pairing
    nl = pairLines({l1, l2});

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

    console.log(`Morphing ${sph.length} vertices`);
    for(j = 0; j<sph.length; j++) {
        if(verbose) {
            if(j%1000 === 0 ) console.time('1000 vertices');
            if((j+1)%1000 === 0 ) console.timeEnd('1000 vertices');
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