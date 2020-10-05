/* globals paper, $, THREE, pako */

let renderer; // used for 3d rendering
let scene; // used for 3d rendering
let material = null; // used for 3d rendering
let mesh = null; // used for 3d rendering
let camera; // used for 3d rendering
let trackball; // used for 3d rendering
let zoom = 1;
let aspectRatio = 1;
let uniforms = {
  zoom: {type: 'f', value: zoom},
  aspectRatio: {type: 'f', value: aspectRatio}
}; // used for 3d rendering
const defaultCameraPosition = 40; // used for 3d rendering
const Data = {}; // object centralising all data, geometrySphere, geometryNative, names, etc.
let geometry = null;
let geometrySphere = null;
let geometryNative = null;
const Regions = []; // main list of regions. Contains a paper.js path, a unique ID and a name,
let region = null; // currently selected region (one element of Regions[])
let handle; // currently selected control point or handle (if any)
let selectedTool; // currently selected tool
let selectedProjection; // currently selected projection
let mouseIsDown = false;
let counter = 1; // for path unique ID
let flagSphericalMeshLoaded = false;
let flagSulcalMapLoaded = false;
const arrows = [];
let lines = [];
let stereographicRotation = null; // stereographic rotation matrix
let orthographicRotation = null; // orthographic rotation matrix
const UID = parseInt(Math.random()*1e+6).toString(16);
let selectedRenderStyle = "";
let verbose;

function regionUniqueID() {
  let found = false;
  while (found === false) {
    found = true;
    for (let i = 0; i < Regions.length; i += 1) {
      if (Regions[i].uid === counter) {
        counter += 1;
        found = false;
        break;
      }
    }
  }

  return counter;
}

function regionHashColor(name) {
  const color = {};
  let hash = name.split("").reduce((a, b) => {
    a = ((a << 5) - a) + b.charCodeAt(0);

    return a & a;
  }, 0);

  // add some randomness
  hash = Math.sin(hash++)*10000;
  hash = 0xffffff * (hash - Math.floor(hash));

  color.red=hash&0xff;
  color.green=(hash&0xff00)>>8;
  color.blue=(hash&0xff0000)>>16;

  return color;
}

function newRegion(arg) {
  const reg = {
    uid: regionUniqueID()
  };
  reg.name = (arg.name)?arg.name:("Untitled "+reg.uid);

  const color=regionHashColor(reg.name);

  if(arg.path) {
    reg.path = arg.path;
    reg.path.strokeWidth=3;
    reg.path.strokeColor='rgba('+color.red+','+color.green+','+color.blue+',0.75)';
    reg.path.selected=false;
  }

  if(arg.path0) {
    reg.path0 = arg.path0;
  }

  // push the new region to the Regions array
  Regions.push(reg);

  return reg;
}

function removeRegion(reg) {
  // remove from Regions array
  Regions.splice(Regions.indexOf(reg), 1);
  // remove from paths
  reg.path.remove();
}

function selectRegion(reg) {
  // Select path
  for(let i=0; i<Regions.length; i++) {
    if(Regions[i]===reg) {
      reg.path.selected=true;
      reg.path.fullySelected=true;
      region=reg;
      $("#log").html(reg.name);
    } else {
      Regions[i].selected=false;
      Regions[i].path.fullySelected=false;
    }
  }
}

/*
    Transformations
*/
function screen2stereographic(px, py) {
  const h=window.innerHeight;
  const w=window.innerWidth;
  const x=(2*px-w)/(h*zoom)*Math.PI;
  const y=(h-2*py)/(h*zoom)*Math.PI;

  return {x:x, y:y};
}

function stereographic2screen(x, y) {
  const h=window.innerHeight;
  const w=window.innerWidth;
  x = w/2+zoom*x*h/(2*Math.PI);
  y = h/2-zoom*y*h/(2*Math.PI);

  return {x:x, y:y};
}

function stereographic2sphere(x, y) {
  const b=x*x+y*y;
  const z=Math.cos(Math.sqrt(b));
  const f=Math.sqrt((1-z*z)/b);
  x*=f;
  y*=f;

  return new THREE.Vector3(x, y, z);
}

function sphere2stereographic(p) {
  const a=Math.atan2(p.y, p.x);
  const b=Math.acos(p.z/Math.sqrt(p.x*p.x+p.y*p.y+p.z*p.z));
  const x=b*Math.cos(a);
  const y=b*Math.sin(a);

  return {x:x, y:y};
}

function rotated2unrotated(p) {
  let m=new THREE.Matrix4();
  m=m.makeRotationFromEuler(camera.rotation);
  p=p.applyMatrix4(m);

  return p;
}

function unrotated2rotated(p) {
  let m=new THREE.Matrix4();
  m=m.makeRotationFromEuler(camera.rotation);
  m.getInverse(m);
  p=p.applyMatrix4(m);

  return p;
}

function direct(x, y) {

  /*
        Moves a x,y reference stereographic coordinate
        to the corresponding rotated x',y' coordinate:

        stereographic -> sphere -> rotated -> stereographic
    */
  const p=stereographic2sphere(x, y);
  const r=unrotated2rotated(p);
  const result=sphere2stereographic(r);

  return result;
}

function inverse(px, py) {
  // screen -> stereographic -> sphere -> unrotated -> stereographic
  const s=screen2stereographic(px, py);
  const p=stereographic2sphere(s.x, s.y);
  const r=rotated2unrotated(p);
  const result=sphere2stereographic(r);

  return result;
}

