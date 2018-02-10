const fs = require('fs');
const zlib = require('zlib');


function parsePLY(str) {
/*
    console.log(str.split('\n').slice(0,20).join('\n'));
*/

    const arr = str.split('\n').map((a) => a.split(' '));
    let i=0, j;
    let nverts, ntris;
    let p = [];
    let t = [];

    while(arr[i][0] !== 'end_header') {
        if(arr[i][1] === 'vertex') {
            nverts = parseInt(arr[i][2]);
        }
        if(arr[i][1] === 'face') {
            ntris = parseInt(arr[i][2]);
        }
        i++;
    }

    i++;
    for(j=0;j<nverts;j++) {
        p.push(arr[i].map((o) => parseFloat(o)));
        i++;
    }
    for(j=0;j<ntris;j++) {
        t.push(arr[i].map((o) => parseInt(o)).slice(1,4));
        i++;
    }

/*
    console.log(nverts, ntris);
    console.log(p.slice(0,10));
    console.log(t.slice(0,10));
*/

    return {p: p, t: t};
}

function loadPLY(path) {
    const ply = fs.readFileSync(path).toString();
    const mesh = parsePLY(ply);

    return mesh;
}

function loadPLYGz(path) {
    const plygz = fs.readFileSync(path);

    var pr = new Promise((resolve, reject) => {
        zlib.gunzip(plygz, (err, ply) => {
            if(err) {
                reject(err);

                return;
            }
            const mesh = parsePLY(ply.toString());
            resolve(mesh);
        });
    });

    return pr;
}

function encodePLY(mesh) {
    let plystr =
`ply
format ascii 1.0
comment ply.js, R. Toro 2018
element vertex ${mesh.p.length}
property float x
property float y
property float z
element face ${mesh.t.length}
property list uchar int vertex_indices
end_header
`;
    plystr += mesh.p.map((o) => o.join(' ')).join('\n');
    plystr += mesh.t.map((o) => '3 ' + o.join(' ')).join('\n');

    return plystr;
}

function savePLY(mesh, path) {
    const plystr = encodePLY(mesh);
    fs.writeFileSync(path, plystr);
}

function savePLYGz(mesh, path) {
    const plystr = encodePLY(mesh);
    const pr = new Promise((resolve, reject) => {
        zlib.gzip(plystr, (err, plygz) => {
            if(err) {
                reject(err);

                return;
            }
            fs.writeFileSync(path, plygz);
            resolve("Ply.gz file saved");
        });
    });

    return pr;
}
