/*global $, htmlToImage, FileSaver*/

const LINE_STATUSES = ["inactive", "active", "blocked", "hidden"];
const SHAPES = ["inactive", "circ", "diamond", "triangle"];
const ENTRANCE_TYPES = [false, "entrance", "secretEntrance"];

const SCROLL_SPEED = 1;

const cos30 = 0.86602540378;

let frameToHexScale = 1;
let lineCount = 0;
let shapeCount = 0;
let hexCount = 10;

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
    classes: "active",
  },
};

const shapeStyles = {
  inactive: {
    shape: "circ",
    draw: circDraw,
    color: "var(--shape-inactive-color)",
    size: 10,
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
    size: 30,
    classes: "entrance",
  },
  secretEntrance: {
    shape: "circle",
    draw: circDraw,
    color: "",
    size: 30,
    classes: "secret entrance",
  },
};

// points: top, topR, bottomR, bottom, bottomL, topL
// side starts at top right, goes clockwise, base 0
const pointsPerSide = {
  0: ["top", "topR"],
  1: ["topR", "bottomR"],
  2: ["bottomR", "bottom"],
  3: ["bottom", "bottomL"],
  4: ["bottomL", "topL"],
  5: ["topL", "top"],
};
const excludedSidesForPosition = {
  bottomLeft: 0,
  left: 1,
  topLeft: 2,
  topRight: 3,
  right: 4,
  bottomRight: 5,
};
const sideNumToName = {
  0: "topRight",
  1: "right",
  2: "bottomRight",
  3: "bottomLeft",
  4: "left",
  5: "topLeft",
};
const nameToSideNum = {
  topRight: 0,
  right: 1,
  bottomRight: 2,
  bottomLeft: 3,
  left: 4,
  topLeft: 5,
};

/**
 * Gets coordinates of all possible neighbors of a hex
 *
 * @param {number} x
 * @param {number} y
 * @returns neighboring coordinates
 */
function neighborsFromCoords(x, y) {
  x = parseInt(x);
  y = parseInt(y);
  const offsetX = y % 2 === 0 ? 1 : 0;

  const offsetsPerSide = [
    { x: offsetX, y: -1, label: "topRight" }, // topR
    { x: 1, y: 0, label: "right" }, // right
    { x: offsetX, y: +1, label: "bottomRight" }, // bottomR
    { x: offsetX - 1, y: +1, label: "bottomLeft" }, // bottomL
    { x: -1, y: 0, label: "left" }, // left
    { x: offsetX - 1, y: -1, label: "topLeft" }, // topL
  ];

  return offsetsPerSide.map((o) => ({
    x: o.x + x,
    y: o.y + y,
    label: o.label,
  }));
}

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
    x: 0.5 * cos30 * size,
    y: 0,
    neighbors: {
      topR: true,
      topL: true,
      center: true,
    },
  };
  points.topR = {
    x: cos30 * size,
    y: 0.25 * size,
    neighbors: {
      top: true,
      bottomR: true,
      center: true,
    },
  };
  points.bottomR = {
    x: cos30 * size,
    y: 0.75 * size,
    neighbors: {
      topR: true,
      bottom: true,
      center: true,
    },
  };
  points.bottom = {
    x: 0.5 * cos30 * size,
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
    x: 0.5 * cos30 * size,
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
      data-id="${id}"
      style='transform-origin: center left;
      transform: ${translateX} rotate(${degree}deg);
      width: ${lineLength}px;
      height: ${thickness}px;
      background: ${color};
      position: absolute;
      top: ${y}px; left:${x}px;'
      data-parentid="${$(parent).attr("id")}">
      
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
      data-id="${id}"
      style='
      width: ${size * 2}px;
      height: ${size * 2}px;
      background: ${color};
      position: absolute;
      top: ${y}px; left:${x}px;
      border-radius: 50%;'
      data-parentid="${$(parent).attr("id")}">
    </div>${
      classes.includes("active")
        ? `
    <div class='circ shape ${classes}'
      data-id="${id}"
      style='
      width: ${size * 2 * 1.2}px;
      height: ${size * 2 * 1.2}px;
      background: var(--line-color-active);
      position: absolute;
      top: ${y - size * 0.2}px; left:${x - size * 0.2}px;
      border-radius: 50%;
      z-index: 95;'
      data-parentid="${$(parent).attr("id")}">
    </div>`
        : ""
    }`;

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
      data-id="${id}"
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
        rotate(45deg);'
      data-parentid="${$(parent).attr("id")}">
    </div>
      <div class='diamond shape ${classes}'
        data-id="${id}"
        style='
        z-index: 95;
        width: ${size * 1.3}px;
        height: ${size * 1.3}px;
        background: var(--line-color-active);
        position: absolute;
        top: ${y - size * 0.15}px; left:${x - size * 0.15}px;
        transform-origin: center center;
        transform: 
          translateX(${size / 2}px)
          translateY(${size / 2}px)
          rotate(45deg);'
        data-parentid="${$(parent).attr("id")}"></div>`;

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
      data-id="${id}"
      style='
      width: ${width}px;
      height: ${height}px;
      background: ${color};
      position: absolute;
      clip-path: polygon(50% 0, 100% 100%, 0 100%);
      top: ${y}px; left:${x}px;'
      data-parentid="${$(parent).attr("id")}">
    </div>
    <div class='triangle shape ${classes}'
      data-id="${id}"
      style='
      width: ${width * 1.3}px;
      height: ${height * 1.3}px;
      position: absolute;
      clip-path: polygon(50% 0, 100% 100%, 0 100%);
      top: ${y - height * 0.2}px; left:${x - width * 0.15}px;
      background: var(--line-color-active);
      z-index: 100;'
      data-parentid="${$(parent).attr("id")}">
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
 }[]]} lines 
 * @param {unknown} parent jquery selector
 */