function convertScreenPathToReference(myregion) {
  console.log("[convertScreenPathToReference]");

  myregion.path0=[];
  const {path} = myregion;
  const {path0} = myregion;
  const segmentCount=path.segments.length;

  for(let i=0; i<segmentCount; i++) {
    let tmp;
    tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x, path.segments[i].point.y));
    const point1=inverse(tmp.x, tmp.y);
    tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x+path.segments[i].handleIn.x, path.segments[i].point.y+path.segments[i].handleIn.y));
    const point2=inverse(tmp.x, tmp.y);
    tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x+path.segments[i].handleOut.x, path.segments[i].point.y+path.segments[i].handleOut.y));
    const point3=inverse(tmp.x, tmp.y);
    path0.push({
      px:point1.x,
      py:point1.y,
      ix:point2.x-point1.x,
      iy:point2.y-point1.y,
      ox:point3.x-point1.x,
      oy:point3.y-point1.y
    });
  }
}

function mouseDown(x, y) {
  mouseIsDown=true;
  const point=paper.view.viewToProject(new paper.Point(x, y));
  handle=null;

  console.log(selectedTool);

  switch(selectedTool) {
  case "select":
  case "addpoint":
  case "delpoint": {
    const hitResult=paper.project.hitTest(point, {
      tolerance:2,
      stroke: true,
      segments:true,
      fill: true,
      handles:true
    });
    if (hitResult) {
      let re;
      for(let i=0; i<Regions.length; i++) {
        if(Regions[i].path===hitResult.item) {
          re=Regions[i];
          break;
        }
      }

      // select path
      if(region && region!==re) {
        region.path.selected=false;
      }
      selectRegion(re);

      console.log(hitResult.type);

      if (hitResult.type === 'handle-in') {
        handle = hitResult.segment.handleIn;
        handle.point=point;
      } else
      if (hitResult.type === 'handle-out') {
        handle = hitResult.segment.handleOut;
        handle.point=point;
      } else
      if (hitResult.type==='segment') {
        if(selectedTool==="select") {
          handle=hitResult.segment.point;
          handle.point=point;
        }
        if(selectedTool==="delpoint") { hitResult.segment.remove(); }
      } else
      if (hitResult.type==='stroke' && selectedTool==="addpoint") {
        region.path
          .curves[hitResult.location.index]
          .divide(hitResult.location);
        region.path.fullySelected=true;
      }
      break;
    }
    if(hitResult===null && region) {
      // deselect paths
      region.path.selected=false;
      region=null;
    }
    break;
  }
  case "draw":
    console.log("start new region");
    // Start a new region
    // if there was an older region selected, unselect it
    if(region) { region.path.selected = false; }
    // start a new region
    region=newRegion({path:new paper.Path({segments:[point]})});
    // signal that a new region has been created for drawing
    break;
  }
}

function mouseDrag(x, y) {

  if(!mouseIsDown) { return; }

  const point=paper.view.viewToProject(new paper.Point(x, y));
  if (handle) {
    handle.x+=point.x-handle.point.x;
    handle.y+=point.y-handle.point.y;
    handle.point=point;
  } else
  if(selectedTool==="draw") {
    region.path.add(point);
  }
}

function mouseUp() {

  mouseIsDown=false;

  if(selectedTool==="move") { return; }

  console.log("update paths\n");

  if(selectedTool==="draw") {
    region.path.simplify(10);
    //region.path.flatten(40);
    region.path.fullySelected = true;
  }

  if(region) {
    convertScreenPathToReference(region);
  }
}

function convertReferencePathsToScreen() {
  // console.log("[convertReferencePathsToScreen]");

  let hi, ho, p;

  // arrow: remove previous arrows
  if(arrows.length) {
    for(const arrow of arrows) { arrow.remove(); }
  }

  for(const regj of Regions) {
    const {path, path0} = regj;
    if(typeof path0 === "undefined") { continue; }

    for(let i=0; i<path.segments.length; i++) {
      p=direct(path0[i].px, path0[i].py);
      p=stereographic2screen(p.x, p.y);
      path.segments[i].point.x=p.x;
      path.segments[i].point.y=p.y;

      if(path0[i].ix !== 0 && path0[i].iy!==0) {
        hi=direct(path0[i].px+path0[i].ix, path0[i].py+path0[i].iy);
        hi=stereographic2screen(hi.x, hi.y);
        path.segments[i].handleIn.x=hi.x-p.x;
        path.segments[i].handleIn.y=hi.y-p.y;
      }

      if(path0[i].ox !== 0 && path0[i].oy!==0) {
        ho=direct(path0[i].px+path0[i].ox, path0[i].py+path0[i].oy);
        ho=stereographic2screen(ho.x, ho.y);
        path.segments[i].handleOut.x=ho.x-p.x;
        path.segments[i].handleOut.y=ho.y-p.y;
      }
    }

    // arrow: add arrow and path name
    if(selectedTool==="move") {
      const ns=path.segments.length;
      const lp0=path.segments[ns-2].point;
      const lp1=paper.view.viewToProject(new paper.Point(path.segments[ns-1].point));
      const iv={x:lp0.x-lp1.x, y:lp0.y-lp1.y};
      const niv=Math.sqrt(iv.x*iv.x+iv.y*iv.y);
      iv.x*=10/niv;
      iv.y*=10/niv;
      const jv={x:-iv.y, y:iv.x};
      const path2 = new paper.Path();
      const ap=paper.view.viewToProject(new paper.Point(lp1.x-jv.x+iv.x, lp1.y-jv.y+iv.y));
      const bp=paper.view.viewToProject(new paper.Point(lp1.x+jv.x+iv.x, lp1.y+jv.y+iv.y));
      path2.add(ap);
      path2.add(lp1);
      path2.add(bp);
      path2.strokeWidth=1;
      path2.strokeColor='black';
      arrows.push(path2);
      const text = new paper.PointText(regj.path.segments[parseInt(regj.path.segments.length/2)].point);
      text.justification = 'center';
      text.fillColor = 'white';
      text.content = regj.name;
      arrows.push(text);
    }
  }
}

