/*
	Beier & Neely morphing algorithm adapted to the sphere.
	v2
	
	This version read very simple line set files
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
	int nlines;
	float2D	*p;
}LineSet;
typedef struct
{
	int nlines;
	float *w;
	float2D *c;
}Weights;

#define MIN(x,y) (((x)<(y))?(x):(y))

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
	float b,z,f;
	b=sqrt(x0.x*x0.x+x0.y*x0.y);	if(verbose) printf("b: %g\n",b);
	if(b==0)
	{
		x1->x=0;
		x1->y=0;
		x1->z=1;
	}
	else
	{
		z=cos(b);					if(verbose) printf("z: %g\n",z);
		f=sqrt(1-z*z);				if(verbose) printf("f: %g\n",f);
		x1->x=x0.x*f/b;				if(verbose) printf("x: %g\n",x1->x);
		x1->y=x0.y*f/b;				if(verbose) printf("y: %g\n",x1->y);
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
int transform(LineSet *l, Weights *w, float2D *x)
{
	int i;
	float3D	p,q,r,q1;
	float3D tmp,x0,x1;
	float	sumw;
	float	a,b,length;
	float2D	xy;
	
	tmp=(float3D){0,0,0};
	sumw=0;
	for(i=0;i<l->nlines;i++)
	{
		stereographic2sphere(l->p[i*2],&p);								if(verbose) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
		stereographic2sphere(l->p[i*2+1],&q);							if(verbose) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
		stereographic2sphere(*x,&x1);
		r=cross3D(p,q);
		r=sca3D(r,1/norm3D(r));											if(verbose) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
		q1=cross3D(r,p);												if(verbose) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
		a=w->c[i].x;
		length=acos(dot3D(p,q));										if(verbose) printf("length: %g\n",length);
		b=length*w->c[i].y;												if(verbose) printf("a,b: %g,%g\n",a,b);
		xy=(float2D){b*cos(a),b*sin(a)};								if(verbose) printf("xy: %g,%g\n",xy.x,xy.y);
		stereographic2sphere(xy,&x0);									if(verbose) printf("x0: %g,%g,%g\n",tmp.x,tmp.y,tmp.z);
		x0=add3D(add3D(sca3D(q1,x0.x),sca3D(r,x0.y)),sca3D(p,x0.z));	if(verbose) printf("x0': %g,%g,%g\n",x0.x,x0.y,x0.z);
		tmp=add3D(tmp,sca3D(x0,w->w[i]));
		sumw+=w->w[i];
	}
	sphere2stereographic(sca3D(tmp,1/sumw),x);							if(verbose) printf("x: %g,%g\n",x->x,x->y);

	return 0;
}
int weights(LineSet *l, float2D x, Weights *w)
{
	int i;
	float	length;
	float	a,b,c;
	float	fa,fb,t;
	float3D	p,q,r,q1,x1;
	float3D	tmp;
	
	a=0.5;		// if a=0, there's no influence of line length on the weights
	b=0.001;	// a small number to ensure that the weights are defined even over the line
	c=2;		// a value that determines how quickly the influence of a line decreases with distance
	
	stereographic2sphere(x,&x1);						if(verbose) printf("x1: %g,%g,%g\n",x1.x,x1.y,x1.z);
	for(i=0;i<l->nlines;i++)
	{
		stereographic2sphere(l->p[i*2],&p);				if(verbose) printf("p: %g,%g,%g\n",p.x,p.y,p.z);
		stereographic2sphere(l->p[i*2+1],&q);			if(verbose) printf("q: %g,%g,%g\n",q.x,q.y,q.z);
		r=cross3D(p,q);
		r=sca3D(r,1/norm3D(r));							if(verbose) printf("r: %g,%g,%g\n",r.x,r.y,r.z);
		q1=cross3D(r,p);								if(verbose) printf("q1: %g,%g,%g\n",q1.x,q1.y,q1.z);
		// coordinates
		w->c[i].x=atan2(dot3D(x1,r),dot3D(x1,q1));
		w->c[i].y=acos(dot3D(x1,p))/acos(dot3D(p,q));	if(verbose) printf("c: %g,%g\n",w->c[i].x,w->c[i].y);
		// weight
		length=acos(dot3D(p,q));						if(verbose) printf("length: %g\n",length);
		fa=pow(length,a);
		// transformed coordinate
		t=acos(dot3D(p,x1))/(acos(dot3D(p,x1))+acos(dot3D(q,x1)));
		tmp=add3D(sca3D(p,1-t),sca3D(q,t));
		fb=b+MIN(MIN(acos(dot3D(p,x1)),acos(dot3D(q,x1))),acos(dot3D(tmp,x1)));
		w->w[i]=pow(fa/fb,c);							if(verbose) printf("w: %g\n",w->w[i]);
	}
	
	return 0;
}
int main(int argc, char *argv[])
{
	// input:
	// argv[1] path to line set 1
	// argv[2] path to line set 2
	// argv[3] stereotaxic coordinate in the space of line set 1
	//
	// output:
	// stereotaxic coordinate in the space of line set 2
	
	FILE *f;
	int	i,nlines,tmp;
	LineSet	l1;
	LineSet	l2;
	Weights	w;
	float2D	x1,x2;
	char str[512];
	
	// 1. Load line set 1
	f=fopen(argv[1],"r");
	fgets(str,512,f);
	sscanf(str," %i ",&nlines);
	l1.nlines=nlines;
	l1.p=(float2D*)calloc(nlines*2,sizeof(float2D));
	for(i=0;i<nlines;i++)
	{
		fgets(str,512,f);
		sscanf(str," %f %f %f %f ",&(l1.p[2*i].x),&(l1.p[2*i].y),&(l1.p[2*i+1].x),&(l1.p[2*i+1].y));
	}
	fclose(f);
	
	// 2. Load line set 2
	l2.nlines=nlines;
	l2.p=(float2D*)calloc(nlines*2,sizeof(float2D));
	f=fopen(argv[2],"r");
	fgets(str,512,f);
	sscanf(str," %i ",&tmp);
	if(tmp!=nlines)
	{
		printf("ERROR: The number of lines in both sets has to be the same\n");
		return 1;
	}
	for(i=0;i<nlines;i++)
	{
		fgets(str,512,f);
		sscanf(str," %f %f %f %f ",&(l2.p[2*i].x),&(l2.p[2*i].y),&(l2.p[2*i+1].x),&(l2.p[2*i+1].y));
	}
	fclose(f);
	
	//3. get x
	sscanf(argv[3]," %f,%f ",&(x1.x),&(x1.y));
	
	// 4. compute weights for x1 relative to set 1
	w.nlines=nlines;
	w.w=(float*)calloc(nlines,sizeof(float));
	w.c=(float2D*)calloc(nlines,sizeof(float2D));
	weights(&l1,x1,&w);
	
	// 5. compute x2=f(x1), applying the previous weights to line set 2
	transform(&l2,&w,&x2);
	
	// 6. print result
	printf("%f %f\n",x2.x,x2.y);
	
	return 0;
}