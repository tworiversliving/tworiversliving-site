// Static map maths shared by src/components/AreaMap.astro and scripts/map-tiles.mjs.
// Tiles are OpenStreetMap's, downloaded once into public/maps/<slug>/ so the page makes no third-party requests.

export const MAP = { zoom: 15, width: 800, height: 450, tileSize: 256 };

export interface MapTile {
  file: string;
  url: string;
  /** Position of the tile's top-left corner inside the map frame, in map pixels. */
  dx: number;
  dy: number;
}

function project(lat: number, lng: number, zoom: number) {
  const size = MAP.tileSize * 2 ** zoom;
  const rad = (lat * Math.PI) / 180;
  return {
    x: ((lng + 180) / 360) * size,
    y: ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * size,
  };
}

/** Which tiles cover a map centred on the circle, and the circle's radius in map pixels. */
export function mapLayout(area: { lat: number; lng: number; radiusM: number }) {
  const { zoom, width, height, tileSize } = MAP;
  const centre = project(area.lat, area.lng, zoom);
  const left = centre.x - width / 2;
  const top = centre.y - height / 2;

  const tiles: MapTile[] = [];
  for (let ty = Math.floor(top / tileSize); ty <= Math.floor((top + height - 1) / tileSize); ty++) {
    for (let tx = Math.floor(left / tileSize); tx <= Math.floor((left + width - 1) / tileSize); tx++) {
      tiles.push({
        file: `${zoom}-${tx}-${ty}.png`,
        url: `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`,
        dx: Math.round(tx * tileSize - left),
        dy: Math.round(ty * tileSize - top),
      });
    }
  }

  const metresPerPixel = (156543.03392 * Math.cos((area.lat * Math.PI) / 180)) / 2 ** zoom;
  return { tiles, cx: width / 2, cy: height / 2, r: area.radiusM / metresPerPixel };
}