function changeTool(tool) {
  console.log("[changeTool]", tool);

  const prevTool=selectedTool;
  selectedTool=tool;
  if(tool === "move") {
    $("#overlay").css('pointer-events', 'none');
  } else {
    $("#overlay").css('pointer-events', 'all');
    if(tool==="draw"||tool==="select") {
      // arrow: remove previous arrows
      if(arrows.length) {
        for(const arri of arrows) { arri.remove(); }
      }
    }
  }
  $("#tools button").removeClass('selected');
  $("#"+tool).addClass('selected');

  const backToPreviousTool = function (thePrevTool) {
    setTimeout(() => {
      selectedTool=thePrevTool;
      changeTool(selectedTool);
    }, 500);
  };

  if(tool==="delete") {
    for(const regi of Regions) {
      if(regi.path.selected) {
        removeRegion(regi);
        break;
      }
    }
    backToPreviousTool(prevTool);
  }

  if(tool==="rename") {
    const name=prompt("Enter new name", region.name);
    region.name=name;
    backToPreviousTool(prevTool);
  }
}

function configureMaterial() {
  if(selectedProjection==="stereographic") {
    // universal stereographic projection with vertex shader
    uniforms={zoom:{type:'f', value:zoom}, aspectRatio:{type:'f', value:aspectRatio}};
    material = new THREE.ShaderMaterial({
      wireframe: (selectedRenderStyle === "wireframe"),
      uniforms: uniforms,
      vertexShader: `
uniform float zoom;
uniform float aspectRatio;
varying vec3 vnormal;
varying vec3 vcolor;
void main(){
  vnormal=normal;
  vcolor=color;
  vec4 p=viewMatrix*vec4(position,0.0);
  p=p/length(p);
  float invPI=0.3183098861837907;
  float a=atan(p.y,p.x);
  float b=zoom*acos(p.z/length(p))*invPI;
  gl_Position=vec4(b*cos(a),b*sin(a),length(p)*0.1,1.0);
  gl_Position.x=gl_Position.x/aspectRatio;
  //if(b>0.9) vnormal=vec3(0,0,0);
}`,
      fragmentShader: `
varying vec3 vnormal;
varying vec3 vcolor;
void main() {
  if(length(vnormal)>0.0)
    gl_FragColor=vec4(vcolor,1);
    // gl_FragColor=vec4(normalize(vec3(1,1,1)+vnormal),1);
  else
    discard;
}`,
      vertexColors: THREE.VertexColors,
      shading:THREE.SmoothShading
    });
  } else {
    material = new THREE.MeshBasicMaterial({
      wireframe: (selectedRenderStyle === "wireframe"),
      vertexColors:THREE.VertexColors
    });
  }

  material.needsUpdate=true;
  if(mesh!==null) {
    console.log("removing old mesh");
    scene.remove(mesh);
  }
  mesh=new THREE.Mesh(geometry, material);
  scene.add(mesh);
}

function configureBrainDisplay() {
  if(flagSphericalMeshLoaded && flagSulcalMapLoaded) { configureMaterial(); }
}

function labels2lines() {
  let i, j, k, p, q;
  let arr=[];

  if(lines.length) {
    for(const line of lines) {
      scene.remove(line);
    }
    lines=[];
  }

  let c;
  let newp;
  const S = geometrySphere.vertices;
  const N = geometryNative.vertices;
  const T = geometry.faces;
  for(i=0; i<Regions.length; i++) {
    const vectors = [];
    const path=new paper.Path();
    arr.push(path);
    path.importJSON(Regions[i].path.exportJSON());
    path.flatten(5);
    for(j=0; j<path.segments.length; j++) {
      q=inverse(path.segments[j].point.x, path.segments[j].point.y);
      p=stereographic2sphere(q.x, q.y);
      for(k=0; k<T.length; k++) {
        if(dot3D(p, S[T[k].a])>0.9) {
          c = intersectVectorTriangle(p.toArray(), [S[T[k].a].toArray(), S[T[k].b].toArray(), S[T[k].c].toArray()]);
          if(c.case === 1) {
            newp = add3D(add3D(
              sca3D(N[T[k].a], 1-c.u-c.v),
              sca3D(N[T[k].b], c.u)),
            sca3D(N[T[k].c], c.v)
            );
            vectors.push(new THREE.Vector3(newp.x, newp.y, newp.z));
            break;
          }
        }
      }
    }
    const curve = new THREE.SplineCurve3( vectors );
    const lgeo = new THREE.TubeGeometry(curve, path.segments.length, 0.2, 8, false);
    const lmat = new THREE.MeshBasicMaterial({color:0xff0000});
    lmat.color = {
      r: Regions[i].path.strokeColor.red,
      g: Regions[i].path.strokeColor.green,
      b: Regions[i].path.strokeColor.blue
    };
    const line=new THREE.Mesh(lgeo, lmat);
    scene.add(line);
    lines.push(line);
  }
  for(const a of arr) { a.remove(); }
  arr=[];
}

