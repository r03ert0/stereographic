/*
	Beier & Neely morphing algorithm adapted to the sphere.
	v3
	This version was able to morph only one vertex per run, v4 will load ply surfaces
*/
#include <stdlib.h>
#include <stdio.h>
#include <math.h>
#include <string.h>

typedef struct
{
	float x,y;
}float2D;
typedef struct
{
	float x,y,z;
}float3D;
typedef struct
{
	char    name[512];
	int     npoints;
	float2D *p;
}Line;
typedef struct
{
	int  nlines;
	Line *l;
}LineSet;
typedef struct
{
	int nlines;
	float *w;
	float2D *c;
}Weights;

#define MIN(x,y) (((x)<(y))?(x):(y))
#define MAX(x,y) (((x)>(y))?(x):(y))

int verbose=0;

float dot3D(float3D a, float3D b)
{
    return (float){a.x*b.x+a.y*b.y+a.z*b.z};
}
float3D cross3D(float3D a, float3D b)
{
    return (float3D){a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x};
}
float3D add3D(float3D a, float3D b)
{
    return (float3D){a.x+b.x,a.y+b.y,a.z+b.z};
}
float3D sub3D(float3D a, float3D b)
{
    return (float3D){a.x-b.x,a.y-b.y,a.z-b.z};
}
float3D sca3D(float3D a, float t)
{
    return (float3D){a.x*t,a.y*t,a.z*t};
}
float norm3D(float3D a)
{
    return sqrt(a.x*a.x+a.y*a.y+a.z*a.z);
}

