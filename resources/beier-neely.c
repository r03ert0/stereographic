/*
    Beier & Neely morphing algorithm adapted to the sphere.
    v4
*/
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <string.h>

typedef struct
{
    double x,y;
}double2D;
typedef struct
{
    double x,y,z;
}double3D;
typedef struct
{
    int a,b,c;
}int3D;
typedef struct
{
    char    name[512];
    int     npoints;
    double2D *p;
}Line;
typedef struct
{
    int  nlines;
    Line *l;
}LineSet;
typedef struct
{
    int nlines;
    double *w;
    double2D *c;
}Weights;

typedef struct
{
    int     np;     // number of vertices
    int     nt;     // number of triangles
    double3D *p;     // vertices
    int3D   *t;     // triangles
}Mesh;

#define MIN(x,y) (((x)<(y))?(x):(y))
#define MAX(x,y) (((x)>(y))?(x):(y))

int verbose=1;

double dot3D(double3D a, double3D b)
{
    return (double){a.x*b.x+a.y*b.y+a.z*b.z};
}
double3D cross3D(double3D a, double3D b)
{
    return (double3D){a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};
}
double3D add3D(double3D a, double3D b)
{
    return (double3D){a.x+b.x,a.y+b.y,a.z+b.z};
}
double3D sub3D(double3D a, double3D b)
{
    return (double3D){a.x-b.x,a.y-b.y,a.z-b.z};
}
double3D sca3D(double3D a, double t)
{
    return (double3D){a.x*t,a.y*t,a.z*t};
}
double norm3D(double3D a)
{
    return sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
}

int Ply_load(char *path, Mesh *m)
{
    int     *np=&(m->np);
    int     *nt=&(m->nt);
    float	X,Y,Z;
    double3D **p=&(m->p);
    int3D   **t=&(m->t);
    FILE    *f;
    int     i,x;
    char    str[512],str1[256],str2[256];
    
    f=fopen(path,"r");
    if(f==NULL){printf("ERROR: Cannot open file\n");return 1;}

    // READ HEADER
    *np=*nt=0;
    do
    {
        fgets(str,511,f);
        sscanf(str," %s %s %i ",str1,str2,&x);
        if(strcmp(str1,"element")==0&&strcmp(str2,"vertex")==0)
            *np=x;
        else
        if(strcmp(str1,"element")==0&&strcmp(str2,"face")==0)
            *nt=x;
    }
    while(strcmp(str1,"end_header")!=0 && !feof(f));
    if((*np)*(*nt)==0)
    {
        printf("ERROR: Bad Ply file header format\n");
        return 1;
    }
    // READ VERTICES
    *p = (double3D*)calloc(*np,sizeof(double3D));
    if(*p==NULL){printf("ERROR: Not enough memory for mesh vertices\n");return 1;}
    for(i=0;i<*np;i++)
    {
        fscanf(f," %f %f %f ",&X,&Y,&Z);
        (*p)[i].x=X;
        (*p)[i].y=Y;
        (*p)[i].z=Z;
    }
    if(verbose)
        printf("Read %i vertices\n",*np);

    // READ TRIANGLES
    *t = (int3D*)calloc(*nt,sizeof(int3D));
    if(*t==NULL){printf("ERROR: Not enough memory for mesh triangles\n"); return 1;}
    for(i=0;i<*nt;i++)
        fscanf(f," 3 %i %i %i ",&((*t)[i].a),&((*t)[i].b),&((*t)[i].c));
    if(verbose)
        printf("Read %i triangles\n",*nt);

    fclose(f);

    return 0;
}
int Ply_save_mesh(char *path, Mesh *m)
{
    int     *np=&(m->np);
    int     *nt=&(m->nt);
    double3D *p=m->p;
    int3D   *t=m->t;
    FILE    *f;
    int     i;

    f=fopen(path,"w");
    if(f==NULL){printf("ERROR: Cannot open file\n");return 1;}

    // WRITE HEADER
    fprintf(f,"ply\n");
    fprintf(f,"format ascii 1.0\n");
    fprintf(f,"comment meshconvert, R. Toro 2010\n");
    fprintf(f,"element vertex %i\n",*np);
    fprintf(f,"property float x\n");
    fprintf(f,"property float y\n");
    fprintf(f,"property float z\n");
    fprintf(f,"element face %i\n",*nt);
    fprintf(f,"property list uchar int vertex_indices\n");
    fprintf(f,"end_header\n");

    // WRITE VERTICES
    for(i=0;i<*np;i++)
        fprintf(f,"%f %f %f\n",(float)p[i].x,(float)p[i].y,(float)p[i].z);    

    // WRITE TRIANGLES
    for(i=0;i<*nt;i++)
        fprintf(f,"3 %i %i %i\n",t[i].a,t[i].b,t[i].c);

    fclose(f);

    return 0;
}

