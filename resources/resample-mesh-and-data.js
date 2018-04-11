/**
 * @desc native geometry 2, on topology 1
 * @returnValues {object} An object with properties `mesh` and `data` containing the resampled mesh and data
 */
function resampleMeshAndData(tr2, sphcoords2, native2, data2, sphcoords1as2) {
    const native2as1 = [];
    const data2as1 = [];
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

        // resample the mesh
        const p = add3D(
            add3D(
                sca3D(native2[tr2[t][0]],1-u-v),
                sca3D(native2[tr2[t][1]],u)
            ),  sca3D(native2[tr2[t][2]],v));
        native2as1.push(p);

        // resample the data
        const d = add(
            add(
                sca(data2[tr2[t][0]],1-u-v),
                sca(data2[tr2[t][1]],u)
            ),  sca(data2[tr2[t][2]],v));
        data2as1.push(d);

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

    return {brain2topo1: native2as1, data2topo1: data2as1};
}
