window.onload = function() {
  view.init();
  newGrid(9, 9);
}

const kTileSize = 50;
const kTileHalf = 25;

const view = {
  init: function() {
    this._svg = document.getElementById('gameview');
    this._gridview = document.getElementById('sqrgrid');
    const ids = {
      tile: 'sqr-tile',
      wall_v: 'wall-v',
      wall_h: 'wall-h',
      core: 'sqr-core',
      t: 'sqr-t',
      tr: 'sqr-tr',
      tb: 'sqr-tb',
      trb: 'sqr-trb',
      trbl: 'sqr-trbl',
    };
    const sts = this._svg_templates = {};
    for(var [k, v] in Iterator(ids)) {
      sts[k] = document.getElementById(v);
      sts[k].removeAttribute('id'); // because we're going to clone it a lot
    }
    this.init = null; // make repeated init() fail
  },

  _grid: null,
  _svg: null,
  _svg_templates: null,
  _gridview: null,
  _views: null,

  show: function(grid) {
    this._grid = grid;
    const gv = this._gridview;
    while(gv.hasChildNodes()) gv.removeChild(gv.lastChild);
    const vb = this._svg.viewBox.baseVal;
    vb.width = grid.width * kTileSize;
    vb.height = grid.height * kTileSize;
    // Draw the tile backgrounds first, so they're lowest in z-order
    for(var x = 0; x != grid.width; ++x) {
      for(var y = 0; y != grid.height; ++y) {
        var tv = this._add_transformed_clone('tile', 'translate(' + (x * kTileSize) + ', ' + (y * kTileSize) + ')');
        tv.__isTile = true;
        tv.__x = x;
        tv.__y = y;
      }
    }
    // Draw the links/nodes in the tiles
    const tvs = this._tileviews = new Array(grid.width);
    for(var x = 0; x != grid.width; ++x) {
      tvs[x] = new Array(grid.height);
      for(var y = 0; y != grid.height; ++y) {
        tvs[x][y] = this._make_tile(x, y);
        this.update_tile_view(x, y);
      }
    }
    // draw the walls (after the tiles, so they come above in z-order)
    for(var x = 0; x != grid.width; ++x) {
      for(var y = 0; y != grid.height; ++y) {
        var cell = grid[x][y], adj = cell.adj;
        if(!x && !adj[3]) this._draw_wall('wall_v', x, y);
        if(!adj[1]) this._draw_wall('wall_v', x + 1, y);
        if(!y && !adj[0]) this._draw_wall('wall_h', x, y);
        if(!adj[2]) this._draw_wall('wall_h', x, y + 1);
      }
    }
    this.update_poweredness();
    const self = this;
    gv.onclick = function(ev) { self._onclick(ev) };
  },

  _add_transformed_clone: function(template_id, transform) {
    const el = this._svg_templates[template_id].cloneNode(true);
    el.setAttribute('transform', transform);
    this._gridview.appendChild(el);
    return el;
  },

  _make_tile: function(x, y) {
    const cell = this._grid[x][y];
    const [shape, base_angle] = this._calculate_shape(cell);
    const view = this._add_transformed_clone(shape, 'translate(' + (x * kTileSize + kTileHalf) + ',' + (y * kTileSize + kTileHalf) + ') rotate(' + base_angle + ')');
    if(cell.isSource) {
      const core = this._svg_templates.core.cloneNode(true);
      view.firstChild.appendChild(core);
    }
    this._gridview.appendChild(view);
    return view;
  },

  _calculate_shape: function(tile) {
    const links = tile.links;
    const links_sum = links[3] * 8 + links[2] * 4 + links[1] * 2 + links[0];
    return ({
        0: ['none', 0],
        1: ['t', 0],
        2: ['t', 90],
        3: ['tr', 0],
        4: ['t', 180],
        5: ['tb', 0],
        6: ['tr', 90],
        7: ['trb', 0],
        8: ['t', 270],
        9: ['tr', 270],
        10: ['tb', 90],
        11: ['trb', 270],
        12: ['tr', 180],
        13: ['trb', 180],
        14: ['trb', 90],
        15: ['trbl', 0],
      })[links_sum];
  },

  update_tile_view: function(x, y) {
    this._tileviews[x][y].firstChild.setAttribute('transform', 'rotate(' + this._grid[x][y].current_angle() + ')');
  },

  update_poweredness: function() {
    const g = this._grid, w = g.width, h = g.height, tvs = this._tileviews;
    const powered_id_set = which_cells_are_powered(g);
    for(var x = 0; x != w; ++x)
      for(var y = 0; y != h; ++y)
        tvs[x][y].className.baseVal = g[x][y].id in powered_id_set ? 'powered' : '';
  },

  _draw_wall: function(wall, x, y) {
    this._add_transformed_clone(wall, 'translate(' + (x * kTileSize) + ', ' + (y * kTileSize) + ')');
  },

  _onclick: function(ev) {
    const g = ev.target;
    if(!g.__isTile) return;
    const x = g.__x, y = g.__y;
    const cell = this._grid[x][y];
    cell.rotate_clockwise();
    this.update_tile_view(x, y);
    this.update_poweredness();
  },
};