function changeProjection(projection) {
  selectedProjection=projection;
  $("#projection button").removeClass('selected');
  $("#"+projection).addClass('selected');

  const pos=camera.position;
  const {up} = camera;
  if(stereographicRotation === null) { stereographicRotation = {pos: new THREE.Vector3(pos.x, pos.y, pos.z), up: new THREE.Vector3(up.x, up.y, up.z)}; }
  if(orthographicRotation === null) { orthographicRotation = {pos: new THREE.Vector3(pos.x, pos.y, pos.z), up: new THREE.Vector3(up.x, up.y, up.z)}; }

  if(projection==="stereographic") {
    geometry=geometrySphere;

    if(lines.length) {
      for(const li of lines) { scene.remove(li); }
      lines=[];
    }

    $("#overlay").show();

    orthographicRotation.pos.copy(pos);
    orthographicRotation.up.copy(up);
    camera.position.copy(stereographicRotation.pos);
    camera.up.copy(stereographicRotation.up);
  }
  if(projection==="orthographic") {
    geometry=geometryNative;
    $("#overlay").hide();
    labels2lines();

    stereographicRotation.pos.copy(pos);
    stereographicRotation.up.copy(up);
    camera.position.copy(orthographicRotation.pos);
    camera.up.copy(orthographicRotation.up);
  }

  configureBrainDisplay();
}

function changeRenderStyle(renderStyle) {
  selectedRenderStyle=renderStyle;
  $("#renderStyle button").removeClass('selected');
  $("#"+renderStyle).addClass('selected');

  configureBrainDisplay();
}

/*
    Open brain mesh and sulcal map
*/
function findAndLoad(files, targetFile, callback, fallback) {
  const def = $.Deferred();
  let found = false;
  let file;
  for (let i=0; i<files.length; i++) {
    const path = files[i].webkitRelativePath;
    const name = path.split('/')[1];
    if(name === targetFile) {
      found = true;
      console.log('reading', name);
      file = files[i];
    }
  }
  if(found) {
    return callback(file);
  }
  if(typeof fallback !== 'undefined') {
    fallback();
  }

  return def.resolve("Unable to find file", targetFile);
}

function openPaths(name) {
  const def = $.Deferred();
  const reader = new FileReader();
  reader.onload = function(e) {
    const tmpRegions=JSON.parse(e.target.result);
    // remove old paths
    for(let i=0; i<Regions.length; i++) { Regions[i].path.remove(); }
    // configure new paths
    for(let i=0; i<tmpRegions.length; i++) {
      if(typeof verbose !== 'undefined' && verbose) {
        console.log("configuring path "+i);
      }
      const reg=tmpRegions[i];
      const path=new paper.Path();
      path.importJSON(reg.path);
      newRegion({name:reg.name, path:path, path0:reg.path0});
    }
    convertReferencePathsToScreen();

    $("#info").append("<b>Annotation: </b>"+name.name+"<br />");
    Data.paths = tmpRegions;
    Data.pathsName = name.name;
    def.resolve();
  };
  reader.readAsText(name);

  return def.promise();
}

function savePaths() {
  const filename=prompt("File name", "sulci");
  const tmpRegions=JSON.parse(JSON.stringify(Regions));
  for(let i=0; i<Regions.length; i++) { tmpRegions[i].path=Regions[i].path.exportJSON(); }
  const json = JSON.stringify(tmpRegions);
  const jsonData = 'data:text/json;charset=utf-8,'+encodeURIComponent(json);
  const a = document.createElement('a');
  a.href = jsonData;
  a.download = filename+'.json';
  document.body.appendChild(a);
  a.click();
}

function openRotation(name) {
  const def = $.Deferred();
  const reader = new FileReader();
  reader.onload = function(e) {
    const arr=e.target.result.replace(/\n/g, ' ').split(' ')
      .map((b) => parseFloat(b))
      .splice(0, 16);
    arr[3] = 0;
    arr[7] = 0;
    arr[11] = 0;
    const rot = new THREE.Matrix4();
    const pos = trackball.position0;
    const up = trackball.up0;
    rot.set(...arr);
    trackball.position0 = pos.applyMatrix4(rot);
    trackball.up0 = up.applyMatrix4(rot);
    trackball.reset();
    $("#info").append("<b>Rotation: </b>"+name.name+"<br />");
    Data.rotation = rot;
    Data.rotationName = name.name;
    def.resolve();
  };
  reader.readAsText(name);

  return def.promise();
}

function saveRotation() {
  const filename=prompt("File name", "rotation");
  const mat = camera.matrix;
  const rot = new THREE.Matrix4();
  rot.extractRotation(mat);
  const txt = [...rot.transpose().elements]
    .map((b, i) => {
      if (i===0||(i+1)%4>0) {
        return `${b} `;
      }

      return `${b}\n`;
    }).join('');
  const txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  const a = document.createElement('a');
  a.href = txtData;
  a.download = filename+'.txt';
  document.body.appendChild(a);
  a.click();
}

