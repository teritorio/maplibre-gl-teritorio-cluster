import type { MapGeoJSONFeature } from 'maplibre-gl'
import { buildCss } from './helpers';

const colors = ['#fed976', '#feb24c', '#fd8d3c', '#fc4e2a', '#e31a1c'];
const markerDim = {
  width: 24,
  height: 24,
  gap: 2
}

// code for creating a HTML div of individual earthquakes
export const createUncluster = (features: GeoJSON.Feature[], clickHandler: (e: Event) => void) => {
  const clusterHTML = document.createElement('div')

  buildCss(clusterHTML, {
    'display': 'flex',
    'gap': `${markerDim.gap}px`,
    'flex-wrap': 'wrap',
    'max-width': '200px'
  })

  features.forEach(feature => {
    const featureHTML = document.createElement('div')
    featureHTML.id = feature.properties?.id
    featureHTML.textContent = feature.properties?.mag

    buildCss(featureHTML, {
      'background-color': 'blue',
      'border-radius': '100%',
      'justify-content': 'center',
      'align-items': 'center',
      'display': 'flex',
      'color': 'white',
      'width': `${markerDim.width}px`,
      'height': `${markerDim.height}px`,
    });

    featureHTML.addEventListener('click', clickHandler)

    clusterHTML.append(featureHTML)
  })

  return clusterHTML
}

// code for creating an SVG donut chart from feature properties
export const createDonutChart = (props: MapGeoJSONFeature['properties']) => {
  const offsets = [];
  let total = 0;
  const counts = [
    props.mag1,
    props.mag2,
    props.mag3,
    props.mag4,
    props.mag5
  ];

  for (let i = 0; i < counts.length; i++) {
    offsets.push(total);
    total += counts[i];
  }

  const fontSize = total >= 1000 ? 22 : total >= 100 ? 20 : total >= 10 ? 18 : 16;
  const r = total >= 1000 ? 50 : total >= 100 ? 32 : total >= 10 ? 24 : 18;
  const r0 = Math.round(r * 0.6);
  const w = r * 2;

  let html =
    `<svg width="${w
    }" height="${w
    }" viewbox="0 0 ${w
    } ${w
    }" text-anchor="middle" style="font: ${fontSize
    }px sans-serif; display: block">`;

  for (let i = 0; i < counts.length; i++) {
    html += donutSegment(
      offsets[i] / total,
      (offsets[i] + counts[i]) / total,
      r,
      r0,
      colors[i]
    );
  }

  html +=
    `<circle cx="${r
    }" cy="${r
    }" r="${r0
    }" fill="white" /><text dominant-baseline="central" transform="translate(${r
    }, ${r
    })">${total.toLocaleString()
    }</text></svg>`;

  const el = document.createElement('div');
  el.innerHTML = html;

  return el;
}

const donutSegment = (start: number, end: number, r: number, r0: number, color: string) => {
  if (end - start === 1)
    end -= 0.00001;

  const a0 = 2 * Math.PI * (start - 0.25);
  const a1 = 2 * Math.PI * (end - 0.25);
  const x0 = Math.cos(a0), y0 = Math.sin(a0);
  const x1 = Math.cos(a1), y1 = Math.sin(a1);
  const largeArc = end - start > 0.5 ? 1 : 0;

  return [
    '<path d="M',
    r + r0 * x0,
    r + r0 * y0,
    'L',
    r + r * x0,
    r + r * y0,
    'A',
    r,
    r,
    0,
    largeArc,
    1,
    r + r * x1,
    r + r * y1,
    'L',
    r + r0 * x1,
    r + r0 * y1,
    'A',
    r0,
    r0,
    0,
    largeArc,
    0,
    r + r0 * x0,
    r + r0 * y0,
    `" fill="${color}" />`
  ].join(' ');
}
