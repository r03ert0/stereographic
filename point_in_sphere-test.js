const fs = require('fs');
for(var code of [
    fs.readFileSync('resample.js'),
    fs.readFileSync('point_in_sphere.js'),
    fs.readFileSync('linalg.js'),
    fs.readFileSync('intersect_vector_triangle.js'),
    fs.readFileSync('minimum_bounding_circle.js'),
    fs.readFileSync('sbn.js')
]) {
    eval(code.toString());
}

var assert = require('assert');

var ico = {
    p: [
        [0, -0.525731, 0.850651],
        [0.850651, 0, 0.525731],
        [0.850651, 0, -0.525731],
        [-0.850651, 0, -0.525731],
        [-0.850651, 0, 0.525731],
        [-0.525731, 0.850651, 0],
        [0.525731, 0.850651, 0],
        [0.525731, -0.850651, 0],
        [-0.525731, -0.850651, 0],
        [0, -0.525731, -0.850651],
        [0, 0.525731, -0.850651],
        [0, 0.525731, 0.850651]
    ],
    t: [
        [6, 2, 1],
        [2, 7, 1],
        [5, 4, 3],
        [8, 3, 4],
        [11, 5, 6],
        [10, 6, 5],
        [2, 10, 9],
        [3, 9, 10],
        [9, 8, 7],
        [0, 7, 8],
        [1, 0, 11],
        [4, 11, 0],
        [10, 2, 6],
        [11, 6, 1],
        [10, 5, 3],
        [11, 4, 5],
        [9, 7, 2],
        [0, 1, 7],
        [8, 9, 3],
        [0, 8, 4]
    ]
};

function equalFloatArray(a, b) {
    let i, sum = 0;
    for(i=0;i<a.length;i++) {
        sum += Math.abs(a[i]-b[i]);
    }
    // console.log(a,b,sum/a.length);
    return sum/a.length < 1e-6;
}

setSphereHashCellSize(0.03);

describe('Linear algebra', function() {
    describe('transpose', function() {
        it('should return [[1,3,5], [2,4,6]] for [[1,2],[3,4],[5,6]]', function() {
            const result = transpose([[1,2],[3,4],[5,6]]);
            assert.deepEqual(result, [[1,3,5], [2,4,6]]);
      });
    });
});

