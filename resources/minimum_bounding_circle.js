/*
    Depends on:
    linalg.js
*/

/**
 * @desc Check if to spheres intersect
 * @param sph1 array [cx, cy, cz, r]
 * @param sph2 array [cx, cy, cz, r]
 * @returnValue binary True if they intersect
 */
function testSphereIntersection(sph1, sph2) {
    let d = norm3D(sub3D(sph1, sph2));
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
    let bbox = {
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
    let dotABAB = dot3D(sub3D(b, a), sub3D(b, a));
    let dotABAC = dot3D(sub3D(b, a), sub3D(c, a));
    let dotACAC = dot3D(sub3D(c, a), sub3D(c, a));
    let d = 2.0*(dotABAB*dotACAC - dotABAC*dotABAC);
    let referencePt = a;
    let circle = {};
    if (Math.abs(d) <= EPSILON) {
        // a, b, and c lie on a line. Circle center is center of AABB of the
        // points, and radius is distance from circle center to AABB corner
        let bbox = computeAABB(a, b, c);
        circle.c = sca3D(add3D(bbox.min, bbox.max), 0.5);
        referencePt = bbox.min;
    } else {
        let s = (dotABAB*dotACAC - dotACAC*dotABAC) / d;
        let t = (dotACAC*dotABAB - dotABAB*dotABAC) / d;
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
