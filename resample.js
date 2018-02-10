/*
    Depends on:
    point_in_sphere.js
    intersect_vector_triangle.js
    minimum_bounding_circle.js
    linalg.js
*/

/**
 * @desc native geometry 2, on topology 1
 */
function resampleMesh(tr2, sphcoords2, native2, sphcoords1as2) {
    let native2as1 = [];
    let t, u, v;
    let n = 0;
    let nhash = 0, nverts = 0, ntris = 0;
//BROWSER_ONLY    let t0, t1;

    // if there's no sphere hash computed, compute one
    if(sphereHash.length === 0) {
        console.log('Sphere hash is not computed. Computing it now');
//BROWSER_ONLY        t0 = performance.now();
        computeSphereHash({p: sphcoords2, t: tr2});
//BROWSER_ONLY        t1 = performance.now();
//BROWSER_ONLY        console.log("Spherical hash computed in " + (t1 - t0)/1000 + " seconds.")
    }

//BROWSER_ONLY    t0 = performance.now();
    console.log('resampling vertices');
    for(i=0; i<sphcoords1as2.length; i++) {
        let res = pointInSphere(
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
    console.log(`nhash: ${nhash}, nverts: ${nverts}, ntris: ${ntris}`);
    if(n) {
        console.log(`${n} vertices could not be resampled, ${(100*(n+1)/i)|0}% of the total`);
    }
//BROWSER_ONLY    t1 = performance.now();
//BROWSER_ONLY    console.log("Resampling took " + (t1 - t0)/1000 + " seconds.")

    return native2as1;
}