void stereographic2sphere(double2D x0, double3D *x1)
{
    if(verbose>1) printf("[stereographic2sphere]\n");
    double b,z,f;
    b=sqrt(x0.x*x0.x+x0.y*x0.y);	if(verbose>1) printf("b: %g\n",b);
    if(b==0)
    {
        x1->x=0;
        x1->y=0;
        x1->z=1;
    }
    else
    {
        z=cos(b);					if(verbose>1) printf("z: %g\n",z);
        f=sqrt(1-z*z);				if(verbose>1) printf("f: %g\n",f);
        x1->x=x0.x*f/b;				if(verbose>1) printf("x: %g\n",x1->x);
        x1->y=x0.y*f/b;				if(verbose>1) printf("y: %g\n",x1->y);
        x1->z=z;
    }
}
void sphere2stereographic(double3D x0,double2D *x1)
{
    double a=atan2(x0.y,x0.x);
    double b=acos(x0.z/sqrt(x0.x*x0.x+x0.y*x0.y+x0.z*x0.z));
    x1->x=b*cos(a);
    x1->y=b*sin(a);
}
int transform(LineSet *l, Weights *w, double3D *x,int maxnl)
{
    if(verbose>1) printf("[transform]\n");
    int i,j,k;
    double3D	p,q,r,q1;
    double3D tmp,x0;
    double	sumw;
    double	a,b,length;
    double2D	xy;

    tmp=(double3D){0,0,0};
    sumw=0;
    k=0;
    for(i=0;i<maxnl/*l->nlines*/;i++)
    for(j=0;j<l->l[i].npoints-1;j++)
    {
        stereographic2sphere(l->l[i].p[j],&p);							if(verbose>1) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
        stereographic2sphere(l->l[i].p[j+1],&q);						if(verbose>1) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
        r=cross3D(p,q);
        r=sca3D(r,1/norm3D(r));											if(verbose>1) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
        q1=cross3D(r,p);												if(verbose>1) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
        a=w->c[k].x;
        length=acos(dot3D(p,q));										if(verbose>1) printf("length: %g\n",length);
        b=length*w->c[k].y;												if(verbose>1) printf("a,b: %g,%g\n",a,b);
        xy=(double2D){b*cos(a),b*sin(a)};								if(verbose>1) printf("xy: %g,%g\n",xy.x,xy.y);
        stereographic2sphere(xy,&x0);									if(verbose>1) printf("x0: %g,%g,%g\n",tmp.x,tmp.y,tmp.z);
        x0=add3D(add3D(sca3D(q1,x0.x),sca3D(r,x0.y)),sca3D(p,x0.z));	if(verbose>1) printf("x0': %g,%g,%g\n",x0.x,x0.y,x0.z);
        tmp=add3D(tmp,sca3D(x0,w->w[k]));
        sumw+=w->w[k];
        k++;
    }
    tmp=sca3D(tmp,1/sumw);
    *x=sca3D(tmp,1/norm3D(tmp));

    if(verbose>1) printf("Total number of weights applied: %i\n",k);

    return 0;
}
int weights(LineSet *l, double3D x, Weights *w, int maxnl)
{
    if(verbose>1) printf("[weights]\n");
    int i,j,k;
    double	length;
    double	a,b,c;
    double	fa,fb,t;
    double3D	p,q,r,q1;
    double3D	tmp;

    a=0.5;		// if a=0, there's no influence of line length on the weights
    b=0.01;	// a small number to ensure that the weights are defined even over the line
    c=2;		// a value that determines how quickly the influence of a line decreases with distance

    k=0;
    for(i=0;i<maxnl/*l->nlines*/;i++)
    for(j=0;j<l->l[i].npoints-1;j++)
    {
        stereographic2sphere(l->l[i].p[j],&p);			if(verbose>1) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
        stereographic2sphere(l->l[i].p[j+1],&q);		if(verbose>1) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
        r=cross3D(p,q);
        r=sca3D(r,1/norm3D(r));							if(verbose>1) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
        q1=cross3D(r,p);								if(verbose>1) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
        // coordinates
        w->c[k].x=atan2(dot3D(x,r),dot3D(x,q1));
        w->c[k].y=acos(dot3D(x,p))/acos(dot3D(p,q));	if(verbose>1) printf("c: %g,%g\n",w->c[i].x,w->c[i].y);
        // weight
        length=acos(dot3D(p,q));						if(verbose>1) printf("length: %g\n",length);
        fa=pow(length,a);
        // transformed coordinate
        t=acos(dot3D(p,x))/(acos(dot3D(p,x))+acos(dot3D(q,x)));
        tmp=add3D(sca3D(p,1-t),sca3D(q,t));
        fb=b+10*MIN(MIN(acos(dot3D(p,x)),acos(dot3D(q,x))),acos(dot3D(tmp,x)));
        w->w[k]=pow(fa/fb,c);							if(verbose>1) printf("w: %g\n",w->w[i]);
//		printf("sx:%g sy:%g tx:%g ty:%g px:%g py:%g pz:%g qx:%g qy:%g qz:%g x:%g y:%g fa:%g t:%g fb:%g w:%g;",l->l[i].p[j].x,l->l[i].p[j].y,l->l[i].p[j+1].x,l->l[i].p[j+1].y,p.x,p.y,p.z,q.x,q.y,q.z,w->c[k].x,w->c[k].y,fa,t,fb,w->w[k]);
        k++;
    }
//	printf("\n");
    if(verbose>1) printf("Total number of weights computed: %i\n",k);

    return 0;
}
int printLineSet(LineSet *l)
{
    int	i,j;

    printf("%i\n",l->nlines);
    for(i=0;i<l->nlines;i++)
    {
        printf("%s\n",l->l[i].name);
        printf("%i\n",l->l[i].npoints);
        for(j=0;j<l->l[i].npoints;j++)
            printf("%f,%f ",l->l[i].p[j].x,l->l[i].p[j].y);
        printf("\n");
    }
    return 0;
}
int loadLineSet(char *path, LineSet *l)
{
    if(verbose) printf("[loadLineSet]\n");
    /*
        LineSet file format:
        int 							// number of lines
        string							// name of the 1st line
        int								// number of points in the 1st line
        float,float float,float, ...	// stereographic coordinates of the points in the 1st line
        string							// name of the 2nd line
        int								// number of points in the 2nd line
        float,float float,float, ...	// stereographic coordinates of the points in the 2nd line
        ...
    */
    FILE *f;
    int  nlines,npoints;
    int  i,j;
    char str[512];

    f=fopen(path,"r");
    fgets(str,512,f);
    sscanf(str," %i ",&nlines);
    l->nlines=nlines;
    l->l=(Line*)calloc(nlines,sizeof(Line));
    for(i=0;i<nlines;i++)
    {
        fgets(str,512,f);
        sscanf(str," %s ",l->l[i].name);
        fgets(str,512,f);
        sscanf(str," %i ",&npoints);
        l->l[i].npoints=npoints;
        l->l[i].p=(double2D*)calloc(npoints,sizeof(double2D));
        for(j=0;j<npoints;j++)
            fscanf(f," %lf,%lf ",&(l->l[i].p[j].x),&(l->l[i].p[j].y));
    }
    fclose(f);

    /*
    printf("%i lines\n",nlines);
    for(i=0;i<nlines;i++)
    {
        printf("%s (%i) ",l->l[i].name,l->l[i].npoints);
        for(j=0;j<l->l[i].npoints;j++)
            printf("%f,%f ",l->l[i].p[j].x,l->l[i].p[j].y);
        printf("\n");
    }
    */

    return 0;
}
int findLineWithName(LineSet *l, char *name)
{
    if(verbose>1) printf("[findLineWithName]\n");
    int	j;
    int found=0;
    int	result;

    for(j=0;j<l->nlines;j++)
        if(strcmp(name,l->l[j].name)==0)
        {
            found=1;
            result=j;
            break;
        }
    if(!found)
        result=-1;
    return result;
}
int pairLines(LineSet *l1, LineSet *l2)
{
    if(verbose) printf("[pairLines]\n");
    int	i,j;
    int	found,keep=0;
    Line swap;

    for(i=0;i<l1->nlines;i++)
    {
        found=0;
        do
        {
            j=findLineWithName(l2,l1->l[i].name);
            if(j<0)
            {
                printf("Dropping line %i, '%s', which is in line set 1 but not in line set 2\n",i,l1->l[i].name);
                l1->l[i]=l1->l[l1->nlines-1];
                l1->nlines--;
            }
            else
                found=1;
        }
        while(!found && i<l1->nlines);
    
        if(found && i<l1->nlines)
        {
            swap=l2->l[i];
            l2->l[i]=l2->l[j];
            l2->l[j]=swap;
            keep++;
        }
    }
    return keep;
}
int resampleLine(Line *l, int nseg)
{
    if(verbose>1) printf("[resampleLine]\n");
    /*
        Resample the line into nseg equal-length segments
    */
    double tlength; // total length
    double slength; // segment length
    double s,t,d,g;
    int i,j;
    double3D p1,p2,px;
    double2D *spx;

    //printf("nsegments: %i, npoints: %i\n",nseg,l->npoints);

    // allocate memory for resampled points
    spx=(double2D*)calloc(nseg+1,sizeof(double2D));

    // compute the total length of the line and the length of each segment
    // in the resampled line (=total/nseg)
    tlength=0;
    for(i=0;i<l->npoints-1;i++)
    {
        stereographic2sphere(l->p[i],&p1);
        stereographic2sphere(l->p[i+1],&p2);
        tlength+=norm3D(sub3D(p1,p2));
    }
    slength=tlength/(double)nseg;
    //printf("total length: %g\nsegment length: %g\n",tlength,slength);

    // resample the line
    for(i=0;i<nseg+1;i++)
    {
        s=slength*i;
        t=0;
        for(j=0;j<l->npoints-1;j++)
        {
            stereographic2sphere(l->p[j],&p1);
            stereographic2sphere(l->p[j+1],&p2);
            d=norm3D(sub3D(p1,p2));
            //printf("t:%g, s:%g, t+d:%g\n",t,s,t+d);
            if(t<=s && t+d>=s-1e-6) // point is bracketed
            {
                g=(s-t)/d;
                px=add3D(sca3D(p1,1-g),sca3D(p2,g));
                px=sca3D(px,1/norm3D(px));
                sphere2stereographic(px,&(spx[i]));

                //printf("%g,%g,%g:%g,%g  ",px.x,px.y,px.z,spx[i].x,spx[i].y);

                break;
            }
            t+=d;
        }
    }

    // replace the points in the original line with the resampled ones
    if(l->npoints<nseg+1) {
        printf("EEEEERRRRROOOOORRRRR!!!! %i %i\n",l->npoints,nseg+1);
    }
    //printf("\n-----------------------------------------\n");
    l->npoints=nseg+1;
    for(i=0;i<nseg+1;i++)
    {
        l->p[i]=spx[i];
        //printf("%g,%g ",spx[i].x,spx[i].y);
    }
    //printf("\n");
    free(spx);

    return 0;
}
int resample(LineSet *l1, LineSet *l2, double d)
{
    if(verbose) printf("[resample]\n");
    /*
        Resample the lines into segments of length d
        1. for each pair of lines the number of segments has to be equal, so use the
           smaller number of segments
        2. adjust d to resample the lines into segments all of the same length
    */
    double length1,length2;
    double3D p1,p2;
    int	i,j,k,nseg;

    for(i=0;i<l1->nlines;i++)
    {
        length1=0;
        for(j=0;j<l1->l[i].npoints-1;j++)
        {
            stereographic2sphere(l1->l[i].p[j],&p1);
            stereographic2sphere(l1->l[i].p[j+1],&p2);
            length1+=norm3D(sub3D(p1,p2));
        }
        k=findLineWithName(l2,l1->l[i].name);
        length2=0;
        for(j=0;j<l2->l[k].npoints-1;j++)
        {
            stereographic2sphere(l2->l[k].p[j],&p1);
            stereographic2sphere(l2->l[k].p[j+1],&p2);
            length2+=norm3D(sub3D(p1,p2));
        }
        nseg=MAX(1,MIN((int)(length1/d+0.5),(int)(length2/d+0.5)));
        nseg=MIN(nseg,MIN(l1->l[i].npoints-1,l2->l[k].npoints-1));
        if(verbose) printf("line %s, %i segments\n",l1->l[i].name,nseg);
    
        resampleLine(&(l1->l[i]),nseg);
        resampleLine(&(l2->l[k]),nseg);
    }

    return 0;
}
int main(int argc, char *argv[])
{
    // input:
    // argv[1] path to line set 1
    // argv[2] path to line set 2
    // argv[3] path to sphere 3d ply mesh in the space of line set 1
    //
    // output:
    // argv[4] path to r=1 sphere 3d ply mesh in the space of line set 2
    //
    // test:
    // argv[5] number of line pairs to use

    LineSet	l1;
    LineSet	l2;
    double   d=0.1;
    Weights	w;
    double3D	x1;
    double3D	x2;
    double3D mi,ma;
    int i,j,k,nl,maxnl;
    Mesh m;

    // 1. Load line set 1
    loadLineSet(argv[1],&l1);

    // 2. Load line set 2
    loadLineSet(argv[2],&l2);

    // check line pairing
    nl=pairLines(&l1,&l2);
    if(nl==0)
    {
        printf("ERROR: There are no lines in common between both sets\n");
        return 1;
    }

    if(argc==6)
        maxnl=atoi(argv[5]);
    else
        maxnl=nl;		
    printf("Deformation based on %i/%i line pairs\n",maxnl,nl);

    // resample the lines to have a homogeneous number of segments
    resample(&l1,&l2,d);
    
    // count total number of segments that will be used for morphing
    k=0;
    for(i=0;i<l1.nlines;i++)
        k+=l1.l[i].npoints-1;
    w.nlines=k;
    w.w=(double*)calloc(k,sizeof(double));
    w.c=(double2D*)calloc(k,sizeof(double2D));

    // 3. get spherical mesh
    Ply_load(argv[3],&m);

    // center and normalise source mesh
    mi.x=ma.x=m.p[0].x;
    mi.y=ma.y=m.p[0].y;
    mi.z=ma.z=m.p[0].z;
    for(i=0;i<m.np;i++) {
        mi.x=(mi.x>m.p[i].x)?m.p[i].x:mi.x;
        mi.y=(mi.y>m.p[i].y)?m.p[i].y:mi.y;
        mi.z=(mi.z>m.p[i].z)?m.p[i].z:mi.z;
        ma.x=(ma.x<m.p[i].x)?m.p[i].x:ma.x;
        ma.y=(ma.y<m.p[i].y)?m.p[i].y:ma.y;
        ma.z=(ma.z<m.p[i].z)?m.p[i].z:ma.z;
    }
    for(i=0;i<m.np;i++) {
        m.p[i].x-=(mi.x+ma.x)/2.0;
        m.p[i].y-=(mi.y+ma.y)/2.0;
        m.p[i].z-=(mi.z+ma.z)/2.0;
    
        m.p[i]=sca3D(m.p[i],1/norm3D(m.p[i]));
    }

    for(j=0;j<m.np;j++)
    {
        x1=m.p[j];

        // 4. compute weights for x1 relative to set 1
        //printf("%i. ",j);
        weights(&l1,x1,&w,maxnl);

        // 5. compute x2=f(x1), applying the previous weights to line set 2
        transform(&l2,&w,&x2,maxnl);
    
        m.p[j]=x2;
    }

    // 6. save result
    printf("Saving to %s\n",argv[4]);
    Ply_save_mesh(argv[4],&m);

    // 7. clean up
    free(w.w);
    free(w.c);
    for(i=0;i<l1.nlines;i++)
        free(l1.l[i].p);
    free(l1.l);
    for(i=0;i<l2.nlines;i++)
        free(l2.l[i].p);
    free(l2.l);
    free(m.p);
    free(m.t);

    return 0;
}