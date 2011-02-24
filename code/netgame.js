var svg = null;
var gridview = null;
const svg_templates = {};

window.onload = function() {
  svg = document.getElementById('gameview');
  for each(var el in svg.getElementsByTagName('defs')[0].childNodes) {
    if(!el.id) continue;
    svg_templates[el.id] = el;
    el.removeAttribute('id'); // because we clone them
  }
  gridview = document.getElementById('sqrgrid');
  newGrid(9, 9);
}


const kTileSize = 50;
const kTileHalf = 25;


const view = {
  _grid: null,
  _views: null,

  show: function(grid) {
    this._grid = grid;
    while(gridview.hasChildNodes()) gridview.removeChild(gridview.lastChild);
    const vb = svg.viewBox.baseVal;
    vb.width = grid.width * kTileSize;
    vb.height = grid.height * kTileSize;

    // Draw backgrounds, then links/nodes, then walls.  For z-ordering.
    for each(var c in grid.cells) c.draw_bg();
    for each(var c in grid.cells) c.draw_fg();

    for each(var cell in grid.cells) {
      var adj = cell.adj, x = cell.x, y = cell.y;
      if(!x && !adj[3]) this._draw_wall('sqr-wall-v', x, y);
      if(!adj[1]) this._draw_wall('sqr-wall-v', x + 1, y);
      if(!y && !adj[0]) this._draw_wall('sqr-wall-h', x, y);
      if(!adj[2]) this._draw_wall('sqr-wall-h', x, y + 1);
    }

    this.update_poweredness();
    const self = this;
    gridview.onclick = function(ev) { self._onclick(ev) };
  },

  _add_transformed_clone: function(template_id, transform) {
    const el = svg_templates[template_id].cloneNode(true);
    el.setAttribute('transform', transform);
    gridview.appendChild(el);
    return el;
  },

  update_poweredness: function() {
    const powered_id_set = which_cells_are_powered(this._grid);
    for each(var c in this._grid.cells) c.show_powered(c.id in powered_id_set);
  },

  _draw_wall: function(wall, x, y) {
    this._add_transformed_clone(wall, 'translate(' + (x * kTileSize) + ', ' + (y * kTileSize) + ')');
  },

  _onclick: function(ev) {
    const g = ev.target;
    if(!g.__cell) return;
    const cell = g.__cell;
    cell.rotate_clockwise();
    cell.redraw();
    this.update_poweredness();
  },
};


function newGrid(width, height) {
  const grid = create_empty_grid(width, height, false);
  fill_grid(grid);
  grid.cells = Array.concat.apply(null, grid);
  add_walls(grid, 0.1);
  for each(var c in grid.cells) c._rotation = random_int(4);
  view.show(grid);
}


function create_empty_grid(width, height, wrap) {
  const grid = new Array(width);
  grid.width = width;
  grid.height = height;

  const xmax = width - 1;
  const ymax = height - 1;

  for(var x = 0; x != width; ++x) {
    grid[x] = new Array(height);
    for(var y = 0; y != height; ++y) grid[x][y] = new Cell(x, y, x * width + y);
  }

  for(x = 0; x != width; ++x) {
    for(y = 0; y != width; ++y) {
      var cell = grid[x][y];
      if(x != xmax) cell.adj[1] = grid[x + 1][y];
      else if(wrap) cell.adj[1] = grid[0][y];
      if(y != 0) cell.adj[0] = grid[x][y - 1];
      else if(wrap) cell.adj[0] = grid[x][ymax];
      if(y != ymax) cell.adj[2] = grid[x][y + 1];
      else if(wrap) cell.adj[2] = grid[x][0];
      if(x != 0) cell.adj[3] = grid[x - 1][y];
      else if(wrap) cell.adj[3] = grid[xmax][y];
    }
  }

  return grid;
}