function openPLYMesh(name) {
  const def=$.Deferred();
  const reader = new FileReader();
  let ma, mi;
  reader.onload = function(e) {
    let {result} = e.target;
    if(name.name.split(".").pop()==="gz") {
      const inflate=new pako.Inflate();
      const data=new Uint8Array(result);
      const chunk=4096;
      for(let j=0; j<data.length; j+=chunk) {
        if((j+chunk)>=data.length) {
          inflate.push(data.subarray(j, j+chunk), true);
        } else {
          inflate.push(data.subarray(j, j+chunk), false);
        }
      }
      result=inflate.result.buffer;
    }
    const geo=new THREE.PLYLoader().parse(result);
    geo.computeFaceNormals();

    mi=new THREE.Vector3();
    ma=new THREE.Vector3();
    ma.x=geo.vertices[0].x;
    ma.y=geo.vertices[0].y;
    ma.z=geo.vertices[0].z;
    mi.x=ma.x;
    mi.y=ma.y;
    mi.z=ma.z;
    for(let i=0; i<geo.vertices.length; i++) {
      mi.x=(mi.x>geo.vertices[i].x)?geo.vertices[i].x:mi.x;
      mi.y=(mi.y>geo.vertices[i].y)?geo.vertices[i].y:mi.y;
      mi.z=(mi.z>geo.vertices[i].z)?geo.vertices[i].z:mi.z;
      ma.x=(ma.x<geo.vertices[i].x)?geo.vertices[i].x:ma.x;
      ma.y=(ma.y<geo.vertices[i].y)?geo.vertices[i].y:ma.y;
      ma.z=(ma.z<geo.vertices[i].z)?geo.vertices[i].z:ma.z;
    }
    // console.log("min,max:",mi,ma);
    for(let i=0; i<geo.vertices.length; i++) {
      geo.vertices[i].x-=(mi.x+ma.x)/2;
      geo.vertices[i].y-=(mi.y+ma.y)/2;
      geo.vertices[i].z-=(mi.z+ma.z)/2;
    }
    def.resolve(geo);
  };
  reader.readAsArrayBuffer(name);

  return def.promise();
}

function openMesh(name) {
  return $.when(openPLYMesh(name))
    .then(function(geo) {
      geometrySphere=geo;
      geometry=geo;
      $("#info").append("<b>Spherical Mesh: </b>"+name.name+"<br />");
      $("#open-sulcal-map").removeAttr('disabled');
      flagSphericalMeshLoaded=true;
      configureBrainDisplay();
      Data.sphere = geometrySphere;
      Data.sphereName = name.name;
    });
}

function openNativeMesh(name) {
  return $.when(openPLYMesh(name)).then(function(geo) {
    geometryNative=geo;

    let val;

    for(let i=0; i<geo.vertices.length; i++) {
      val=geometrySphere.colors[i].r;
      geo.colors[i]=new THREE.Color().setRGB(val, val, val);//geometrySphere.colors[i];
    }
    for(let i=0; i<geometry.faces.length; i++) {
      geo.faces[i].vertexColors[0]=geo.colors[geo.faces[i].a];
      geo.faces[i].vertexColors[1]=geo.colors[geo.faces[i].b];
      geo.faces[i].vertexColors[2]=geo.colors[geo.faces[i].c];
    }

    $("#info").append("<b>Native Mesh: </b>"+name.name+"<br />");
    configureBrainDisplay();
    Data.native = geometryNative;
    Data.nativeName = name.name;
  });
}

function openSulcalMap(name) {
  const def=$.Deferred();

  const reader = new FileReader();
  reader.onload = function(e) {


    let {result} = e.target;
    if(name.name.split('.').pop()==="gz") {
      const inflate=new pako.Inflate();
      const data=new Uint8Array(result);
      const chunk=4096;
      for(let j=0; j<data.length; j+=chunk) {
        if((j+chunk)>=data.length) {
          inflate.push(data.subarray(j, j+chunk), true);
        } else {
          inflate.push(data.subarray(j, j+chunk), false);
        }
      }
      result=inflate.result.buffer;
    }
    const dataView = new DataView(result);
    const decoder = new TextDecoder("utf-8");
    const str = decoder.decode(dataView).split("\n");
    const tmp=str[0].split(" ");
    const np=parseInt(tmp[0]);
    const values = str.splice(1).map((o) => parseFloat(o))
      .slice(0, np);

    const ma=Math.max(...values);
    const mi=Math.min(...values);
    const val = values.map((v) => (v-mi)/(ma-mi));

    for(let i=0; i<geometry.vertices.length; i++) {
      geometry.colors[i]= new THREE.Color().setRGB(val[i], val[i], val[i]);
    }
    for(let i=0; i<geometry.faces.length; i++) {
      geometry.faces[i].vertexColors[0]=geometry.colors[geometry.faces[i].a];
      geometry.faces[i].vertexColors[1]=geometry.colors[geometry.faces[i].b];
      geometry.faces[i].vertexColors[2]=geometry.colors[geometry.faces[i].c];
    }

    flagSulcalMapLoaded=true;
    configureBrainDisplay();

    $("#info").append("<b>Sulcal map: </b>"+name.name+"<br />");
    Data.map = val;
    Data.mapName = name.name;

    def.resolve();
  };

  /*
    oReq.send();
    */
  reader.readAsArrayBuffer(name);

  return def.promise();
}

