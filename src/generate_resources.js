import fs from "fs";
import path from "path";
import sharp from "sharp";
import ora from "ora";
import MBTiles from "@mapbox/mbtiles";
import fromMBTiles from "styled-map-package/from-mbtiles";

import {
  calculateTileRangeForBounds,
  validateMinMaxValues,
} from "./tile_calculations.js";
import { renderTile, renderThumbnail } from "./render_map.js";
import {
  basicMapStyle,
  openStreetMapStyle,
  protomapsStyle,
} from "./map_styles.js";

// Generate a MapGL style JSON object from a remote source
// and an additional source.
export const generateStyle = (
  style,
  overlay,
  openStreetMap,
  tileSize,
  tempDir,
) => {
  let styleObject;
  if (style === "protomaps") {
    styleObject = protomapsStyle(tempDir);
  } else if (openStreetMap) {
    styleObject = openStreetMapStyle(style, tileSize);
  } else {
    styleObject = basicMapStyle(style, tileSize);
  }
  // For now, we are styling an additional source with a
  // transparent red fill and red outline. In the future
  // we may want to allow for more customization.
  if (overlay) {
    styleObject.sources["overlay"] = {
      type: "geojson",
      data: `overlay.geojson`,
    };
    styleObject.layers.push({
      id: "polygon-layer",
      type: "fill",
      source: "overlay",
      "source-layer": "output",
      filter: ["==", "$type", "Polygon"],
      paint: {
        "fill-color": "#FF0000",
        "fill-opacity": 0.5,
      },
    });
    styleObject.layers.push({
      id: "line-layer",
      type: "line",
      source: "overlay",
      "source-layer": "output",
      filter: ["==", "$type", "LineString"],
      paint: {
        "line-color": "#FF0000",
        "line-width": 2,
      },
    });
  }
  return styleObject;
};

// Convert premultiplied image buffer from MapGL to RGBA PNG format
export const generateImage = async (buffer, tiletype, width, height, ratio) => {
  const image = sharp(buffer, {
    raw: {
      premultiplied: true,
      width: width * ratio,
      height: height * ratio,
      channels: 4,
    },
  });

  switch (tiletype) {
    case "jpg":
      return image.jpeg().toBuffer();
    case "png":
      return image.png().toBuffer();
    case "webp":
      return image.webp().toBuffer();
  }
};

// Generate a thumbnail image for the style and bounds
export const generateThumbnail = async (
  styleObject,
  styleDir,
  sourceDir,
  bounds,
  ratio,
  outputDir,
  outputFilename,
) => {
  const thumbnailBuffer = await renderThumbnail(
    styleObject,
    styleDir,
    sourceDir,
    bounds,
    ratio,
  );

  const thumbnailFilename = `${outputFilename}-thumbnail.jpg`;
  const outputPath = path.join(outputDir, thumbnailFilename);

  fs.writeFileSync(outputPath, thumbnailBuffer);

  console.log(`Thumbnail generated at ${outputPath}`);

  return thumbnailFilename;
};

