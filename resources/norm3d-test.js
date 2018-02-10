var sum = 0;
function norm3Dtest(a) {
    var i;
    for(i=0;i<1e+8;i++) {
        var x = Math.random()*1e+3;
        var y = Math.random()*1e+3;
        var z = Math.random()*1e+3;
        sum += Math.sqrt(x*x+y*y+z*z);
    }
}

console.time('norm3D');
norm3Dtest();
console.timeEnd('norm3D');

/*
var sum;function norm3Dtest(){var a;for(a=0;1E8>a;a++){var b=3*Math.random(),c=3*Math.random(),d=3*Math.random();sum+=Math.sqrt(b*b+c*c+d*d)}}console.time("norm3D");norm3Dtest();console.timeEnd("norm3D");
*/

/*
console.time("norm3D");
var b;
for(b=0;1E8>b;b++){
    var c=3*Math.random(),
        d=3*Math.random(),
        e=3*Math.random(),
        f=Math.sqrt(c*c+d*d+e*e)
}
console.timeEnd("norm3D")
*/