function chooseDirectory() {
  const input=document.getElementById("i-open-directory");
  input.type="file";
  input.onchange=function(e) {
    console.log("onchange: chooseDirectory");
    const {files} = this;
    const path = files[0].webkitRelativePath;
    const base = path.split('/')[0];

    $("#info").append("<b>Directory: </b>"+base+"<br />");

    Data.name = base;
    findAndLoad(files, 'surf.sphere.ply.gz', openMesh)
      .then(() => findAndLoad(files, 'surf.curv.txt.gz', openSulcalMap))
      .then(() => findAndLoad(files, 'surf.ply.gz', openNativeMesh))
      .then(() => findAndLoad(files, 'sulci.json', openPaths))
      .then(() => findAndLoad(files, 'rotation.txt', openRotation, () => console.log('WARNING: No rotation.txt file available')));
  };
  input.click();
}

function chooseMesh() {
  const input=document.getElementById("i-open-mesh");
  input.type="file";
  input.onchange=() => {
    console.log("onchange: chooseMesh");
    const file=this.files[0];
    openMesh(file);
  };
  input.click();
}

function chooseNativeMesh() {
  const input=document.getElementById("i-open-native-mesh");
  input.type="file";
  input.onchange=function() {
    console.log("onchange: chooseNativeMesh");
    const file=this.files[0];
    openNativeMesh(file);
  };
  input.click();
}

function chooseSulcalMap() {
  const input=document.getElementById("i-open-sulcal-map");
  input.type="file";
  input.onchange=() => {
    console.log("onchange: chooseSulcalMap");
    const [file]=this.files;
    openSulcalMap(file);
  };
  input.click();
}

function initRender() {
  renderer = new THREE.WebGLRenderer({canvas:$("#three")[0]});
  const h=window.innerHeight;
  const z=40;
  const w=window.innerWidth;
  renderer.setSize(w, h);
  renderer.setClearColor('white');
  document.body.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera( -w/2/(z*zoom), w/2/(z*zoom), h/2/(z*zoom), -h/2/(z*zoom), 0.1, 1000);
  aspectRatio = w/h;
  /*TEST*/uniforms.aspectRatio.value=aspectRatio;
  camera.position.z = defaultCameraPosition;
  scene.add(camera);
  trackball = new THREE.TrackballControls(camera, renderer.domElement);
  trackball.dynamicDampingFactor=1.0;
  trackball.addEventListener( 'change', () => {
    convertReferencePathsToScreen();
    paper.view.draw();
  });
}

function initAnnotationOverlay() {
  console.log("> initAnnotationOverlay");

  // set up vectorial annotation overlay
  const height = window.innerHeight;
  const width = window.innerWidth;
  $("#overlay").attr('width', width);
  $("#overlay").attr('height', height);

  $("svg").width(width);
  $("svg").height(height);

  const canvas = document.querySelector("#overlay");

  paper.setup(canvas);
  paper.settings.handleSize=10;

  $("#overlay").on("mousedown", function(e) { mouseDown(e.originalEvent.layerX, e.originalEvent.layerY); });
  $("#overlay").on("mousemove", function(e) { mouseDrag(e.originalEvent.layerX, e.originalEvent.layerY); });
  $("#overlay").on("mouseup", function(e) { mouseUp(e); });
}

/*
    Open and Save path annotations
*/
function chooseAnnotation() {
  const input=document.getElementById("i-open-annotation");
  input.type="file";
  input.onchange=() => {
    console.log("onchange: chooseAnnotation");
    const [file]=this.files;
    openPaths(file);
  };
  input.click();
}

// function flatten(path, n) {
//   var i, t;
//   var p0, p1, p2, p3, s0, s1, s2, s3;
//   var arr=[];

//   for(i=0; i<path.segments.length-1; i++) {
//     p0=path.segment[i].point;
//     p1=path.segment[i].handleOut;
//     p2=path.segment[i+1].handleIn;
//     p3=path.segment[i+1].point;
//     p1.x+=p0.x;
//     p1.y+=p0.y;
//     p2.x+=p3.x;
//     p2.y+=p3.y;
//     s0=screen2stereographic(p0);
//     s1=screen2stereographic(p1);
//     s2=screen2stereographic(p2);
//     s3=screen2stereographic(p3);

//     if(i<path.segments.length-2) {
//       for(t=0; t<1; t+=1/n) {
//         const s={};
//         s.x=(1-t)*s0.x+3*Math.pow(1-t, 2)*t*s1.x+3*(1-t)*t*t*s2.x+t*t*t*s3.x;
//         s.y=(1-t)*s0.y+3*Math.pow(1-t, 2)*t*s1.y+3*(1-t)*t*t*s2.y+t*t*t*s3.y;
//         arr.push(s);
//       }
//     } else {
//       for(t=0; t<=1; t+=1/n) {
//         const s={};
//         s.x=(1-t)*s0.x+3*Math.pow(1-t, 2)*t*s1.x+3*(1-t)*t*t*s2.x+t*t*t*s3.x;
//         s.y=(1-t)*s0.y+3*Math.pow(1-t, 2)*t*s1.y+3*(1-t)*t*t*s2.y+t*t*t*s3.y;
//         arr.push(s);
//       }
//     }
//   }

//   return arr;
// }

function lineset() {
  let p, tmp;
  const arr = [],
    content = [];

  content.push(Regions.length);
  for(let i=0; i<Regions.length; i++) {
    content.push(Regions[i].name);
    const path=new paper.Path();
    arr.push(path);
    path.importJSON(Regions[i].path.exportJSON());
    path.flatten(5);
    content.push(path.segments.length);
    const line=[];
    for(let j=0; j<path.segments.length; j++) {
      p=inverse(path.segments[j].point.x, path.segments[j].point.y);
      line.push(p.x+","+p.y);
    }
    content.push(line.join(" "));
  }
  for(tmp of arr) { tmp.remove(); }

  return content;
}

