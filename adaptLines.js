const fs = require('fs');
const cli = require('cli');
const ply = require('ply.js');

const pwd = process.argv[1].split('/').slice(0,-1).join('/')+'/'; // own path
for(var code of [
    fs.readFileSync(pwd + 'linalg.js'),
    fs.readFileSync(pwd + 'intersect_vector_triangle.js'),
    fs.readFileSync(pwd + 'sbn.js')
]) {
    eval(code.toString());
}

cli.parse({
    lineset: ['l', 'Path to lineset drawn over the reference mesh', 'file'],
    reference: ['a', 'Path to reference mesh', 'file'],
    new: ['b', 'Path to new mesh', 'file'],
    out: ['o', 'Path to adapted lineset', 'file']
});

let pathLineset1, pathLineset2, pathSphere1, pathSphere2;
cli.main(function (args, options) {
    if (options.lineset) {
        console.log('lineset',options.lineset);
        pathLineset1 = options.lineset;
    }
    if (options.reference) {
        console.log('reference',options.reference);
        pathSphere1 = options.reference;
    }
    if (options.out) {
        console.log('new',options.new);
        pathSphere2 = options.new;
    }
    if (options.out) {
        console.log('out',options.out);
        pathLineset2 = options.out;
    }
});

function findPointInSphere(p, sph) {
    let t;
    let result;
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
    return result;
}
const l1 = JSON.parse(fs.readFileSync(pathLineset1).toString());
console.log(JSON.stringify(l1));
var args = [
    ply.loadPLYGz(pathSphere1),
    ply.loadPLYGz(pathSphere2),
];

Promise.all(args)
.then((meshes) => {
    console.log(`m1. np: ${meshes[0].p.length}, nt: ${meshes[0].t.length}`);
    console.log(`m2. np: ${meshes[1].p.length}, nt: ${meshes[1].t.length}`);
    const t = meshes[0].t;
    const p1 = meshes[0].p;
    const p2 = meshes[1].p;
    for(i=0;i<l1.length;i++) {
        let line = {};
        line.name = l1[i].name;
        var path = [];
        for(seg of l1[i].path0) {
            // get the points
            const p = [seg.px, seg.py];
            const hi = [seg.px + seg.ix, seg.py + seg.iy];
            const ho = [seg.px + seg.ox, seg.py + seg.oy];

            // move them from the stereographic projection to the unitary sphere
            const sp = stereographic2sphere(p);
            const shi = stereographic2sphere(hi);
            const sho = stereographic2sphere(ho);

            // find the corresponding triangle in sphere 1
            const cp = findPointInSphere(sp, {t:t, p:p1});
            const chi = findPointInSphere(shi, {t:t, p:p1});
            const cho = findPointInSphere(sho, {t:t, p:p1});

            // get the equivalent sphere coordinates in sphere 2
            const sp2 = add3D(add3D(
                sca3D(p2[t[cp[0]][0]], 1-cp[1]-cp[2]),
                sca3D(p2[t[cp[0]][1]], cp[1])),
                sca3D(p2[t[cp[0]][2]], cp[2]));
            const shi2 = add3D(add3D(
                sca3D(p2[t[chi[0]][0]], 1-chi[1]-chi[2]),
                sca3D(p2[t[chi[0]][1]], chi[1])),
                sca3D(p2[t[chi[0]][2]], chi[2]));
            const sho2 = add3D(add3D(
                sca3D(p2[t[cho[0]][0]], 1-cho[1]-cho[2]),
                sca3D(p2[t[cho[0]][1]], cho[1])),
                sca3D(p2[t[cho[0]][2]], cho[2]));
            const newp = sphere2stereographic(sp2);
            const newhi = sphere2stereographic(shi2);
            const newho = sphere2stereographic(sho2);

            // store
            path.push({
                px: newp[0],
                py: newp[1],
                ix: newhi[0]-newp[0],
                iy: newhi[1]-newp[1],
                ox: newho[0]-newp[0],
                oy: newho[1]-newp[1]
            });
        }
        l1[i].path0 = path;
    }
    fs.writeFileSync(pathLineset2, JSON.stringify(l1));
})
.catch((err) => console.error(err));
