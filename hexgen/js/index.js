/*global $, htmlToImage, FileSaver*/

let lineCount = 0;
let shapeCount = 0;

const ICON_SCALE = 0.75;

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

const lineStyles = {
  inactive: { thickness: 6, color: "var(--line-color)", classes: "" },
  active: {
    thickness: 8,
    color: "var(--line-color-active)",
    classes: "active",
  },
  blocked: {
    thickness: 8,
    color: "var(--line-color-blocked)",
    classes: "blocked",
  },
  hidden: {
    thickness: 7,
    color: "var(--line-color-hidden)",
    classes: "blocked",
  },
};

const shapeStyles = {
  inactive: {
    shape: "circ",
    draw: circDraw,
    color: "var(--shape-inactive-color)",
    size: 2,
  },
  circ: {
    shape: "circ",
    draw: circDraw,
    color: "var(--shape-active-color)",
    size: 15,
    classes: "active",
  },
  diamond: {
    shape: "diamond",
    draw: diamondDraw,
    color: "var(--shape-active-color)",
    size: 30,
    classes: "active",
  },
  triangle: {
    shape: "triangle",
    draw: triangleDraw,
    color: "var(--shape-active-color)",
    size: 40,
    classes: "active",
  },
  entrance: {
    shape: "circle",
    draw: circDraw,
    color: "",
    size: 25,
    classes: "entrance",
  },
  secretEntrance: {
    shape: "circle",
    draw: circDraw,
    color: "",
    size: 50,
    classes: "secret entrance",
  },
};

/**
 * Calculates the points of a hexagon
 * @param {number} width
 * @param {number} height
 * @param {{x: number, y:number}} offset
 * @returns {{top:{x:number, y:number, neighbors: {[]:boolean}}
 *            topR:{x:number, y:number, neighbors: {[]:boolean}}
 *            bottomR:{x:number, y:number, neighbors: {[]:boolean}}
 *            bottom:{x:number, y:number, neighbors: {[]:boolean}}
 *            bottomL:{x:number, y:number, neighbors: {[]:boolean}}
 *            topL:{x:number, y:number, neighbors: {[]:boolean}}}
 *            center:{x:number, y:number, neighbors: string[]}}
 *            points
 */
function hexPoints(width, height, offset) {
  const size = Math.min(width, height);
  const offsetX = (width - size) / 2 + (offset?.x ?? 0);
  const offsetY = (height - size) / 2 + (offset?.y ?? 0);
  const points = {};
  points.top = {
    x: 0.5 * 0.87 * size,
    y: 0,
    neighbors: {
      topR: true,
      topL: true,
      center: true,
    },
  };
  points.topR = {
    x: 0.87 * size,
    y: 0.25 * size,
    neighbors: {
      top: true,
      bottomR: true,
      center: true,
    },
  };
  points.bottomR = {
    x: 0.87 * size,
    y: 0.75 * size,
    neighbors: {
      topR: true,
      bottom: true,
      center: true,
    },
  };
  points.bottom = {
    x: 0.5 * 0.87 * size,
    y: size,
    neighbors: {
      bottomR: true,
      bottomL: true,
      center: true,
    },
  };
  points.bottomL = {
    x: 0,
    y: 0.75 * size,
    neighbors: {
      bottom: true,
      topL: true,
      center: true,
    },
  };
  points.topL = {
    x: 0,
    y: 0.25 * size,
    neighbors: {
      top: true,
      bottomL: true,
      center: true,
    },
  };
  points.center = {
    x: 0.5 * 0.87 * size,
    y: 0.5 * size,
    neighbors: {
      topR: true,
      topL: true,
      center: true,
    },
  };

  for (const [, point] of Object.entries(points)) {
    point.x += offsetX + 0.065 * size;
    point.y += offsetY;
  }
  return points;
}

/**
 * Draws a line as an html element
 * @param {{
 *  parent?: HTMLElement,
 *  p1: {x: number, y: number},
 *  p2: {x: number, y: number},
 *  color?: string,
 *  thickness?: number,
 *  id?: string,
 *  classes? string
 * }} options
 */
