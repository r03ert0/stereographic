var	 renderer,
	 scene,
	 mesh,
	 camera,
	 trackball,
	 geometry=null;
var time=0;
var Regions=[]; 	// main list of regions. Contains a paper.js path, a unique ID and a name;
var region=null;	// currently selected region (one element of Regions[])
var handle;			// currently selected control point or handle (if any)
var selectedTool;	// currently selected tool
var newRegionFlag;	

var zoom=1;
var aspectRatio=1;
var uniforms={zoom:{type:'f',value:zoom},aspectRatio:{type:'f',value:aspectRatio}};

var mouseIsDown=false;
var navEnabled;
var counter=1;	// for path unique ID

var filename="Untitled";

var arrows=[];

function regionUniqueID() {
	var i;
	var	found=false;
	while(found==false) {
		found=true;
		for(i=0;i<Regions.length;i++) {
			if(Regions[i].uid==counter) {
				counter++;
				found=false;
				break;
			}
		}
	}
	return counter;
}
function regionHashColor(name) {
	var color={};
	var hash=name.split("").reduce(function(a,b){
		a=((a<<5)-a)+b.charCodeAt(0);return a&a
	},0);

	// add some randomness
    hash=Math.sin(hash++)*10000;
    hash=0xffffff*(hash-Math.floor(hash));
	
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
	var	i;

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
function convertScreenPathToReference(region) {
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

/*
	Open brain mesh and sulcal map
*/
function chooseMesh() {
	var input=document.createElement("input");
	input.type="file";
	input.onchange=function(e){
		var file=this.files[0];
		openMesh(file);
	}
	input.click();
}
function chooseSulcalMap() {
	var input=document.createElement("input");
	input.type="file";
	input.onchange=function(e){
		var file=this.files[0];
		openSulcalMap(file);
	}
	input.click();
}
function openMesh(name) {
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
		if(name.name.split(".").pop()=="gz") {
			var inflate=new pako.Inflate();
			var	data=new Uint8Array(result);
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
		geometry=new THREE.PLYLoader().parse(result);
		geometry.computeFaceNormals();
		
		mi=new THREE.Vector3();
		ma=new THREE.Vector3();
		mi.x=ma.x=geometry.vertices[0].x;
		mi.y=ma.y=geometry.vertices[0].y;
		mi.z=ma.z=geometry.vertices[0].z;
		for(i=0;i<geometry.vertices.length;i++) {
			mi.x=(mi.x>geometry.vertices[i].x)?geometry.vertices[i].x:mi.x;
			mi.y=(mi.y>geometry.vertices[i].y)?geometry.vertices[i].y:mi.y;
			mi.z=(mi.z>geometry.vertices[i].z)?geometry.vertices[i].z:mi.z;
			ma.x=(ma.x<geometry.vertices[i].x)?geometry.vertices[i].x:ma.x;
			ma.y=(ma.y<geometry.vertices[i].y)?geometry.vertices[i].y:ma.y;
			ma.z=(ma.z<geometry.vertices[i].z)?geometry.vertices[i].z:ma.z;
		}
		for(i=0;i<geometry.vertices.length;i++) {
			geometry.vertices[i].x-=(mi.x+ma.x)/2;
			geometry.vertices[i].y-=(mi.y+ma.y)/2;
			geometry.vertices[i].z-=(mi.z+ma.z)/2;
			
			geometry.vertices[i]=geometry.vertices[i].normalize();
		}
		
		$("#info").append("<b>Mesh: </b>"+name.name+"<br />");
		$("#open-sulc").removeAttr('disabled');

		def.resolve();
	}
	/*
	oReq.send();
	*/
	reader.readAsArrayBuffer(name);

	return def.promise();
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
			var	data=new Uint8Array(result);
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
		var val,ma,mi;

		ma=mi=parseFloat(str[1]);
		for(i=0;i<np;i++) {
			val=parseFloat(str[i+1]);
			mi=(mi>val)?val:mi;
			ma=(ma<val)?val:ma;
		}

		for(i=0;i<geometry.vertices.length;i++) {
			val=(parseFloat(str[i+1])-mi)/(ma-mi);
			geometry.colors[i]= new THREE.Color().setRGB(val,val,val);
		}
		for(i=0;i<geometry.faces.length;i++) {
			geometry.faces[i].vertexColors[0]=geometry.colors[geometry.faces[i].a];
			geometry.faces[i].vertexColors[1]=geometry.colors[geometry.faces[i].b];
			geometry.faces[i].vertexColors[2]=geometry.colors[geometry.faces[i].c];
		}
		
		configureMaterial();

		$("#info").append("<b>Sulcal map: </b>"+name.name+"<br />");

		def.resolve();
	}
	/*
	oReq.send();
	*/
	reader.readAsArrayBuffer(name);
	
	return def.promise();
}
function initRender() {
	renderer = new THREE.WebGLRenderer({canvas:$("#three")[0]});
	var h=window.innerHeight;
	var w=h;
	/*TEST*/var w=window.innerWidth;
	renderer.setSize(w,h);
	renderer.setClearColor('white');
	document.body.appendChild(renderer.domElement);
	scene = new THREE.Scene();
	camera = new THREE.OrthographicCamera( -w/2,w/2,h/2,-h/2,1,1000);
	aspectRatio = w/h;
	/*TEST*/uniforms.aspectRatio.value=aspectRatio;
	camera.position.z = 10;
	scene.add(camera);
	trackball = new THREE.TrackballControls(camera,renderer.domElement);
	trackball.dynamicDampingFactor=1.0;
	trackball.addEventListener( 'change', function(){
		convertReferencePathsToScreen();
		paper.view.draw();
	});
}
function configureMaterial() {
	var material;
	
	//material=new THREE.MeshNormalMaterial();
	//material=new THREE.MeshBasicMaterial({vertexColors: THREE.VertexColors});
	//material=new THREE.ShaderMaterial({vertexShader: "varying vec3 vnormal;void main(){vnormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}", fragmentShader: "varying vec3 vnormal;void main(){vec3 n=normalize(vec3(1,1,1)+vnormal);gl_FragColor=vec4(n,1);}",shading:THREE.SmoothShading});
	
	// universal stereographic projection with vertex shader
	uniforms={zoom:{type:'f',value:zoom},aspectRatio:{type:'f',value:aspectRatio}};
	material = new THREE.ShaderMaterial({
		wireframe:false,
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
				"float invPI=0.3183098861837907;",
				"float a=atan(p.y,p.x);",
				"float b=zoom*acos(p.z/length(p))*invPI;",
				"gl_Position=vec4(b*cos(a),b*sin(a),length(p)*0.1,1);",
				"gl_Position.x=gl_Position.x/aspectRatio;",
				//"if(b>0.9) vnormal=vec3(0,0,0);",
			"}"
		].join(" "),
		fragmentShader: [
			"varying vec3 vnormal;",
			"varying vec3 vcolor;",
			"void main(){",
			"if(length(vnormal)>0.0)",
			"	gl_FragColor=vec4(vcolor,1);",
			//"	gl_FragColor=vec4(normalize(vec3(1,1,1)+vnormal),1);",
			"else",
			"	discard;",
			"}"
		].join(" "),
		vertexColors: THREE.VertexColors,
		shading:THREE.SmoothShading});
	mesh=new THREE.Mesh(geometry,material);
	scene.add(mesh);
}
function initBrain() {
	openMesh("data/F01.ply.gz")
	.then(function() {openSulcalMap("data/F01.icurv.txt.gz")});
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

	var	canvas=$("#overlay")[0];

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
	var input=document.createElement("input");
	input.type="file";
	input.onchange=function(e){
		var file=this.files[0];
		openPaths(file);
	}
	input.click();
}
function openPaths(name) {
	var reader = new FileReader();
	reader.onload = function(e) {
		var i;
		var tmpRegions=JSON.parse(e.target.result);
		// remove old paths
		for(i=0;i<Regions.length;i++)
			Regions[i].path.remove();
		// configure new paths
		for(i=0;i<tmpRegions.length;i++) {
			console.log("configuring path "+i);
			var reg=tmpRegions[i];
			var path=new paper.Path();
			path.importJSON(reg.path);
			newRegion({name:reg.name,path:path,path0:reg.path0});
		}
		convertReferencePathsToScreen();

		$("#info").append("<b>Annotation: </b>"+name.name+"<br />");
	};
	reader.readAsText(name);
}
function savePaths() {
	var filename=prompt("File name",filename);
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
function exportLines() {
	var filename=prompt("File name",filename);
	var tmpRegions=JSON.parse(JSON.stringify(Regions));
	var content=[];
	var i,j,p,arr=[];
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
	for(i in arr)
		arr[i].remove();
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
	var i,j,k,p,q,arr=[],lab=[],thr=0.1,dist;
	content.push(Regions.length);
	for(k=0;k<geometry.vertices.length;k++)
		lab[k]=0;
	for(i=0;i<Regions.length;i++) {
		var path=new paper.Path();
		arr.push(path);
		path.importJSON(Regions[i].path.exportJSON());
		path.flatten(5);
		for(j=0;j<path.segments.length;j++) {
			q=inverse(path.segments[j].point.x,path.segments[j].point.y);
			p=stereographic2sphere(q.x,q.y);
			for(k=0;k<geometry.vertices.length;k++) {
				v=geometry.vertices[k];
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

/*
	Transformations
*/
function screen2stereographic(px,py) {
	var h=window.innerHeight;
	var w=h;
	/*TEST*/var w=window.innerWidth;
	var a,b,x,y;
	x=(px-w/2)/(h/2)/zoom*Math.PI;
	y=(h/2-py)/(h/2)/zoom*Math.PI;
	return {x:x,y:y};
}
function stereographic2screen(x,y) {
	var h=window.innerHeight;
	var w=h;
	/*TEST*/var w=window.innerWidth;
	var x=w/2+zoom*x*(h/2)/Math.PI;
	var y=h/2-zoom*y*(h/2)/Math.PI;
	return {x:x,y:y};
}
function stereographic2sphere(x,y) {
	var b=Math.sqrt(x*x+y*y);
	var z=Math.cos(b);
	var f=Math.sqrt(1-z*z);
	x*=f/b;
	y*=f/b;
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
		to the corresponding rotated x',y' coordinate
	*/
	var p=stereographic2sphere(x,y);
	var r=unrotated2rotated(p);
	var result=sphere2stereographic(r);
	return result;
}
function inverse(px,py) {
	var s=screen2stereographic(px,py);
	var p=stereographic2sphere(s.x,s.y);
	var r=rotated2unrotated(p);
	var result=sphere2stereographic(r);
	return result;
}
/*
	Render mesh and annotations
*/
function render() {
	renderer.render(scene,camera);
	trackball.update();

	time+=0.1;
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
	
	$("#open-mesh").click(chooseMesh);
	$("#open-sulc").click(chooseSulcalMap);
	$("#open-path").click(chooseAnnotation);
	$("#save").click(savePaths);
	$("#export").click(exportLines);
	$("#import").click(importLines);
	$("#labels").click(exportLabels);
	$("#draw").click(function(){changeTool("draw")});
	$("#move").click(function(){changeTool("move")});
	$("#select").click(function(){changeTool("select")});
	$("#addpoint").click(function(){changeTool("addpoint")});
	$("#delpoint").click(function(){changeTool("delpoint")});
	$("#delete").click(function(){changeTool("delete")});
	$("#rename").click(function(){changeTool("rename")});
	
	changeTool("move");

	renderer.domElement.addEventListener('DOMMouseScroll', mousewheel, false);
	renderer.domElement.addEventListener('mousewheel', mousewheel, false);
	
	window.addEventListener('resize',resize, true);
}
init();
animate();

function resize(e) {
	var h=window.innerHeight;
	var w=h;
	var w=window.innerWidth;

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
/*
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
*/
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
	render();
}