function newGrid(width, height) {
  const grid = createEmptyGrid(width, height, false, false, 10);
  fillGrid(grid);
  for(var x = 0; x != width; ++x)
    for(var y = 0; y != height; ++y)
      grid[x][y]._rotation = random_int(4);
  view.show(grid);
}


// xWrap, yWrap are bools, all others are integers
function createEmptyGrid(width, height, xWrap, yWrap, walls) {
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
      else if(xWrap) cell.adj[1] = grid[0][y];
      if(y != 0) cell.adj[0] = grid[x][y - 1];
      else if(yWrap) cell.adj[0] = grid[x][ymax];
      if(y != ymax) cell.adj[2] = grid[x][y + 1];
      else if(yWrap) cell.adj[2] = grid[x][0];
      if(x != 0) cell.adj[3] = grid[x - 1][y];
      else if(xWrap) cell.adj[3] = grid[xmax][y];
    }
  }

  // Add some "walls" (extra barriers between cells which should be adjacent)
  for(var i = 0; i != walls; ) {
    x = random_int(width);
    y = random_int(height);
    adj = random_int(4);

    cell = grid[x][y];
    var adjcell = grid[x][y].adj[adj];
    if(!adjcell) continue;
    adjcell.adj[invert_direction(adj)] = null;
    cell.adj[adj] = null;
    ++i;
  }

  return grid;
}


function fillGrid(grid) {
  const width = grid.length, height = grid[0].length;

  const source = grid[Math.floor(width / 2)][Math.floor(height / 2)];
  source.isSource = true;
  source.isLinked = true;
  grid.sourceCell = source;

  const fringe0 = source.adj;
  const fringe = [];
  const uniq = new Array(width * height); // ensures uniqueness of elements of |fringe|
  for(var i = 0; i != 4; ++i) {
    var fr = fringe0[i];
    if(!fringe0[i]) continue;
    fringe.push(fr);
    uniq[fr.id] = true;
  }

  for(var num = fringe.length; num; num = fringe.length) {
    // pick a random cell from the fringe
    var cell = fringe.splice(random_int(num), 1)[0];

    // link it into the network, and add its unlinked adjs to the fringe
    cell.linkToRandomAdj();

    var adjs = cell.adj;
    for(i = 0; i != 4; ++i) {
      var adj = adjs[i];
      if(!adj || adj.isLinked || uniq[adj.id]) continue;
      fringe.push(adj);
      uniq[adj.id] = true;
    }
  }

  return grid;
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

  // used only during grid construction.  has the cell been linked to the source yet?
  isLinked: false,

  _rotation: 0, // [0 .. 4)

  // link this cell to a random adjacent unlinked cell
  linkToRandomAdj: function() {
    const adjs = this.adj;

    var linked = [];
    for(var i = 0; i != 4; ++i) {
      var adj = adjs[i];
      if(adj && adj.isLinked) linked.push(i);
    }

    ran = random_int(linked.length);
    ran = linked[ran]; // so it's a cell's index

    this.links[ran] = 1;
    this.isLinked = true;

    var i2 = invert_direction(ran);
    adj = adjs[ran];
    adj.links[i2] = 1;
  },

  has_current_link_to: function(dir) {
    dir -= this._rotation;
    if(dir < 0) dir += 4;
    return !!this.links[dir];
  },

  current_angle: function() {
    return this._rotation * 90;
  },

  rotate_clockwise: function() {
    this._rotation = [1, 2, 3, 0][this._rotation];
  }
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
