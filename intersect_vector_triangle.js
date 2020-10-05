const EPSILON = 1e-6;

/**
 * Adapted from intersect_RayTriangle()
 * Copyright 2001, softSurfer (www.softsurfer.com)
 * This code may be freely used and modified for any purpose
 * providing that this copyright notice is included with it.
 * SoftSurfer makes no warranty for this code, and cannot be held
 * liable for any real or imagined damage resulting from its use.
 * Users of this code must verify correctness for their application.
 * @param x array vector
 * @param t array Array containing the 3D coordinates of the 3 vertices of the triangle
 * @returns {c0, c1, case} object The triangle-based coordinates of the intersection (when it exists)
 *    Case: -1 = triangle is degenerate (a segment or point)
 *           0 = disjoint (no intersect)
 *           1 = intersect in unique point I1
 *           2 = are in the same plane
 * code from:http://geometryalgorithms.com/Archive/algorithm_0105/algorithm_0105.htm#intersect_RayTriangle()
 */
function intersectVectorTriangle(x, T) {
  const xx = [];
  const u = [];
  const v = [];
  const n = []; // triangle vectors
  const dir = [];
  const w0 = [];
  const w = []; // ray vectors
  let ss, tt;

  u[0]=T[1][0]-T[0][0];
  u[1]=T[1][1]-T[0][1];
  u[2]=T[1][2]-T[0][2];

  v[0]=T[2][0]-T[0][0];
  v[1]=T[2][1]-T[0][1];
  v[2]=T[2][2]-T[0][2];

  n[0]=u[1]*v[2]-u[2]*v[1];
  n[1]=u[2]*v[0]-u[0]*v[2];
  n[2]=u[0]*v[1]-u[1]*v[0];

  if(Math.sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]) < EPSILON) {
    //printf("%lf\n", sqrt(n[0]*n[0]+n[1]*n[1]+n[2]*n[2]));        // triangle is degenerate, do not deal with this case
    return {u: null, v: null, case: -1};
  }

  [dir[0], dir[1], dir[2]] = x;

  w0[0] = -T[0][0];
  w0[1] = -T[0][1];
  w0[2] = -T[0][2];

  const a = n[0]*w0[0]+n[1]*w0[1]+n[2]*w0[2]; //a = dot3D(n,w0);
  const b = n[0]*dir[0]+n[1]*dir[1]+n[2]*dir[2]; //b = dot3D(n,dir);

  if (b>-EPSILON && b<EPSILON) { // ray is parallel to triangle plane
    if (a === 0.0) { // ray lies in triangle plane
      return {u: null, v: null, case: 2};
    }

    return {u: null, v: null, case: 0}; // ray disjoint from plane
  }

  // get intersect point of ray with triangle plane
  const r = -a/b; // params to calc ray-plane intersect
  if (r < 0.0) { // ray goes away from triangle
    return {u: null, v: null, case: 0}; // => no intersect
  }
  // for a segment, also test if (r > 1.0) => no intersect

  xx[0]=dir[0]*r;
  xx[1]=dir[1]*r;
  xx[2]=dir[2]*r; // intersect point of ray and plane

  // is I inside T?
  const uu=u[0]*u[0]+u[1]*u[1]+u[2]*u[2];
  const uv=u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const vv=v[0]*v[0]+v[1]*v[1]+v[2]*v[2];
  w[0]=xx[0]-T[0][0];
  w[1]=xx[1]-T[0][1];
  w[2]=xx[2]-T[0][2];
  const wu=w[0]*u[0]+w[1]*u[1]+w[2]*u[2];
  const wv=w[0]*v[0]+w[1]*v[1]+w[2]*v[2];
  const D = uv * uv - uu * vv;

  // get and test parametric coords
  ss = (uv * wv - vv * wu) / D;
  if(ss>-EPSILON && ss<EPSILON) {
    ss=0;
  }
  if((1-ss)>-EPSILON && (1-ss)<EPSILON) {
    ss=1;
  }

  tt = (uv * wu - uu * wv) / D;
  if(tt>-EPSILON && tt<EPSILON) {
    tt=0;
  }
  if((1-tt)>-EPSILON && (1-tt)<EPSILON) {
    tt=1;
  }

  const c0 = ss;
  const c1 = tt;

  if (ss < 0.0 || tt < 0.0 || (ss + tt) > 1.0) { // I is outside T
    return {u: c0, v: c1, case: 0};
  }

  return {u: c0, v: c1, case: 1}; // I is in T
}
