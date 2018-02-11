/**
 * @desc Generates a lineset in the format required by the C version of the sbn code
 */
function lineset_old(regions, rotation, flagPrintSVG) {
    let i, j, seg, p, hi, ho, tmp;
    let arr = [], content = [];

    content.push(regions.length);
    for(i=0;i<regions.length;i++) {
        content.push(regions[i].name);
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
        path.flatten(0.01);
        content.push(path.segments.length);
        var line=[];
        for(j=0;j<path.segments.length;j++) {
            line.push(path.segments[j].point.x+","+path.segments[j].point.y);
        }
        content.push(line.join(" "));
    }

    if(typeof flagPrintSVG !== 'undefined' && flagPrintSVG === true) {
        console.log(paper.project.exportSVG({ asString: true }));
    }

    for(tmp of arr)
        tmp.remove();

    return content;
}