function linedraw(options) {
  const { p1, p2 } = JSON.parse(JSON.stringify(options));
  const color = options.color ?? "";
  const thickness = options.thickness ?? "";
  const parent = options.parent ?? document.body;

  if (p2.x < p1.x) {
    let tmp;
    tmp = p2.x;
    p2.x = p1.x;
    p1.x = tmp;
    tmp = p2.y;
    p2.y = p1.y;
    p1.y = tmp;
  }

  var lineLength = Math.sqrt(
    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
  );
  var m = (p2.y - p1.y) / (p2.x - p1.x);

  var degree = (Math.atan(m) * 180) / Math.PI;

  const id = options.id ?? `line-${lineCount++}`;
  const x = p1.x;
  const y = p1.y;

  const translateX = thickness
    ? `translateY(-${thickness / 2}px)`
    : "translateY(-3px)";

  parent.innerHTML += `<div class='line ${options.classes ?? ""}'
      id="${id}"
      style='transform-origin: center left;
      transform: ${translateX} rotate(${degree}deg);
      width: ${lineLength}px;
      height: ${thickness}px;
      background: ${color};
      position: absolute;
      top: ${y}px; left:${x}px;'>
    </div>`;

  return id;
}

/**
 * Draws a circle as an html element
 * size=radius
 * @param {{
 *  parent?: HTMLElement,
 *  p: {x: number, y: number},
 *  size: number,
 *  color?: string,
 *  id?: string,
 *  classes? string
 * }} options
 * @returns {string} id of newly created element
 */
function circDraw(options) {
  const { p, size } = options;
  const color = options.color ?? "";
  const parent = options.parent ?? document.body;
  const classes = options.classes ?? "";

  const x = p.x - size;
  const y = p.y - size;

  const id = options.id ?? `shape-${shapeCount++}`;

  parent.innerHTML += `<div class='circ shape ${classes}'
      id="${id}"
      style='
      width: ${size * 2}px;
      height: ${size * 2}px;
      background: ${color};
      position: absolute;
      top: ${y}px; left:${x}px;
      border-radius: 50%;'>
    </div>`;

  return id;
}

/**
 * Draws a diamond as an html element
 * @param {{
 *         parent?: HTMLElement,
 *         p: {x: number, y: number},
 *         size: number,
 *         color?: string,
 *         id?: string,
 *         classes? string
 *        }} options
 * @returns {string} id of newly created element
 */
function diamondDraw(options) {
  const { p, size } = options;
  const color = options.color ?? "";
  const parent = options.parent ?? document.body;
  const classes = options.classes ?? "";

  const x = p.x - size;
  const y = p.y - size;

  const id = options.id ?? `shape-${shapeCount++}`;

  parent.innerHTML += `<div class='diamond shape ${classes}'
      id="${id}"
      style='
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      position: absolute;
      top: ${y}px; left:${x}px;
      transform-origin: center center;
      transform: 
        translateX(${size / 2}px)
        translateY(${size / 2}px)
        rotate(45deg);'>
    </div>`;

  return id;
}

/**
 * Draws a triangle as an html element
 * @param {{
 *         parent?: HTMLElement,
 *         p: {x: number, y: number},
 *         size: number,
 *         color?: string,
 *         id?: string,
 *         classes? string
 *        }} options
 * @returns {string} id of newly created element
 */
function triangleDraw(options) {
  const { p, size } = options;
  const color = options.color ?? "";
  const parent = options.parent ?? document.body;
  const classes = options.classes ?? "";

  const width = size;
  const height = (Math.tan(Math.PI / 3) * size) / 2;
  const x = p.x - width / 2;
  const y = p.y - (height * 2) / 3;
  const id = options.id ?? `shape-${shapeCount++}`;

  parent.innerHTML += `<div class='triangle shape ${classes}'
      id="${id}"
      style='
      width: ${width}px;
      height: ${height}px;
      background: ${color};
      position: absolute;
      clip-path: polygon(50% 0, 100% 100%, 0 100%);
      top: ${y}px; left:${x}px;'>
    </div>`;

  return id;
}

/**
 * Draws a set of lines
 * @param {{
            p1: {
              x: number,
              y: number,
              key: string,
            },
            p2: {
              x: number,
              y: number,
              key: string,
            },
            status: string
          }[]} lines 
 */