function exportLines() {
  const filename=prompt("File name");
  const content = lineset();
  const txt=content.join("\n");
  const txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
  const a = document.createElement('a');
  a.href = txtData;
  a.download = filename+'.txt';
  document.body.appendChild(a);
  a.click();
}

function importLines() {
  const input=document.createElement("input");
  input.type="file";
  input.onchange=() => {
    console.log("onchange: importLines");
    const file=this.files[0];

    const reader = new FileReader();
    reader.onload = function(e) {
      const str=e.target.result.split("\n");
      // remove old paths
      for(let i=0; i<Regions.length; i++) { Regions[i].path.remove(); }
      // configure new paths
      const nlines=parseInt(str[0]);
      for(let i=0; i<nlines; i++) {
        const name=str[1+3*i];
        console.log(name);
        const points=str[1+3*i+2].split(" ");
        const path=new paper.Path();
        path.strokeWidth=1;
        path.strokeColor='black';
        for(let j=0; j<points.length; j++) {
          const x=points[j].split(",");
          path.add(new paper.Point(500+100*parseFloat(x[0]), 500+100*parseFloat(x[1])));
        }
      }
    };
    reader.readAsText(file);

  };
  input.click();
}

// function exportLabels() {
//   var filename=prompt("Enter a name for the labels file");
//   let p, q, v;
//   const arr=[];
//   const lab=[];
//   const thr=0.05;
//   let dist;
//   for(let k=0; k<geometry.vertices.length; k++) {
//     lab[k]=0;
//   }
//   for(let i=0; i<Regions.length; i++) {
//     var path=new paper.Path();
//     arr.push(path);
//     path.importJSON(Regions[i].path.exportJSON());
//     path.flatten(1);
//     for(let j=0; j<path.segments.length; j++) {
//       q=inverse(path.segments[j].point.x, path.segments[j].point.y);
//       p=stereographic2sphere(q.x, q.y);
//       for(let k=0; k<geometry.vertices.length; k++) {
//         v=geometrySphere.vertices[k].normalize();
//         dist=Math.sqrt(Math.pow(p.x-v.x, 2)+Math.pow(p.y-v.y, 2)+Math.pow(p.z-v.z, 2));
//         if(dist<thr) { lab[k]+=1; }
//       }
//     }
//   }
//   for(const a of arr) { a.remove(); }
//   var txt=String(geometry.vertices.length)+"\n"+lab.join("\n");
//   var txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
//   var a = document.createElement('a');
//   a.href = txtData;
//   a.download = filename+'.txt';
//   document.body.appendChild(a);
//   a.click();
// }

function add3D(a, b) {
  return {x:a.x+b.x, y:a.y+b.y, z:a.z+b.z};
}

// function sub3D(a, b) {
//   return {x:a.x-b.x, y:a.y-b.y, z:a.z-b.z};
// }

function sca3D(a, t) {
  return {x:a.x*t, y:a.y*t, z:a.z*t};
}

function dot3D(a, b) {
  return a.x*b.x+a.y*b.y+a.z*b.z;
}

// function barycentric(p, a, b, c) {
//   var v0=sub3D(b, a),
//     v1=sub3D(c, a),
//     v2=sub3D(p, a);
//   var d00 = dot3D(v0, v0);
//   var d01 = dot3D(v0, v1);
//   var d11 = dot3D(v1, v1);
//   var d20 = dot3D(v2, v0);
//   var d21 = dot3D(v2, v1);
//   var denom = d00 * d11 - d01 * d01;
//   var v = (d11 * d20 - d01 * d21) / denom;
//   var w = (d00 * d21 - d01 * d20) / denom;
//   var u = 1 - v - w;

//   return {u:u, v:v, w:w};
// }

/* Basic Laplace smoothing of the native mesh */
function smoothMesh() {
  let i;
  const p = [];
  const n = [];
  for(i=0; i<geometryNative.vertices.length; i++) {
    p[i] = [0, 0, 0];
    n[i] = 0;
  }
  for(const t of geometryNative.faces) {
    p[t.a][0] += geometryNative.vertices[t.b].x + geometryNative.vertices[t.c].x;
    p[t.a][1] += geometryNative.vertices[t.b].y + geometryNative.vertices[t.c].y;
    p[t.a][2] += geometryNative.vertices[t.b].z + geometryNative.vertices[t.c].z;
    p[t.b][0] += geometryNative.vertices[t.c].x + geometryNative.vertices[t.a].x;
    p[t.b][1] += geometryNative.vertices[t.c].y + geometryNative.vertices[t.a].y;
    p[t.b][2] += geometryNative.vertices[t.c].z + geometryNative.vertices[t.a].z;
    p[t.c][0] += geometryNative.vertices[t.a].x + geometryNative.vertices[t.b].x;
    p[t.c][1] += geometryNative.vertices[t.a].y + geometryNative.vertices[t.b].y;
    p[t.c][2] += geometryNative.vertices[t.a].z + geometryNative.vertices[t.b].z;
    n[t.a] += 2;
    n[t.b] += 2;
    n[t.c] += 2;
  }
  for(i=0; i<geometryNative.vertices.length; i++) {
    geometryNative.vertices[i].x = p[i][0]/n[i];
    geometryNative.vertices[i].y = p[i][1]/n[i];
    geometryNative.vertices[i].z = p[i][2]/n[i];
  }
  geometry.verticesNeedUpdate=true;
}

