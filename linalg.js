var EPSILON = 1e-10;

/**
 * @function norm3D3D
 * @desc Vector norm
 * @returns {number}
 */
function norm3D(a) {
    return Math.sqrt(a[0]*a[0] + a[1]*a[1] + a[2]*a[2]);
}

/**
 * @function add3D
 * @desc Vector addition
 * @param {array} a First vector
 * @param {array} b Second vector
 * @returns {array} The sum of a and b
 */
function add3D(a,b) {
    return [a[0]+b[0], a[1]+b[1], a[2]+b[2]];
}

/**
 * @function sub3D
 * @desc Vector subtraction
 */
function sub3D(a,b) {
    return [a[0]-b[0], a[1]-b[1], a[2]-b[2]];
}

/**
 * @function sca3D
 * @desc Vector scaling
 */
function sca3D(a,t) {
    return [a[0]*t, a[1]*t, a[2]*t];
}

/**
 * @function dot3D
 * @desc Vector dot product
 */
function dot3D(a,b) {
    return a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
}

/**
  * @function cross3D
  * @desc Cross product
  */
function cross3D(a, b) {
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
}

/**
 * @function add
 * @desc Add two vectors of arbitrary length
 * @param {array} a First vector
 * @param {array} b Second vector
 * @returnValues {array} The sum of a and b
 */
function add(a, b) {
    let c = [];
    let i;
    for(i=0;i<a.length;i++) {
        c[i] = a[i] + b[i];
    }

    return c;
}

/**
 * @function sca
 * @desc Scale a vector of arbitrary length by a constant
 * @param {array} a The vector
 * @param {number} t The constant
 * @returnValues {array} The vector a scaled by the constant t
 */
function sca(a, t) {
    let c = [];
    let i;
    for(i=0;i<a.length;i++) {
        c[i] = t * a[i];
    }

    return c;
}

/**
 * @function direction
 * @desc Normalise vector to unit norm
 */
function direction(p) {
    const n = Math.sqrt(p.reduce((sum,s)=>sum+s*s, 0));
    let result = p.map((o)=>o/n);
    return result;
}

/**
  * @function multiply
  * @desc multiplication of matrices a and b
  */
function multiply(a, b) {
    let r,c,i;
    const am=a.length, an=a[0].length;
    const bm=b.length, bn=b[0].length;
    if(an != bm) {
        console.log("ERROR: Wrong matrix dimensions in multiplication");
        return;
    }
    let res = new Array(am).fill(0);
    res=res.map(o=>new Array(bn).fill(0));
    for(r=0;r<am;r++) {
        for(c=0;c<bn;c++) {
            for(i=0;i<an;i++) {
                res[r][c] += a[r][i]*b[i][c];
            }
        }
    }

    return res;
}

/**
  * @function transpose
  * @desc transpose of matrix a
  */
function transpose(a) {
    let i, j, r = new Array(a[0].length).fill(0);
    r=r.map(o=>new Array(a.length).fill(0));
    for(i=0;i<a.length;i++)
    for(j=0;j<a[0].length;j++) {
        r[j][i] = a[i][j];
    }
    return r;
}