// Generate MBTiles or SMP file from a given style, bounds, and zoom range
export const generateTileFile = async (
  styleObject,
  styleDir,
  sourceDir,
  bounds,
  minZoom,
  maxZoom,
  ratio,
  tiletype,
  format,
  tempDir,
  outputDir,
  outputFilename,
) => {
  const outputMBTiles = `${outputFilename}.mbtiles`;
  const tempPath = `${tempDir}/${outputMBTiles}`;
  console.log(`\nGenerating MBTiles file...`);

  let numberOfTiles = 0;
  let fileSize = 0;

  const mbtiles = await new Promise((resolve, reject) => {
    new MBTiles(`${tempPath}?mode=rwc`, (error, mbtiles) => {
      if (error) {
        console.error("Error opening MBTiles file:", error);
        reject(error);
      } else {
        resolve(mbtiles);
      }
    });
  });

  try {
    // Start writing to the MBTiles file
    mbtiles.startWriting((error) => {
      if (error) {
        throw error;
      } else {
        let metadata = {
          name: outputFilename,
          format: tiletype,
          minzoom: minZoom,
          maxzoom: maxZoom,
          type: "overlay",
        };

        // Check if metadata.json exists in the sourceDir
        const metadataFile = path.join(sourceDir, "metadata.json");
        if (fs.existsSync(metadataFile)) {
          try {
            // Read and parse the metadata.json file
            const metadataJson = fs.readFileSync(metadataFile, "utf8");
            const metadataFromFile = JSON.parse(metadataJson);

            // Merge the file metadata with the default metadata
            metadata = { ...metadata, ...metadataFromFile };
          } catch (error) {
            console.error(`Error reading metadata.json file: ${error}`);
          }
        }

        mbtiles.putInfo(metadata, (error) => {
          if (error) throw error;
        });
      }
    });

    // Iterate over zoom levels
    for (let zoom = minZoom; zoom <= maxZoom; zoom++) {
      const spinner = ora(`Rendering zoom level ${zoom}...`).start();
      // Calculate tile range for this zoom level based on bounds
      const { minX, minY, maxX, maxY } = calculateTileRangeForBounds(
        bounds,
        zoom,
      );

      validateMinMaxValues(minX, minY, maxX, maxY);

      // Iterate over tiles within the range
      for (let x = minX; x <= maxX; x++) {
        fs.mkdirSync(`${outputDir}/tiles/${zoom}/${x}`, { recursive: true });
        for (let y = minY; y <= maxY; y++) {
          try {
            // Render the tile
            const tileBuffer = await renderTile(
              styleObject,
              styleDir,
              sourceDir,
              ratio,
              tiletype,
              zoom,
              x,
              y,
            );
            const imageFilename = `tiles/${zoom}/${x}/${y}.png`;
            const outputPath = path.join(outputDir, imageFilename);
            fs.writeFileSync(outputPath, tileBuffer);

            // Write the tile to the MBTiles file
            mbtiles.putTile(zoom, x, y, tileBuffer, (err) => {
              if (err) throw err;
            });

            // Increment the number of tiles
            numberOfTiles++;
          } catch (error) {
            spinner.fail(`Error rendering tile ${zoom}/${x}/${y}: ${error}`);
          }
        }
      }
      spinner.succeed(`Zoom level ${zoom} rendered`);
    }

    // Finish writing and close the MBTiles file
    await new Promise((resolve, reject) => {
      mbtiles.stopWriting((err) => {
        if (err) reject(err);
        resolve();
      });
    });

    fileSize = fs.statSync(tempPath).size;
  } catch (error) {
    throw new Error(`Error writing MBTiles file: ${error}`);
  }

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  let finalOutputPath;
  if (format === "smp") {
    console.log("Converting MBTiles to SMP...");

    const mbTilesInputPath = path.join(tempDir, `${outputFilename}.mbtiles`);
    const smpOutputPath = path.join(outputDir, `${outputFilename}.smp`);

    try {
      await fromMBTiles(mbTilesInputPath, smpOutputPath);
      console.log("SMP conversion successful!");
      fileSize = fs.statSync(smpOutputPath).size;
      fs.unlinkSync(mbTilesInputPath);
      finalOutputPath = smpOutputPath;
    } catch (error) {
      throw new Error(`Error converting MBTiles to SMP: ${error.message}`);
    }
  } else {
    const outputPath = path.join(outputDir, `${outputFilename}.mbtiles`);
    const readStream = fs.createReadStream(tempPath);
    const writeStream = fs.createWriteStream(outputPath);

    readStream.on("error", (err) => {
      console.error(`Error reading MBTiles file: ${err}`);
    });

    writeStream.on("error", (err) => {
      console.error(`Error writing MBTiles file: ${err}`);
    });

    writeStream.on("close", () => {
      if (tempDir !== null) {
        fs.promises.rm(tempDir, { recursive: true });
      }
    });

    readStream.pipe(writeStream);
    finalOutputPath = outputPath;
  }

  return {
    errorMessage: null,
    fileLocation: outputDir,
    filename: path.basename(finalOutputPath),
    fileSize: fileSize,
    numberOfTiles,
  };
};