function drawLines(lines, parent) {
  for (const line of lines) {
    const id = `${line.p1.key}-${line.p2.key}`;
    const style = lineStyles[line.status];
    const thickness = style.thickness;
    const color = style.color;
    const classes = style.classes;
    // erase old line
    $(`[data-id=${id}][data-parentid=${$(parent).attr("id")}]`).remove();
    linedraw({
      p1: line.p1,
      p2: line.p2,
      parent: $(parent).get(0),
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
 * @param {unknown} parent jquery selector
 */
function drawShapes(shapes, parent) {
  $(parent).children(".entrance").remove();
  for (const shape of shapes) {
    {
      const style = shapeStyles[shape.type];
      if (!style) continue;
      const { x, y, key } = shape;
      const id = `shape-${key}`;
      $(`[data-id=${id}][data-parentid=${$(parent).attr("id")}]`).remove();
      const { size, color, classes } = style;
      style.draw({
        p: { x, y },
        size,
        color,
        id,
        classes,
        parent: $(parent).get(0),
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
        parent: $(parent).get(0),
      });
    }
  }
}
/**
 * Save the
 */
async function saveHex() {
  $("button").attr("aria-busy", true);
  $("#global-parent").addClass("min");
  await new Promise((resolve) => {
    htmlToImage
      .toBlob(document.getElementById("global-parent"))
      .then(function (blob) {
        FileSaver.saveAs(blob, "site");
        resolve(true);
      });
  });
  $("#global-parent").removeClass("min");
  $("button").removeAttr("aria-busy");
}

function addLinesListeners(parent, lines) {
  /**
   * Cycle lines
   */
  $(document).on("mousedown", `#${$(parent).attr("id")} .line`, (ev) => {
    ev.preventDefault();
    const e = $(ev.currentTarget);
    const line = lines.find((l) => e.data("id") === `${l.p1.key}-${l.p2.key}`);
    if (!line) return;
    let statusIndex = LINE_STATUSES.findIndex((s) => s === line.status);
    if (ev.button === 0) {
      statusIndex += 1;
      if (statusIndex >= LINE_STATUSES.length) statusIndex = 0;
    } else if (ev.button === 2) {
      statusIndex -= 1;
      if (statusIndex < 0) statusIndex = LINE_STATUSES.length - 1;
      ev.stopPropagation();
    }
    line.status = LINE_STATUSES[statusIndex];

    drawLines(lines, parent);
    return false;
  });
}

function addShapesListeners(parent, shapes) {
  /**
   * Cycle shapes
   */
  $(document).on("mousedown", `#${$(parent).attr("id")} .shape`, (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    const e = $(ev.currentTarget);
    const shape = shapes.find((s) => e.data("id") === `shape-${s.key}`);
    if (!shape) return;
    let shapeIndex = SHAPES.findIndex((s) => s === shape.type);
    if (ev.button === 0) {
      shapeIndex += 1;
      if (shapeIndex >= SHAPES.length) shapeIndex = 0;
    } else if (ev.button === 2) {
      shapeIndex -= 1;
      if (shapeIndex < 0) shapeIndex = SHAPES.length - 1;
    } else if (ev.button === 1) {
      let entranceIndex =
        ENTRANCE_TYPES.findIndex((e) => e === shape.entrance) + 1;
      if (entranceIndex >= ENTRANCE_TYPES.length) entranceIndex = 0;
      shape.entrance = ENTRANCE_TYPES[entranceIndex];
    }
    shape.type = SHAPES[shapeIndex];

    console.log(shapes);
    drawShapes(shapes, parent);
  });
}

/**
 *
 * @param {HTMLElement} parent
 * @param {'topLeft'
 *       | 'topRight'
 *       | 'right'
 *       | 'bottomRight'
 *       | 'bottomLeft'
 *       | 'left'
 * } position
 * @returns {{left: string, top: string}} css values for left and top
 */
function cssPos(parent, position) {
  // const offset = { left: $(parent).css("left"), top: $(parent).css("top") };
  const globalOffset = {
    left: $(".content").css("--global-offset-x")?.slice(0, -2) ?? 0,
    top: $(".content").css("--global-offset-y")?.slice(0, -2) ?? 0,
  };
  const offset = {
    left: $(parent).position().left - Number(globalOffset.left),
    top: $(parent).position().top - Number(globalOffset.top),
  };
  let left = "";
  let top = "";

  switch (position) {
    case "topLeft":
      left = `calc(var(--global-offset-x) + ${
        offset.left
      }px - var(--hex-size) * ${cos30 / 2})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px - var(--hex-size) * 0.75)`;
      break;
    case "topRight":
      left = `calc(var(--global-offset-x) + ${
        offset.left
      }px + var(--hex-size) * ${cos30 / 2})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px - var(--hex-size) * 0.75)`;
      break;
    case "right":
      left = `calc(var(--global-offset-x) + ${offset.left}px + var(--hex-size) * ${cos30})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px)`;
      break;
    case "bottomRight":
      left = `calc(var(--global-offset-x) + ${
        offset.left
      }px + var(--hex-size) * ${cos30 / 2})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px + var(--hex-size) * 0.75)`;
      break;
    case "bottomLeft":
      left = `calc(var(--global-offset-x) + ${
        offset.left
      }px - var(--hex-size) * ${cos30 / 2})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px + var(--hex-size) * 0.75)`;
      break;
    case "left":
      left = `calc(var(--global-offset-x) + ${offset.left}px - var(--hex-size) * ${cos30})`;
      top = `calc(var(--global-offset-y) + ${offset.top}px)`;
      break;
  }
  return { left, top };
}

/**
 *
 * @param {HTMLElement} frame
 * @param {{parent: HTMLElement,
 *          position: 'topLeft'
 *                  | 'topRight'
 *                  | 'right'
 *                  | 'bottomRight'
 *                  | 'bottomLeft'
 *                  | 'left'
 *          }?} options: array of sides to exclude
 */
function drawHex(frame, options = {}) {
  const lines = [];
  const shapes = [];

  const mapFrame = $(frame);
  // const mSize = Math.min(mapFrame.width(), mapFrame.height());
  // mapFrame.css({
  //   width: mSize + "px",
  //   height: mSize + "px",
  // });
  const h = frameToHexScale * mapFrame.height();
  const w = frameToHexScale * mapFrame.width();

  const points = hexPoints(w, h, {
    x: ((1 - frameToHexScale) / 2) * mapFrame.width(),
    y: ((1 - frameToHexScale) / 2) * mapFrame.height(),
  });

  const size = Math.min(w, h);
  const left = (mapFrame.width() - size) / 2;
  const top = (mapFrame.height() - size) / 2;
  mapFrame.append(`
    <div class="hexagon"
      style='left: ${left}px;
        top: ${top}px;
        height: ${size}px;
        width: ${size}px;'>
    </div>`);

  // const excludedSides = options.position
  //   ? [excludedSidesForPosition[options.position]]
  //   : [];
  const excludedSides = [];

  /**
   * Draw a hex
   */
  for (const [c1, p1] of Object.entries(points)) {
    for (const [c2, p2] of Object.entries(points)) {
      if (c1 === c2) continue;
      const exists = lines.find(
        (l) =>
          (l.p1.key === c1 && l.p2.key === c2) ||
          (l.p1.key === c2 && l.p2.key === c1)
      );
      if (exists) continue;
      const excluded = excludedSides.some((side) => {
        const keys = pointsPerSide[side];
        if (!keys) return false;
        return keys.includes(c1) && keys.includes(c2);
      });
      if (excluded) continue;
      if (!p1.neighbors[c2]) continue;
      lines.push({
        p1: {
          x: p1.x,
          y: p1.y,
          key: c1,
        },
        p2: {
          x: p2.x,
          y: p2.y,
          key: c2,
        },
        status: "inactive",
      });
    }
    shapes.push({
      x: p1.x,
      y: p1.y,
      type: "inactive",
      key: c1,
      entrance: false,
    });
  }

  drawLines(lines, mapFrame);
  drawShapes(shapes, mapFrame);

  addLinesListeners(mapFrame, lines);
  addShapesListeners(mapFrame, shapes);

  const outer = $(mapFrame).parent(".hex-outer");

  const parent = $(options.parent);
  let css = {
    left: "var(--global-offset-x)",
    top: "var(--global-offset-y)",
  };
  let x = 0;
  let y = 0;
  if (parent && options.position) {
    const cssPositions = cssPos(
      $(parent).parent(".hex-outer"),
      options.position
    );
    if (cssPositions) css = cssPositions;
    outer.attr("data-parent-id", $(parent).attr("id"));
    outer.attr("data-position", options.position);

    const parentOuter = $(parent).parent(".hex-outer");

    const parentsChildren =
      parentOuter.data("child-directions")?.split(",") ?? [];

    parentsChildren.push(nameToSideNum[options.position]);
    parentOuter.data("child-directions", parentsChildren.join());

    const parentX = parseInt(parentOuter.data("x") ?? 0) ?? 0;
    const parentY = parseInt(parentOuter.data("y") ?? 0) ?? 0;
    const offsetX = parentY % 2 === 0 ? 1 : 0;
    // Set coords based on parent
    switch (options.position) {
      case "topLeft":
        x = parentX - 1 + offsetX;
        y = parentY - 1;
        break;
      case "topRight":
        x = parentX + offsetX;
        y = parentY - 1;
        break;
      case "right":
        x = parentX + 1;
        y = parentY;
        break;
      case "bottomRight":
        x = parentX + offsetX;
        y = parentY + 1;
        break;
      case "bottomLeft":
        x = parentX - 1 + offsetX;
        y = parentY + 1;
        break;
      case "left":
        x = parentX - 1;
        y = parentY;
    }
  }

  $(mapFrame).parent(".hex-outer").attr("data-x", x);
  $(mapFrame).parent(".hex-outer").attr("data-y", y);

  $(mapFrame).parent(".hex-outer").css(css);
}

function drawAddbuttons() {
  $("button.add-hex").remove();

  const addButtons = [
    {
      direction: "topLeft",
      top: "5%",
      left: `calc(25% - 11px)`,
    },
    {
      direction: "topRight",
      top: "5%",
      left: `calc(75% - 11px)`,
    },
    {
      direction: "right",
      top: "50%",
      left: "110%",
    },
    {
      direction: "bottomRight",
      top: "90%",
      left: `calc(75% - 11px)`,
    },
    {
      direction: "bottomLeft",
      top: "90%",
      left: `calc(25% - 11px)`,
    },
    {
      direction: "left",
      top: "50%",
      left: "-10%",
    },
  ];

  $(".hex-outer").each(function () {
    const e = $(this);

    const mapFrame = e.children(".map-frame");
    const outer = mapFrame.parent(".hex-outer");
    const neighborCoords = neighborsFromCoords(
      outer.data("x"),
      outer.data("y")
    );
    // const childDirections = e.data("child-directions")?.split(",");

    const existingNeighbor = (direction) => {
      const coords = neighborCoords.find((c) => c.label === direction);
      return $(`.hex-outer[data-x=${coords?.x}][data-y=${coords?.y}]`).length;
    };

    for (const button of addButtons) {
      if (existingNeighbor(button.direction)) continue;
      // if (childDirections?.find((i) => button.direction === sideNumToName[i]))
      //   continue;
      e.append(`
      <button class="add-hex"
        data-from="${mapFrame.attr("id")}"
        style="left:${button.left};top:${button.top}"
        data-position="${button.direction}">
        +
      </button>`);
    }
  });
}

function drawRemoveButtons() {
  $("button.remove-hex").remove();

  // Dont draw remove buttons if only one hex
  if ($(".hex-outer").length <= 1) return;

  $(".hex-outer").each(function () {
    const e = $(this);

    const mapFrame = e.children(".map-frame");

    e.append(`
      <button class="remove-hex"
        data-from="${mapFrame.attr("id")}">
        X
      </button>`);
  });
}

$(document).ready(() => {
  const mapRoot = $("#map-frame-0");
  drawHex(mapRoot);
  // drawHex(mapRightBottom, { parent: mapRoot, position: "topRight" });
  // drawHex(mapRightTop, { parent: mapRoot, position: "topLeft" });

  drawAddbuttons();
  drawRemoveButtons();

  $(document).on("click", ".add-hex", (ev) => {
    const e = $(ev.currentTarget);

    const parent = $(`#${e.data("from")}`);
    const position = e.data("position");

    $("#global-parent").append(`<div class='hex-outer'>
        <div class="map-frame" id="map-frame-${++hexCount}"></div>
      </div>`);

    drawHex($(`#map-frame-${hexCount}`), { parent, position });
    drawAddbuttons();
    drawRemoveButtons();
  });

  $(document).on("click", ".remove-hex", (ev) => {
    const e = $(ev.currentTarget);

    $(`#${e.data("from")}`)
      .parent(".hex-outer")
      .remove();

    drawAddbuttons();
    drawRemoveButtons();
  });

  /**
   * Scrolling
   */
  $(document).on("wheel", (ev) => {
    const currentOffset = Number(
      $(".content").css("--global-offset-y")?.slice(0, -2) ?? 400
    );
    $(".content").css({
      "--global-offset-y": `${
        currentOffset - ev.originalEvent.deltaY * SCROLL_SPEED
      }px`,
    });
  });

  /**
   * Save hex
   */
  $(document).on("click", ".save-hex", () => {
    saveHex();
  });

  /**
   * remove extra stuff
   */
  $(document).on("click", ".minify", () => {
    const globalParent = $("#global-parent");
    if (globalParent.hasClass("min")) {
      globalParent.removeClass("min");
    } else {
      globalParent.addClass("min");
    }
  });
});