void stereographic2sphere(float2D x0, float3D *x1)
{
	if(verbose>1) printf("_________________________________________stereographic2sphere\n");
	float b,z,f;
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
void sphere2stereographic(float3D x0,float2D *x1)
{
	float a=atan2(x0.y,x0.x);
	float b=acos(x0.z/sqrt(x0.x*x0.x+x0.y*x0.y+x0.z*x0.z));
	x1->x=b*cos(a);
	x1->y=b*sin(a);
}
int transform(LineSet *l, Weights *w, float3D *x)
{
	if(verbose) printf("___________________________________________________transform\n");
	int i,j,k;
	float3D	p,q,r,q1;
	float3D tmp,x0;
	float	sumw;
	float	a,b,length;
	float2D	xy;
	
	tmp=(float3D){0,0,0};
	sumw=0;
	k=0;
	for(i=0;i<l->nlines;i++)
	for(j=0;j<l->l[i].npoints-1;j++)
	{
		stereographic2sphere(l->l[i].p[j],&p);							if(verbose) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
		stereographic2sphere(l->l[i].p[j+1],&q);						if(verbose) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
		r=cross3D(p,q);
		r=sca3D(r,1/norm3D(r));											if(verbose) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
		q1=cross3D(r,p);												if(verbose) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
		a=w->c[k].x;
		length=acos(dot3D(p,q));										if(verbose) printf("length: %g\n",length);
		b=length*w->c[k].y;												if(verbose) printf("a,b: %g,%g\n",a,b);
		xy=(float2D){b*cos(a),b*sin(a)};								if(verbose) printf("xy: %g,%g\n",xy.x,xy.y);
		stereographic2sphere(xy,&x0);									if(verbose) printf("x0: %g,%g,%g\n",tmp.x,tmp.y,tmp.z);
		x0=add3D(add3D(sca3D(q1,x0.x),sca3D(r,x0.y)),sca3D(p,x0.z));	if(verbose) printf("x0': %g,%g,%g\n",x0.x,x0.y,x0.z);
		tmp=add3D(tmp,sca3D(x0,w->w[k]));
		sumw+=w->w[k];
		k++;
	}
	tmp=sca3D(tmp,1/sumw);
	*x=sca3D(tmp,1/norm3D(tmp));

	if(verbose) printf("Total number of weights applied: %i\n",k);

	return 0;
}
int weights(LineSet *l, float3D x, Weights *w)
{
	if(verbose) printf("______________________________________________________weights\n");
	int i,j,k;
	float	length;
	float	a,b,c;
	float	fa,fb,t;
	float3D	p,q,r,q1;
	float3D	tmp;
	
	a=0.5;		// if a=0, there's no influence of line length on the weights
	b=0.001;	// a small number to ensure that the weights are defined even over the line
	c=2;		// a value that determines how quickly the influence of a line decreases with distance
	
	k=0;
	for(i=0;i<l->nlines;i++)
	for(j=0;j<l->l[i].npoints-1;j++)
	{
		stereographic2sphere(l->l[i].p[j],&p);			if(verbose) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
		stereographic2sphere(l->l[i].p[j+1],&q);		if(verbose) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
		r=cross3D(p,q);
		r=sca3D(r,1/norm3D(r));							if(verbose) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
		q1=cross3D(r,p);								if(verbose) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
		// coordinates
		w->c[k].x=atan2(dot3D(x,r),dot3D(x,q1));
		w->c[k].y=acos(dot3D(x,p))/acos(dot3D(p,q));	if(verbose) printf("c: %g,%g\n",w->c[i].x,w->c[i].y);
		// weight
		length=acos(dot3D(p,q));						if(verbose) printf("length: %g\n",length);
		fa=pow(length,a);
		// transformed coordinate
		t=acos(dot3D(p,x))/(acos(dot3D(p,x))+acos(dot3D(q,x)));
		tmp=add3D(sca3D(p,1-t),sca3D(q,t));
		fb=b+10*MIN(MIN(acos(dot3D(p,x)),acos(dot3D(q,x))),acos(dot3D(tmp,x)));
		w->w[k]=pow(fa/fb,c);							if(verbose) printf("w: %g\n",w->w[i]);
		k++;
	}
	if(verbose) printf("Total number of weights computed: %i\n",k);
	
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
	if(verbose) printf("__________________________________________________loadLineSet\n");
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
		l->l[i].p=(float2D*)calloc(npoints,sizeof(float2D));
		for(j=0;j<npoints;j++)
			fscanf(f," %f,%f ",&(l->l[i].p[j].x),&(l->l[i].p[j].y));
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
	if(verbose) printf("_____________________________________________findLineWithName\n");
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
int checkLinePairing(LineSet *l1, LineSet *l2)
{
	if(verbose) printf("_____________________________________________checkLinePairing\n");
	int	i,j;
	int	result=1;
	Line swap;
	
	for(i=0;i<l1->nlines;i++)
	{
		j=findLineWithName(l2,l1->l[i].name);
		if(j<0)
		{
			printf("Line %i, '%s', in set 1 is not in line set 2\n",i,l1->l[i].name);
			result=0;
		}
		else
		{
			swap=l2->l[i];
			l2->l[i]=l2->l[j];
			l2->l[j]=swap;
		}
	}
	return result;
}
int resampleLine(Line *l, int nseg)
{
	if(verbose) printf("_________________________________________________resampleLine\n");
	/*
		Resample the line into nseg equal-length segments
	*/
	float tlength; // total length
	float slength; // segment length
	float s,t,d,g;
	int i,j;
	float3D p1,p2,px;
	float2D *spx;
	
	// allocate memory for resampled points
	spx=(float2D*)calloc(nseg+1,sizeof(float2D));
	
	// compute the total length of the line and the length of each segment
	// in the resampled line (=total/nseg)
	tlength=0;
	for(i=0;i<l->npoints-1;i++)
	{
		stereographic2sphere(l->p[i],&p1);
		stereographic2sphere(l->p[i+1],&p2);
		tlength+=norm3D(sub3D(p1,p2));
	}
	slength=tlength/(float)nseg;
	
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
			if(t<=s && t+d>=s) // point is bracketed
			{
				g=(s-t)/d;
				px=add3D(sca3D(p1,1-g),sca3D(p2,g));
				px=sca3D(px,1/norm3D(px));
				sphere2stereographic(px,&(spx[i]));
				break;
			}
			t+=d;
		}
	}
	
	// replace the points in the original line with the resampled ones
	if(l->npoints<nseg+1) {
		printf("EEEEERRRRROOOOORRRRR!!!! %i %i\n",l->npoints,nseg+1);
	}
	l->npoints=nseg+1;
	for(i=0;i<nseg+1;i++)
		l->p[i]=spx[i];
	free(spx);
	
	return 0;
}
int resample(LineSet *l1, LineSet *l2, float d)
{
	if(verbose) printf("_____________________________________________________resample\n");
	/*
		Resample the lines into segments of length d
		1. for each pair of lines the number of segments has to be equal, so use the
		   smaller number of segments
		2. adjust d to resample the lines into segments all of the same length
	*/
	float length1,length2;
	float3D p1,p2;
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
		if(verbose) printf("line %s, number of segments:%i\n",l1->l[i].name,nseg);
		
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
	// argv[3] r=1 sphere 3d coordinates for a point in the space of line set 1
	//
	// output:
	// stereotaxic coordinate in the space of line set 2
	
	//int	tmp;
	LineSet	l1;
	LineSet	l2;
	float   d=0.1;
	Weights	w;
	float3D	x1;
	float3D	x2;
	int i,k;
	
	// 1. Load line set 1
	loadLineSet(argv[1],&l1);
	
	// 2. Load line set 2
	loadLineSet(argv[2],&l2);
	
	// check number of lines
	if(l2.nlines!=l1.nlines)
	{
		printf("ERROR: The number of lines in both sets has to be the same\n");
		return 1;
	}
	
	// check line pairing
	if(!checkLinePairing(&l1,&l2))
	{
		printf("ERROR: The lines in both sets are not the same\n");
		return 1;
	}

	// resample the lines to have a homogeneous number of segments
	resample(&l1,&l2,d);
	//printLineSet(&l1);
	//printLineSet(&l2);
		
	// 3. get x
	sscanf(argv[3]," %f,%f,%f ",&(x1.x),&(x1.y),&(x1.z));
	x1=sca3D(x1,1/norm3D(x1));
	if(verbose) printf("normalised x: %f,%f,%f\n",x1.x,x1.y,x1.z);
	//sphere2stereographic(x1,&a);
	//printf("%f,%f\n",a.x,a.y);
	
	/* test
	// tmp. use only argv[4] lines
	l1.nlines=atoi(argv[4]);
	l2.nlines=atoi(argv[4]);
	*/
	
	// 4. compute weights for x1 relative to set 1
	k=0;
	for(i=0;i<l1.nlines;i++)
		k+=l1.l[i].npoints-1;
	if(verbose) printf("Total number of segments: %i\n",k);
	w.nlines=k;
	w.w=(float*)calloc(k,sizeof(float));
	w.c=(float2D*)calloc(k,sizeof(float2D));
	weights(&l1,x1,&w);
	
	// 5. compute x2=f(x1), applying the previous weights to line set 2
	transform(&l2,&w,&x2);
	
	// 6. print result
	printf("%f %f %f\n",x2.x,x2.y,x2.z);
	//sphere2stereographic(x2,&a);
	//printf("%f,%f\n",a.x,a.y);

	// 7. clean up
	free(w.w);
	free(w.c);
	for(i=0;i<l1.nlines;i++)
		free(l1.l[i].p);
	free(l1.l);
	for(i=0;i<l2.nlines;i++)
		free(l2.l[i].p);
	free(l2.l);
	
	return 0;
}