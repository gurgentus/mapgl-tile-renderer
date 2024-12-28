#!/usr/bin/env node
import { initiateRendering } from "./initiate.js";

import {
  parseListToFloat,
  validateInputOptions,
  handleError,
} from "./utils.js";

export const render = async (options) => {
  const {
    style,
    styleLocation,
    sourceDir,
    apiKey,
    mapboxStyle,
    monthYear,
    openStreetMap,
    overlay,
    bounds,
    minZoom = 0,
    maxZoom,
    ratio = 1,
    tiletype = "jpg",
    format = "mbtiles",
    outputDir = "outputs",
    outputFilename = "output",
    thumbnail = false,
  } = options;
  console.log("VALIDATE")
  const boundsArray = parseListToFloat(bounds);
  validateInputOptions(
    style,
    styleLocation,
    sourceDir,
    apiKey,
    mapboxStyle,
    monthYear,
    openStreetMap,
    overlay,
    boundsArray,
    minZoom,
    maxZoom,
  );

  console.log("\n======== Rendering map tiles with MapLibre GL ========");

  console.log("Map style: %j", style);
  if (styleLocation)
    console.log("Location of self-hosted stylesheet: %j", styleLocation);
  if (sourceDir) console.log("Location of self-hosted sources: %j", sourceDir);
  if (apiKey) console.log("API key: %j", apiKey);
  if (mapboxStyle) console.log("Mapbox style: %j", mapboxStyle);
  if (monthYear)
    console.log("Month and year (for Planet monthly basemaps): %j", monthYear);
  if (openStreetMap) console.log("OpenStreetMap overlay: %j", openStreetMap);
  if (overlay) console.log("Overlay: %j", overlay);
  console.log("Bounding box: %j", bounds);
  console.log("Min zoom: %j", minZoom);
  console.log("Max zoom: %j", maxZoom);
  console.log("Ratio: %j", ratio);
  console.log("Generate thumbnail: %j", thumbnail);
  console.log("Format: %j", format);
  console.log("Output tile type: %j", tiletype);
  console.log("Output directory: %j", outputDir);
  console.log("Output MBTiles filename: %j", outputFilename);
  console.log("======================================================\n");

  const renderResult = await initiateRendering(
    style,
    styleLocation,
    sourceDir,
    apiKey,
    mapboxStyle,
    monthYear,
    openStreetMap,
    overlay,
    boundsArray,
    minZoom,
    maxZoom,
    ratio,
    tiletype,
    format,
    outputDir,
    outputFilename,
    thumbnail,
  );

  console.log("\n======== Render Result ========");
  console.log("Style: %j", renderResult.style);
  console.log("Status: %j", renderResult.status);
  if (renderResult.errorMessage) {
    console.log("Error message: %j", renderResult.errorMessage);
  }
  console.log("File location: %j", renderResult.fileLocation);
  console.log("Filename: %j", renderResult.filename);
  console.log("File size: %j", renderResult.fileSize);
  console.log("Number of tiles: %j", renderResult.numberOfTiles);
  if (renderResult.thumbnailFilename) {
    console.log("Thumbnail filename: %j", renderResult.thumbnailFilename);
  }
  console.log("Work begun: %j", renderResult.workBegun);
  console.log("Work ended: %j", renderResult.workEnded);
  console.log("================================");
}