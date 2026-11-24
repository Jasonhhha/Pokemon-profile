import { harborHeight, ringBreakwaterSpans } from './field-city-layout';
import { ringAngle, ringPosition } from './field-ring-coordinates';

type Point = { x: number; z: number };
export type HarborCasting = { foot: Point[]; crown: Point[]; base: number; top: number; color: string; lit?: boolean };
export type PierHead = { center: Point; castings: HarborCasting[]; height: number };

const stone = '#bcad90', wetGranite = '#697b73', soot = '#404f50', coping = '#d5c7a4', slate = '#40575b', copper = '#7d9b87';

// Each tip has a tide-stained footing, a watch gallery and a glazed navigation light.
// The lower pair marks the outer fairway. The tall pair frames the approach to the fortress lock.
function pierHead(column: number, tall: boolean, port: boolean): PierHead {
  const row = harborHeight + .63;
  const center = ringPosition(column, row);
  const angle = ringAngle(column), cs = Math.cos(angle), sn = Math.sin(angle);
  const castings: HarborCasting[] = [];
  const width = tall ? .98 : .67;
  const world = (x: number, z: number) => ({ x: center.x + cs*x + sn*z, z: center.z - sn*x + cs*z });
  function drum(sides: number, radius: number, x = 0, z = 0) {
    return Array.from({ length: sides }, (_, i) => {
      const a = 2*Math.PI*(i+.5)/sides;
      return world(x + radius*Math.sin(a), z + radius*Math.cos(a));
    });
  }
  function tier(bottom: number, top: number, lowerRadius: number, upperRadius: number, color: string, lit = false) {
    castings.push({ base: bottom, top, foot: drum(8, lowerRadius * width), crown: drum(8, upperRadius * width), color, lit });
  }
  function post(x: number, z: number, radius: number, bottom: number, top: number, color: string) {
    const foot = drum(4, radius, x*width, z*width);
    castings.push({ base: bottom, top, foot, crown: foot, color });
  }
  const deck = tall ? 2.08 : 1.22;
  tier(-.84, -.40, 1.24, 1.17, wetGranite);
  tier(-.40, .08, 1.17, 1.05, '#90968a');
  tier(.08, .19, 1.07, 1.09, coping);
  tier(.19, .33, .86, .81, '#8d8675');
  tier(.33, deck-.17, .78, .69, stone);
  tier(deck-.17, deck-.10, .72, .80, soot);
  tier(deck-.10, deck+.04, .80, .89, coping);
  tier(deck+.04, deck+.11, .90, .90, slate);
  const lintel = deck + (tall ? .90 : .58);
  // Recessing the lens leaves clear depth between the octagonal mullions.
  tier(deck+.12, lintel, .36, .36, port ? '#bc7560' : '#80ac94', true);
  for (let i=0; i<8; i++) {
    const a=2*Math.PI*(i+.5)/8;
    post(.65*Math.sin(a), .65*Math.cos(a), tall ? .063 : .045, deck+.10, lintel+.035, soot);
  }
  tier(lintel, lintel+.11, .80, .82, soot);
  tier(lintel+.11, lintel+.20, .85, .85, copper);
  tier(lintel+.20, lintel+(tall ? .83 : .56), .88, .12, slate);
  tier(lintel+(tall ? .77 : .51), lintel+(tall ? .91 : .62), .19, .11, copper);
  post(0, 0, .040, lintel+.57, lintel+(tall ? 1.26 : .79), soot);
  if (tall) {
    // Slit windows sit just forward of an ashlar face, with sill and hood following its slope.
    for (let i=0; i<8; i+=2) {
      const a=2*Math.PI*(i+1)/8, dx=Math.sin(a), dz=Math.cos(a);
      function plate(halfWidth: number, distance: number, bottom: number, top: number, color: string) {
        const corners = [[-halfWidth,0],[halfWidth,0],[halfWidth,.046],[-halfWidth,.046]].map(([w,d]) =>
          world((dx*(distance+d)+dz*w)*width, (dz*(distance+d)-dx*w)*width));
        castings.push({ base: bottom, top, foot: corners, crown: corners, color });
      }
      plate(.105, .680, .81, 1.50, soot);
      plate(.175, .696, .76, .83, coping);
      plate(.170, .669, 1.48, 1.56, coping);
    }
  }
  return { center, castings, height: lintel+(tall ? 1.26 : .79) };
}

export const harborHeads = [
  pierHead(ringBreakwaterSpans[0][1] - .16, false, true),
  pierHead(ringBreakwaterSpans[1][0] + .16, false, false),
  pierHead(ringBreakwaterSpans[1][1] - .16, true, true),
  pierHead(ringBreakwaterSpans[2][0] + .16, true, false),
];
