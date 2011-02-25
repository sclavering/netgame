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
  new_grid(9, 9, true, 0.1);
}


const kTileSize = 50;
const kTileHalf = 25;


const view = {
  _grid: null,

  show: function(grid) {
    this._grid = grid;
    while(gridview.hasChildNodes()) gridview.removeChild(gridview.lastChild);
    const vb = svg.viewBox.baseVal;
    vb.width = grid.view_width;
    vb.height = grid.view_height;
    // Draw each group of things separately for z-ordering
    for each(var c in grid.cells) c.draw_bg();
    for each(var c in grid.cells) c.draw_fg();
    for each(var c in grid.cells) c.draw_walls();
    this.update_poweredness();
    const self = this;
    gridview.onclick = function(ev) { self._onclick(ev) };
  },

  update_poweredness: function() {
    const powered_id_set = which_cells_are_powered(this._grid);
    for each(var c in this._grid.cells) c.show_powered(c.id in powered_id_set);
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


function new_grid(width, height, wrap, wall_probability) {
  const grid = create_grid_functions.sqr(width, height, wrap);
  fill_grid(grid);
  // Walls are just hints, added after grid filling to make it easier to solve.
  if(wall_probability) for each(var c in grid.cells) c.add_walls(wall_probability);
  const max_rotation = grid.cells[0].adj.length;
  for each(var c in grid.cells) c._rotation = random_int(max_rotation);
  view.show(grid);
}


function fill_grid(grid) {
  const source = grid.source_cell;
  const linked = {};
  linked[source.id] = true;

  const fringe = [];
  const fringe_set = {};
  for each(var fr in source.adj) {
    if(!fr) continue;
    fringe.push(fr);
    fringe_set[fr.id] = true;
  }

  // Repeatedly pick a random cell from the fringe, link it into the network, and add its unlinked adjacents to the fringe.
  for(var num = fringe.length; num; num = fringe.length) {
    var cell = fringe.splice(random_int(num), 1)[0];

    var adjs = cell.adj, len = adjs.length;
    var linked_adj_ixs = [];
    for(var i = 0; i != len; ++i) {
      var adj = adjs[i];
      if(adj && linked[adj.id]) linked_adj_ixs.push(i);
    }

    var random_dir = linked_adj_ixs[random_int(linked_adj_ixs.length)];
    cell.links[random_dir] = 1;
    cell.adj[random_dir].links[cell.invert_direction(random_dir)] = 1;
    linked[cell.id] = true;

    for each(var adj in cell.adj) {
      if(!adj || linked[adj.id] || fringe_set[adj.id]) continue;
      fringe.push(adj);
      fringe_set[adj.id] = true;
    }
  }

  return grid;
}


// Rotating a cell can power or depower abitrarily many others, so it doesn't make sense to store powered-ness as a property of the cell.  Instead, we build sets of powered node as-needed.
function which_cells_are_powered(grid) {
  const powered = {};
  const queue = [grid.source_cell];
  for(var i = 0; i < queue.length; ++i) {
    var cell = queue[i], adjs = cell.adj, len = adjs.length;
    powered[cell.id] = true;
    for(var dir = 0; dir !== len; ++dir) {
      var adj = adjs[dir];
      if(!adj || !cell.had_current_bidirectional_link(dir)) continue;
      if(powered[adj.id]) continue;
      queue.push(adj);
    }
  }
  return powered;
}


function random_int(max) {
  var r;
  do { r = Math.random(); } while(r == 1.0);
  return Math.floor(r * max);
}


function add_transformed_clone(parent, template_id, transform) {
  const el = svg_templates[template_id].cloneNode(true);
  el.setAttribute('transform', transform);
  parent.appendChild(el);
  return el;
}


const create_grid_functions = {
  sqr: function(width, height, wrap) {
    const cells = new Array(width);

    function connect_adj(a, dir, b) {
      a.adj[dir] = b;
      b.adj[a.invert_direction(dir)] = a;
    }

    var id = 0;
    for(var x = 0; x != width; ++x) {
      cells[x] = new Array(height);
      for(var y = 0; y != height; ++y) cells[x][y] = new Sqr(id++, x, y);
    }
    for(var x = 0; x != width; ++x) {
      for(var y = 0; y != height; ++y) {
        if(y) connect_adj(cells[x][y], 0, cells[x][y - 1]);
        if(x) connect_adj(cells[x][y], 3, cells[x - 1][y]);
      }
    }
    if(wrap) {
      for(var x = 0; x != width; ++x) connect_adj(cells[x][0], 0, cells[x][height - 1]);
      for(var y = 0; y != height; ++y) connect_adj(cells[0][y], 3, cells[width - 1][y]);
    }

    const source = cells[Math.floor(width / 2)][Math.floor(height / 2)];
    source.is_source = true;

    return {
      view_width: width * kTileSize,
      view_height: height * kTileSize,
      cells: Array.concat.apply(null, cells),
      source_cell: source,
    };
  }
};


function Sqr(id, x, y) {
  this.id = id; // numeric nonce
  this.x = x;
  this.y = y;

  // up, right, down, left
  this.adj = [null, null, null, null];
  // 1 or 0, as bools, indicating if this block is linked up, right, down, left, when in its proper orientation.  (i.e. current rotation is not reflected here)
  this.links = [0, 0, 0, 0];
}
Sqr.prototype = {
  is_source: false,

  _rotation: 0, // [0 .. 4)

  add_walls: function(wall_probability) {
    const links = this.links, adj = this.adj;
    if(!links[0] && adj[0] && Math.random() < wall_probability) adj[0].adj[2] = null, adj[0] = null;
    if(!links[3] && adj[3] && Math.random() < wall_probability) adj[3].adj[1] = null, adj[3] = null;
  },

  invert_direction: function(dir) {
    return [2, 3, 0, 1][dir];
  },

  had_current_bidirectional_link: function(dir) {
    return this.has_current_link_to(dir) && this.adj[dir].has_current_link_to(this.invert_direction(dir));
  },

  has_current_link_to: function(dir) {
    dir -= this._rotation;
    if(dir < 0) dir += 4;
    return !!this.links[dir];
  },

  rotate_clockwise: function() {
    this._rotation = [1, 2, 3, 0][this._rotation];
  },

  draw_bg: function() {
    var tv = add_transformed_clone(gridview, 'sqr-tile', 'translate(' + (this.x * kTileSize) + ', ' + (this.y * kTileSize) + ')');
    tv.__cell = this;
  },

  draw_fg: function() {
    const cv = this._view = add_transformed_clone(gridview, 'gg', 'translate(' + (this.x * kTileSize + kTileHalf) + ',' + (this.y * kTileSize + kTileHalf) + ')');
    const inner = cv.firstChild, ls = this.links;
    if(ls[0]) add_transformed_clone(inner, 'sqr-line', '');
    if(ls[1]) add_transformed_clone(inner, 'sqr-line', 'rotate(90)');
    if(ls[2]) add_transformed_clone(inner, 'sqr-line', 'rotate(180)');
    if(ls[3]) add_transformed_clone(inner, 'sqr-line', 'rotate(270)');
    if(ls[0] + ls[1] + ls[2] + ls[3] === 1) add_transformed_clone(inner, 'sqr-node', '');
    if(this.is_source) add_transformed_clone(inner, 'sqr-core', '')
    gridview.appendChild(cv);
    this.redraw(); // to handle the initial random rotation
  },

  redraw: function(x, y) {
    this._view.firstChild.setAttribute('transform', 'rotate(' + (this._rotation * 90) + ')');
  },

  show_powered: function(is_powered) {
    this._view.className.baseVal = is_powered ? 'powered' : '';
  },

  draw_walls: function() {
    const x = this.x, y = this.y, adj = this.adj;
    if(!x && !adj[3]) this._draw_wall('sqr-wall-v', x, y);
    if(!adj[1]) this._draw_wall('sqr-wall-v', x + 1, y);
    if(!y && !adj[0]) this._draw_wall('sqr-wall-h', x, y);
    if(!adj[2]) this._draw_wall('sqr-wall-h', x, y + 1);
  },

  _draw_wall: function(wall, x, y) {
    add_transformed_clone(gridview, wall, 'translate(' + (x * kTileSize) + ', ' + (y * kTileSize) + ')');
  },
};
