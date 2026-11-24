export type PalaceOrbit = { angle: number; tilt: number };

// Fit the 49-square plan and the north facade inside both viewport dimensions.
export function palaceOverlook(orbit: PalaceOrbit, aspect: number) {
  const angle=.28+orbit.angle, pitch=.75+orbit.tilt*.74;
  const extent=24.5*(Math.abs(Math.cos(angle))+Math.abs(Math.sin(angle)));
  const distance=Math.max((extent+1.5)/(Math.tan(22*Math.PI/180)*aspect), (extent*Math.sin(pitch)+7)/Math.tan(22*Math.PI/180))+extent*.67;
  const aim=[24.5,2.6,23.5] as const;
  const ground=distance*Math.cos(pitch);
  const eye=[aim[0]+ground*Math.sin(angle),aim[1]+distance*Math.sin(pitch),aim[2]+ground*Math.cos(angle)] as const;
  return {eye,aim};
}

// A sectional view removes only the perimeter on the observer's side.
export function outerWall(x:number,z:number) {
  if(z < 3.1) return 'north';
  if(x < 3.15) return 'west';
  if(x > 45.85) return 'east';
}
export function wallFacesCamera(wall:ReturnType<typeof outerWall>, orbit?:PalaceOrbit) {
  if(!orbit || !wall) return false;
  const azimuth=.28+orbit.angle;
  if(wall==='north') return Math.cos(azimuth)<-.45;
  return Math.sin(azimuth)*(wall==='east'?1:-1)>.45;
}