function fill_grid(grid) {
  const width = grid.length, height = grid[0].length;

  const source = grid[Math.floor(width / 2)][Math.floor(height / 2)];
  source.isSource = true;
  grid.sourceCell = source;

  const linked = {};
  linked[source.id] = true;

  const fringe0 = source.adj;
  const fringe = [];
  const uniq = new Array(width * height); // ensures uniqueness of elements of |fringe|
  for(var i = 0; i != 4; ++i) {
    var fr = fringe0[i];
    if(!fringe0[i]) continue;
    fringe.push(fr);
    uniq[fr.id] = true;
  }

  // Repeatedly pick a random cell from the fringe, link it into the network, and add its unlinked adjacents to the fringe.
  for(var num = fringe.length; num; num = fringe.length) {
    var cell = fringe.splice(random_int(num), 1)[0];
    var adjs = cell.adj;

    var linked_adj_ixs = [];
    for(var i = 0; i != 4; ++i) {
      var adj = adjs[i];
      if(adj && linked[adj.id]) linked_adj_ixs.push(i);
    }

    var random_dir = linked_adj_ixs[random_int(linked_adj_ixs.length)];
    cell.links[random_dir] = 1;
    cell.adj[random_dir].links[invert_direction(random_dir)] = 1;
    linked[cell.id] = true;

    for each(var adj in cell.adj) {
      if(!adj || linked[adj.id] || uniq[adj.id]) continue;
      fringe.push(adj);
      uniq[adj.id] = true;
    }
  }

  return grid;
}


// Walls are just hints, added after grid filling to make it easier to solve.
function add_walls(grid, wall_probability) {
  if(!wall_probability) return;
  for each(var c in grid.cells) {
    if(!c.links[0] && c.adj[0] && Math.random() < wall_probability) c.adj[0].adj[2] = null, c.adj[0] = null;
    if(!c.links[3] && c.adj[3] && Math.random() < wall_probability) c.adj[3].adj[1] = null, c.adj[3] = null;
  }
}


function Cell(x, y, id) {
  this.id = id; // numeric nonce
  this.x = x;
  this.y = y;

  // up, right, down, left
  this.adj = [null, null, null, null];
  // 1 or 0, as bools, indicating if this block is linked up, right, down, left, when in its proper orientation.  (i.e. current rotation is not reflected here)
  this.links = [0, 0, 0, 0];
}
Cell.prototype = {
  isSource: false,

  _rotation: 0, // [0 .. 4)

  has_current_link_to: function(dir) {
    dir -= this._rotation;
    if(dir < 0) dir += 4;
    return !!this.links[dir];
  },

  rotate_clockwise: function() {
    this._rotation = [1, 2, 3, 0][this._rotation];
  },

  draw_bg: function() {
    var tv = view._add_transformed_clone('sqr-tile', 'translate(' + (this.x * kTileSize) + ', ' + (this.y * kTileSize) + ')');
    tv.__cell = this;
  },

  draw_fg: function() {
    const [shape, base_angle] = this._calculate_shape();
    const cv = this._view = view._add_transformed_clone(shape, 'translate(' + (this.x * kTileSize + kTileHalf) + ',' + (this.y * kTileSize + kTileHalf) + ') rotate(' + base_angle + ')');
    if(this.isSource) {
      const core = svg_templates['sqr-core'].cloneNode(true);
      cv.firstChild.appendChild(core);
    }
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  _calculate_shape: function() {
    const links = this.links;
    const links_sum = links[3] * 8 + links[2] * 4 + links[1] * 2 + links[0];
    return ({
        0: ['sqr-none', 0],
        1: ['sqr-t', 0],
        2: ['sqr-t', 90],
        3: ['sqr-tr', 0],
        4: ['sqr-t', 180],
        5: ['sqr-tb', 0],
        6: ['sqr-tr', 90],
        7: ['sqr-trb', 0],
        8: ['sqr-t', 270],
        9: ['sqr-tr', 270],
        10: ['sqr-tb', 90],
        11: ['sqr-trb', 270],
        12: ['sqr-tr', 180],
        13: ['sqr-trb', 180],
        14: ['sqr-trb', 90],
        15: ['sqr-trbl', 0],
      })[links_sum];
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 90) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },
};


// Rotating a cell can power or depower abitrarily many others, so it doesn't make sense to store powered-ness as a property of the cell.  Instead, we build sets of powered node as-needed.
function which_cells_are_powered(grid) {
  const powered = {};
  const queue = [grid.sourceCell];
  for(var i = 0; i < queue.length; ++i) {
    var cell = queue[i];
    powered[cell.id] = true;
    for(var dir = 0; dir !== 4; ++dir) {
      var adj = cell.adj[dir];
      if(!adj) continue;
      if(!cell.has_current_link_to(dir)) continue;
      if(!adj.has_current_link_to(invert_direction(dir))) continue;
      if(powered[adj.id]) continue;
      queue.push(adj);
    }
  }
  return powered;
}


function invert_direction(dir) {
  return [2, 3, 0, 1][dir];
}


function random_int(max) {
  var r;
  do { r = Math.random(); } while(r == 1.0);
  return Math.floor(r * max);
}
