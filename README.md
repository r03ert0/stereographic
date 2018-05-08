# Cartographer

Roberto Toro, January 2015

Vectorial annotation of cortical surfaces and morphing.

Or in other words, a tool to draw landmarks over brain meshes. The nice thing is that you don't
have to draw them in the folded mesh – which would be very tricky – but on a flat version of
the mesh. Now, even drawing landmarks on a flat mesh would be challenging if you were using, for
example, a Van Essen like flattening of the mesh with cuts. Plus, if you had brains which were
not humans nor macaques, you would have to figure out for each new brain how to best cut the
neocortex to flatten it. Using stereogrographic, you can generate mesh flattenings based on a
spherical deformation of your mesh, in real time. Stereographic flattenings are very fast to
compute and do not require any ad-hoc mesh cut. They do tend to have a lot of deformation as
you move towards the periphery, but this doesn't really matter because you can always move the
cortical regions from the periphery to the centre of the map, which has the less deformation.

Drawing landmarks on the flat surfaces is much easier. Stereographic lets you draw vectorial
landmarks, as you would do in Inkscape. This landmarks are resolution independent, and will
work even if you decide later on to increase the density of vertices in your meshes. Although
you see and interact with the vectorial landmarks in 2D, they are encoded internally in 3D
and projected to the flat surface. Thanks to that, if you displace the centre of your flat map,
the landmarks will transform to register with the new map.

<img width="1428" alt="screenshot1" src="https://user-images.githubusercontent.com/2310732/34650646-c1a1d0f2-f3c4-11e7-91bc-08d3649d59a1.png">

<img width="1428" alt="screenshot2" src="https://user-images.githubusercontent.com/2310732/34650648-c93c5530-f3c4-11e7-9332-88200a4381e9.png">

<img width="1428" alt="screenshot3" src="https://user-images.githubusercontent.com/2310732/34650649-ce7dbaac-f3c4-11e7-96a9-cfd864b17113.png">

<img src="https://user-images.githubusercontent.com/2310732/35473124-a61537e0-037b-11e8-9376-f3cd4e96dca5.gif" >
