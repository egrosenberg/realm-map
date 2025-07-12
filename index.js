/*global $, htmlToImage, FileSaver*/

const TILE_SIZE = "small";
const TILE_RESOLUTION = 256;
const IMG_BASE_PATH = `img/tiles/${TILE_SIZE}/`;

const LAND_CHARACTERS = [
  "barren",
  "dry",
  "grey",
  "sparse",
  "sharp",
  "teeming",
  "still",
  "soft",
  "overgrown",
  "vivid",
  "sodden",
  "lush",
];

const LAND_LANDSCAPES = [
  "marsh",
  "heath",
  "crags",
  "peaks",
  "forest",
  "valley",
  "hills",
  "meadow",
  "bog",
  "lakes",
  "glades",
  "plain",
];

const capitalize = (word) =>
  word[0].toUpperCase() + word.slice(1).toLowerCase();
/**
 * Save the current hex
 * @param {string?} character
 * @param {string?} landscape
 * @returns {Promise}
 */
async function saveHex() {
  return new Promise((resolve) => {
    const fName = "map";
    htmlToImage
      .toBlob(document.getElementById("map-frame"))
      .then(function (blob) {
        resolve(FileSaver.saveAs(blob, fName));
      });
  });
}

/**
 *
 * @param {{
 *  tiles: {character: string, landscape:string}[][]}} options
 */
function renderGrid(options) {
  const { tiles } = options;
  let res = "<div class='map'><tbody>";
  for (const row of tiles) {
    res += "<div class='map-row'>";
    for (const tile of row) {
      const imgPath = `${IMG_BASE_PATH}${tile.character}-${tile.landscape}.webp`;
      const title = `${capitalize(tile.character)} ${capitalize(
        tile.landscape
      )}`;
      res += `<div class="map-cell"><img class="map-tile" 
              width="${TILE_RESOLUTION}px" height="${TILE_RESOLUTION}px"
              title="${title}" src="${imgPath}"></div>`;
    }
    res += "</div>";
  }
  res += "</div>";
  return res;
}

$(document).ready(() => {
  const tiles = [
    [
      { character: "overgrown", landscape: "bog" },
      { character: "overgrown", landscape: "bog" },
      { character: "sparse", landscape: "forest" },
    ],
    [
      { character: "sodden", landscape: "marsh" },
      { character: "sodden", landscape: "marsh" },
      { character: "sparse", landscape: "forest" },
    ],
    [
      { character: "sharp", landscape: "crags" },
      { character: "teeming", landscape: "forest" },
      { character: "teeming", landscape: "glades" },
    ],
  ];
  $("#map-frame").html(renderGrid({ tiles }));

  /**
   * Save hex
   */
  $(document).on("click", ".save-hex", async () => {
    saveHex();
  });
});
