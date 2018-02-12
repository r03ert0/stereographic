const fs = require('fs');
var paper = require('paper');
paper.setup([5, 5]);

const pwd = process.argv[1].split('/').slice(0,-1).join('/')+'/';
for(var code of [
//    fs.readFileSync('resample.js'),
//    fs.readFileSync('point_in_sphere.js'),
    fs.readFileSync(pwd + 'linalg.js'),
    fs.readFileSync(pwd + 'intersect_vector_triangle.js'),
//    fs.readFileSync('minimum_bounding_circle.js'),
    fs.readFileSync(pwd + 'ply.js'),
    fs.readFileSync(pwd + 'sbn.js')
]) {
    eval(code.toString());
}

function applyRotation(rotation, p) {
    var s=stereographic2sphere(p);
    var r=multiply(rotation, transpose([[...s,1]]));
    var result=sphere2stereographic(r);

    return result;
}

function lineset(regions, rotation, flagPrintSVG) {
    let i, seg, p, hi, ho, tmp;
    let arr = [], content = [];

    for(i=0;i<regions.length;i++) {
        let line = {};
        line.name = regions[i].name;
        var path=new paper.Path();
        arr.push(path);
        for(seg of regions[i].path0) {
            p = applyRotation(rotation, [seg.px, seg.py]);
            hi = applyRotation(rotation, [seg.px + seg.ix, seg.py + seg.iy]);
            ho = applyRotation(rotation, [seg.px + seg.ox, seg.py + seg.oy]);
            path.add(new paper.Segment(
                new paper.Point(p),
                new paper.Point(hi[0]-p[0], hi[1]-p[1]),
                new paper.Point(ho[0]-p[0], ho[1]-p[1])
            ));
        }
        path.flatten(0.001);
        line.p = []
        for(seg of path.segments) {
            line.p.push([seg.point.x, seg.point.y]);
        }
        content.push(line);
    }

    if(typeof flagPrintSVG !== 'undefined' && flagPrintSVG === true) {
        console.log(paper.project.exportSVG({ asString: true }));
    }

    for(tmp of arr)
        tmp.remove();

    return content;
}

function morph(brain1, brain2) {
    const {l1, sph1} = brain1;
    const {l2, tr2, sph2, nat2} = brain2;

    console.log('Morphing...')
    console.time('Morphing')
    const sph2topo1 = sbn(l1, l2, sph1); // spherical geometry 2, on topology 1
    console.timeEnd('Morphing')

    console.log('Resampling...');
    const brain2topo1 = resampleMesh(tr2, sph2, nat2, sph2topo1); // native geometry 2, on topology 1

    return brain2topo1;
}
const pathBrain1 = process.argv[2];
const pathBrain2 = process.argv[3];
const pathResult = process.argv[4];

const F01Reg = JSON.parse(fs.readFileSync(`${pathBrain1}/sulci.json`).toString());
const F01Rot = transpose(fs.readFileSync(`${pathBrain1}/rotation.txt`).toString()
                .split('\n').map((a)=>a.split(' ').map((b)=>parseFloat(b)))
                .splice(0,4));
const F16Reg = JSON.parse(fs.readFileSync(`${pathBrain2}/sulci.json`).toString());
const F16Rot = transpose(fs.readFileSync(`${pathBrain2}/rotation.txt`).toString()
                .split('\n').map((a)=>a.split(' ').map((b)=>parseFloat(b)))
                .splice(0,4));
var l1 = lineset(F01Reg, F01Rot);
var l2 = lineset(F16Reg, F16Rot);

Promise.all([
    loadPLYGz(`${pathBrain1}/surf.ply.gz`),
    loadPLYGz(`${pathBrain1}/surf.sphere.ply.gz`),
    loadPLYGz(`${pathBrain2}/surf.ply.gz`),
    loadPLYGz(`${pathBrain2}/surf.sphere.ply.gz`)
])
.then((meshes) => {
    console.log(`m1. np: ${meshes[0].p.length}, nt: ${meshes[0].t.length}`);
    console.log(`m2. np: ${meshes[1].p.length}, nt: ${meshes[1].t.length}`);
    console.log(`m3. np: ${meshes[2].p.length}, nt: ${meshes[2].t.length}`);
    console.log(`m4. np: ${meshes[3].p.length}, nt: ${meshes[3].t.length}`);
    const tr1 = meshes[0].t;
    const nat1 = meshes[0].p;
    const tr2 = meshes[2].t;
    const nat2 = meshes[2].p;
    const sph1 = meshes[1].p.map((o)=>transpose(multiply(F01Rot, transpose([[...direction(o), 1]])))[0].slice(0,3));
    const sph2 = meshes[3].p.map((o)=>transpose(multiply(F16Rot, transpose([[...direction(o), 1]])))[0].slice(0,3));
    const brain2topo1 = morph({l1,tr1,sph1,nat1}, {l2,tr2,sph2,nat2});

    console.log('morph:', brain2topo1.length);
    savePLYGz({p: brain2topo1, t: tr1}, pathResult);
})
.catch((err) => console.error(err));

/*
var sph1 = fs.readFileSync('data/test3/F01_Adult/sulci.json');

var sph2 = sbn(l1, l2, sph, 4);
console.log("Morphed coordinates:");
console.log(sph2.map((a)=>a.join(', ')).join('\n'));
*/
