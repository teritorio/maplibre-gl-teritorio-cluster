import { buildCss } from './helpers';

// code for creating a HTML div of individual earthquakes
export const createUnclusterHTML = (id: string) => {
  const clusterHTML = document.createElement('div')
  clusterHTML.id = id
  clusterHTML.classList.add('uncluster')

  buildCss(clusterHTML, {
    'display': 'flex',
    'gap': '2px',
    'flex-wrap': 'wrap',
    'max-width': '200px'
  })

  return clusterHTML
}