describe('Point in sphere', function() {
    describe('sphere2sinusoidal', function() {
        it('should return [2pi, pi/2] for [-1, 0, 0]', function() {
            assert(equalFloatArray(sphere2sinusoidal([-1, 0, 0]), [2*Math.PI, Math.PI/2]));
      });
    });
    describe('sphere2sinusoidal', function() {
        it('should return [pi, pi/2] for [1, 0, 0]', function() {
            assert(equalFloatArray(sphere2sinusoidal([1, 0, 0]), [Math.PI, Math.PI/2]));
      });
    });
    describe('sphere2sinusoidal', function() {
        it('should return [0, pi] for [0, 0, 1]', function() {
            assert(equalFloatArray(sphere2sinusoidal([0, 0, 1]), [0, Math.PI]));
      });
    });
    describe('sinusoidal2sphere', function() {
        let pp = direction([Math.random()-0.5, Math.random()-0.5, Math.random()-0.5]);
        it(`should return ${pp}`, function() {
            assert(equalFloatArray(
                sinusoidal2sphere(sphere2sinusoidal(pp)),
                pp
            ));
        });
    });
    describe('barycentric', function() {
        it('should return [0, 1, 0]', function() {
            assert(equalFloatArray(
                barycentric([1, 0, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]),
                [0, 1, 0]
            ));
        });
    });
    describe('pointInTriangle', function() {
        it('should return true', function() {
            assert.equal(pointInTriangle([0.3, 0.3, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]), true);
        });
    });
    describe('pointInTriangle', function() {
        it('should return false', function() {
            assert.equal(pointInTriangle([-0.3, 0.3, 0], [0, 0, 0], [1, 0, 0], [0, 1, 0]), false);
        });
    });
    describe('minimumBoundingCircle', function() {
        it('should return [0, 0, 0, 1]', function() {
            assert(equalFloatArray(minimumBoundingCircle([-1, 0, 0], [1, 0, 0], [0, 0.5, 0]), [0, 0, 0, 1]));
        });
    });
    describe('testSphereIntersection', function() {
        it('should return true', function() {
            assert.equal(
                testSphereIntersection([0, 0, 0, 1], [1.5, 0, 0, 1]),
                true
            );
        });
    });
    describe('testSphereIntersection', function() {
        it('should return false', function() {
            assert.equal(
                testSphereIntersection([0, 0, 0, 1], [2.1, 0, 0, 1]),
                false
            );
        });
    });
    describe('pointInSphere', function() {
        // take a random triangle
        const i = parseInt(ico.t.length*Math.random());
        // take random barycentric coordinates
        let c = [Math.random(), Math.random(), Math.random()];
        const sum = c.reduce((sum, v) => sum+v);
        c=c.map((o) => o/sum);
        // make a vector from those coordinates
        const p = add3D(
            add3D(
                sca3D(ico.p[ico.t[i][0]], c[0]),
                sca3D(ico.p[ico.t[i][1]], c[1])
            ), sca3D(ico.p[ico.t[i][2]], c[2]));
        let pp = direction(p);
        it(`should return triangle ${i} at coordinates ${c[1]}, ${c[2]}`, function() {
            //this.timeout(15000);
            assert(equalFloatArray(pointInSphere(pp, ico), [i, c[1], c[2]]));
        });
    });
    describe('pointInSphere', function() {
        // take a random triangle
        const i = parseInt(ico.t.length*Math.random());
        // take random barycentric coordinates
        let c = [Math.random(), Math.random(), Math.random()];
        const sum = c.reduce((sum, v) => sum+v);
        c=c.map((o) => o/sum);
        // make a vector from those coordinates
        const p = add3D(
            add3D(
                sca3D(ico.p[ico.t[i][0]], c[0]),
                sca3D(ico.p[ico.t[i][1]], c[1])
            ), sca3D(ico.p[ico.t[i][2]], c[2]));
        let pp = direction(p);
        it(`should return triangle ${i} at coordinates ${c[1]}, ${c[2]}`, function() {
            assert(equalFloatArray(pointInSphere(pp, ico), [i, c[1], c[2]]));
        });
    });
    describe('resampleMesh', function() {
        it('should output the same vectors as the input', function() {
            const tr2 = ico.t; // topology 2
            const sphcoords2 = ico.p; // sphere coordinates 2
            const native2 = ico.p; // native coordinates 2
            const sphcoords1as2 = ico.p; // sphere coordinates of 1 aligned to 2, topology 1
            assert(equalFloatArray(
                [].concat(...resampleMesh(tr2, sphcoords2, native2, sphcoords1as2)),
                [].concat(...ico.p)
            ));
        });
    });
});

describe('Spherical Beier and Neely morphing', function() {
    describe('sbn', function() {
        it('should return [2pi, pi/2] for [-1, 0, 0]', function() {
            assert(equalFloatArray(sphere2sinusoidal([-1, 0, 0]), [2*Math.PI, Math.PI/2]));
            sph = sph.splice(0, nv).map((a)=>a.split(' ').map((b)=>parseFloat(b)));
            var sph2 = sbn(l1, l2, sph, 4);
            console.log("Morphed coordinates:");
            console.log(sph2.map((a)=>a.join(', ')).join('\n'));
      });
    });
});


/*
computeSphereHash(ico);
console.log(intersectVectorTriangle([0.5, 0.5, 0.5], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
console.log(intersectVectorTriangle([1, 0, 0], [[1, 0, 0], [0, 1, 0], [0, 0, 1]]));
*/
