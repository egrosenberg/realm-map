/*global $, htmlToImage, FileSaver, Confirm*/

const TILE_RESOLUTION = 256;
const IMG_BASE_PATH = `img/symbols/`;

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

const HOLDING_OFFSET = 20;
const N_HOLDINGS = 4;
const DEFAULT_MAXLAND = 12;
const RIVER_I = 5;
const LANDSCAPES = {
  0: { name: "marsh", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  1: { name: "heath", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  2: { name: "crags", connectsTo: "any", maxConnected: 5 },
  3: { name: "peaks", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  4: { name: "forest", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  5: { name: "valley", connectsTo: [], maxConnected: 1 },
  6: { name: "hills", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  7: { name: "meadow", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  8: { name: "bog", connectsTo: "any", maxConnected: 5 },
  9: { name: "lakes", connectsTo: "any", maxConnected: 3 },
  10: { name: "glades", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  11: { name: "plain", connectsTo: "any", maxConnected: DEFAULT_MAXLAND },
  // holdings
  20: { name: "castle", connectsTo: "any", maxConnected: 1 },
  21: { name: "town", connectsTo: "any", maxConnected: 1 },
  22: { name: "fortress", connectsTo: "any", maxConnected: 1 },
  23: { name: "tower", connectsTo: "any", maxConnected: 1 },
};

const LANDMARKS = {
  0: { name: "dwellings" },
  1: { name: "sanctum" },
  2: { name: "monument" },
  3: { name: "hazards" },
  4: { name: "cursed" },
  5: { name: "ruins" },
};

const DEFAULT_REALM_CFG = {
  width: 12,
  height: 12,
  landscapeN: 12,
  characterN: 12,
  landmarkMin: 3,
  landmarkMax: 4,
  holdingN: 4,
  mythsN: 6,
};

const REALM_FIELDS = {
  width: { input: "width-cfg" },
  height: { input: "height-cfg" },
  landscapeN: { input: "landscape-n-cfg" },
  characterN: { input: "character-n-cfg" },
  landmarkMin: { input: "landmark-min-cfg" },
  landmarkMax: { input: "landmark-max-cfg" },
  holdingN: { input: "holding-cfg" },
  mythsN: { input: "myths-n-cfg" },
};

let realmCfg = structuredClone(DEFAULT_REALM_CFG);

const NEIGHBOR_LAND_PERCENT = 0.8;
const NEIGHBOR_CHAR_PERCENT = 0.9;
const MAX_CONNECTED_CHAR = 144;

const MIN_TILE_SIZE = 64;
const MAX_TILE_SIZE = 512;
const TILE_SIZE_DELTA = 32;
let tileSize = MIN_TILE_SIZE;

let tiles;
let playerMode = false;
let mythNames = {};

// small helper functions
const capitalize = (word) =>
  word[0].toUpperCase() + word.slice(1).toLowerCase();
const randInt = (min, max) => Math.floor(Math.random() * (max - min)) + min;

function download(text, name, type, element) {
  let file = new Blob([text], { type: type });
  element.href = URL.createObjectURL(file);
  element.download = name;
}

/**
 * Updates realm config var with current input field values
 */
function updateCfg() {
  for (const [key, value] of Object.entries(REALM_FIELDS)) {
    const val = parseInt($(`#${value.input}`).val());
    if (val && !isNaN(val)) realmCfg[key] = val;
  }
}

/**
 * Save the current map
 * @returns {Promise}
 */
async function saveHex() {
  return new Promise((resolve) => {
    const fName = "map";
    htmlToImage.toBlob($(".map").get(0)).then(function (blob) {
      resolve(FileSaver.saveAs(blob, fName));
    });
  });
}

/**
 *
 * @param {{
 *  tiles: {character: number,
 *  landscape:number,
 *  to?: [number,number],
 *  from?: [number,number]
 * }[][],
 * playerView?: boolean}} options
 */
function renderGrid(options = {}) {
  const { tiles, playerView } = options;
  let res = "<div class='map'><tbody>";
  for (let i = 0; i < tiles.length; ++i) {
    const row = tiles[i];
    res += "<div class='map-row'>";
    for (let j = 0; j < row.length; j++) {
      const tile = row[j];
      const landscape = LANDSCAPES[tile.landscape].name;
      const character = LAND_CHARACTERS[tile.character];
      let imgPath = `${IMG_BASE_PATH}${landscape}.svg`;
      if (tile.landscape === RIVER_I) {
        let fromDir = 0;
        const evenOdd = j % 2 === 0 ? "even" : "odd";
        if (tile.from) {
          const diff = [tile.from[0] - i, tile.from[1] - j];
          fromDir = getConnectionNumber({ diff, evenOdd });
          fromDir = connectionNumber({ p1: [i, j], p2: tile.from });
        }
        let toDir = 0;
        if (tile.to) {
          const diff = [tile.to[0] - i, tile.to[1] - j];
          toDir = getConnectionNumber({ diff, evenOdd });
          toDir = connectionNumber({ p1: [i, j], p2: tile.to });
        }
        if (!fromDir && toDir) fromDir = ((toDir + 2) % 7) + 1;
        if (fromDir && !toDir) toDir = ((fromDir + 2) % 7) + 1;
        if (fromDir === toDir) toDir = ((fromDir + 2) % 7) + 1;
        const inD = Math.min(fromDir, toDir);
        const outD = Math.max(fromDir, toDir);
        imgPath = `${IMG_BASE_PATH}river/${inD}-${outD}.svg`;
      }
      const title = `${j},${i}<br/>
        ${capitalize(character)} ${capitalize(landscape)}
        ${
          tile.landmark !== undefined && !playerView
            ? `<br/>(${LANDMARKS[tile.landmark].name})`
            : ""
        }`;

      res += `<div class="map-cell" data-x="${j}" data-y="${i}">
               ${
                 tile.myth && !playerView
                   ? `<div class="overlay myth-num">${tile.myth}</div>`
                   : ""
               }
               ${
                 tile.blocked && !playerView
                   ? `<div class="overlay blocker" style="clip-path:var(--blocker-${tile.blocked})"></div>`
                   : ""
               }
               ${
                 tile.landmark !== undefined && !playerView
                   ? `
                    <div class="overlay landmark-behind"></div>
                    <img class="overlay landmark"
                      src="${IMG_BASE_PATH}landmarks/${
                       LANDMARKS[tile.landmark].name
                     }.svg"></img>
                    <img class="overlay landmark-bg"
                      src="${IMG_BASE_PATH}landmarks/bg/${
                       LANDMARKS[tile.landmark].name
                     }.svg"></img>`
                   : ""
               }
              <img class="map-tile" 
                width="${TILE_RESOLUTION}px" height="${TILE_RESOLUTION}px"
                title="${title}" src="${imgPath}">
            </div>`;
    }
    res += "</div>";
  }
  res += "</div>";

  return res;
}

const RIVER_DIRECTIONS = 3;
const RIVER_PATHS = {
  even: {
    0: [
      [-1, -1],
      [-1, 0],
      [-1, 1],
    ],
    1: [
      [-1, 0],
      [-1, 1],
      [0, 1],
    ],
    2: [
      [-1, 1],
      [0, 1],
      [1, 0],
    ],
    3: [
      [0, 1],
      [1, 0],
      [0, -1],
    ],
    4: [
      [1, 0],
      [0, -1],
      [-1, -1],
    ],
    5: [
      [0, -1],
      [-1, -1],
      [-1, 0],
    ],
  },
  odd: {
    0: [
      [0, -1],
      [-1, 0],
      [0, 1],
    ],
    1: [
      [-1, 0],
      [0, 1],
      [1, 1],
    ],
    2: [
      [0, 1],
      [1, 1],
      [1, 0],
    ],
    3: [
      [1, 1],
      [1, 0],
      [1, -1],
    ],
    4: [
      [1, 0],
      [1, -1],
      [0, -1],
    ],
    5: [
      [1, -1],
      [0, -1],
      [-1, 0],
    ],
  },
};
const RIVER_CONNECTIONS = {
  odd: {
    1: [-1, 0],
    2: [0, 1],
    3: [1, 1],
    4: [1, 0],
    5: [1, -1],
    6: [0, -1],
  },
  even: {
    1: [-1, 0],
    2: [-1, 1],
    3: [0, 1],
    4: [1, 0],
    5: [0, -1],
    6: [-1, -1],
  },
};

/**
 * Finds the number for the connection direction of a river delta
 * @deprecated use connectionNumber()
 * @param {{diff: [number,number], evenOdd: "even" | "odd"}} options
 * @returns
 */
function getConnectionNumber(options = {}) {
  const { diff, evenOdd } = options;
  for (const [num, delta] of Object.entries(RIVER_CONNECTIONS[evenOdd])) {
    if (delta[0] === diff[0] && delta[1] === diff[1]) return parseInt(num);
  }
  return 1;
}

/**
 *
 * @param {{
 *  p1: [y: number, x: number],
 *  p2: [y: number, x: number]
 * }} options
 * @returns number
 */
function connectionNumber(options) {
  const {
    p1: [y1, x1],
    p2: [y2, x2],
  } = options;
  const evenOdd = x1 % 2 === 0 ? "even" : "odd";
  const diff = [y2 - y1, x2 - x1];
  for (const [num, delta] of Object.entries(RIVER_CONNECTIONS[evenOdd])) {
    if (delta[0] === diff[0] && delta[1] === diff[1]) return parseInt(num);
  }
  return 1;
}
/**
 *
 * @param {{
 *  pos: [y: number, x: number],
 *  direction: number
 * }} options
 * @returns {[y: number, x: number]}
 */
function fromConnectionNumber(options) {
  const {
    pos: [y, x],
    direction,
  } = options;
  const evenOdd = x % 2 === 0 ? "even" : "odd";
  const delta = RIVER_CONNECTIONS[evenOdd][direction];
  if (!delta) return [y, x];
  return [y + delta[0], x + delta[1]];
}

/**
 *
 * @param {{
 *  tiles: ({character: number, landscape:number}|null)[][],
 *  pos: [number, number],
 *  direction: number
 * }} options
 * @returns {void}
 */
function traverseRiver(options = {}) {
  const { tiles, pos, direction } = options;
  const evenOdd = pos[1] % 2 === 0 ? "even" : "odd";
  const possibleDeltas = RIVER_PATHS[evenOdd][direction];
  const pointTowards = possibleDeltas[randInt(0, RIVER_DIRECTIONS)];
  const nextPos = [pos[0] + pointTowards[0], pos[1] + pointTowards[1]];
  if (
    nextPos[0] >= tiles.length ||
    nextPos[0] < 0 ||
    nextPos[1] >= tiles[0].length ||
    nextPos[1] < 0
  ) {
    tiles[pos[0]][pos[1]].to = [nextPos[0], nextPos[1]];
    return;
  }
  tiles[nextPos[0]][nextPos[1]] = {
    character: randInt(0, LAND_CHARACTERS.length),
    landscape: 5,
    from: pos.slice(),
  };
  if (tiles[pos[0]][pos[1]])
    tiles[pos[0]][pos[1]].to = [nextPos[0], nextPos[1]];
  traverseRiver({ tiles, pos: nextPos.slice(), direction });
}

/**
 * Draws a river on a set of tiles
 * @param {{tiles: ({character: number, landscape:number}|null)[][]}} options
 */
function drawRiver(options = {}) {
  const { tiles } = options;
  // choose starting point
  const startSide = randInt(0, 4);
  let startPos = [];
  let direction = 0;
  let from = [-1, -1];
  switch (startSide) {
    case 0: {
      startPos = [0, randInt(1, tiles[0].length)];
      direction = 3;
      from = [-1, startPos[1]];
      break;
    }
    case 1: {
      startPos = [tiles.length - 1, randInt(1, tiles[0].length)];
      direction = 0;
      from = [tiles.length, startPos[1]];
      break;
    }
    case 2: {
      startPos = [randInt(1, tiles.length), 0];
      direction = startPos[0] < tiles.length / 2 ? 2 : 1;
      from = [startPos[0], -1];
      break;
    }
    case 3: {
      startPos = [randInt(1, tiles.length), tiles[0].length - 1];
      direction = startPos[0] < tiles.length / 2 ? 4 : 5;
      from = [startPos[0], tiles[0].length];
      break;
    }
  }
  tiles[startPos[0]][startPos[1]] = {
    character: 0,
    landscape: 5,
    from,
  };
  traverseRiver({ tiles, pos: startPos, direction });
}

/**
 * populates a tile (if it exists)
 * @param {{
 *  tiles: ({character: number, landscape:number}|null)[][],
 *  x: number,
 *  y: number,
 * }} options
 * @returns {{
 *  character: number,
 *  landscape: number,
 *  blocked?: number,
 *  landmark?: number,
 *  x: number,
 *  y:number}[]}
 */
function scanNeighbors(options = {}) {
  const { tiles, x, y } = options;
  const yExists = (y) => y >= 0 && y < tiles.length;
  const xExists = (x, row) => x >= 0 && x < row.length;

  const res = [];
  const neighbors = {
    even: [
      [-1, -1],
      [-1, 0],
      [-1, 1],
      [1, -1],
      [1, 0],
      [0, 1],
    ],
    odd: [
      [0, -1],
      [-1, 0],
      [0, 1],
      [1, -1],
      [1, 0],
      [1, 1],
    ],
  };
  const evenOdd = x % 2 === 0 ? "even" : "odd";
  for (const delta of neighbors[evenOdd]) {
    const newY = delta[0] + y;
    const newX = delta[1] + x;
    if (!yExists(newY)) continue;
    if (!xExists(newX, tiles[newY])) continue;
    if (tiles[newY][newX]) res.push({ ...tiles[newY][newX], y: newY, x: newX });
  }
  return res;
}

/**
 * counts how many contiguous tiles chosen coords are a part of
 * @param {{
 *  tiles: ({character: number, landscape:number}|null)[][],
 *  x: number,
 *  y: number,
 *  prop: "character" | "landscape",
 *  counted?: {x: number, y:number}[]
 * }} options
 * @returns {number}
 */
function findConnected(options = {}) {
  const { tiles, x, y, prop } = options;
  let counted = options.counted ?? [];

  if (!tiles?.[y]?.[x]) return [];
  const val = tiles[y][x][prop];
  const neighbors = scanNeighbors({ tiles, x, y });

  for (const neighbor of neighbors) {
    if (!neighbor) continue;
    if (counted.find((p) => p.x === neighbor.x && p.y === neighbor.y)) continue;
    if (neighbor[prop] === val) {
      counted.push({ x: neighbor.x, y: neighbor.y });
      counted = findConnected({
        tiles,
        x: neighbor.x,
        y: neighbor.y,
        prop,
        counted,
      });
    }
  }
  return counted;
}

/**
 * populates a tile (if it exists)
 * @param {{
 *  tiles: {character: number, landscape:number}[][],
 *  x: number,
 *  y: number,
 * }} options
 * @returns
 */
function populateTile(options = {}) {
  const { tiles, x, y, landscapes, characters } = options;
  if (y >= tiles.length) return;
  if (x >= tiles[y].length) return;
  if (tiles[y][x]) return;

  // get neighbor info
  const neighbors = scanNeighbors({ tiles, x, y });

  // decide landscape
  let landscape = 0;
  const randomizeLandscape = () => {
    if (Math.random() < NEIGHBOR_LAND_PERCENT && neighbors.length) {
      landscape = neighbors[randInt(0, neighbors.length)].landscape;
    } else {
      landscape = landscapes[randInt(0, landscapes.length)];
    }
  };
  randomizeLandscape();

  // decide character
  let character = 0;
  let from = null;
  const randomizeCharacter = () => {
    if (Math.random() < NEIGHBOR_CHAR_PERCENT && neighbors.length) {
      const neighbor = neighbors[randInt(0, neighbors.length)];
      character = neighbor.character;
      from = [neighbor.y, neighbor.x];
      if (
        tiles[neighbor.y]?.[neighbor.x] &&
        !tiles[neighbor.y]?.[neighbor.x].to
      )
        tiles[neighbor.y][neighbor.x].to = [y, x];
    } else {
      character = characters[randInt(0, characters.length)];
    }
  };
  randomizeCharacter();

  // decide if blocked (slightly more favorable odds to account for failed attempts)
  const blocked =
    !neighbors.find((n) => n.blocked) && Math.random() < 1 / 4
      ? randInt(1, 7)
      : 0;

  const setAttributes = () => {
    tiles[y][x] = {
      character,
      landscape,
      from,
      blocked,
    };
  };
  setAttributes();

  const validLandscape = () => {
    if (
      findConnected({ tiles, x, y, prop: "landscape" }).length >
      LANDSCAPES[landscape].maxConnected
    ) {
      return false;
    }
    if (LANDSCAPES[landscape].connectsTo !== "any") {
      const neighbors = scanNeighbors({ tiles, x, y });
      const canPlace =
        neighbors.find((n) =>
          LANDSCAPES[landscape].connectsTo.find((l) => l === n.landscape)
        ) || neighbors.find((n) => n.landscape === landscape);
      return canPlace;
    }
    return true;
  };

  while (!validLandscape()) {
    randomizeLandscape();
    setAttributes();
  }
  while (
    findConnected({ tiles, x, y, prop: "character" }).length >
    MAX_CONNECTED_CHAR
  ) {
    randomizeCharacter();
    setAttributes();
  }
}

/**
 * creates an empty realm
 * @param {{width: number, height:number, tiles: []}} options
 * @returns {null[][]}
 */
function emptyRealm(options = {}) {
  const { width, height, tiles } = options;
  tiles.length = 0;
  for (let i = 0; i < height; ++i) {
    const row = [];
    for (let j = 0; j < width; ++j) {
      row.push(null);
    }
    tiles.push(row);
  }
}

/**
 * counts occurrences of a landscape
 * @param {{
 *  tiles: {landscape: number, character:number}[][],
 *  landscape: number
 * }} options
 * @returns {number} count
 */
function countLandscape(options = {}) {
  const { tiles, landscape } = options;
  let count = 0;
  for (const row of tiles) {
    for (const tile of row) {
      if (tile?.landscape === landscape) count++;
    }
  }
  return count;
}

/**
 * generate the tiles for a realm
 * @param {{
 *  width?: number;
 *  height?: number;
 *  landscapeN?: number;
 *  characterN?: number;
 *  landmarkMin?: number,
 *  landmarkMax?: number,
 *  holdingN?: number,
 *  mythsN?: number,
 * }} options
 */
function generateRealm(options = {}) {
  for (const [key] of Object.entries(DEFAULT_REALM_CFG)) {
    options[key] ??= DEFAULT_REALM_CFG[key];
  }
  const {
    width,
    height,
    landscapeN,
    characterN,
    landmarkMin,
    landmarkMax,
    holdingN,
    mythsN,
  } = options;

  const landscapes = [];
  // decide landscape pool
  for (let i = 0; i < landscapeN; ++i) {
    let index = randInt(0, LAND_LANDSCAPES.length);
    while (landscapes.find((l) => l === index)) {
      index = randInt(0, LAND_LANDSCAPES.length);
    }
    landscapes.push(index);
  }
  // decide character pool
  const characters = [];
  for (let i = 0; i < characterN; ++i) {
    let index = randInt(0, LAND_CHARACTERS.length);
    while (characters.find((c) => c === index)) {
      index = randInt(0, LAND_CHARACTERS.length);
    }
    characters.push(index);
  }

  // create empty realm
  const tiles = [];
  do {
    emptyRealm({ width, height, tiles });
    drawRiver({ tiles });
  } while (countLandscape({ tiles, landscape: 5 }) < width);

  // traverse realm diagonally
  const longest = Math.max(width, height);
  for (let i = 0; i < longest; ++i) {
    // populate bottom and right edges
    for (let j = 0; j < i; ++j) {
      populateTile({
        tiles,
        landscapes,
        characters,
        x: j,
        y: i,
      });
      populateTile({
        tiles,
        landscapes,
        characters,
        x: i,
        y: j,
      });
    }
    // populate corner
    populateTile({
      tiles,
      landscapes,
      characters,
      x: i,
      y: i,
    });
  }

  // place holdings
  const holdingPositions = [];
  for (let i = 0; i < holdingN; ++i) {
    const validPos = (position) => {
      for (const pos of holdingPositions) {
        const dist =
          Math.abs(pos[0] - position[0]) + Math.abs(pos[1] - position[1]);
        if (dist < (width - 2) * 0.6) return false;
      }
      return true;
    };
    let tries = 0;
    let position = [
      randInt(1, tiles.length - 2),
      randInt(1, tiles[0].length - 2),
    ];
    while (!validPos(position) && tries < 10000) {
      position = [
        randInt(1, tiles.length - 2),
        randInt(1, tiles[0].length - 2),
      ];
      tries++;
    }
    holdingPositions.push(position);
  }
  for (let i = 0; i < holdingN; ++i) {
    const pos = holdingPositions[i];
    tiles[pos[0]][pos[1]] = {
      character: randInt(0, LAND_CHARACTERS.length),
      landscape: HOLDING_OFFSET + (i % N_HOLDINGS),
    };
  }

  /**
   * Place landmarks
   */
  for (const [id] of Object.entries(LANDMARKS)) {
    const count = randInt(landmarkMin, landmarkMax + 1);
    for (let i = 0; i < count; i++) {
      // find a random unoccupied position
      let position = [
        randInt(1, tiles.length - 2),
        randInt(1, tiles[0].length - 2),
      ];
      const validPosition = (position) => {
        const tile = tiles[position[0]][position[1]];
        if (
          tile.landmark !== undefined ||
          tile.landscape >= LAND_LANDSCAPES.length ||
          tile.landscape === RIVER_I
        )
          return false;
        const neighbors = scanNeighbors({
          tiles,
          x: position[1],
          y: position[0],
        });
        for (const neighbor of neighbors) {
          if (neighbor.landmark !== undefined) return false;
        }
        return true;
      };
      let tries = 0;
      const maxTries = 10000;
      while (!validPosition(position) && tries < maxTries) {
        position = [
          randInt(0, tiles.length - 1),
          randInt(0, tiles[0].length - 1),
        ];
        tries++;
      }
      if (tries >= maxTries - 1) console.log("timed out :(");
      // set landmark
      tiles[position[0]][position[1]].landmark = parseInt(id);
    }
  }

  /**
   * place myths
   */
  for (let i = 1; i <= mythsN; ++i) {
    // find a random unoccupied position
    let position = [
      randInt(1, tiles.length - 2),
      randInt(1, tiles[0].length - 2),
    ];
    const validPosition = (position) => {
      const tile = tiles[position[0]][position[1]];
      if (
        tile.landmark !== undefined ||
        tile.landscape >= LAND_LANDSCAPES.length ||
        tile.myth
      )
        return false;
      const neighbors = scanNeighbors({
        tiles,
        x: position[1],
        y: position[0],
      });
      for (const neighbor of neighbors) {
        if (neighbor.landmark !== undefined || neighbor.myth) return false;
      }
      return true;
    };
    let tries = 0;
    const maxTries = 100000;
    while (!validPosition(position) && tries < maxTries) {
      position = [
        randInt(0, tiles.length - 1),
        randInt(0, tiles[0].length - 1),
      ];
      tries++;
    }
    if (tries >= maxTries - 1) console.log("timed out :(");
    // set myth
    tiles[position[0]][position[1]].myth = i;
  }

  return tiles;
}

function regenerate(t) {
  if (t) {
    tiles = t;
  } else {
    updateCfg();
    tiles = generateRealm(realmCfg);
  }
  $("#map-frame").html(renderGrid({ tiles, playerView: playerMode }));
  $(".map-tile").tooltip({
    position: {
      my: "center top",
      at: "center bottom",
    },
    classes: {
      "ui-tooltip": "tooltip",
    },
    content: function () {
      return $(this).attr("title");
    },
  });

  /**
   * Show myth coordinates
   */
  const myths = findMyths(tiles);
  let res = "";
  for (let i = 1; i <= realmCfg.mythsN; ++i) {
    const myth = myths[i];
    if (!myth) continue;
    const x = myth.x < 10 ? "&nbsp;" + myth.x : myth.x;
    const y = myth.y < 10 ? "&nbsp;" + myth.y : myth.y;
    res += `<li>
              <input type="text" placeholder="Myth ${i}" class="myth-input"
                value="${mythNames[i] ?? ""}">
              <span class="position">${x}, ${y}</span>
            </li>`;
  }
  $(".myths-list").html(res);
  // $(".myths-list li").each((i, e) => {
  //   const myth = myths[$(e).index() + 1];
  //   if (myth) {
  //     if (mythNames[$(e).index() + 1])
  //       $(e)
  //         .find(".myth-input")
  //         .val(mythNames[$(e).index() + 1]);

  //     const x = myth.x < 10 ? "&nbsp;" + myth.x : myth.x;
  //     const y = myth.y < 10 ? "&nbsp;" + myth.y : myth.y;
  //     $(e).find(".position").html(`${x}, ${y}`);
  //   }
  // });
}

/**
 * Transforms tiles into array of strings
 * @param {{
 *  character: number,
 *  landscape:number,
 *  from?: [number, number],
 *  to?: [number,number],
 *  blocked?: number,
 *  landmark?: number
 *  myth?: number,
 * }[][]} tiles
 * @param {boolean?} playerView
 * @returns {string[]}
 */
function encodeTiles(tiles, playerView = false) {
  const res = [];
  for (const row of tiles) {
    let r = [];
    for (const tile of row) {
      if (playerView) {
        r.push([
          tile.character,
          tile.landscape,
          tile.from,
          tile.to,
          null,
          null,
          null,
        ]);
      } else {
        r.push([
          tile.character,
          tile.landscape,
          tile.from,
          tile.to,
          tile.blocked,
          tile.landmark,
          tile.myth,
        ]);
      }
    }
    res.push(JSON.stringify(r));
  }
  return res;
}
/**
 * Transforms encoded tiles into a programmer friendly object 2d array
 * @param {string[]} tiles
 * @returns {{
 *  character: number,
 *  landscape:number,
 *  from: [number, number],
 *  to: [number,number],
 *  blocked?: number,
 *  landmark?: number,
 *  myth?: number,
 * }[][]}
 */
function decodeTiles(tiles) {
  const res = [];
  for (const row of tiles) {
    const r = [];
    const arr = JSON.parse(row);
    for (const tile of arr) {
      r.push({
        character: tile[0],
        landscape: tile[1],
        from: tile[2],
        to: tile[3],
        blocked: tile[4] === null ? undefined : tile[4],
        landmark: tile[5] === null ? undefined : tile[5],
        myth: tile[6] === null ? undefined : tile[6],
      });
    }
    res.push(r);
  }
  return res;
}

/**
 *
 * @param {{
 *  character: number,
 *  landscape:number,
 *  to?: [number,number],
 *  from?: [number,number],
 * }} tile
 * @param {Event} ev
 * @param {[y: number. x: number]} position
 */
async function editTile(tile, ev, position) {
  $(ev.currentTarget).addClass("focused");
  console.log(ev.currentTarget);

  let landscapeRadio = "";
  for (let i = 0; i < LAND_LANDSCAPES.length; ++i) {
    landscapeRadio += `
      <input type="radio" id="landscape-${i}" name="landscape" value="${i}"
        ${i === tile.landscape ? "checked" : ""}
      ><label for="landscape-${i}">${LAND_LANDSCAPES[i]}</label><br>`;
  }
  let holdingRadio = "";
  for (let i = HOLDING_OFFSET; i < HOLDING_OFFSET + N_HOLDINGS; ++i) {
    holdingRadio += `
      <input type="radio" id="landscape-${i}" name="landscape" value="${i}"
        ${i === tile.landscape ? "checked" : ""}
      ><label for="landscape-${i}">${LANDSCAPES[i].name}</label><br>`;
  }
  let characterRadio = "";
  for (let i = 0; i < LAND_CHARACTERS.length; ++i) {
    characterRadio += `
      <input type="radio" id="character-${i}" name="character" value="${i}"
        ${i === tile.character ? "checked" : ""}
      ><label for="character-${i}">${LAND_CHARACTERS[i]}</label><br>`;
  }
  let landmarkRadio = `
  <input type="radio" id="landmark--1" name="landmark" value="-1"
        ${isNaN(parseInt(tile.landmark)) ? "checked" : ""}
      ><label for="landmark--1">none</label><br>`;
  for (const [i, landmark] of Object.entries(LANDMARKS)) {
    landmarkRadio += `
      <input type="radio" id="landmark-${i}" name="landmark" value="${i}"
        ${i == tile.landmark ? "checked" : ""}
      ><label for="landmark-${i}">${landmark.name}</label><br>`;
  }
  let mythRadio = `
  <input type="radio" id="myth-0" name="myth" value=""
        ${!tile.myth ? "checked" : ""}
      ><label for="myth-0">none</label><br>`;
  for (let i = 1; i <= realmCfg.mythsN; ++i) {
    mythRadio += `
      <input type="radio" id="myth-${i}" name="myth" value="${i}"
        ${i == tile.myth ? "checked" : ""}
      ><label for="myth-${i}">${i}</label><br>`;
  }
  let blockedRadio = `
  <input type="radio" id="blocked-0" name="blocked" value="-1"
        ${!tile.blocked ? "checked" : ""}
      ><label for="blocked-0">none</label><br>`;
  for (let i = 1; i <= 6; ++i) {
    blockedRadio += `
      <input type="radio" id="blocked-${i}" name="blocked" value="${i}"
        ${i == tile.blocked ? "checked" : ""}
      ><label for="blocked-${i}">${i}</label><br>`;
  }
  const directions = ["", "N", "NE", "SE", "S", "SW", "NW"];
  const fromDir = tile.from
    ? connectionNumber({ p1: position, p2: tile.from })
    : 1;
  let fromRadio = "";
  for (let i = 1; i <= 6; ++i) {
    fromRadio += `
      <input type="radio" id="from-${i}" name="from" value="${i}"
        ${i === fromDir ? "checked" : ""}
      ><label for="from-${i}">${i} (${directions[i]})</label><br>`;
  }
  const toDir = tile.to ? connectionNumber({ p1: position, p2: tile.to }) : 6;
  let toRadio = "";
  for (let i = 1; i <= 6; ++i) {
    toRadio += `
      <input type="radio" id="to-${i}" name="to" value="${i}"
        ${i === toDir ? "checked" : ""}
      ><label for="to-${i}">${i} (${directions[i]})</label><br>`;
  }
  return new Promise((resolve) => {
    Confirm(
      "Edit Tile",
      `
      <div class="flexrow">
        <div>
          <h4>Character</h4>
          ${characterRadio}
        </div>
        <div>
          <h4>Landscape</h4>
          ${landscapeRadio}
        </div>
        <div>
          <h4>Holding</h4>
          ${holdingRadio}
        </div>
        <div>
          <h4>Landmark</h4>
          ${landmarkRadio}
        </div>
      </div>
      <br/>
      <div class="flexrow">
        <div>
          <h4>Myth?</h4>
          ${mythRadio}
        </div>
        <div>
          <h4>Blocked?</h4>
          ${blockedRadio}
        </div>
        <div>
          <h4>From</h4>
          ${fromRadio}
        </div>
        <div>
          <h4>To</h4>
          ${toRadio}
        </div>
      </div>
      `,
      {
        classes: "tile-edit",
        confirm: (data) => {
          const formValues = Object.fromEntries(data);
          if (formValues.landscape !== undefined)
            tile.landscape = parseInt(formValues.landscape);
          if (formValues.character !== undefined)
            tile.character = parseInt(formValues.character);
          const landmark = parseInt(formValues.landmark);
          if (landmark === -1 || isNaN(landmark)) tile.landmark = undefined;
          else tile.landmark = landmark;

          tile.myth = formValues.myth ?? 0;

          const blocked = parseInt(formValues.blocked);
          if (blocked === -1 || isNaN(blocked)) tile.blocked = undefined;
          else tile.blocked = blocked;

          tile.from = fromConnectionNumber({
            pos: position,
            direction: parseInt(formValues.from),
          });
          tile.to = fromConnectionNumber({
            pos: position,
            direction: parseInt(formValues.to),
          });

          console.log(tile);
          $(ev.currentTarget).removeClass("focused");
          resolve();
        },
        cancel: () => {
          $(ev.currentTarget).removeClass("focused");
        },
      }
    );
  });
}

function findMyths(tiles) {
  const res = {};
  for (let i = 0; i < tiles.length; ++i) {
    const row = tiles[i];
    for (let j = 0; j < row.length; ++j) {
      if (row[j].myth) res[row[j].myth] = { x: j, y: i };
    }
  }
  return res;
}

/**
 * Finds all names of myths
 * @returns {{
 *  1: string,
 *  2: string,
 *  3: string,
 *  4: string,
 *  5: string,
 *  6: string,
 * }}
 */
function findMythNames() {
  const mythNames = {};
  $(".myths-list li").each((i, e) => {
    mythNames[$(e).index() + 1] = $(e).find(".myth-input").val();
  });
  return mythNames;
}

function parseUpload(text) {
  const data = JSON.parse(text);
  tiles = decodeTiles(data.tiles);
  console.log(data.myths);
  mythNames = data.myths;
  realmCfg = data.realmCfg;
  for (const [key, value] of Object.entries(REALM_FIELDS)) {
    $(`#${value.input}`).val(realmCfg[key]);
  }
  regenerate(tiles);
}

async function promptUpload() {
  await new Promise((resolve) => {
    Confirm(
      "Upload json",
      `<input type="file" accept="text/json" name="fileupload">`,
      {
        confirm: async (data) => {
          const reader = new FileReader();
          await new Promise((r) => {
            reader.onload = (e) => {
              parseUpload(e.target.result);
              r();
            };
            reader.readAsText(data.get("fileupload"));
          });
          resolve();
        },
      }
    );
  });
}

/**
 * Stashes a map's data in localStorage
 * @param {string} key
 */
function stashLocal(key = 0) {
  const data = {
    tiles: encodeTiles(tiles),
    myths: structuredClone(mythNames),
    realmCfg: structuredClone(realmCfg),
  };
  localStorage.setItem(`stashedMap[${key}]`, JSON.stringify(data));
}
/**
 * Loads a map stored in localStorage
 * @param {string} key
 */
function loadLocalStash(key = 0) {
  const data = localStorage.getItem(`stashedMap[${key}]`);
  if (data) parseUpload(data);
}

$(document).ready(() => {
  const params = new Proxy(new URLSearchParams(window.location.search), {
    get: (searchParams, prop) => searchParams.get(prop),
  });
  playerMode = $("#player-mode-toggle").is(":checked");
  if (params.tiles) {
    const tiles = decodeTiles(JSON.parse(decodeURI(params.tiles)));
    regenerate(tiles);
  } else regenerate();

  /**
   * set save button tooltips
   */
  $(".save-slot *").tooltip({
    position: {
      my: "center top",
      at: "center bottom",
    },
    classes: {
      "ui-tooltip": "tooltip",
    },
    content: function () {
      return $(this).attr("title");
    },
  });
  /**
   * Local storage
   */
  $(document).on("click", ".save-map", (ev) => {
    const index = $(ev.currentTarget).parents(".save-slot").data("index");
    Confirm(
      "Save Map?",
      `Are you sure you want to save this map?<br/>
      Any data currently stored in slot ${index} will be overwritten.<br/>
      This action cannot be undone`,
      {
        confirm: () => stashLocal(index),
      }
    );
  });
  $(document).on("click", ".load-map", (ev) => {
    const index = $(ev.currentTarget).parents(".save-slot").data("index");
    Confirm(
      "Load Map?",
      `Are you sure you want to load the map stored in slot ${index}?<br/>
      The currently loaded map will be destroyed.<br/>
      This action cannot be undone`,
      {
        confirm: () => loadLocalStash(index),
      }
    );
  });

  /**
   * Save image
   */
  $(document).on("click", ".save-hex", async () => {
    saveHex();
  });
  /**
   * Export map
   */
  $(document).on("click", ".export-map", async (ev) => {
    const data = {
      tiles: encodeTiles(tiles),
      myths: mythNames,
      realmCfg: structuredClone(realmCfg),
    };
    download(JSON.stringify(data), "map.json", "text/json", ev.currentTarget);
  });
  $(document).on("click", ".export-map-player", async (ev) => {
    const data = {
      tiles: encodeTiles(tiles, true),
      realmCfg: DEFAULT_REALM_CFG,
      myths: {},
    };
    download(
      JSON.stringify(data),
      "map-player-ver.json",
      "text/json",
      ev.currentTarget
    );
  });

  /**
   * Import map
   */
  $(document).on("click", ".upload-map", () => promptUpload());

  /**
   * Export URI
   */
  $(document).on("click", ".export-map-uri", async () => {
    const path =
      window.location.href.split("?")[0] +
      "?tiles=" +
      encodeURI(JSON.stringify(encodeTiles(tiles)));
    try {
      await navigator.clipboard.writeText(path);
    } catch (err) {
      console.error("Unable to copy text", err);
    }
  });
  /**
   * Export URI for players
   */
  $(document).on("click", ".export-player-uri", async () => {
    const path =
      window.location.href.split("?")[0] +
      "?tiles=" +
      encodeURI(JSON.stringify(encodeTiles(tiles, true)));
    try {
      await navigator.clipboard.writeText(path);
    } catch (err) {
      console.error("Unable to copy text", err);
    }
  });
  /**
   * Regenerate
   */
  $(document).on("click", ".regen-map", async () => {
    regenerate();
  });

  /**
   * Map zoom
   */
  $(document).on("wheel", ".map-frame", (ev) => {
    const delta = Math.sign(ev.originalEvent.deltaY) * -TILE_SIZE_DELTA;
    let newSize = tileSize + delta;
    newSize = Math.max(newSize, MIN_TILE_SIZE);
    newSize = Math.min(newSize, MAX_TILE_SIZE);
    tileSize = newSize;
    $(".size-indicator").html(`Tile size: ${tileSize}px`);
    $(document.body).css({ "--tile-size": `${tileSize}px` });
  });
  $(".size-indicator").html(`Tile size: ${tileSize}px`);
  $(document.body).css({ "--tile-size": `${tileSize}px` });

  let curYPos = 0,
    curXPos = 0,
    curDown = false;

  const map = $(".map-frame").get(0);
  document.addEventListener("mousemove", function (e) {
    if (curDown === true) {
      map.scrollTo(curXPos - e.pageX, curYPos - e.pageY);
    }
  });

  map.addEventListener("mousedown", function (e) {
    // if (e.button === 0) return;
    e.stopPropagation();
    e.preventDefault();
    curDown = true;
    curYPos = e.pageY + map.clientLeft + map.scrollTop;
    curXPos = e.pageX + map.clientLeft + map.scrollLeft;
    $(document.body).css({ cursor: "move" });
    return false;
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("mouseup", function () {
    // if (e.button === 0) return;
    curDown = false;
    $(document.body).css({ cursor: "" });
  });

  /**
   * Edit a tile
   */
  $(document).on("dblclick", ".map-cell", async (ev) => {
    if (playerMode) return;
    ev.preventDefault();
    const tile =
      tiles[$(ev.currentTarget).data("y")][$(ev.currentTarget).data("x")];
    await editTile(tile, ev, [
      $(ev.currentTarget).data("y"),
      $(ev.currentTarget).data("x"),
    ]);
    regenerate(tiles);
  });

  /**
   * Toggle player mode
   */
  $(document).on("change", "#player-mode-toggle", (ev) => {
    playerMode = $(ev.currentTarget).is(":checked");
    console.log(playerMode);
    regenerate(tiles);
  });

  /**
   * Hover myth entries
   */
  $(document).on("mouseover", ".myths-list li", (ev) => {
    const myths = findMyths(tiles);
    const myth = myths[$(ev.currentTarget).index() + 1];
    if (myth) {
      $(`.map-cell[data-x=${myth.x}][data-y=${myth.y}]`).addClass("focused");
    }
  });
  $(document).on("mouseleave", ".myths-list li", (ev) => {
    const myths = findMyths(tiles);
    const myth = myths[$(ev.currentTarget).index() + 1];
    if (myth) {
      $(`.map-cell[data-x=${myth.x}][data-y=${myth.y}]`).removeClass("focused");
    }
  });

  /**
   * Myth name updates
   */
  $(document).on("change", ".myth-input", () => {
    mythNames = findMythNames();
  });

  /**
   * listen to realm config updates
   */
  $(document).on("change", ".config input", updateCfg);
});