function drawLines(lines) {
  for (const line of lines) {
    const id = `${line.p1.key}-${line.p2.key}`;
    const style = lineStyles[line.status];
    const thickness = style.thickness;
    const color = style.color;
    const classes = style.classes;
    // erase old line
    $(`#${id}`).remove();
    linedraw({
      p1: line.p1,
      p2: line.p2,
      parent: $("#map-frame").get(0),
      thickness,
      id,
      color,
      classes,
    });
  }
}

/**
 * draws all shapes in an array
 * @param {{
 *          x: number,
 *          y: number,
 *          type: string,
 *          key: string,
 *          entrance: boolean | string
 *        }} shapes
 */
function drawShapes(shapes) {
  $(".entrance").remove();
  for (const shape of shapes) {
    {
      const style = shapeStyles[shape.type];
      if (!style) continue;
      const { x, y, key } = shape;
      const id = `shape-${key}`;
      $(`#${id}`).remove();
      const { size, color, classes } = style;
      style.draw({
        p: { x, y },
        size,
        color,
        id,
        classes,
        parent: $("#map-frame").get(0),
      });
    }

    if (shape.entrance) {
      const style = shapeStyles[shape.entrance];
      if (!style) continue;
      const { x, y, key } = shape;
      const id = `entrance-${key}`;
      const { size, color, classes } = style;
      style.draw({
        p: { x, y },
        size,
        color,
        id,
        classes,
        parent: $("#map-frame").get(0),
      });
    }
  }
}
/**
 * Save the current hex
 * @param {string?} character
 * @param {string?} landscape
 * @returns {Promise}
 */
async function saveHex(character, landscape) {
  character ??= $("#character-select").val();
  landscape ??= $("#landscape-select").val();
  return new Promise((resolve) => {
    const fName = character + "-" + landscape;
    htmlToImage
      .toBlob(document.getElementById("map-frame"))
      .then(function (blob) {
        resolve(FileSaver.saveAs(blob, fName));
      });
  });
}

/**
 * draws the background hexagons
 * @param {number} w
 * @param {number} h
 */
function drawBackgroundHexes(w, h) {
  {
    // outer hex
    const size = Math.min(w, h);
    const left = ($("#map-frame").width() - size) / 2;
    const top = ($("#map-frame").height() - size) / 2;
    $("#map-frame").append(`
    <div class="hexagon base"
      style='left: ${left}px;
        top: ${top}px;
        height: ${size}px;
        width: ${size}px;
        background: var(--color-dark-3);'>
    </div>`);
  }
  {
    // inner hex
    const size = Math.min(w, h) * 0.9;
    const left = ($("#map-frame").width() - size) / 2;
    const top = ($("#map-frame").height() - size) / 2;
    $("#map-frame").append(`
    <div class="hexagon inner"
      style='left: ${left}px;
        top: ${top}px;
        height: ${size}px;
        width: ${size}px;
        z-index: 1;
        background: var(--hex-inner-background);'>
    </div>`);
  }
  {
    // inner hex overlay
    const size = Math.min(w, h);
    const left = ($("#map-frame").width() - size) / 2;
    const top = ($("#map-frame").height() - size) / 2;
    $("#map-frame").append(`
    <div class="hexagon overlay"
      style='left: ${left}px;
        top: ${top}px;
        height: ${size}px;
        width: ${size}px;'>
    </div>`);
  }
}

function displayTerrainIcon(character, landscape, scale) {
  const e = $("#map-canvas");
  const size = Math.min(e.width(), e.height()) * scale;
  const x = (e.width() - size) / 2;
  const y = (e.height() - size) / 2;
  e.html(`<div class="hex-symbol"
    style='background-color: var(--color-${character});
      -webkit-mask-image: url(img/symbols/${landscape}.svg);
      mask-image: url(img/symbols/${landscape}.svg);
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;'
    >
  </div>`);

  // display indexes for character and landscape
  // const cIndex = LAND_CHARACTERS.findIndex((c) => c === character) + 1;
  // const lIndex = LAND_LANDSCAPES.findIndex((l) => l === landscape) + 1;
  // $(".landscape-signifier").html(`${cIndex}:${lIndex}`);
  // $(".landscape-signifier").css({ color: `var(--color-${character})` });

  // change hex border
  $(".hexagon.base").css({ background: `var(--color-${character})` });
}

