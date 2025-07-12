/* eslint-disable no-unused-vars */
/*global $*/

const dialogHTML = `
  <form class="ui-dialog">
    <div class="dialog-header">
      <div class="dialog-label">
        <div class="dialog-title"></div>
      </div>
      <div class="dialog-controls">
        <button class="close-dialog dialog-cancel">
          <i class="fa-solid fa-square-xmark"></i>
        </button>
      </div>
    </div>
    <div class="dialog-content"></div>
  </form>`;

/**
 * Initializes all ui hooks
 */
function initializeUi() {
  // Close dialog
  $(document).on("click", ".close-dialog", (ev) => {
    const d = $(ev.currentTarget).closest(".ui-dialog");
    d.closest(".ui-dialog").slideUp("fast", () => d.remove());
  });
}

/**
 * Creates a new dialog from the title, content, and options
 * @param {string} title
 * @param {string} content
 * @param {{classes?: string}} options draggable?
 * @returns {Promise<JQuery>} newly created element
 */
async function Dialog(title, content, options = {}) {
  return new Promise((resolve) => {
    // $.get("bastion-site/map/templates/dialog.html", (data) => {
    //   const e = $(data);
    //   e.find(".dialog-title").html(title);
    //   e.find(".dialog-content").html(content);
    //   // make draggable if option chosen
    //   if (options.draggable) {
    //     e.modal();
    //     e.addClass("draggable");
    //     e.draggable({
    //       cancel: ".dialog-content",
    //       scroll: false,
    //       contain: "#ui-overlay",
    //       start: () => {
    //         e.css({ transform: "unset" });
    //         $("#ui-overlay").append(e);
    //       },
    //     });
    //   }
    //   $("#ui-overlay").append(e);
    //   resolve(e);
    // });
    const e = $(dialogHTML);
    if (options.classes) e.addClass(options.classes);
    e.find(".dialog-title").html(title);
    e.find(".dialog-content").html(content);
    $("#ui-overlay").append(e);
    resolve(e);
  });
}

/**
 * Creates a confirmation dialog
 * @param {string} title
 * @param {string} content
 * @param {{
 *  confirm?: (FormData, Event) => any,
 *  cancel?: () => any,
 *  classes?: string
 * }?} options
 */
async function Confirm(title, content, options = {}) {
  const buttons = $(`<div class="dialog-buttons">
    <button class="dialog-confirm">Confirm</button>
    <button type="button" class="dialog-cancel">Cancel</button>
    </div>
    `);
  const dialog = await Dialog(title, content, { classes: options.classes });
  dialog.append(buttons);
  dialog.on("click", ".dialog-cancel", () => {
    dialog.slideUp(100, () => dialog.remove());
    if (options.cancel) options.cancel();
  });
  dialog.on("submit", (ev) => {
    dialog.slideUp(100, () => dialog.remove());
    ev.preventDefault();
    if (options.confirm) {
      const data = new FormData(dialog.get(0));
      options.confirm(data, ev.originalEvent);
    }
  });
}
