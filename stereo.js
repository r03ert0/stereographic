var renderer,
    scene,
    material = null,
    mesh = null,
    camera,
    trackball,
    Data = {},          // object centralising all data, geometry_sphere, geometry_native, names, etc.
    geometry = null,
    geometry_sphere = null,
    geometry_native = null,
    Regions = [],       // main list of regions. Contains a paper.js path, a unique ID and a name,
    region = null,      // currently selected region (one element of Regions[])
    handle,             // currently selected control point or handle (if any)
    selectedTool,       // currently selected tool
    selectedProjection, // currently selected projection
    newRegionFlag,
    zoom = 1,
    defaultCameraPosition = 30,
    aspectRatio = 1,
    uniforms = {zoom: {type: 'f', value: zoom}, aspectRatio: {type: 'f', value: aspectRatio}},
    mouseIsDown = false,
    navEnabled,
    counter = 1, // for path unique ID
    filename = "Untitled",
    flag_sphericalMeshLoaded = false,
    flag_sulcalMapLoaded = false,
    flag_nativeMeshLoaded = false,
    arrows = [],
    lines = [],
    stereographic_rotation = null,    // stereographic rotation matrix
    orthographic_rotation = null,     // orthographic rotation matrix
    renderStyle,
    UID = parseInt(Math.random()*1e+6).toString(16);