/*
    Render mesh and annotations
*/
function render() {
  renderer.render(scene, camera);
  trackball.update();
}

function animate() {
  requestAnimationFrame(animate);
  if(geometry) { geometry.colorsNeedUpdate=true; }
  render();
}

function messageReceived(msg) {
  console.log('msg', new Date());
  console.log(msg);

  if(msg.originalEvent.url.split('/').pop() !== 'sbn.html') {
    console.log('refused: url', msg.originalEvent.url);

    return;
  }

  if(typeof msg.originalEvent.key === 'undefined') {
    console.log('refused: empty key');

    return;
  }

  let data;

  if(msg.originalEvent.key === 'message') {
    console.log('accepted: message');
    data = JSON.parse(localStorage.message);
    switch(data.message) {
    case 'callback':
      console.log('callback message');
      localStorage[UID] = JSON.stringify({
        timestamp: new Date(),
        message: 'introduction',
        UID: UID,
        name: Data.name,
        'native': Data.nativeName,
        sphere: Data.sphereName,
        paths: Data.pathsName,
        map: Data.mapName
      });
      break;
    }
  } else if(msg.originalEvent.key === UID) {
    console.log('accepted: UID', UID);
    data = JSON.parse(localStorage[UID]);
    switch(data.message) {
    case 'lineset':
      console.log('lineset message');
      localStorage[UID] = JSON.stringify({
        timestamp: new Date(),
        message: 'lineset',
        UID: UID,
        lineset: JSON.stringify(lineset())
      });
      break;
    case 'coordinates':
      console.log('coordinates message');
      localStorage[UID] = JSON.stringify({
        timestamp: new Date(),
        message: 'coordinates',
        UID: UID,
        coordinates: geometrySphere.vertices.map((a) => [a.x, a.y, a.z].map((b) => b.toFixed(4)).join(',')).join(' ')
      });
      break;
    case 'native':
      console.log('native coordinates message');
      localStorage[UID] = JSON.stringify({
        timestamp: new Date(),
        message: 'native',
        UID: UID,
        coordinates: geometryNative.vertices.map((a) => [a.x, a.y, a.z].map((b) => b.toFixed(4)).join(',')).join(' ')
      });
      break;
    case 'triangles':
      console.log('triangles message');
      localStorage[UID] = JSON.stringify({
        timestamp: new Date(),
        message: 'triangles',
        UID: UID,
        triangles: geometrySphere.faces.map((a) => [a.a, a.b, a.c].join(',')).join(' ')
      });
      break;
    }
  } else {
    console.log('unknown');
  }
}

function resize() {
  const h=window.innerHeight;
  const w=window.innerWidth;
  const z = defaultCameraPosition;

  $("#overlay").attr('width', w);
  $("#overlay").attr('height', h);

  paper.view.setViewSize(w, h);
  convertReferencePathsToScreen();
  paper.view.draw();

  $("svg").width(w);
  $("svg").height(h);

  aspectRatio = w/h;
  uniforms.aspectRatio.value=aspectRatio;
  renderer.setSize( w, h );

  camera.left = -w/2/(z*zoom);
  camera.right = w/2/(z*zoom);
  camera.top = h/2/(z*zoom);
  camera.bottom = -h/2/(z*zoom);
  camera.updateProjectionMatrix();
}

function mousewheel(e) {
  let val;
  if(e.wheelDelta) { //IE/Opera/Chrome
    val=-e.wheelDelta;
  }else if(e.detail) { //Firefox
    val=e.detail;
  }

  zoom=uniforms.zoom.value;
  zoom*=1-val/100.0;
  if(zoom<0.1) { zoom=0.1; }
  uniforms.zoom.value=zoom;
  resize();
  render();
}

/*
    Init
*/
function init() {

  initRender();

  //initBrain();

  // init annotation
  initAnnotationOverlay();

  $("#open-directory").click(chooseDirectory);
  $("#open-mesh").click(chooseMesh);
  $("#open-native-mesh").click(chooseNativeMesh);
  $("#open-sulcal-map").click(chooseSulcalMap);
  $("#open-annotation").click(chooseAnnotation);
  $("#save").click(savePaths);
  $("#saveRotation").click(saveRotation);
  $("#export").click(exportLines);
  $("#import").click(importLines);
  $("#labels").click(labels2lines);//exportLabels);
  $("#draw").click(() => { changeTool("draw"); });
  $("#move").click(() => { changeTool("move"); });
  $("#select").click(() => { changeTool("select"); });
  $("#addpoint").click(() => { changeTool("addpoint"); });
  $("#delpoint").click(() => { changeTool("delpoint"); });
  $("#delete").click(() => { changeTool("delete"); });
  $("#rename").click(() => { changeTool("rename"); });
  $("#stereographic").click(() => { changeProjection("stereographic"); });
  $("#orthographic").click(() => { changeProjection("orthographic"); });
  $("#solid").click(() => { changeRenderStyle("solid"); });
  $("#wireframe").click(() => { changeRenderStyle("wireframe"); });
  $("#smoothMesh").click(() => { smoothMesh(); });

  changeTool("move");
  changeProjection("stereographic");
  changeRenderStyle("solid");

  renderer.domElement.addEventListener('DOMMouseScroll', mousewheel, false);
  renderer.domElement.addEventListener('mousewheel', mousewheel, false);

  window.addEventListener('resize', resize, true);

  // enable communication with Spherical Beier and Neely code
  $(window).on('storage', messageReceived);
}

init();
animate();