$(document).ready(() => {
  const mSize = Math.min($("#map-frame").width(), $("#map-frame").height());
  $("#map-frame").css({
    width: mSize + "px",
    height: mSize + "px",
  });
  const scale = 1;
  const h = scale * $("#map-frame").height();
  const w = scale * $("#map-frame").width();
  const points = hexPoints(w, h, {
    x: ((1 - scale) / 2) * $("#map-frame").width(),
    y: ((1 - scale) / 2) * $("#map-frame").height(),
  });

  drawBackgroundHexes(w, h);

  /**
   * generate central icon on select change
   */
  $(document).on("change", "#character-select,#landscape-select", () => {
    const character = $("#character-select").val();
    const landscape = $("#landscape-select").val();
    displayTerrainIcon(character, landscape, ICON_SCALE);
  });
  displayTerrainIcon(
    $("#character-select").val(),
    $("#landscape-select").val(),
    ICON_SCALE
  );

  // /**
  //  * Draw a hex
  //  */
  // delete points.center;
  // for (const [c1, p1] of Object.entries(points)) {
  //   for (const [c2, p2] of Object.entries(points)) {
  //     if (c1 === c2) continue;
  //     const exists = lines.find(
  //       (l) =>
  //         (l.p1.key === c1 && l.p2.key === c2) ||
  //         (l.p1.key === c2 && l.p2.key === c1)
  //     );
  //     if (exists) continue;
  //     if (!p1.neighbors[c2]) continue;
  //     lines.push({
  //       p1: {
  //         x: p1.x,
  //         y: p1.y,
  //         key: c1,
  //       },
  //       p2: {
  //         x: p2.x,
  //         y: p2.y,
  //         key: c2,
  //       },
  //       status: "inactive",
  //     });
  //   }
  //   shapes.push({
  //     x: p1.x,
  //     y: p1.y,
  //     type: "inactive",
  //     key: c1,
  //     entrance: false,
  //   });
  // }
  // drawLines(lines);
  // drawShapes(shapes);

  // /**
  //  * Cycle lines
  //  */
  // $(document).on("mousedown", ".line", (ev) => {
  //   ev.preventDefault();
  //   const e = $(ev.currentTarget);
  //   const line = lines.find((l) => e.attr("id") === `${l.p1.key}-${l.p2.key}`);
  //   if (!line) return;
  //   let statusIndex = LINE_STATUSES.findIndex((s) => s === line.status);
  //   if (ev.button === 0) {
  //     statusIndex += 1;
  //     if (statusIndex >= LINE_STATUSES.length) statusIndex = 0;
  //   } else if (ev.button === 2) {
  //     statusIndex -= 1;
  //     if (statusIndex < 0) statusIndex = LINE_STATUSES.length - 1;
  //     ev.stopPropagation();
  //   }
  //   line.status = LINE_STATUSES[statusIndex];
  //   drawLines(lines);
  //   return false;
  // });
  // /**
  //  * Cycle shapes
  //  */
  // $(document).on("mousedown", ".shape", (ev) => {
  //   ev.preventDefault();
  //   ev.stopPropagation();
  //   const e = $(ev.currentTarget);
  //   const shape = shapes.find((s) => e.attr("id") === `shape-${s.key}`);
  //   if (!shape) return;
  //   let shapeIndex = SHAPES.findIndex((s) => s === shape.type);
  //   if (ev.button === 0) {
  //     shapeIndex += 1;
  //     if (shapeIndex >= SHAPES.length) shapeIndex = 0;
  //   } else if (ev.button === 2) {
  //     shapeIndex -= 1;
  //     if (shapeIndex < 0) shapeIndex = SHAPES.length - 1;
  //   } else if (ev.button === 1) {
  //     let entranceIndex =
  //       ENTRANCE_TYPES.findIndex((e) => e === shape.entrance) + 1;
  //     if (entranceIndex >= ENTRANCE_TYPES.length) entranceIndex = 0;
  //     shape.entrance = ENTRANCE_TYPES[entranceIndex];
  //   }
  //   console.log(ev.button);
  //   shape.type = SHAPES[shapeIndex];
  //   drawShapes(shapes);
  // });

  /**
   * Save hex
   */
  $(document).on("click", ".save-hex", async () => {
    // for (const character of LAND_CHARACTERS) {
    //   for (const landscape of LAND_LANDSCAPES) {
    //     displayTerrainIcon(character, landscape, 0.5);
    //     await saveHex(character, landscape);
    //   }
    // }
    saveHex();
  });
});