function regionUniqueID() {
    var i,
        found = false;
    while (found === false) {
        found = true;
        for (i = 0; i < Regions.length; i += 1) {
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
    var color = {},
        hash = name.split("").reduce(function (a, b) {
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
    var reg={};

    reg.uid=regionUniqueID();
    if(arg.name)
        reg.name=arg.name;
    else {
        reg.name="Untitled "+reg.uid;
    }
    var color=regionHashColor(reg.name);

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
    Regions.splice(Regions.indexOf(reg),1);
    // remove from paths
    reg.path.remove();
}
function selectRegion(reg) {
    var i;

    // Select path
    for(i=0;i<Regions.length;i++) {
        if(Regions[i]==reg) {
            reg.path.selected=true;
            reg.path.fullySelected=true;
            region=reg;
            $("#log").html(reg.name);
        }
        else {
            Regions[i].selected=false;
            Regions[i].path.fullySelected=false;
        }
    }
}
function mouseDown(x,y) {
    mouseIsDown=true;
    var prevRegion=null;
    var point=paper.view.viewToProject(new paper.Point(x,y));
    handle=null;

    console.log(selectedTool);

    switch(selectedTool) {
        case "select":
        case "addpoint":
        case "delpoint":
            var hitResult=paper.project.hitTest(point, {
                    tolerance:2,
                    stroke: true,
                    segments:true,
                    fill: true,
                    handles:true
                });
            newRegionFlag=false;
            if (hitResult) {
                var i;
                for(i=0;i<Regions.length;i++) {
                    if(Regions[i].path==hitResult.item) {
                        var re=Regions[i];
                        break;
                    }
                }

                // select path
                if(region && region!=re) {
                    region.path.selected=false;
                    prevRegion=region;
                }
                selectRegion(re);

                console.log(hitResult.type);

                if (hitResult.type == 'handle-in') {
                    handle = hitResult.segment.handleIn;
                    handle.point=point;
                } else
                if (hitResult.type == 'handle-out') {
                    handle = hitResult.segment.handleOut;
                    handle.point=point;
                } else
                if (hitResult.type=='segment') {
                    if(selectedTool=="select") {
                        handle=hitResult.segment.point;
                        handle.point=point;
                    }
                    if(selectedTool=="delpoint")
                        hitResult.segment.remove();
                } else
                if (hitResult.type=='stroke' && selectedTool=="addpoint") {
                    region.path
                    .curves[hitResult.location.index]
                    .divide(hitResult.location);
                    region.path.fullySelected=true;
                }
                break;
            }
            if(hitResult==null && region) {
                // deselect paths
                region.path.selected=false;
                region=null;
            }
            break;
        case "draw":
            console.log("start new region");
            // Start a new region
            // if there was an older region selected, unselect it
            if(region)
                region.path.selected = false;
            // start a new region
            region=newRegion({path:new paper.Path({segments:[point]})});
            // signal that a new region has been created for drawing
            newRegionFlag=true;
            break;
    }
}
function mouseDrag(x,y) {

    if(!mouseIsDown)
        return;

    var point=paper.view.viewToProject(new paper.Point(x,y));
    if (handle) {
        handle.x+=point.x-handle.point.x;
        handle.y+=point.y-handle.point.y;
        handle.point=point;
    } else
    if(selectedTool=="draw") {
        region.path.add(point);
    }
}
function mouseUp() {

    mouseIsDown=false;

    if(selectedTool=="move")
        return;

    console.log("update paths\n");

    if(selectedTool=="draw") {
        region.path.simplify(10);
        //region.path.flatten(40);
        region.path.fullySelected = true;
    }

    if(region)
        convertScreenPathToReference(region);
}
function convertReferencePathsToScreen() {
    // console.log("[convertReferencePathsToScreen]");

    var i,j,p,hi,ho;

    // arrow: remove previous arrows
    if(arrows.length) {
        for(i in arrows)
            arrows[i].remove();
    }

    for(j in Regions) {
        var path=Regions[j].path;
        var path0=Regions[j].path0;
        if(path0==undefined)
            continue;

        for(i=0;i<path.segments.length;i++) {
            p=direct(path0[i].px,path0[i].py);
            p=stereographic2screen(p.x,p.y);
            path.segments[i].point.x=p.x;
            path.segments[i].point.y=p.y;

            if(path0[i].ix!=0 && path0[i].iy!=0) {
                hi=direct(path0[i].px+path0[i].ix,path0[i].py+path0[i].iy);
                hi=stereographic2screen(hi.x,hi.y);
                path.segments[i].handleIn.x=hi.x-p.x;
                path.segments[i].handleIn.y=hi.y-p.y;
            }

            if(path0[i].ox!=0 && path0[i].oy!=0) {
                ho=direct(path0[i].px+path0[i].ox,path0[i].py+path0[i].oy);
                ho=stereographic2screen(ho.x,ho.y);
                path.segments[i].handleOut.x=ho.x-p.x;
                path.segments[i].handleOut.y=ho.y-p.y;
            }
        }

        // arrow: add arrow and path name
        if(selectedTool=="move") {
            var ns=path.segments.length;
            var lp0=path.segments[ns-2].point;
            var lp1=paper.view.viewToProject(new paper.Point(path.segments[ns-1].point));
            var iv={x:lp0.x-lp1.x,y:lp0.y-lp1.y};
            var niv=Math.sqrt(iv.x*iv.x+iv.y*iv.y);
            iv.x*=10/niv;
            iv.y*=10/niv;
            var jv={x:-iv.y,y:iv.x};
            var path=new paper.Path();
            var ap=paper.view.viewToProject(new paper.Point(lp1.x-jv.x+iv.x,lp1.y-jv.y+iv.y));
            var bp=paper.view.viewToProject(new paper.Point(lp1.x+jv.x+iv.x,lp1.y+jv.y+iv.y));
            path.add(ap);
            path.add(lp1);
            path.add(bp);
            path.strokeWidth=1;
            path.strokeColor='black';
            arrows.push(path);
            var text = new paper.PointText(Regions[j].path.segments[parseInt(Regions[j].path.segments.length/2)].point);
            text.justification = 'center';
            text.fillColor = 'white';
            text.content = Regions[j].name;
            arrows.push(text);
        }
    }
}
function convertScreenPathToReference(region) {
    console.log("[convertScreenPathToReference]");

    region.path0=[];
    var i;
    var path=region.path;
    var path0=region.path0;
    var segmentCount=path.segments.length;

    for(i=0;i<segmentCount;i++) {
        var tmp,point1,point2,point3;
        tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x,path.segments[i].point.y));
        point1=inverse(tmp.x,tmp.y);
        tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x+path.segments[i].handleIn.x,path.segments[i].point.y+path.segments[i].handleIn.y));
        point2=inverse(tmp.x,tmp.y);
        tmp=paper.view.viewToProject(new paper.Point(path.segments[i].point.x+path.segments[i].handleOut.x,path.segments[i].point.y+path.segments[i].handleOut.y));
        point3=inverse(tmp.x,tmp.y);
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
function backToPreviousTool(prevTool) {
    setTimeout(function() {
        selectedTool=prevTool;
        changeTool(selectedTool)
    },500);
}
function changeTool(tool) {
    console.log("[changeTool]",tool);

    var prevTool=selectedTool;
    selectedTool=tool;
    if(tool=="move") {
        $("#overlay").css('pointer-events','none');
    }
    else {
        $("#overlay").css('pointer-events','all');
        if(tool=="draw"||tool=="select") {
            // arrow: remove previous arrows
            if(arrows.length) {
                for(i in arrows)
                    arrows[i].remove();
            }
        }
    }
    $("#tools button").removeClass('selected');
    $("#"+tool).addClass('selected');

    if(tool=="delete") {
        for(i in Regions) {
            if(Regions[i].path.selected) {
                removeRegion(Regions[i]);
                break;
            }
        }
        backToPreviousTool(prevTool);
    }

    if(tool=="rename") {
        var name=prompt("Enter new name",region.name);
        region.name=name;
        backToPreviousTool(prevTool);
    }
}
function changeProjection(projection) {
    selectedProjection=projection;
    $("#projection button").removeClass('selected');
    $("#"+projection).addClass('selected');

    var pos=camera.position;
    var up=camera.up;
    if(stereographic_rotation === null)
        stereographic_rotation = {pos: new THREE.Vector3(pos.x,pos.y,pos.z), up: new THREE.Vector3(up.x,up.y,up.z)};
    if(orthographic_rotation === null)
        orthographic_rotation = {pos: new THREE.Vector3(pos.x,pos.y,pos.z), up: new THREE.Vector3(up.x,up.y,up.z)};

    if(projection=="stereographic") {
        geometry=geometry_sphere;

        if(lines.length) {
            for(i in lines)
                scene.remove(lines[i]);
            lines=[];
        }

        $("#overlay").show();

        orthographic_rotation.pos.copy(pos);
        orthographic_rotation.up.copy(up);
        camera.position.copy(stereographic_rotation.pos);
        camera.up.copy(stereographic_rotation.up);
    }
    if(projection=="orthographic") {
        geometry=geometry_native;
        $("#overlay").hide();
        labels2lines();

        stereographic_rotation.pos.copy(pos);
        stereographic_rotation.up.copy(up);
        camera.position.copy(orthographic_rotation.pos);
        camera.up.copy(orthographic_rotation.up);
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
    var def = $.Deferred();
    var found = false;
    var file;
    for (let i=0; i<files.length; i++) {
        const path = files[i].webkitRelativePath;
        const name = path.split('/')[1];
        if(name === targetFile) {
            found = true;
            console.log('reading',name);
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
function chooseDirectory() {
    var input=document.getElementById("i-open-directory");
    input.type="file";
    input.onchange=function(e) {
        console.log("onchange: chooseDirectory");
        var files=this.files;
        const path = files[0].webkitRelativePath;
        const base = path.split('/')[0];

        $("#info").append("<b>Directory: </b>"+base+"<br />");

        findAndLoad(files, 'surf.sphere.ply.gz', openMesh)
        .then(() => findAndLoad(files, 'surf.curv.txt.gz', openSulcalMap))
        .then(() => findAndLoad(files, 'surf.ply.gz', openNativeMesh))
        .then(() => findAndLoad(files, 'sulci.json', openPaths))
        .then(() => findAndLoad(files, 'rotation.txt', openRotation, ()=>console.log('WARNING: No rotation.txt file available')))
    }
    input.click();
}
function chooseMesh() {
    var input=document.getElementById("i-open-mesh");
    input.type="file";
    input.onchange=function(e){
        console.log("onchange: chooseMesh");
        var file=this.files[0];
        openMesh(file);
    }
    input.click();
}
function chooseNativeMesh() {
    var input=document.getElementById("i-open-native-mesh");
    input.type="file";
    input.onchange=function(e){
        console.log("onchange: chooseNativeMesh");
        var file=this.files[0];
        openNativeMesh(file);
    }
    input.click();
}
function chooseSulcalMap() {
    var input=document.getElementById("i-open-sulcal-map");
    input.type="file";
    input.onchange=function(e){
        console.log("onchange: chooseSulcalMap");
        var file=this.files[0];
        openSulcalMap(file);
    }
    input.click();
}
function openPLYMesh(name) {
    var def=$.Deferred();
    var reader = new FileReader();
    reader.onload = function(e) {
        var result=e.target.result;
        if(name.name.split(".").pop()=="gz") {
            var inflate=new pako.Inflate();
            var data=new Uint8Array(result);
            var i,j,chunk=4096;//16384;
            var mi,ma;
            for(j=0;j<data.length;j+=chunk) {
                if((j+chunk)>=data.length) {
                    inflate.push(data.subarray(j,j+chunk),true);
                } else {
                    inflate.push(data.subarray(j,j+chunk),false);
                }
            }
            result=inflate.result.buffer;
        }
        var geo=new THREE.PLYLoader().parse(result);
        geo.computeFaceNormals();

        mi=new THREE.Vector3();
        ma=new THREE.Vector3();
        mi.x=ma.x=geo.vertices[0].x;
        mi.y=ma.y=geo.vertices[0].y;
        mi.z=ma.z=geo.vertices[0].z;
        for(i=0;i<geo.vertices.length;i++) {
            mi.x=(mi.x>geo.vertices[i].x)?geo.vertices[i].x:mi.x;
            mi.y=(mi.y>geo.vertices[i].y)?geo.vertices[i].y:mi.y;
            mi.z=(mi.z>geo.vertices[i].z)?geo.vertices[i].z:mi.z;
            ma.x=(ma.x<geo.vertices[i].x)?geo.vertices[i].x:ma.x;
            ma.y=(ma.y<geo.vertices[i].y)?geo.vertices[i].y:ma.y;
            ma.z=(ma.z<geo.vertices[i].z)?geo.vertices[i].z:ma.z;
        }
        // console.log("min,max:",mi,ma);
        for(i=0;i<geo.vertices.length;i++) {
            geo.vertices[i].x-=(mi.x+ma.x)/2;
            geo.vertices[i].y-=(mi.y+ma.y)/2;
            geo.vertices[i].z-=(mi.z+ma.z)/2;
        }
        def.resolve(geo);
    }
    reader.readAsArrayBuffer(name);
    return def.promise();
}
function openMesh(name) {
    return $.when(openPLYMesh(name))
    .then(function(geo) {
        geometry_sphere=geo;
        geometry=geo;
        $("#info").append("<b>Spherical Mesh: </b>"+name.name+"<br />");
        $("#open-sulcal-map").removeAttr('disabled');
        flag_sphericalMeshLoaded=true;
        configureBrainDisplay();
        Data.sphere = geometry_sphere;
        Data.sphereName = name.name;
    });
}
function openNativeMesh(name) {
    return $.when(openPLYMesh(name)).then(function(geo) {
        geometry_native=geo;

        var val;

        for(var i=0;i<geo.vertices.length;i++) {
            val=geometry_sphere.colors[i].r;
            geo.colors[i]=new THREE.Color().setRGB(val,val,val);//geometry_sphere.colors[i];
        }
        for(i=0;i<geometry.faces.length;i++) {
            geo.faces[i].vertexColors[0]=geo.colors[geo.faces[i].a];
            geo.faces[i].vertexColors[1]=geo.colors[geo.faces[i].b];
            geo.faces[i].vertexColors[2]=geo.colors[geo.faces[i].c];
        }

        $("#info").append("<b>Native Mesh: </b>"+name.name+"<br />");
        flag_nativeMeshLoaded=true;
        configureBrainDisplay();
        Data['native'] = geometry_native;
        Data.nativeName = name.name;
    });
}
function openSulcalMap(name) {
    var def=$.Deferred();
    /*
    var oReq = new XMLHttpRequest();
    oReq.open("GET", name, true);
    oReq.responseType="arraybuffer";
    oReq.onload = function(oEvent) {
    */
    var reader = new FileReader();
    reader.onload = function(e) {
        /*
        var result=this.response;
        */
        var result=e.target.result;
        if(name.name.split('.').pop()=="gz") {
            var inflate=new pako.Inflate();
            var data=new Uint8Array(result);
            var i,j,chunk=4096;//16384;
            for(j=0;j<data.length;j+=chunk) {
                if((j+chunk)>=data.length) {
                    inflate.push(data.subarray(j,j+chunk),true);
                } else {
                    inflate.push(data.subarray(j,j+chunk),false);
                }
            }
            result=inflate.result.buffer;
        }
        var dataView = new DataView(result);
        var decoder = new TextDecoder("utf-8");
        var str = decoder.decode(dataView).split("\n");
        var tmp=str[0].split(" ");
        var np=parseInt(tmp[0]);
        var values = str.splice(1).map((o)=>parseFloat(o)).slice(0,np);
        var val,ma,mi;

        ma=Math.max(...values);
        mi=Math.min(...values);
        val = values.map((v)=>(v-mi)/(ma-mi));

        for(i=0;i<geometry.vertices.length;i++) {
            geometry.colors[i]= new THREE.Color().setRGB(val[i],val[i],val[i]);
        }
        for(i=0;i<geometry.faces.length;i++) {
            geometry.faces[i].vertexColors[0]=geometry.colors[geometry.faces[i].a];
            geometry.faces[i].vertexColors[1]=geometry.colors[geometry.faces[i].b];
            geometry.faces[i].vertexColors[2]=geometry.colors[geometry.faces[i].c];
        }

        flag_sulcalMapLoaded=true;
        configureBrainDisplay();

        $("#info").append("<b>Sulcal map: </b>"+name.name+"<br />");
        Data.map = val;
        Data.mapName = name.name;

        def.resolve();
    }
    /*
    oReq.send();
    */
    reader.readAsArrayBuffer(name);

    return def.promise();
}
function configureBrainDisplay() {
    if(flag_sphericalMeshLoaded && flag_sulcalMapLoaded)
        configureMaterial();
}
function initRender() {
    renderer = new THREE.WebGLRenderer({canvas:$("#three")[0]});
    var h=window.innerHeight;
    var w=h;
    var z=40;
    /*TEST*/var w=window.innerWidth;
    renderer.setSize(w,h);
    renderer.setClearColor('white');
    document.body.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    camera = new THREE.OrthographicCamera( -w/2/(z*zoom),w/2/(z*zoom),h/2/(z*zoom),-h/2/(z*zoom),0.1,1000);
    aspectRatio = w/h;
    /*TEST*/uniforms.aspectRatio.value=aspectRatio;
    camera.position.z = defaultCameraPosition;
    scene.add(camera);
    trackball = new THREE.TrackballControls(camera,renderer.domElement);
    trackball.dynamicDampingFactor=1.0;
    trackball.addEventListener( 'change', function(){
        convertReferencePathsToScreen();
        paper.view.draw();
    });
}
function configureMaterial() {
    if(selectedProjection=="stereographic") {
        // universal stereographic projection with vertex shader
        uniforms={zoom:{type:'f',value:zoom},aspectRatio:{type:'f',value:aspectRatio}};
        material = new THREE.ShaderMaterial({
            wireframe: (selectedRenderStyle === "wireframe"),
            uniforms: uniforms,
            vertexShader: [
                "uniform float zoom;",
                "uniform float aspectRatio;",
                "varying vec3 vnormal;",
                "varying vec3 vcolor;",
                "void main(){",
                    "vnormal=normal;",
                    "vcolor=color;",
                    "vec4 p=viewMatrix*vec4(position,0.0);",
                    "p=p/length(p);",
                    "float invPI=0.3183098861837907;",
                    "float a=atan(p.y,p.x);",
                    "float b=zoom*acos(p.z/length(p))*invPI;",
                    "gl_Position=vec4(b*cos(a),b*sin(a),length(p)*0.1,1.0);",
                    "gl_Position.x=gl_Position.x/aspectRatio;",
                    //"if(b>0.9) vnormal=vec3(0,0,0);",
                "}"
            ].join(" "),
            fragmentShader: [
                "varying vec3 vnormal;",
                "varying vec3 vcolor;",
                "void main(){",
                "if(length(vnormal)>0.0)",
                "    gl_FragColor=vec4(vcolor,1);",
                //"    gl_FragColor=vec4(normalize(vec3(1,1,1)+vnormal),1);",
                "else",
                "    discard;",
                "}"
            ].join(" "),
            vertexColors: THREE.VertexColors,
            shading:THREE.SmoothShading
        });
    }
    else {
        material = new THREE.MeshBasicMaterial({
            wireframe: (selectedRenderStyle === "wireframe"),
            vertexColors:THREE.VertexColors
        });
        //material.opacity=0.85;
        //material.transparent=true;
    }
    /*
        console.log("projection: ",selectedProjection);

        //material=new THREE.MeshNormalMaterial();
        material=new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors});
        //material=new THREE.ShaderMaterial({vertexShader: "varying vec3 vnormal;void main(){vnormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}", fragmentShader: "varying vec3 vnormal;void main(){vec3 n=normalize(vec3(1,1,1)+vnormal);gl_FragColor=vec4(n,1);}",shading:THREE.SmoothShading});
    }
    */
    material.needsUpdate=true;
    if(mesh!=null) {
        console.log("removing old mesh");
        scene.remove(mesh);
    }
    mesh=new THREE.Mesh(geometry,material);
    scene.add(mesh);
}
function initAnnotationOverlay() {
    console.log("> initAnnotationOverlay");

    // set up vectorial annotation overlay
    var height=window.innerHeight;
    var width=height;
    /*TEST*/var width=window.innerWidth;
    $("#overlay").attr('width',width);
    $("#overlay").attr('height',height);

    $("svg").width(width);
    $("svg").height(height);

    var canvas=$("#overlay")[0];

    paper.setup(canvas);
    paper.settings.handleSize=10;

    $("#overlay").on("mousedown",function(e) {mouseDown(e.originalEvent.layerX,e.originalEvent.layerY);});
    $("#overlay").on("mousemove",function(e) {mouseDrag(e.originalEvent.layerX,e.originalEvent.layerY);});
    $("#overlay").on("mouseup",function(e) {mouseUp(e);});
}

/*
    Open and Save path annotations
*/
function chooseAnnotation() {
    var input=document.getElementById("i-open-annotation");
    input.type="file";
    input.onchange=function(e){
        console.log("onchange: chooseAnnotation");
        var file=this.files[0];
        openPaths(file);
    }
    input.click();
}
function openPaths(name) {
    var def = $.Deferred();
    var reader = new FileReader();
    reader.onload = function(e) {
        var i;
        var tmpRegions=JSON.parse(e.target.result);
        // remove old paths
        for(i=0;i<Regions.length;i++)
            Regions[i].path.remove();
        // configure new paths
        for(i=0;i<tmpRegions.length;i++) {
            if(typeof verbose !== 'undefined' && verbose) {
                console.log("configuring path "+i);
            }
            var reg=tmpRegions[i];
            var path=new paper.Path();
            path.importJSON(reg.path);
            newRegion({name:reg.name,path:path,path0:reg.path0});
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
    var filename=prompt("File name","sulci");
    var tmpRegions=JSON.parse(JSON.stringify(Regions));
    for(var i=0;i<Regions.length;i++)
        tmpRegions[i].path=Regions[i].path.exportJSON();
    var json = JSON.stringify(tmpRegions);
    var jsonData = 'data:text/json;charset=utf-8,'+encodeURIComponent(json);
    var a = document.createElement('a');
    a.href = jsonData;
    a.download = filename+'.json';
    document.body.appendChild(a);
    a.click();
}
function openRotation(name) {
    var def = $.Deferred();
    var reader = new FileReader();
    reader.onload = function(e) {
        var i;
        var arr=e.target.result.replace(/\n/g,' ').split(' ').map((b)=>parseFloat(b)).splice(0,16);
        arr[3] = 0;
        arr[7] = 0;
        arr[11] = 0;
        var rot = new THREE.Matrix4();
        var pos = trackball.position0;
        var up = trackball.up0;
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
    var filename=prompt("File name","rotation");
    var mat = camera.matrix;
    var rot = new THREE.Matrix4();
    rot.extractRotation(mat);
    var txt = [...rot.transpose().elements]
              .map((b,i)=>(i==0||(i+1)%4>0)?`${b} `:`${b}\n`)
              .join('');
    var txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
    var a = document.createElement('a');
    a.href = txtData;
    a.download = filename+'.txt';
    document.body.appendChild(a);
    a.click();
}
function flatten(path,n) {
    var length=path.length;
    var i,t;
    var p0,p1,p2,p3,s0,s1,s2,s3;
    var arr=[];

    for(i=0;i<path.segments.length-1;i++) {
        p0=path.segment[i].point;
        p1=path.segment[i].handleOut;
        p2=path.segment[i+1].handleIn;
        p3=path.segment[i+1].point;
        p1.x+=p0.x;
        p1.y+=p0.y;
        p2.x+=p3.x;
        p2.y+=p3.y;
        s0=screen2stereographic(p0);
        s1=screen2stereographic(p1);
        s2=screen2stereographic(p2);
        s3=screen2stereographic(p3);
    
        if(i<path.segments.length-2) {
            for(t=0;t<1;t+=1/n) {
                var s={};
                s.x=(1-t)*s0.x+3*pow(1-t,2)*t*s1.x+3*(1-t)*t*t*s2.x+t*t*t*s3.x;
                s.y=(1-t)*s0.y+3*pow(1-t,2)*t*s1.y+3*(1-t)*t*t*s2.y+t*t*t*s3.y;
                arr.push(s);
            }
        } else {
            for(t=0;t<=1;t+=1/n) {
                var s={};
                s.x=(1-t)*s0.x+3*pow(1-t,2)*t*s1.x+3*(1-t)*t*t*s2.x+t*t*t*s3.x;
                s.y=(1-t)*s0.y+3*pow(1-t,2)*t*s1.y+3*(1-t)*t*t*s2.y+t*t*t*s3.y;
                arr.push(s);
            }
        }
    }
    return arr;
}

function lineset() {
    let i, j, p, tmp;
    var arr = [], content = [];

    content.push(Regions.length);
    for(i=0;i<Regions.length;i++) {
        content.push(Regions[i].name);
        var path=new paper.Path();
        arr.push(path);
        path.importJSON(Regions[i].path.exportJSON());
        path.flatten(5);
        content.push(path.segments.length);
        var line=[];
        for(j=0;j<path.segments.length;j++) {
            p=inverse(path.segments[j].point.x,path.segments[j].point.y);
            line.push(p.x+","+p.y);
        }
        content.push(line.join(" "));
    }
    for(tmp of arr)
        tmp.remove();

    return content;
}

function exportLines() {
    var filename=prompt("File name",filename);
    var tmpRegions=JSON.parse(JSON.stringify(Regions));
    var i, j, p;
    var content = lineset();
/*
    for(i=0;i<Regions.length;i++) {
        content.push(Regions[i].name);
        var path=new paper.Path();
    }
*/
    var txt=content.join("\n");
    var txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
    var a = document.createElement('a');
    a.href = txtData;
    a.download = filename+'.txt';
    document.body.appendChild(a);
    a.click();
}

function importLines() {
    var input=document.createElement("input");
    input.type="file";
    input.onchange=function(e){
        console.log("onchange: importLines");
        var file=this.files[0];

        var reader = new FileReader();
        reader.onload = function(e) {
            var i,j;
            var str=e.target.result.split("\n");
            // remove old paths
            for(i=0;i<Regions.length;i++)
                Regions[i].path.remove();
            // configure new paths
            var nlines=parseInt(str[0]);
            for(i=0;i<nlines;i++) {
                var name=str[1+3*i];
                console.log(name);
                var points=str[1+3*i+2].split(" ");
                var path=new paper.Path();
                path.strokeWidth=1;
                path.strokeColor='black';
                for(j=0;j<points.length;j++) {
                    var x=points[j].split(",");
                    path.add(new paper.Point(500+100*parseFloat(x[0]),500+100*parseFloat(x[1])));
                }
            }
        };
        reader.readAsText(file);

    }
    input.click();
}

function exportLabels() {
    var filename=prompt("Enter a name for the labels file",filename);
    var tmpRegions=JSON.parse(JSON.stringify(Regions));
    var content=[];
    var i,j,k,p,q,arr=[],lab=[],thr=0.05,dist;
    for(k=0;k<geometry.vertices.length;k++)
        lab[k]=0;
    for(i=0;i<Regions.length;i++) {
        var path=new paper.Path();
        arr.push(path);
        path.importJSON(Regions[i].path.exportJSON());
        path.flatten(1);
        for(j=0;j<path.segments.length;j++) {
            q=inverse(path.segments[j].point.x,path.segments[j].point.y);
            p=stereographic2sphere(q.x,q.y);
            for(k=0;k<geometry.vertices.length;k++) {
                v=geometry_sphere.vertices[k].normalize();
                dist=Math.sqrt(Math.pow(p.x-v.x,2)+Math.pow(p.y-v.y,2)+Math.pow(p.z-v.z,2));
                if(dist<thr)
                    lab[k]+=1;
            }
        }
    }
    for(i in arr)
        arr[i].remove();
    var txt=""+geometry.vertices.length+"\n"+lab.join("\n");
    var txtData = 'data:text/plain;charset=utf-8,'+encodeURIComponent(txt);
    var a = document.createElement('a');
    a.href = txtData;
    a.download = filename+'.txt';
    document.body.appendChild(a);
    a.click();
}

function markLabels() {
    var tmpRegions=JSON.parse(JSON.stringify(Regions));
    var i,j,k,p,q,arr=[],lab=[],thr=0.05,dist;
    for(k=0;k<geometry.vertices.length;k++)
        lab[k]=0;
    for(i=0;i<Regions.length;i++) {
        var path=new paper.Path();
        arr.push(path);
        path.importJSON(Regions[i].path.exportJSON());
        path.flatten(1);
        for(j=0;j<path.segments.length;j++) {
            q=inverse(path.segments[j].point.x,path.segments[j].point.y);
            p=stereographic2sphere(q.x,q.y);
            for(k=0;k<geometry.vertices.length;k++) {
                v=geometry_sphere.vertices[k].normalize();
                dist=Math.sqrt(Math.pow(p.x-v.x,2)+Math.pow(p.y-v.y,2)+Math.pow(p.z-v.z,2));
                if(dist<thr)
                    lab[k]+=1;
            }
        }
    }
    for(i=0;i<geometry.vertices.length;i++)
        geometry_native.colors[i]= (lab[i])?(new THREE.Color().setRGB(1,0,0)):geometry_sphere.colors[i];

    for(i=0;i<geometry.faces.length;i++) {
        geometry_native.faces[i].vertexColors[0]=geometry_native.colors[geometry.faces[i].a];
        geometry_native.faces[i].vertexColors[1]=geometry_native.colors[geometry.faces[i].b];
        geometry_native.faces[i].vertexColors[2]=geometry_native.colors[geometry.faces[i].c];
    }
    mesh.needsUpdate=true;
    geometry_native.colorsNeedUpdate=true;

    for(i in arr)
        arr[i].remove();
}

function sub3D(a,b) {
    return {x:a.x-b.x,y:a.y-b.y,z:a.z-b.z};
}

function dot3D(a,b) {
    return a.x*b.x+a.y*b.y+a.z*b.z;
}

function barycentric(p,a,b,c) {
    var v0=sub3D(b,a),v1=sub3D(c,a),v2=sub3D(p,a);
    var d00 = dot3D(v0, v0);
    var d01 = dot3D(v0, v1);
    var d11 = dot3D(v1, v1);
    var d20 = dot3D(v2, v0);
    var d21 = dot3D(v2, v1);
    var denom = d00 * d11 - d01 * d01;
    var v = (d11 * d20 - d01 * d21) / denom;
    var w = (d00 * d21 - d01 * d20) / denom;
    var u = 1 - v - w;
    return {u:u,v:v,w:w};
}

function labels2lines() {
    var tmpRegions=JSON.parse(JSON.stringify(Regions));
    var i,j,k,p,q,arr=[],bar;
    var dist,mndist=[],imndist=[];

    if(lines.length) {
        for(i in lines)
            scene.remove(lines[i]);
        lines=[];
    }

    var s=0;

    for(i=0;i<Regions.length;i++) {
        var lgeo=new THREE.Geometry();
        var np = 0;
//var lmat=new THREE.LineBasicMaterial({linewidth:5,color:0xff0000});
        var lmat=new THREE.MeshBasicMaterial({color:0xff0000});
        lmat.color.r=Regions[i].path.strokeColor.red;
        lmat.color.g=Regions[i].path.strokeColor.green;
        lmat.color.b=Regions[i].path.strokeColor.blue;

        var path=new paper.Path();
        arr.push(path);
        path.importJSON(Regions[i].path.exportJSON());
        path.flatten(5);
        for(j=0;j<path.segments.length;j++) {
            q=inverse(path.segments[j].point.x,path.segments[j].point.y);
            p=stereographic2sphere(q.x,q.y);

            // find 3 closest points in mesh
            for(k=0;k<geometry.vertices.length;k++) {

                s++;

                v=geometry_sphere.vertices[k].normalize();
                dist=Math.sqrt(Math.pow(p.x-v.x,2)+Math.pow(p.y-v.y,2)+Math.pow(p.z-v.z,2));
                if(k==0) {
                    mndist[0]=dist;
                    mndist[1]=dist;
                    mndist[2]=dist;
                    imndist[0]=0;
                    imndist[1]=0;
                    imndist[2]=0;
                } else if(dist<mndist[2]) {
                    if(dist<mndist[1]) {
                        if(dist<mndist[0]) {
                            // put instead of 0, move original 0 to 1 and original 1 to 2
                            mndist[2]=mndist[1];
                            imndist[2]=imndist[1];
                            mndist[1]=mndist[0];
                            imndist[1]=imndist[0];
                            mndist[0]=dist;
                            imndist[0]=k;
                        } else {
                            // put instead of 1, move original 1 to 2
                            mndist[2]=mndist[1];
                            imndist[2]=imndist[1];
                            mndist[1]=dist;
                            imndist[1]=k;
                        }
                    } else {
                        // put instead of 2
                        mndist[2]=dist;
                        imndist[2]=k
                    }
                }
            }

            // write point as a function of 3 closest
            var a=geometry_native.vertices[imndist[0]];
            var b=geometry_native.vertices[imndist[1]];
            var c=geometry_native.vertices[imndist[2]];
            /*
            var sum=1/mndist[0]+1/mndist[1]+1/mndist[2];
            var u=1/mndist[0]/sum;
            var v=1/mndist[1]/sum;
            var w=1/mndist[2]/sum;
            lgeo.vertices.push(new THREE.Vector3(
                u*a.x+v*b.x+w*c.x,
                u*a.y+v*b.y+w*c.y,
                u*a.z+v*b.z+w*c.z
            ));
            */
            lgeo.vertices.push(a);
            lgeo.vertices.push(b);
            lgeo.vertices.push(c);
            lgeo.faces.push(new THREE.Face3(np,np+1,np+2));
            np += 3;
        }
//var line=new THREE.Line(lgeo,lmat);
        var line=new THREE.Mesh(lgeo,lmat);
        scene.add(line);
        lines.push(line);
    }

    console.log("l2l:",s);

    for(i in arr)
        arr[i].remove();
    arr=[];
}
/*
    Transformations
*/
function screen2stereographic(px,py) {
    var h=window.innerHeight;
    var w=window.innerWidth;
    var x,y;
    x=(2*px-w)/(h*zoom)*Math.PI;
    y=(h-2*py)/(h*zoom)*Math.PI;
    return {x:x,y:y};
}
function stereographic2screen(x,y) {
    var h=window.innerHeight;
    var w=window.innerWidth;
    var x=w/2+zoom*x*h/(2*Math.PI);
    var y=h/2-zoom*y*h/(2*Math.PI);
    return {x:x,y:y};
}
function stereographic2sphere(x,y) {
    var b=x*x+y*y;
    var z=Math.cos(Math.sqrt(b));
    var f=Math.sqrt((1-z*z)/b);
    x*=f;
    y*=f;
    return new THREE.Vector3(x,y,z);
}
function sphere2stereographic(p) {
    var a=Math.atan2(p.y,p.x);
    var b=Math.acos(p.z/Math.sqrt(p.x*p.x+p.y*p.y+p.z*p.z));
    var x=b*Math.cos(a);
    var y=b*Math.sin(a);
    return {x:x,y:y};
}
function rotated2unrotated(p) {
    var m=new THREE.Matrix4();
    m=m.makeRotationFromEuler(camera.rotation);
    p=p.applyMatrix4(m);
    return p;
}
function unrotated2rotated(p) {
    var m=new THREE.Matrix4();
    m=m.makeRotationFromEuler(camera.rotation);
    m.getInverse(m);
    p=p.applyMatrix4(m);
    return p;
}
function direct(x,y) {
    /*
        Moves a x,y reference stereographic coordinate
        to the corresponding rotated x',y' coordinate:
    
        stereographic -> sphere -> rotated -> stereographic
    */
    var p=stereographic2sphere(x,y);
    var r=unrotated2rotated(p);
    var result=sphere2stereographic(r);
    return result;
}
function inverse(px,py) {
    // screen -> stereographic -> sphere -> unrotated -> stereographic
    var s=screen2stereographic(px,py);
    var p=stereographic2sphere(s.x,s.y);
    var r=rotated2unrotated(p);
    var result=sphere2stereographic(r);
    return result;
}

/**
 * @desc Basic Laplace smoothing of the native mesh
 */
function smoothMesh() {
    let i, v, f;
    let p = [];
    let n = [];
    for(i=0;i<geometry_native.vertices.length;i++) {
        p[i] = [0,0,0];
        n[i] = 0;
    }
    for(t of geometry_native.faces) {
        p[t.a][0] += geometry_native.vertices[t.b].x + geometry_native.vertices[t.c].x;
        p[t.a][1] += geometry_native.vertices[t.b].y + geometry_native.vertices[t.c].y;
        p[t.a][2] += geometry_native.vertices[t.b].z + geometry_native.vertices[t.c].z;
        p[t.b][0] += geometry_native.vertices[t.c].x + geometry_native.vertices[t.a].x;
        p[t.b][1] += geometry_native.vertices[t.c].y + geometry_native.vertices[t.a].y;
        p[t.b][2] += geometry_native.vertices[t.c].z + geometry_native.vertices[t.a].z;
        p[t.c][0] += geometry_native.vertices[t.a].x + geometry_native.vertices[t.b].x;
        p[t.c][1] += geometry_native.vertices[t.a].y + geometry_native.vertices[t.b].y;
        p[t.c][2] += geometry_native.vertices[t.a].z + geometry_native.vertices[t.b].z;
        n[t.a] += 2;
        n[t.b] += 2;
        n[t.c] += 2;
    }
    for(i=0;i<geometry_native.vertices.length;i++) {
        geometry_native.vertices[i].x = p[i][0]/n[i];
        geometry_native.vertices[i].y = p[i][1]/n[i];
        geometry_native.vertices[i].z = p[i][2]/n[i];
    }
    geometry.verticesNeedUpdate=true;
}
/*
    Render mesh and annotations
*/
function render() {
    renderer.render(scene,camera);
    trackball.update();
}
function animate() {
    requestAnimationFrame(animate);
    if(geometry)
        geometry.colorsNeedUpdate=true;
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
    $("#draw").click(function(){changeTool("draw")});
    $("#move").click(function(){changeTool("move")});
    $("#select").click(function(){changeTool("select")});
    $("#addpoint").click(function(){changeTool("addpoint")});
    $("#delpoint").click(function(){changeTool("delpoint")});
    $("#delete").click(function(){changeTool("delete")});
    $("#rename").click(function(){changeTool("rename")});
    $("#stereographic").click(function(){changeProjection("stereographic")});
    $("#orthographic").click(function(){changeProjection("orthographic")});
    $("#solid").click(function(){changeRenderStyle("solid")});
    $("#wireframe").click(function(){changeRenderStyle("wireframe")});
    $("#smoothMesh").click(function(){smoothMesh()});

    changeTool("move");
    changeProjection("stereographic");
    changeRenderStyle("solid");

    renderer.domElement.addEventListener('DOMMouseScroll', mousewheel, false);
    renderer.domElement.addEventListener('mousewheel', mousewheel, false);

    window.addEventListener('resize',resize, true);

    // enable communication with Spherical Beier and Neely code
    $(window).on('storage', messageReceived);
}
init();
animate();

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
                    coordinates: geometry_sphere.vertices.map((a)=>[a.x,a.y,a.z].map((b)=>b.toFixed(4)).join(',')).join(' ')
                });
                break;
            case 'native':
                console.log('native coordinates message');
                localStorage[UID] = JSON.stringify({
                    timestamp: new Date(),
                    message: 'native',
                    UID: UID,
                    coordinates: geometry_native.vertices.map((a)=>[a.x,a.y,a.z].map((b)=>b.toFixed(4)).join(',')).join(' ')
                });
                break;
            case 'triangles':
                console.log('triangles message');
                localStorage[UID] = JSON.stringify({
                    timestamp: new Date(),
                    message: 'triangles',
                    UID: UID,
                    triangles: geometry_sphere.faces.map((a)=>[a.a,a.b,a.c].join(',')).join(' ')
                });
                break;
        }
    } else {
        console.log('unknown');
    }
}

function resize(e) {
    var h=window.innerHeight;
    var w=window.innerWidth;
    const z = defaultCameraPosition;

    $("#overlay").attr('width',w);
    $("#overlay").attr('height',h);

    paper.view.setViewSize(w,h);
    convertReferencePathsToScreen();
    paper.view.draw();

    $("svg").width(w);
    $("svg").height(h);

    aspectRatio = w/h;
    uniforms.aspectRatio.value=aspectRatio;
    renderer.setSize( w,h );

    camera.left = -w/2/(z*zoom);
    camera.right = w/2/(z*zoom);
    camera.top = h/2/(z*zoom);
    camera.bottom = -h/2/(z*zoom);
    camera.updateProjectionMatrix();
}

function mousewheel(e) {
    var val;
    if(e.wheelDelta){//IE/Opera/Chrome 
        val=-e.wheelDelta;
    }else if(e.detail){//Firefox
        val=e.detail;
    }

    zoom=uniforms.zoom.value;
    zoom*=1-val/100.0;
    if(zoom<1)
        zoom=1;
    uniforms.zoom.value=zoom;
    resize();
    render();
}