import { render } from './api.js'

export const handler = async (event, context) => {
  console.log("EVENT", event)

  await render({
    style: 'self',
    styleLocation: 'outputs/style-with-geojson.json',
    sourceDir: 'outputs',
    bounds: event.bounds, // '-79,37,-77,38',
    minZoom: event.minZoom,
    maxZoom: event.maxZoom, // 8,
    tiletype: event.tiletype, // 'png',
  });

  return {
    statusCode: 200,
    body: {
      code: 200,
      message: "Success!!"
    }
  };
}